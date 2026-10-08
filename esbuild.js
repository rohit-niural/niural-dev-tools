import { context } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** Copies the files Chrome loads verbatim into the bundle output directory. */
const copyStaticPlugin = {
  name: "copy-static",
  setup(build) {
    build.onEnd(async () => {
      await mkdir("dist", { recursive: true });
      await copyFile("manifest.json", "dist/manifest.json");
      await copyFile("src/popup.html", "dist/popup.html");
      console.log("[build] finished");
    });
  },
};

const ctx = await context({
  entryPoints: ["src/background.ts", "src/popup.ts"],
  bundle: true,
  format: "esm",
  target: "chrome120",
  outdir: "dist",
  minify: production,
  sourcemap: !production,
  logLevel: "info",
  plugins: [copyStaticPlugin],
});

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
