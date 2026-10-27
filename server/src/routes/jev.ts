import { Hono } from "hono";
import type { AppDb } from "../db/client";
import type { Env } from "../env";
import { MAX_CANDIDATES, rank } from "../lib/jev";

export function jevRoute(db: AppDb) {
  const app = new Hono<{ Bindings: Env }>();

  // POST /api/jev/rank — ranks candidate careers for the Discover feed.
  // Falls back gracefully when TYPESAFE_API_KEY is missing (see lib/jev).
  //
  // Bounded: the state payload sent to TypeSafe grows with the candidate
  // set, so oversized requests are rejected instead of fanning out.
  app.post("/rank", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const swipes = Array.isArray(body?.swipes) ? body.swipes : [];
    const candidates = Array.isArray(body?.candidates)
      ? body.candidates
      : [];
    if (candidates.length > MAX_CANDIDATES) {
      return c.json(
        { error: `too many candidates (max ${MAX_CANDIDATES})` },
        422,
      );
    }
    const results = await rank(db, c.env, swipes, candidates);
    return c.json({ results });
  });

  return app;
}
