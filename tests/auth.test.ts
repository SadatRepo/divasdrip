import { describe, expect, it } from "vitest";
import { createTotpCode, createTotpSecret, createTotpUri, verifyTotpCode } from "../worker/services/auth";

describe("staff MFA", () => {
  it("matches the standard TOTP test vector", async () => {
    expect(await createTotpCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)).toBe("287082");
  });

  it("creates and verifies six-digit TOTP codes with clock tolerance", async () => {
    const secret = createTotpSecret();
    const code = await createTotpCode(secret, 1_700_000_000_000);
    expect(code).toMatch(/^[0-9]{6}$/);
    expect(await verifyTotpCode(secret, code, 1_700_000_000_000)).toBe(true);
    expect(await verifyTotpCode(secret, code, 1_700_000_029_000)).toBe(true);
    expect(await verifyTotpCode(secret, code === "000000" ? "000001" : "000000", 1_700_000_000_000)).toBe(false);
  });

  it("creates an authenticator-compatible otpauth URI", () => {
    const uri = createTotpUri("staff@example.com", "JBSWY3DPEHPK3PXP");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=DIVASDRIP");
  });
});
