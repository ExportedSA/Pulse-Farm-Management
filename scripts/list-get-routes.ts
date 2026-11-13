// Prints every GET route under /api, one per line (used to smoke-test the API)
// Usage: npx tsx scripts/list-get-routes.ts
import "dotenv/config";
import express from "express";
// server/ is a CommonJS package, so its exports arrive on the default import
import routesModule from "../server/routes.ts";
const { registerRoutes } = routesModule as any;

function mountOf(layer: any): string {
  if (layer.regexp?.fast_slash) return "";
  const path = (layer.regexp?.source ?? "").replace(/^\^/, "").replace(/\\\/\?\(\?=\\\/\|\$\)$/i, "").replace(/\\\//g, "/");
  return /[()[\]|?*+]/.test(path) ? "" : path;
}

function walk(stack: any[], prefix = ""): string[] {
  return stack.flatMap((l: any) => l.route && typeof l.route.path === "string"
    ? (l.route.methods.get ? [prefix + l.route.path] : [])
    : l.name === "router" && l.handle?.stack ? walk(l.handle.stack, prefix + mountOf(l)) : []);
}

const app = express();
registerRoutes(app).then(() => {
  console.log(Array.from(new Set(walk((app as any)._router.stack).filter(p => p.startsWith("/api")))).join("\n"));
  process.exit(0);
});
