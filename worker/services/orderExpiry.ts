import type { StoreSettings } from "./settings";

type ExpirableOrder = { id: string; reference: string | null };

export async function expirePendingOrders(db: D1Database, settings: StoreSettings, actorId = "system-expiry") {
  const stale = await db.prepare("SELECT id, reference FROM orders WHERE status = 'pending_confirmation' AND created_at <= datetime('now', '-' || ?1 || ' hours') ORDER BY created_at ASC LIMIT 100").bind(settings.pendingConfirmationExpiryHours).all<ExpirableOrder>();
  let expired = 0;
  for (const order of stale.results) {
    const claimed = await db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?1 AND status = 'pending_confirmation'").bind(order.id).run();
    if (Number(claimed.meta.changes) !== 1) continue;
    const statements: D1PreparedStatement[] = [
      db.prepare("INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor_id) VALUES (?, ?, 'pending_confirmation', 'cancelled', ?, ?)").bind(crypto.randomUUID(), order.id, "Pending confirmation expired after " + settings.pendingConfirmationExpiryHours + " hours", actorId),
      db.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'order', ?, 'expiry_cancel', ?)").bind(crypto.randomUUID(), actorId, order.id, JSON.stringify({ reference: order.reference, status: "cancelled", pendingConfirmationExpiryHours: settings.pendingConfirmationExpiryHours, stockExpiryPolicy: settings.stockExpiryPolicy })),
    ];
    if (settings.stockExpiryPolicy === "release") {
      const reserved = await db.prepare("SELECT variant_id, MAX(0, -SUM(quantity_delta)) AS quantity FROM inventory_events WHERE order_id = ?1 AND event_type IN ('reserve', 'release') GROUP BY variant_id HAVING quantity > 0").bind(order.id).all<{ variant_id: string; quantity: number }>();
      for (const item of reserved.results) {
        statements.push(db.prepare("UPDATE product_variants SET stock_reserved = MAX(0, stock_reserved - ?1), updated_at = datetime('now') WHERE id = ?2").bind(item.quantity, item.variant_id));
        statements.push(db.prepare("INSERT INTO inventory_events (id, variant_id, event_type, quantity_delta, reason, actor_id, order_id) VALUES (?, ?, 'release', ?, ?, ?, ?)").bind(crypto.randomUUID(), item.variant_id, item.quantity, "Pending confirmation expired", actorId, order.id));
      }
    }
    try {
      await db.batch(statements);
      expired += 1;
    } catch {
      console.error(JSON.stringify({ event: "order_expiry_side_effect_failed", orderId: order.id }));
    }
  }
  return expired;
}
