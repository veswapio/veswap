import { defineConfig } from "vite";
import * as child from "child_process";
import cssnano from "cssnano";
import react from "@vitejs/plugin-react-swc";
import commonjs from "vite-plugin-commonjs";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import svgr from "vite-plugin-svgr";

const commitHash = child.execSync("git rev-parse --short HEAD").toString();

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash)
  },
  server: {
    port: 3000
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /src\/sdk/],
      requireReturnsDefault: "auto",
      transformMixedEsModules: true
    }
  },
  plugins: [
    commonjs(),
    nodePolyfills(),
    react(),
    svgr({
      include: "./src/assets/**/*.svg?react",
      svgrOptions: {
        dimensions: false,
        plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"]
      }
    })
  ],
  css: {
    modules: {
      generateScopedName: "[local]-[hash:base64:4]"
    },
    postcss: {
      plugins: [
        cssnano({
          preset: ["cssnano-preset-advanced", {}]
        })
      ]
    },
    preprocessorOptions: {
      scss: {
        additionalData: `@use "~/styles/common" as *;`
      }
    }
  },
  resolve: {
    alias: [{ find: "~", replacement: "/src" }]
  }
});
