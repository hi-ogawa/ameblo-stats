import { defineConfig } from "vite";
import rakkas from "rakkasjs/vite-plugin";

// cf. https://github.com/rakkasjs/rakkasjs/blob/b96f08027626b6b61a9baeca0930d9fdf06a2cf3/testbed/kitchen-sink/package.json

export default defineConfig({
  plugins: [rakkas({ adapter: "node" })],
});
