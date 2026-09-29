import { describe, expect, it } from "vitest";
import app, { type Env } from "../worker/index";

describe("request observability", () => {
  it("adds a correlation ID to Worker responses", async () => {
    const bindings = { ENVIRONMENT: "test" } as Env["Bindings"];
    const response = await app.request("http://localhost/api/health", {}, bindings);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
    await expect(response.json()).resolves.toMatchObject({ ok: true, environment: "test" });
  });

  it("accepts privacy-safe performance telemetry", async () => {
    const bindings = { ENVIRONMENT: "test" } as Env["Bindings"];
    const response = await app.request("http://localhost/api/telemetry/performance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/shop", navigationType: "navigate", ttfbMs: 120, lcpMs: 860, cls: 0.04, inpMs: 80 }),
    }, bindings);
    expect(response.status).toBe(204);
  });

  it("rejects malformed performance telemetry", async () => {
    const bindings = { ENVIRONMENT: "test" } as Env["Bindings"];
    const response = await app.request("http://localhost/api/telemetry/performance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/shop", ttfbMs: -1 }),
    }, bindings);
    expect(response.status).toBe(400);
  });

});
