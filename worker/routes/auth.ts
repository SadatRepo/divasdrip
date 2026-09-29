import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { Env } from "../index";
import { requireAdmin } from "../middleware/adminAuth";
import { createPasswordRecord, createSessionToken, createTotpSecret, createTotpUri, hashSessionToken, verifyPassword, verifyTotpCode } from "../services/auth";
import { csrfGuard, rateLimit } from "../services/security";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(10).max(200), challenge: z.string().min(20).max(200).optional(), otp: z.string().regex(/^[0-9]{6}$/).optional() });
const bootstrapSchema = loginSchema.pick({ email: true, password: true }).extend({ displayName: z.string().trim().min(2).max(100) });
const otpSchema = z.object({ code: z.string().regex(/^[0-9]{6}$/, "Enter a six-digit verification code") });

function cookieOptions(environment: string) {
  return { httpOnly: true, secure: environment === "production", sameSite: "Lax" as const, path: "/", maxAge: 60 * 60 * 8 };
}

async function createStaffSession(context: Context<Env>, staff: Record<string, unknown>) {
  const token = await createSessionToken();
  await context.env.DB.prepare("INSERT INTO staff_sessions (id, staff_user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+8 hours'))").bind(crypto.randomUUID(), staff.id, await hashSessionToken(token)).run();
  setCookie(context, "session", token, cookieOptions(context.env.ENVIRONMENT));
  return context.json({ id: staff.id, email: staff.email, displayName: staff.display_name, role: staff.role, permissions: JSON.parse(String(staff.permissions_json ?? "[]")), mfaEnabled: Number(staff.mfa_enabled) === 1 });
}

export const authRoutes = new Hono<Env>();
authRoutes.use("/login", rateLimit({ name: "auth-login", limit: 8, windowMs: 60_000 }));
authRoutes.use("/mfa/*", rateLimit({ name: "auth-mfa", limit: 12, windowMs: 60_000 }));
authRoutes.use("/bootstrap", rateLimit({ name: "auth-bootstrap", limit: 3, windowMs: 60_000 }));
authRoutes.use("/logout", csrfGuard);
authRoutes.use("/mfa/setup", csrfGuard);
authRoutes.use("/mfa/enable", csrfGuard);
authRoutes.use("/mfa/disable", csrfGuard);

authRoutes.post("/login", zValidator("json", loginSchema), async (context) => {
  const input = context.req.valid("json");
  const staff = await context.env.DB.prepare("SELECT id, email, display_name, role, permissions_json, password_hash, password_salt, mfa_secret, mfa_enabled FROM staff_users WHERE email = ?1 AND active = 1").bind(input.email.toLowerCase()).first<Record<string, unknown>>();
  if (!staff?.password_hash || !staff.password_salt || !(await verifyPassword(input.password, String(staff.password_salt), String(staff.password_hash)))) return context.json({ error: "Invalid email or password" }, 401);

  if (Number(staff.mfa_enabled) === 1) {
    if (!input.challenge || !input.otp) {
      const challenge = await createSessionToken();
      await context.env.DB.batch([
        context.env.DB.prepare("DELETE FROM staff_mfa_challenges WHERE staff_user_id = ? OR expires_at <= datetime('now')").bind(staff.id),
        context.env.DB.prepare("INSERT INTO staff_mfa_challenges (id, staff_user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+5 minutes'))").bind(crypto.randomUUID(), staff.id, await hashSessionToken(challenge)),
      ]);
      return context.json({ mfaRequired: true, challenge }, 202);
    }
    const challenge = await context.env.DB.prepare("SELECT id, attempts FROM staff_mfa_challenges WHERE staff_user_id = ?1 AND token_hash = ?2 AND expires_at > datetime('now')").bind(staff.id, await hashSessionToken(input.challenge)).first<{ id: string; attempts: number }>();
    if (!challenge || Number(challenge.attempts) >= 5) return context.json({ error: "MFA challenge expired. Sign in again." }, 401);
    if (!(await verifyTotpCode(String(staff.mfa_secret ?? ""), input.otp))) {
      await context.env.DB.prepare("UPDATE staff_mfa_challenges SET attempts = attempts + 1 WHERE id = ?1").bind(challenge.id).run();
      return context.json({ error: "The verification code is invalid." }, 401);
    }
    await context.env.DB.prepare("DELETE FROM staff_mfa_challenges WHERE id = ?1").bind(challenge.id).run();
  }

  return createStaffSession(context, staff);
});

authRoutes.get("/mfa/status", requireAdmin, async (context) => {
  const actorId = context.get("actorId");
  if (actorId === "token-admin") return context.json({ available: false, enabled: false });
  const staff = await context.env.DB.prepare("SELECT email, mfa_enabled FROM staff_users WHERE id = ?1 AND active = 1").bind(actorId).first<{ email: string; mfa_enabled: number }>();
  if (!staff) return context.json({ error: "Staff account not found" }, 404);
  return context.json({ available: true, enabled: Number(staff.mfa_enabled) === 1, email: staff.email });
});

