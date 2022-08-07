import { useQuery } from "@tanstack/react-query";
import React from "react";

export function EchartsWrapper(props: {
  option: echarts.EChartsOption;
  style?: React.CSSProperties;
  setInstance?: (instance?: echarts.ECharts) => void;
}) {
  const ref = React.useRef(null);
  const instance = React.useRef<echarts.ECharts>();

  // dynamic import echarts https://github.com/remix-run/remix/issues/129
  const { data: echarts } = usePromise(() => import("echarts"));

  React.useEffect(() => {
    if (!instance.current && ref.current && echarts) {
      instance.current = echarts.init(ref.current);
      props.setInstance?.(instance.current);
      const handler = () => {
        if (instance.current) {
          instance.current.resize();
        }
      };
      window.addEventListener("resize", handler);
      return () => {
        props.setInstance?.(undefined);
        window.removeEventListener("resize", handler);
        if (instance.current) {
          instance.current.dispose();
          instance.current = undefined;
        }
      };
    }
    return;
  }, [echarts]);

  React.useEffect(() => {
    if (instance.current) {
      instance.current.setOption(props.option, {
        notMerge: true,
        replaceMerge: ["series"],
      });
    }
  }, [echarts, props.option]);

  return <div ref={ref} style={props.style} />;
}

function usePromise<T>(f: () => Promise<T>) {
  return useQuery({
    queryKey: [usePromise.name, f.toString()],
    queryFn: f,
    staleTime: Infinity,
    cacheTime: Infinity,
  });
}
