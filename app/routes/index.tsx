import { useQueries } from "@tanstack/react-query";
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
              {
                amebaId: "juicejuice-official",
                theme_id: "10115236106",
                theme_name: "江端妃咲",
                entry_cnt: 378,
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

  // selected data on chart
  const [selected, setSelected] = React.useState<SelectedData>();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
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
          themes={entryQueries
            .map((q) => q.isSuccess && q.data)
            .filter(isTruthy)}
          setSelected={setSelected}
        />
      </div>
      {selected && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
            margin: "0 auto",
          }}
        >
          <a
            href={`https://ameblo.jp/${selected.theme.amebaId}/entry-${selected.entry.entry_id}.html`}
            target="_blank"
            style={{ fontSize: "1.2rem" }}
          >
            {selected.entry.entry_title}
          </a>
          <span>
            {selected.theme.theme_name} ·{" "}
            {selected.entry.entry_created_datetime.slice(0, 10)}
          </span>
          {selected.entry.image_url && (
            <img
              src={`https://stat.ameba.jp${selected.entry.image_url}?cpd=300`}
              height="300"
              width="300"
            />
          )}
        </div>
      )}
    </div>
  );
}

function Chart(props: {
  themes: { theme: ThemeData; entries: EntriesResponse }[];
  countType: CountType;
  setSelected: (value?: SelectedData) => void;
}) {
  const [chart, setChart] = React.useState<echarts.ECharts>();
  const themesDep = props.themes
    .map((t) => t.theme.amebaId + "#" + t.theme.theme_id)
    .join("@");

  // disable dataZoom for mobile
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia(
      "(any-hover: hover) and (any-pointer: fine)"
    );
    const handler = (e: { matches: boolean }) => {
      setIsMobile(!e.matches);
    };
    handler(query);
    query.addEventListener("change", handler);
    return () => {
      query.addEventListener("change", handler);
    };
  }, []);

  React.useEffect(() => {
    if (chart) {
      const handler = (args: any) => {
        const selected: SelectedData = args.data[2];
        props.setSelected(selected);
      };
      chart.on("click", handler);
      return () => {
        chart.off("click", handler);
      };
    }
    return;
  }, [chart, props.countType, themesDep]);

  const option = React.useMemo(() => {
    const option: echarts.EChartsOption = {
      grid: {
        containLabel: true,
        bottom: "10%",
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
        symbol: "circle",
        data: entries.map(
          (entry) =>
            [
              new Date(entry.entry_created_datetime),
              entry[props.countType],
              // sneak-in the data for click and tooltip
              { theme, entry },
            ] as any
        ),
      })),
      legend: {},
      tooltip: {
        trigger: "axis",
        formatter: ([args]: any) => {
          const { theme, entry }: SelectedData = args.data[2];
          const img = entry.image_url
            ? `<img src="https://stat.ameba.jp${entry.image_url}?cpd=200" height="200" width="200" />`
            : "(no image available)";
          return `
            <span style="font-size: 1.1rem;" >${entry.entry_title}</span>
            <table>
              <tbody>
                <tr>
                  <td>theme: </td>
                  <td>${theme.theme_name}</td>
                </tr>
                <tr>
                  <td>date: </td>
                  <td>${entry.entry_created_datetime.slice(0, 10)}</td>
                </tr>
                <tr>
                  <td>${COUNT_TYPE_TO_NAME[props.countType]}: </td>
                  <td>${entry[props.countType]}</td>
                </tr>
              </tbody>
            </table>
            ${img}
          `;
        },
      },
      dataZoom: [
        {
          type: "inside",
          disabled: isMobile,
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
  }, [props.countType, themesDep, isMobile]);

  return (
    <EchartsWrapper
      option={option}
      style={{ width: "100%", height: "400px" }}
      setInstance={setChart}
    />
  );
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
