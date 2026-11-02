import { Hono } from "hono";
import type { AppDb } from "../db/client";
import type { Env } from "../env";
import { MAX_CANDIDATES, rank, type RankLookup } from "../lib/jev";

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
    // Optional local-bundle enrichment from newer app clients. Absent or
    // malformed values behave exactly like the legacy shape (D1 enrichment).
    const lookup: RankLookup = {};
    if (
      body?.careerLookup != null &&
      typeof body.careerLookup === "object" &&
      !Array.isArray(body.careerLookup)
    ) {
      lookup.careerLookup = body.careerLookup as Record<string, unknown>;
    }
    if (
      body?.candidateNames != null &&
      typeof body.candidateNames === "object" &&
      !Array.isArray(body.candidateNames)
    ) {
      lookup.candidateNames = body.candidateNames as Record<string, unknown>;
    }
    const results = await rank(db, c.env, swipes, candidates, lookup);
    return c.json({ results });
  });

  return app;
}
