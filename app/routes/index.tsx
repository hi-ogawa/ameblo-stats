import useLocalStorage from "@rehooks/local-storage";
import { useQueries } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { minBy, sortBy, zip } from "lodash";
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
  // invalidation key for query result
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

  //
  // scroll thumbnail list on chart click
  //
  const [selected, setSelected] = React.useState<number>();

  // reset on chart refresh
  React.useEffect(() => setSelected(undefined), [themeEntries]);

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
        />
      </div>
      <ThumbnailList
        themeEntries={themeEntries}
        countType={countType}
        selected={selected}
      />
    </div>
  );
}

function ThumbnailList(props: {
  themeEntries: {
    theme: ThemeData;
    entries: EntriesResponse;
  }[];
  countType: CountType;
  selected?: number;
}) {
  const flattenEntries = React.useMemo(() => {
    let entries = props.themeEntries.flatMap(({ theme, entries }, themeIndex) =>
      entries.map((entry) => ({ theme, entry, themeIndex }))
    );
    entries = sortBy(entries, (e) => e.entry.entry_created_datetime);
    return entries;
  }, [props.themeEntries]);

  //
  // virtualize list
  //
  const scrollableRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    horizontal: true,
    getScrollElement: () => scrollableRef.current,
    count: Math.ceil(flattenEntries.length / 4),
    estimateSize: () => 100 + 6 + 8, // border 3 + margin 4
    overscan: 10,
  });

  // TODO: no rtl? https://github.com/TanStack/virtual/issues/282. for now, scroll to the end in order to fake rtl
  React.useEffect(() => {
    scrollableRef.current?.scroll({ left: virtualizer.getTotalSize() });
  }, [flattenEntries]);

  //
  // scroll list based on `selected`
  //
  React.useEffect(() => {
    const { selected } = props;
    if (selected) {
      const found = minBy(flattenEntries, (e) =>
        Math.abs(new Date(e.entry.entry_created_datetime).getTime() - selected)
      );
      const index = flattenEntries.findIndex((e) => e === found);
      if (index >= 0) {
        // disable smooth if target is too far
        const target = Math.ceil(index / 4);
        const first = virtualizer.getVirtualItems().at(0);
        const last = virtualizer.getVirtualItems().at(-1);
        const smooth =
          first &&
          last &&
          Math.min(
            Math.abs(target - first.index),
            Math.abs(target - last.index)
          ) < 10;
        virtualizer.scrollToIndex(target, {
          align: "center",
          smoothScroll: smooth,
        });
      }
    }
  }, [props.selected]);

  return (
    <section>
      <div ref={scrollableRef} style={{ overflowX: "auto" }}>
        <div
          style={{
            // layout virtual container
            position: "relative",
            width: `${virtualizer.getTotalSize()}px`,
            height: (100 + 16 + 14 + 4 + 4 + 4 + 6) * 4 + 8 * 3,
          }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const chunk = flattenEntries.slice(
              4 * item.index,
              4 * (item.index + 1)
            );
            return (
              <div
                key={item.key}
                style={{
                  // layout virtual item
                  position: "absolute",
                  top: 0,
                  left: 0,
                  transform: `translateX(${item.start}px)`,
                  width: 100 + 6,
                  margin: "0 4px",
                  // layout inner
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {chunk.map(({ theme, entry, themeIndex }) => (
                  <a
                    key={entry.entry_id}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      paddingTop: "4px",
                      gap: "4px",
                      width: "100px",
                      height: 100 + 16 + 14 + 4 + 4,
                      border: `3px solid ${THEME_COLORS[themeIndex]}`,
                      textDecoration: "none",
                    }}
                    href={`https://ameblo.jp/${theme.amebaId}/entry-${entry.entry_id}.html`}
                    target="_blank"
                  >
                    <span
                      style={{
                        color: "#444",
                        lineHeight: "16px",
                        fontSize: "14px",
                        width: "calc(100% - 4px)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {entry.entry_title}
                    </span>
                    <span
                      style={{
                        color: "#666",
                        lineHeight: "14px",
                        fontSize: "12px",
                      }}
                    >
                      {entry.entry_created_datetime.slice(0, 10)}
                    </span>
                    <img
                      src={
                        entry.image_url
                          ? `https://stat.ameba.jp${entry.image_url}?cpd=100`
                          : PLACEHOLDER_IMAGE_URL
                      }
                      srcSet={
                        entry.image_url
                          ? `https://stat.ameba.jp${entry.image_url}?cpd=100 1x, https://stat.ameba.jp${entry.image_url}?cpd=200 2x`
                          : undefined
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
              </div>
            );
          })}
        </div>
      </div>
    </section>
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
  setSelected: (value?: number) => void;
}) {
  const [chart, setChart] = React.useState<echarts.ECharts>();

  // extract tooltip position by hacking the internal
  React.useEffect(() => {
    if (chart) {
      const handleTooltipPosition = () => {
        const views: any[] = (chart as any)._componentsViews;
        const view = views.find((v) => v.type === "tooltip");
        if (view.__alive) {
          const value = view?._cbParamsList?.[0]?.axisValue;
          if (value) {
            props.setSelected(value);
          }
        }
      };
      chart.on("click", handleTooltipPosition);
      return () => {
        chart.off("click", handleTooltipPosition);
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
        triggerLineEvent: true,
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
          // hide tooltip on mobile since layout becomes odd (NOTE: cannot use `show: isHoverDevice` since we use the existence of tooltip for `handleTooltipPosition` above)
          if (!isHoverDevice) {
            return "";
          }
          const { theme, entry }: SelectedData = args.data[2];
          const datetime = entry.entry_created_datetime.slice(0, 10);
          const imgSrc = entry.image_url
            ? `https://stat.ameba.jp${entry.image_url}?cpd=200`
            : PLACEHOLDER_IMAGE_URL;
          // NOTE: image flickers during mouseover when devtool is open
          const img = `<img src="${imgSrc}" style="width: 200px; height: 200px; object-fit: cover;" />`;
          return `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; width: 250px;">
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
          // this year as a default range
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
