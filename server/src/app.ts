import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppDb } from "./db/client";
import type { Env } from "./env";
import { areasRoute } from "./routes/areas";
import { careersRoute } from "./routes/careers";
import { jevRoute } from "./routes/jev";
import { roiRoute } from "./routes/roi";
import { swipesRoute } from "./routes/swipes";

export function allowedOrigins(env: Env): string[] {
  return (env.CORS_ORIGINS ?? "https://careerality.app")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function createApp(db: AppDb, env: Env) {
  const app = new Hono<{ Bindings: Env }>();
  const allowlist = allowedOrigins(env);

  // Mirrors Rails rack-cors: explicit origin allowlist + credentials.
  app.use(
    "*",
    cors({
      origin: (origin) =>
        typeof origin === "string" && allowlist.includes(origin)
          ? origin
          : undefined,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
      credentials: true,
    }),
  );

  app.route("/api/careers", careersRoute(db));
  app.route("/api/roi", roiRoute(db));
  app.route("/api/swipes", swipesRoute(db));
  app.route("/api/areas", areasRoute(db));
  app.route("/api/jev", jevRoute(db));

  app.get("/up", (c) => c.json({ status: "ok" }));
  app.get("/", (c) => c.json({ status: "ok" }));

  app.notFound((c) => c.json({ error: "Not found" }, 404));

  return app;
}