authRoutes.post("/mfa/setup", requireAdmin, async (context) => {
  const actorId = context.get("actorId");
  if (actorId === "token-admin") return context.json({ error: "MFA enrollment requires a staff session" }, 400);
  const staff = await context.env.DB.prepare("SELECT email, mfa_enabled FROM staff_users WHERE id = ?1 AND active = 1").bind(actorId).first<{ email: string; mfa_enabled: number }>();
  if (!staff) return context.json({ error: "Staff account not found" }, 404);
  if (Number(staff.mfa_enabled) === 1) return context.json({ error: "MFA is already enabled" }, 409);
  const secret = createTotpSecret();
  await context.env.DB.batch([
    context.env.DB.prepare("UPDATE staff_users SET mfa_pending_secret = ?, mfa_pending_expires_at = datetime('now', '+10 minutes'), updated_at = datetime('now') WHERE id = ?").bind(secret, actorId),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'staff_user', ?, 'mfa_setup_started', ?)").bind(crypto.randomUUID(), actorId, actorId, JSON.stringify({ email: staff.email })),
  ]);
  return context.json({ secret, uri: createTotpUri(staff.email, secret), expiresInMinutes: 10 });
});

authRoutes.post("/mfa/enable", zValidator("json", otpSchema), requireAdmin, async (context) => {
  const actorId = context.get("actorId");
  if (actorId === "token-admin") return context.json({ error: "MFA enrollment requires a staff session" }, 400);
  const pending = await context.env.DB.prepare("SELECT mfa_pending_secret FROM staff_users WHERE id = ?1 AND active = 1 AND mfa_pending_expires_at > datetime('now')").bind(actorId).first<{ mfa_pending_secret: string | null }>();
  if (!pending?.mfa_pending_secret || !(await verifyTotpCode(pending.mfa_pending_secret, context.req.valid("json").code))) return context.json({ error: "The verification code is invalid or setup has expired." }, 422);
  await context.env.DB.batch([
    context.env.DB.prepare("UPDATE staff_users SET mfa_secret = ?, mfa_pending_secret = NULL, mfa_pending_expires_at = NULL, mfa_enabled = 1, updated_at = datetime('now') WHERE id = ?").bind(pending.mfa_pending_secret, actorId),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'staff_user', ?, 'mfa_enabled', ?)").bind(crypto.randomUUID(), actorId, actorId, JSON.stringify({ enabled: true })),
  ]);
  return context.json({ enabled: true });
});

authRoutes.post("/mfa/disable", zValidator("json", otpSchema), requireAdmin, async (context) => {
  const actorId = context.get("actorId");
  if (actorId === "token-admin") return context.json({ error: "MFA is managed only for staff sessions" }, 400);
  const staff = await context.env.DB.prepare("SELECT mfa_secret, mfa_enabled FROM staff_users WHERE id = ?1 AND active = 1").bind(actorId).first<{ mfa_secret: string | null; mfa_enabled: number }>();
  if (!staff || Number(staff.mfa_enabled) !== 1 || !staff.mfa_secret || !(await verifyTotpCode(staff.mfa_secret, context.req.valid("json").code))) return context.json({ error: "The verification code is invalid." }, 422);
  await context.env.DB.batch([
    context.env.DB.prepare("UPDATE staff_users SET mfa_secret = NULL, mfa_pending_secret = NULL, mfa_pending_expires_at = NULL, mfa_enabled = 0, updated_at = datetime('now') WHERE id = ?").bind(actorId),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'staff_user', ?, 'mfa_disabled', ?)").bind(crypto.randomUUID(), actorId, actorId, JSON.stringify({ enabled: false })),
  ]);
  return context.json({ enabled: false });
});

authRoutes.post("/logout", async (context) => {
  const token = getCookie(context, "session");
  if (token) await context.env.DB.prepare("UPDATE staff_sessions SET revoked_at = datetime('now') WHERE token_hash = ?1").bind(await hashSessionToken(token)).run();
  deleteCookie(context, "session", { path: "/" });
  return context.json({ ok: true });
});

authRoutes.post("/bootstrap", zValidator("json", bootstrapSchema), async (context) => {
  const authorization = context.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!authorization || !context.env.ADMIN_TOKEN || authorization !== context.env.ADMIN_TOKEN) return context.json({ error: "Unauthorized" }, 401);
  const count = await context.env.DB.prepare("SELECT COUNT(*) AS count FROM staff_users").first<{ count: number }>();
  if (Number(count?.count ?? 0) > 0) return context.json({ error: "Staff bootstrap is already complete" }, 409);
  const input = context.req.valid("json");
  const password = await createPasswordRecord(input.password);
  const id = crypto.randomUUID();
  await context.env.DB.batch([
    context.env.DB.prepare("INSERT INTO staff_users (id, email, display_name, role, permissions_json, password_hash, password_salt) VALUES (?, ?, ?, 'owner', '[\"owner\"]', ?, ?)").bind(id, input.email.toLowerCase(), input.displayName, password.hash, password.salt),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, NULL, 'staff_user', ?, 'bootstrap', ?)").bind(crypto.randomUUID(), id, JSON.stringify({ email: input.email.toLowerCase(), role: "owner" })),
  ]);
  return context.json({ id, email: input.email.toLowerCase(), role: "owner" }, 201);
});
