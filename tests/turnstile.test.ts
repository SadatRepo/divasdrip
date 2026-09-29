import { describe, expect, it, vi } from "vitest";
import { isTurnstileConfigured, verifyTurnstile } from "../worker/services/turnstile";

describe("Turnstile verification", () => {
  it("bypasses only when no real secret is configured", async () => {
    const fetcher = vi.fn();
    expect(isTurnstileConfigured("replace-with-your-turnstile-secret")).toBe(false);
    expect(await verifyTurnstile(undefined, undefined, fetcher)).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects a configured secret without a token", async () => {
    const fetcher = vi.fn();
    expect(await verifyTurnstile("real-secret", undefined, fetcher)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("accepts and rejects the provider response", async () => {
    const successFetcher = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    const failedFetcher = vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 }));
    expect(await verifyTurnstile("real-secret", "token", successFetcher)).toBe(true);
    expect(await verifyTurnstile("real-secret", "token", failedFetcher)).toBe(false);
  });
});
