import { useQueries } from "@tanstack/react-query";
import { sortBy, zip } from "lodash";
import React from "react";
import { useForm } from "react-hook-form";
import ReactSelect from "react-select";
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

const DEFAULT_AMEBA_ID_OPTIONS = [
  "ocha-norma",
  "juicejuice-official",
  "morningmusume-9ki",
];

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
  const form = useForm<FormType>({
    // pre-fill inputs for quick development
    defaultValues:
      process.env.NODE_ENV == "development"
        ? {
            amebaIds: ["ocha-norma", "juicejuice-official"] as string[],
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
    let entries = themeEntries.flatMap(({ theme, entries }) =>
      entries.map((entry) => ({ theme, entry }))
    );
    entries = sortBy(entries, (e) => e.entry.entry_created_datetime);
    return entries;
  }, [entryQueriesDep]);

  // selected data on chart
  const [selectedRaw, setSelected] = React.useState<SelectedData>();
  const selected = useDebounce(selectedRaw, 300);

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
              value={amebaIds.map((value) => ({ label: value, value }))}
              options={DEFAULT_AMEBA_ID_OPTIONS.map((value) => ({
                label: value,
                value,
              }))}
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
        />
      </div>
      {/* TODO: virtual list */}
      <section style={{}}>
        <div style={{ overflowX: "auto" }} id="--thumbnail-grid-scrollable--">
          <div
            style={{
              display: "grid",
              gridAutoFlow: "column",
              gridTemplateRows: "repeat(4, 1fr)",
              gap: "8px",
            }}
          >
            {/* TODO: highlight "selected" entry */}
            <ThumbnailGridInner
              entries={flattenEntries}
              countType={countType}
              selectedEntryId={selected?.entry.entry_id}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

const ThumbnailGridInner = React.memo(ThumbnailGridInnerImpl);
function ThumbnailGridInnerImpl(props: {
  entries: { theme: ThemeData; entry: Entry }[];
  countType: CountType;
  selectedEntryId?: number;
}) {
  // TODO: color border by chart line color?
  return (
    <>
      {props.entries.map(({ theme, entry }) => (
        <a
          key={entry.entry_id}
          style={{
            position: "relative",
            // TODO: better way to highlight "selected" entry
            transitionProperty: "filter",
            transitionDuration: "300ms",
            ...(entry.entry_id === props.selectedEntryId
              ? { filter: "brightness(1.2)" }
              : {}),
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
              right: "2px",
              bottom: "4px",
              padding: "2px 4px",
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

function Chart(props: {
  themes: { theme: ThemeData; entries: EntriesResponse }[];
  countType: CountType;
  setSelected: (value?: SelectedData) => void;
}) {
  const [_chart, setChart] = React.useState<echarts.ECharts>();

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
      series: props.themes.map(({ theme, entries }) => ({
        name: theme.theme_name,
        type: "line",
        symbol: "none",
        emphasis: {
          disabled: true,
        },
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
          props.setSelected({ theme, entry });
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
          startValue: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          endValue: new Date(),
        },
        {
          startValue: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
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

//
// hooks
//

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
