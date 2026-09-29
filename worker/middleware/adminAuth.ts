import { getCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../index";
import { hashSessionToken } from "../services/auth";

export type AdminPermission =
  | "catalog:read"
  | "catalog:write"
  | "orders:read"
  | "orders:write"
  | "media:write"
  | "audit:read"
  | "staff:read"
  | "staff:write"
  | "settings:read"
  | "settings:write"
  | "inventory:read"
  | "inventory:write"
  | "exports:read";

const ROLE_PERMISSIONS: Record<string, AdminPermission[]> = {
  owner: ["catalog:read", "catalog:write", "orders:read", "orders:write", "media:write", "audit:read", "staff:read", "staff:write", "settings:read", "settings:write", "inventory:read", "inventory:write", "exports:read"],
  admin: ["catalog:read", "catalog:write", "orders:read", "orders:write", "media:write", "audit:read", "staff:read", "staff:write", "settings:read", "settings:write", "inventory:read", "inventory:write", "exports:read"],
  editor: ["catalog:read", "catalog:write", "media:write", "inventory:read"],
  operations: ["catalog:read", "orders:read", "orders:write", "audit:read", "settings:read", "inventory:read", "inventory:write"],
  support: ["catalog:read", "orders:read", "orders:write"],
  viewer: ["catalog:read", "orders:read"],
};

function parsePermissions(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((permission): permission is string => typeof permission === "string") : [];
  } catch {
    return [];
  }
}

export const requireAdmin: MiddlewareHandler<Env> = async (context, next) => {
  const headerToken = context.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (headerToken && context.env.ADMIN_TOKEN && headerToken === context.env.ADMIN_TOKEN) {
    context.set("actorId", "token-admin");
    context.set("actorRole", "owner");
    context.set("actorPermissions", ["*"]);
    await next();
    return;
  }

  const sessionToken = getCookie(context, "session");
  if (!sessionToken) return context.json({ error: "Unauthorized" }, 401);
  const session = await context.env.DB.prepare("SELECT s.staff_user_id, u.role, u.permissions_json FROM staff_sessions s JOIN staff_users u ON u.id = s.staff_user_id WHERE s.token_hash = ?1 AND s.revoked_at IS NULL AND s.expires_at > datetime('now') AND u.active = 1").bind(await hashSessionToken(sessionToken)).first<{ staff_user_id: string; role: string; permissions_json: string }>();
  if (!session) return context.json({ error: "Unauthorized" }, 401);
  context.set("actorId", session.staff_user_id);
  context.set("actorRole", session.role);
  context.set("actorPermissions", parsePermissions(session.permissions_json));
  await next();
};

export function requirePermission(permission: AdminPermission): MiddlewareHandler<Env> {
  return async (context, next) => {
    const rolePermissions = ROLE_PERMISSIONS[context.get("actorRole")] ?? [];
    const explicitPermissions = context.get("actorPermissions") ?? [];
    if (!rolePermissions.includes(permission) && !explicitPermissions.includes(permission) && !explicitPermissions.includes("*")) {
      return context.json({ error: "Forbidden", permission }, 403);
    }
    await next();
  };
}