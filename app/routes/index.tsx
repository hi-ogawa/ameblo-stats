import useLocalStorage from "@rehooks/local-storage";
import { useQueries } from "@tanstack/react-query";
import { sortBy, zip } from "lodash";
import React from "react";
import { useForm } from "react-hook-form";
import ReactSelect, { OptionProps, components } from "react-select";
import ReactSelectCreatable from "react-select/creatable";
import { EchartsWrapper } from "../components/echarts-wrapper";
import { NoSSR } from "../components/no-ssr";
import { Spinner } from "../components/spinner";
import {
  COUNT_TYPES,
  COUNT_TYPE_TO_NAME,
  CountType,
  Entry,
  ThemeData,
} from "../utils/ameblo";
import { fetchJson, isTruthy } from "../utils/misc";
import { PLACEHOLDER_IMAGE_URL } from "../utils/placeholder";
import { EntriesResponse } from "./entries";
import { ThemesResponse } from "./themes";

//
// components
//

interface FormType {
  amebaIds: string[];
  selectedThemes: ThemeData[];
  countType: CountType;
}

interface SelectedData {
  theme: ThemeData;
  entry: Entry;
}

export default function PageComponent() {
  // persist ameba ids users have entered
  const [amebaIdOptions, setAmebaIdOptions] = usePersistedAmebaIdOptions();

  const form = useForm<FormType>({
    // pre-fill inputs for quick development
    defaultValues:
      process.env.NODE_ENV == "development"
        ? {
            amebaIds: ["ocha-norma"],
            selectedThemes: [
              {
                amebaId: "ocha-norma",
                theme_id: "10116081607",
                theme_name: "中山夏月姫",
                entry_cnt: 214,
              },
            ],
            countType: "commentCnt",
          }
        : {
            amebaIds: [],
            selectedThemes: [],
            countType: "commentCnt",
          },
  });
  const { amebaIds, selectedThemes, countType } = form.watch();

  //
  // fetch themes
  //
  const themeQueries = useThemes(amebaIds);
  const themeOptions = themeQueries
    .map(
      (q) =>
        q.isSuccess && {
          label: q.data.amebaId,
          options: q.data.themes.map((t) => ({
            label: t.theme_name,
            value: t,
          })),
        }
    )
    .filter(isTruthy);

  //
  // fetch stats
  //
  const entryQueries = useEntries(selectedThemes);
  // invalidate effect based on the query result identity
  const entryQueriesDep = JSON.stringify(
    zip(selectedThemes, entryQueries).map(([t, q]) => [
      t?.amebaId,
      t?.theme_id,
      q?.status,
    ])
  );
  const themeEntries = React.useMemo(
    () => entryQueries.map((q) => q.isSuccess && q.data).filter(isTruthy),
    [entryQueriesDep]
  );
  const flattenEntries = React.useMemo(() => {
    let entries = themeEntries.flatMap(({ theme, entries }, themeIndex) =>
      entries.map((entry) => ({ theme, entry, themeIndex }))
    );
    entries = sortBy(entries, (e) => e.entry.entry_created_datetime);
    return entries;
  }, [entryQueriesDep]);

  // selected data on chart
  const [selectedRaw, setSelected] = React.useState<SelectedData>();
  const selected = useDebounce(selectedRaw, 300);

  // track chart zoom range to synchronize thumbnail grid
  const [zoomRange, setZoomRange] = React.useState<[number, number]>();

  // scroll thumbnail grid based on tooltip
  React.useEffect(() => {
    if (selected) {
      const index = flattenEntries.findIndex(
        (e) => e.entry.entry_id === selected.entry.entry_id
      );
      if (index >= 0) {
        const scrollable = document.querySelector(
          "#--thumbnail-grid-scrollable--"
        )!;
        const target = scrollable.querySelector(
          `div > :nth-child(${index + 1})`
        )!;
        scrollToTarget(scrollable as any, target as any);
      }
    }
  }, [selected]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {/* TODO: make "form" hideable (e.g. sidebar) */}
      <div
        style={{
          width: "800px",
          maxWidth: "100%",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          padding: "1rem 0", // HACK: horizontal padding is moved to children
          gap: "0.8rem",
          border: "1px solid lightgray",
        }}
      >
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.3rem",
            padding: "0 1rem",
          }}
        >
          <span>Ameba ID</span>
          <NoSSR fallback={<div style={{ height: "38px" }}></div>}>
            <ReactSelectCreatable
              isMulti
              placeholder="Enter IDs"
              components={{ Option: CustomAmebaIdOption }}
              value={amebaIds.map((value) => ({ label: value, value }))}
              options={amebaIdOptions.map((value) => ({
                label: value,
                value,
              }))}
              onCreateOption={(created) => {
                form.setValue("amebaIds", [...amebaIds, created]);
                if (!amebaIdOptions.includes(created)) {
                  setAmebaIdOptions([...amebaIdOptions, created]);
                }
              }}
              onChange={(selected) => {
                form.setValue(
                  "amebaIds",
                  selected.map((s) => s.value)
                );
              }}
            />
          </NoSSR>
        </label>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.3rem",
            padding: "0 1rem",
          }}
        >
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <span>Themes</span>
            {themeQueries.some((query) => query.isLoading) && (
              <Spinner size="12px" />
            )}
          </div>
          <NoSSR fallback={<div style={{ height: "38px" }}></div>}>
            <ReactSelect
              isMulti
              placeholder="Select Themes"
              value={selectedThemes.map((t) => ({
                label: t.theme_name,
                value: t,
              }))}
              options={themeOptions}
              onChange={(selected) => {
                form.setValue(
                  "selectedThemes",
                  (selected as any[]).map((s) => s.value)
                );
              }}
            />
          </NoSSR>
        </label>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.3rem",
            padding: "0 1rem",
          }}
        >
          <span>Count type</span>
          <select {...form.register("countType")}>
            {COUNT_TYPES.map((value) => (
              <option key={value} value={value}>
                {COUNT_TYPE_TO_NAME[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ position: "relative", width: "100%" }}>
        {entryQueries.some((q) => q.isLoading) && (
          <div style={{ position: "absolute", right: "2rem", top: "1rem" }}>
            <Spinner size="24px" />
          </div>
        )}
        <Chart
          countType={countType}
          themes={themeEntries}
          setSelected={setSelected}
          setZoomRange={setZoomRange}
        />
      </div>
      {/* TODO: virtual list */}
      <section>
        <div style={{ overflowX: "auto" }} id="--thumbnail-grid-scrollable--">
          <div
            style={{
              display: "grid",
              gridAutoFlow: "column",
              gridTemplateRows: "repeat(4, 1fr)",
              gap: "8px",
              // direction: "rtl",
            }}
          >
            <ThumbnailGridInner
              entries={flattenEntries}
              countType={countType}
              selectedEntryId={selected?.entry.entry_id}
              rangeStart={zoomRange?.[0]}
              rangeEnd={zoomRange?.[1]}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

const ThumbnailGridInner = React.memo(ThumbnailGridInnerImpl);

function ThumbnailGridInnerImpl(props: {
  entries: { theme: ThemeData; entry: Entry; themeIndex: number }[];
  countType: CountType;
  selectedEntryId?: number;
  rangeStart?: number;
  rangeEnd?: number;
}) {
  // const entries = [...props.entries].reverse();
  const entries = props.entries;
  // props.rangeStart
  // const entries = props.entries.filter(
  //   (e) =>
  //     !(props.rangeStart && props.rangeEnd) ||
  //     (props.rangeStart <= new Date(e.entry.entry_created_datetime).getTime() &&
  //       props.rangeEnd >= new Date(e.entry.entry_created_datetime).getTime())
  // );
  return (
    <>
      {entries.map(({ theme, entry, themeIndex }) => (
        <a
          key={entry.entry_id}
          style={{
            position: "relative",
            overflow: "hidden",
            width: "100px",
            height: "100px",
            border: `3px solid ${THEME_COLORS[themeIndex]}`,
          }}
          href={`https://ameblo.jp/${theme.amebaId}/entry-${entry.entry_id}.html`}
          target="_blank"
          title={entry.entry_title}
        >
          {/* TODO: lazy load on viewport? */}
          <img
            src={
              entry.image_url
                ? `https://stat.ameba.jp${entry.image_url}?cpd=100`
                : PLACEHOLDER_IMAGE_URL
            }
            style={{
              width: "100px",
              height: "100px",
              objectFit: "cover",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: "1px",
              bottom: "1px",
              padding: "1px 3px",
              borderRadius: "4px",
              background: "rgba(0, 0, 0, 0.75)",
              color: "#fff",
              fontSize: "14px",
            }}
          >
            {entry[props.countType]}
          </div>
        </a>
      ))}
    </>
  );
}

function CustomAmebaIdOption(props: OptionProps<any>) {
  const [amebaIdOptions, setAmebaIdOptions] = usePersistedAmebaIdOptions();
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <components.Option {...props} />
      <span
        style={{
          flex: "none",
          cursor: "pointer",
          margin: "0 4px",
          color: "#444",
          transform: "scale(0.8)",
        }}
        onClick={(e) => {
          e.preventDefault();
          const idToRemove = (props as any).value;
          setAmebaIdOptions(amebaIdOptions.filter((id) => id !== idToRemove));
        }}
      >
        {/* https://feathericons.com/?query=close */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </span>
    </div>
  );
}

function Chart(props: {
  themes: { theme: ThemeData; entries: EntriesResponse }[];
  countType: CountType;
  setSelected: (value?: SelectedData) => void;
  setZoomRange: (value: [number, number]) => void;
}) {
  const [chart, setChart] = React.useState<echarts.ECharts>();

  React.useEffect(() => {
    if (chart) {
      const handler = () => {
        // extract zoom range by hacking the internal
        const views: any[] = (chart as any)._componentsViews;
        const view = views.find(
          (v) => v.constructor.name === "SliderZoomView2"
        );
        const d0 = view.dataZoomModel.option.startValue;
        const d1 = view.dataZoomModel.option.endValue;
        props.setZoomRange([d0, d1]);
      };
      chart.on("finished", handler);
      return () => {
        chart.off("finished", handler);
      };
    }
    return;
  }, [chart, props.countType, props.themes]);

  // tweak dataZoom for mobile
  const isHoverDevice = useIsHoverDevice();

  const option = React.useMemo(() => {
    const option: echarts.EChartsOption = {
      grid: {
        containLabel: true,
        bottom: "45px",
        left: "2%",
        right: "2%",
        top: "5%",
      },
      xAxis: {
        type: "time",
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
      },
      series: props.themes.map(({ theme, entries }, i) => ({
        name: theme.theme_name,
        type: "line",
        symbol: "none",
        emphasis: {
          disabled: true,
        },
        color: THEME_COLORS[i],
        data: entries.map(
          (entry) =>
            [
              new Date(entry.entry_created_datetime),
              entry[props.countType],
              // sneak in raw data for click and tooltip
              { theme, entry },
            ] as any
        ),
      })),
      legend: {},
      tooltip: {
        trigger: "axis",
        formatter: ([args]: any) => {
          const { theme, entry }: SelectedData = args.data[2];
          // props.setSelected({ theme, entry });
          // hide tooltip on mobile
          if (!isHoverDevice) {
            return "";
          }
          const datetime = entry.entry_created_datetime.slice(0, 10);
          const imgSrc = entry.image_url
            ? `https://stat.ameba.jp${entry.image_url}?cpd=200`
            : PLACEHOLDER_IMAGE_URL;
          const img = `<img src="${imgSrc}" style="width: 200px; height: 200px; object-fit: cover;" />`;
          return `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; width: 250px">
              <span style="font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">
                ${entry.entry_title}
              </span>
              <span style="color: gray">
                ${theme.theme_name} · ${datetime} (${entry[props.countType]})
              </span>
              ${img}
            </div>
          `;
        },
      },
      dataZoom: [
        {
          type: "inside",
          moveOnMouseMove: isHoverDevice,
          // default range is between a month ago and now
          startValue: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endValue: new Date(),
        },
        {
          startValue: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endValue: new Date(),
        },
      ],
    };
    return option;
  }, [props.countType, props.themes, isHoverDevice]);

  return (
    <EchartsWrapper
      option={option}
      style={{ width: "100%", height: "250px" }}
      setInstance={setChart}
    />
  );
}

//
// utils
//

function scrollToTarget(scrollable: HTMLElement, target: HTMLElement) {
  const hp = scrollable.clientWidth;
  const hc = target.clientWidth;
  const op = scrollable.offsetLeft;
  const oc = target.offsetLeft;
  scrollable.scroll({ left: oc - op + hc / 2 - hp / 2, behavior: "smooth" });
}

// https://github.com/apache/echarts/blob/1fb0d6f1c2d5a6084198bbc2a1b928df66abbaab/src/model/globalDefault.ts#L37-L47
const THEME_COLORS = [
  "#5470c6",
  "#91cc75",
  "#fac858",
  "#ee6666",
  "#73c0de",
  "#3ba272",
  "#fc8452",
  "#9a60b4",
  "#ea7ccc",
];

//
// hooks
//

function usePersistedAmebaIdOptions() {
  return useLocalStorage<string[]>("ameba-id-options-v1", []);
}

function useThemes(amebaIds: string[]) {
  return useQueries({
    queries: amebaIds.map((amebaId) => ({
      queryKey: ["themes", amebaId],
      queryFn: async () => {
        const data: ThemesResponse = await fetchJson(
          "/themes?" + new URLSearchParams({ amebaId })
        );
        return { amebaId, themes: data };
      },
      onError: () => {
        window.alert(`failed to retrive data for '${amebaId}'`);
      },
    })),
  });
}

function useEntries(themes: ThemeData[]) {
  return useQueries({
    queries: themes.map((t) => ({
      queryKey: ["entries", t],
      queryFn: async () => {
        const data: EntriesResponse = await fetchJson(
          "/entries?" +
            new URLSearchParams({ amebaId: t.amebaId, themeId: t.theme_id })
        );
        return { theme: t, entries: data };
      },
      onError: () => {
        window.alert(
          `failed to retrive data for '${t.amebaId} / ${t.theme_name}'`
        );
      },
    })),
  });
}

function useIsHoverDevice(): boolean {
  const [ok, setOk] = React.useState(true);
  React.useEffect(() => {
    const query = window.matchMedia(
      "(any-hover: hover) and (any-pointer: fine)"
    );
    const handler = (e: { matches: boolean }) => {
      setOk(e.matches);
    };
    handler(query);
    query.addEventListener("change", handler);
    return () => {
      query.addEventListener("change", handler);
    };
  }, []);
  return ok;
}

function useDebounce<T>(value: T, msec: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedValue(value);
    }, msec);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [value, msec]);

  return debouncedValue;
}
