import { build } from "esbuild";

// Externalize real npm packages (resolved from node_modules at runtime / traced by
// Vercel), but bundle workspace packages (@platform/*) and relative source — those
// export raw .ts and must be compiled into the output.
const externalizeNodeModules = {
  name: "externalize-node-modules",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === "entry-point") return;
      const isRelative = args.path.startsWith(".") || args.path.startsWith("/");
      const isWorkspace = args.path.startsWith("@platform/");
      if (!isRelative && !isWorkspace) {
        return { path: args.path, external: true };
      }
      return undefined;
    });
  },
};

await build({
  entryPoints: ["src/serverless.ts"],
  outfile: "dist/serverless.cjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  sourcemap: false,
  // NestJS uses legacy decorators; explicit @Inject() tokens mean no metadata is needed.
  tsconfig: "tsconfig.json",
  plugins: [externalizeNodeModules],
  logLevel: "info",
});

console.log("[esbuild] bundled services/api/dist/serverless.cjs");
