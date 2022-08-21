import { defineConfig } from "vite";
import rakkas from "rakkasjs/vite-plugin";
import windicss from "vite-plugin-windicss";
import windicssLineclamp from "windicss/plugin/line-clamp";

// cf. https://github.com/rakkasjs/rakkasjs/blob/b96f08027626b6b61a9baeca0930d9fdf06a2cf3/testbed/kitchen-sink/package.json

export default defineConfig({
  plugins: [
    windicss({
      config: {
        plugins: [windicssLineclamp],
      },
    }),
    rakkas({
      adapter: process.env.APP_RAKKAS_ADAPTER as any,
    }),
  ],
});
