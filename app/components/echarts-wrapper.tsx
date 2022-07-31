import * as echarts from "echarts";
import React from "react";

export function EchartsWrapper(props: {
  option: echarts.EChartsOption;
  style?: React.CSSProperties;
  setInstance?: (instance?: echarts.ECharts) => void;
}) {
  const ref = React.useRef(null);
  const instance = React.useRef<echarts.ECharts>();

  React.useEffect(() => {
    if (!instance.current && ref.current) {
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
  }, []);

  React.useEffect(() => {
    if (instance.current) {
      console.log(props.option);
      instance.current.setOption(props.option, {
        notMerge: true,
        replaceMerge: ["series"],
      });
    }
  }, [props.option]);

  return <div ref={ref} style={props.style} />;
}
