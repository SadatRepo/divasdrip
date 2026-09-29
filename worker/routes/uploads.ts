import { Hono } from "hono";
import type { Env } from "../index";
import { requireAdmin, requirePermission } from "../middleware/adminAuth";
import { parseImageDimensions, stripImageMetadata } from "../services/media";

import { csrfGuard } from "../services/security";

const MAX_BYTES = 8 * 1024 * 1024;
const allowedTypes = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

export const uploadRoutes = new Hono<Env>();
uploadRoutes.use("*", requireAdmin, requirePermission("media:write"), csrfGuard);

uploadRoutes.post("/", async (context) => {
  if (!context.env.IMAGES) return context.json({ error: "R2 image storage is not configured" }, 503);
  const contentType = context.req.header("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) return context.json({ error: "Upload must use multipart/form-data" }, 415);
  const form = await context.req.formData();
  const file = form.get("file");
  const altText = String(form.get("altText") ?? "").trim().slice(0, 240);
  if (!(file instanceof File)) return context.json({ error: "A file field is required" }, 400);
  const extension = allowedTypes.get(file.type);
  if (!extension) return context.json({ error: "Only JPEG, PNG, and WebP images are supported" }, 415);
  if (file.size < 1 || file.size > MAX_BYTES) return context.json({ error: "Image must be between 1 byte and 8 MB" }, 413);
  if (!altText) return context.json({ error: "Alt text is required for product images" }, 422);
  const originalBytes = new Uint8Array(await file.arrayBuffer());
  const sanitizedBytes = stripImageMetadata(originalBytes, file.type);
  const dimensions = parseImageDimensions(originalBytes, file.type);
  if (!dimensions) return context.json({ error: "The uploaded file is not a valid JPEG, PNG, or WebP image" }, 422);

  const objectKey = "products/" + crypto.randomUUID() + "." + extension;
  const mediaId = crypto.randomUUID();
  try {
    await context.env.DB.prepare("INSERT INTO media (id, object_key, width, height, mime_type, alt_text, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')").bind(mediaId, objectKey, dimensions.width, dimensions.height, file.type, altText).run();
  } catch {
    return context.json({ error: "We could not start the upload. Please try again." }, 503);
  }

  try {
    await context.env.IMAGES.put(objectKey, sanitizedBytes, { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" }, customMetadata: { altText, width: String(dimensions.width), height: String(dimensions.height), originalSize: String(file.size), sanitizedSize: String(sanitizedBytes.byteLength), metadataSanitized: "true" } });
    await context.env.DB.batch([
      context.env.DB.prepare("UPDATE media SET status = 'ready' WHERE id = ?").bind(mediaId),
      context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'media', ?, 'upload', ?)").bind(crypto.randomUUID(), context.get("actorId"), mediaId, JSON.stringify({ objectKey, mimeType: file.type, originalSize: file.size, sanitizedSize: sanitizedBytes.byteLength, metadataSanitized: true, width: dimensions.width, height: dimensions.height, altText })),
    ]);
  } catch {
    await context.env.DB.batch([
      context.env.DB.prepare("UPDATE media SET status = 'failed' WHERE id = ?").bind(mediaId),
      context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'media', ?, 'upload_failed', ?)").bind(crypto.randomUUID(), context.get("actorId"), mediaId, JSON.stringify({ objectKey, mimeType: file.type, size: file.size, width: dimensions.width, height: dimensions.height })),
    ]).catch(() => undefined);
    return context.json({ error: "The upload could not be completed. It was added to the media cleanup queue.", mediaId }, 503);
  }

  return context.json({ id: mediaId, objectKey, mimeType: file.type, size: file.size, width: dimensions.width, height: dimensions.height, altText, url: "/api/media/" + encodeURIComponent(objectKey) }, 201);
});
