import { describe, expect, test } from "vitest";
import { body, createTestDb, testApp, testEnv } from "./setup";

describe("app shell", () => {
  test("health checks respond", async () => {
    const { db } = await createTestDb();
    const app = testApp(db);
    expect((await app.request("/up", {}, testEnv)).status).toBe(200);
    expect((await app.request("/", {}, testEnv)).status).toBe(200);
    expect((await app.request("/nope", {}, testEnv)).status).toBe(404);
  });

  test("CORS reflects allowlisted origins and blocks others", async () => {
    const { db } = await createTestDb();
    const app = testApp(db);
    const ok = await app.request(
      "/up",
      { headers: { Origin: "https://careerality.app" } },
      testEnv,
    );
    expect(ok.headers.get("access-control-allow-origin")).toBe(
      "https://careerality.app",
    );
    const blocked = await app.request(
      "/up",
      { headers: { Origin: "https://evil.test" } },
      testEnv,
    );
    expect(blocked.headers.get("access-control-allow-origin")).toBeNull();
  });
});
