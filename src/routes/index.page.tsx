import { useLocalStorage } from "@rehooks/local-storage";
import { useQueries } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { chunk, minBy, sortBy, zip } from "lodash";
import React from "react";
import { useForm } from "react-hook-form";
import ReactSelect, { OptionProps, components } from "react-select";
import ReactSelectCreatable from "react-select/creatable";
import { EchartsWrapper } from "../components/echarts-wrapper";
import { Modal } from "../components/modal";
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
import { EntriesResponse } from "./api/entries.api";
import { ThemesResponse } from "./api/themes.api";

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
    defaultValues: {
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
    <div className="flex flex-col gap-4 py-4">
      {/*  */}
      {/* form */}
      {/*  */}
      {/* TODO: make "form" hideable (e.g. sidebar) */}
      <div
        className="max-w-[800px] mx-auto flex flex-col py-4 gap-4 border border-gray-300"
        style={{ width: "calc(100% - 2rem)" }}
      >
        <label className="flex flex-col gap-1.5 px-4">
          <span>Ameba ID</span>
          <NoSSR fallback={<div className="border rounded-[4px] h-[38px]" />}>
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
        <label className="flex flex-col gap-1.5 px-4">
          <div className="flex items-center gap-2">
            <span>Themes</span>
            {themeQueries.some((query) => query.isLoading) && (
              <Spinner size="18px" />
            )}
          </div>
          <NoSSR fallback={<div className="border rounded-[4px] h-[38px]" />}>
            <ReactSelect
              isMulti
              isSearchable={false}
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
        <label className="flex flex-col gap-1.5 px-4">
          <span>Count type</span>
          <select
            className="border border-gray-300 bg-gray-50"
            {...form.register("countType")}
          >
            {COUNT_TYPES.map((value) => (
              <option key={value} value={value}>
                {COUNT_TYPE_TO_NAME[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {/*  */}
      {/* chart */}
      {/*  */}
      <div className="relative w-full">
        {entryQueries.some((q) => q.isLoading) && (
          <div className="absolute right-8 top-0">
            <Spinner size="24px" />
          </div>
        )}
        <Chart
          countType={countType}
          themes={themeEntries}
          setSelected={setSelected}
        />
      </div>
      {/*  */}
      {/* thumbnails */}
      {/*  */}
      <ThumbnailList
        themeEntries={themeEntries}
        countType={countType}
        selected={selected}
      />
    </div>
  );
}

//
// ThumbnailList
//

// TODO: make it configurable?
const NUM_ROWS = 3;
const ROW_GAP = 8;
const IMAGE_SIZE = 150; // ameblo uses cpd=100, cpd=215, cat=256 (are these expected to be well-cached on CDN?)
const BORDER_SIZE = 2;

function ThumbnailList(props: {
  themeEntries: {
    theme: ThemeData;
    entries: EntriesResponse;
  }[];
  countType: CountType;
  selected?: number;
}) {
  const entries = React.useMemo(() => {
    let entries = props.themeEntries.flatMap(({ theme, entries }, themeIndex) =>
      entries.map((entry) => ({ theme, entry, themeIndex }))
    );
    entries = sortBy(entries, (e) => e.entry.entry_created_datetime);
    return entries;
  }, [props.themeEntries]);

  const entryChunks = chunk(entries, NUM_ROWS);

  //
  // virtualize list
  //
  const scrollableRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    horizontal: true,
    getScrollElement: () => scrollableRef.current,
    count: entryChunks.length,
    estimateSize: () => IMAGE_SIZE + 2 * BORDER_SIZE + 8, // border 3 + margin 4
  });

  // TODO: no rtl? https://github.com/TanStack/virtual/issues/282. for now, scroll to the end in order to fake rtl
  React.useEffect(() => {
    scrollableRef.current?.scroll({ left: virtualizer.getTotalSize() });
  }, [entries]);

  //
  // scroll list based on `selected`
  //
  React.useEffect(() => {
    const { selected } = props;
    if (selected) {
      const found = minBy(entries, (e) =>
        Math.abs(new Date(e.entry.entry_created_datetime).getTime() - selected)
      );
      const index = entries.findIndex((e) => e === found);
      if (index >= 0) {
        // disable smooth if target is too far
        const target = Math.ceil(index / NUM_ROWS);
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

  //
  // modal viewer state (TODO: implement another scrollable virtual list of images inside the modal)
  //
  const [modalImageUrl, setModalImageUrl] = React.useState<string>();
  const isHoverDevice = useIsHoverDevice();

  return (
    <section>
      <div ref={scrollableRef} className="overflow-x-auto">
        <div
          style={{
            // layout virtual container
            position: "relative",
            width: `${virtualizer.getTotalSize()}px`,
            // it's tedious to compute this container height exactly, so just set the large height temporary and then check the actual height via devtool
            // height: "1000px"
            height: "610px",
          }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            return (
              <div
                key={item.key}
                style={{
                  // layout virtual item
                  position: "absolute",
                  top: 0,
                  left: 0,
                  transform: `translateX(${item.start}px)`,
                  width: IMAGE_SIZE + 2 * BORDER_SIZE,
                  margin: "0 4px",
                  // layout inner
                  display: "flex",
                  flexDirection: "column",
                  gap: ROW_GAP,
                }}
              >
                {entryChunks[item.index].map(({ theme, entry, themeIndex }) => (
                  <a
                    className="entry-item"
                    key={entry.entry_id}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "2px",
                      width: IMAGE_SIZE + 2 * BORDER_SIZE,
                      border: `${BORDER_SIZE}px solid ${THEME_COLORS[themeIndex]}`,
                      textDecoration: "none",
                    }}
                    href={`https://ameblo.jp/${theme.amebaId}/entry-${entry.entry_id}.html`}
                    target="_blank"
                    title={entry.entry_title}
                  >
                    <span className="m-0.5 text-sm text-gray-700 line-clamp-1">
                      {entry.entry_title}
                    </span>
                    <span className="text-xs text-gray-500">
                      {entry.entry_created_datetime.slice(0, 10)}
                    </span>
                    <div
                      className="relative"
                      style={{ width: IMAGE_SIZE, height: IMAGE_SIZE }}
                    >
                      <img
                        src={
                          entry.image_url
                            ? `https://stat.ameba.jp${entry.image_url}?cpd=${IMAGE_SIZE}`
                            : PLACEHOLDER_IMAGE_URL
                        }
                        srcSet={
                          entry.image_url
                            ? `https://stat.ameba.jp${
                                entry.image_url
                              }?cpd=${IMAGE_SIZE} 1x, https://stat.ameba.jp${
                                entry.image_url
                              }?cpd=${IMAGE_SIZE * 2} 2x`
                            : undefined
                        }
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                      {entry.image_url && (
                        <div
                          className="entry-item__zoom-icon absolute right-0.5 top-1 p-0.5 rounded bg-black/75 text-gray-200 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setModalImageUrl(entry.image_url);
                          }}
                          dangerouslySetInnerHTML={{
                            // https://feathericons.com/?query=zoom-in
                            __html: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-zoom-in"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>`,
                          }}
                        />
                      )}
                    </div>
                    <div className="absolute right-0.5 bottom-0.5 px-1 rounded bg-black/75 text-xs text-white">
                      {entry[props.countType]}
                    </div>
                  </a>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <Modal
        open={Boolean(modalImageUrl)}
        onClose={() => setModalImageUrl(undefined)}
        render={(getProps) => (
          <div className="h-full flex justify-center items-center p-4">
            <img
              {...getProps()}
              className="max-h-full max-w-full flex-none"
              src={"https://stat.ameba.jp" + modalImageUrl}
            />
          </div>
        )}
      />
      <style>{`
        .entry-item__zoom-icon {
          opacity: ${isHoverDevice ? 0 : 1};
          transition-property: opacity;
          transition-duration: 250ms;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }
        .entry-item:hover .entry-item__zoom-icon {
          opacity: 1;
        }
      `}</style>
    </section>
  );
}

//
// CustomAmebaIdOption
//

function CustomAmebaIdOption(props: OptionProps<any>) {
  const [amebaIdOptions, setAmebaIdOptions] = usePersistedAmebaIdOptions();
  return (
    <div className="flex items-center">
      <components.Option {...props} />
      <span
        className="flex-none cursor-pointer mx-1 text-gray-400 hover:text-gray-600"
        onClick={(e) => {
          e.preventDefault();
          const idToRemove = (props as any).value;
          setAmebaIdOptions(amebaIdOptions.filter((id) => id !== idToRemove));
        }}
        dangerouslySetInnerHTML={{
          // https://feathericons.com/?query=close
          __html: `
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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
        `,
        }}
      />
    </div>
  );
}

//
// Chart
//

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
          "/api/themes?" + new URLSearchParams({ amebaId })
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
          "/api/entries?" +
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
  return useMatchMedia("(any-hover: hover) and (any-pointer: fine)");
}

function useMatchMedia(query: string): boolean {
  const [ok, setOk] = React.useState(true);
  React.useEffect(() => {
    const result = window.matchMedia(query);
    const handler = (e: { matches: boolean }) => {
      setOk(e.matches);
    };
    handler(result);
    result.addEventListener("change", handler);
    return () => {
      result.addEventListener("change", handler);
    };
  }, []);
  return ok;
}
