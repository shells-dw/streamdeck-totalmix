import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

const sdPlugin = "de.shells.totalmix.sdPlugin";

export default {
    input: "src/plugin.ts",
    output: {
        file: `${sdPlugin}/bin/plugin.js`,
        format: "es",
        sourcemap: true,
        sourcemapPathTransform: (p, m) =>
            p.replace(m, `../../${sdPlugin}/bin/`).replaceAll("\\", "/"),
    },
    external: ["node:dgram", "node:events"],
    // Node 20 (what Stream Deck ships) does not auto-detect ESM, so bin/plugin.js
    // would be loaded as CommonJS and crash on the first import statement unless a
    // package.json declaring "type": "module" sits inside the plugin folder.
    plugins: [
        typescript({ tsconfig: "./tsconfig.json", exclude: ["**/*.test.ts"] }),
        nodeResolve({ browser: false, exportConditions: ["node"] }),
        commonjs(),
    ],
};
