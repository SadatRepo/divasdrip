const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

type VitalPayload = {
  path: string;
  navigationType?: string;
  ttfbMs: number;
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  connection?: string;
};

type PerformanceEntryLike = PerformanceEntry & {
  value?: number;
  hadRecentInput?: boolean;
  interactionId?: number;
  processingStart?: number;
  startTime: number;
  duration: number;
};

function send(payload: VitalPayload) {
  const body = JSON.stringify(payload);
  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon && navigator.sendBeacon(API_BASE + "/telemetry/performance", blob)) return;
  void fetch(API_BASE + "/telemetry/performance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function installPerformanceMonitoring() {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return () => undefined;
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const ttfbMs = Math.max(0, Math.round((navigation?.responseStart ?? performance.now()) - (navigation?.requestStart ?? 0)));
  const payload: VitalPayload = {
    path: window.location.pathname.slice(0, 200) || "/",
    navigationType: navigation?.type,
    ttfbMs,
    lcpMs: null,
    cls: 0,
    inpMs: null,
    connection: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType,
  };
  let sent = false;
  const observers: PerformanceObserver[] = [];
  const observe = (type: string, callback: (entry: PerformanceEntryLike) => void, options?: PerformanceObserverInit & { durationThreshold?: number }) => {
    try {
      const observer = new PerformanceObserver((list) => list.getEntries().forEach((entry) => callback(entry as PerformanceEntryLike)));
      observer.observe({ type, buffered: true, ...options } as PerformanceObserverInit);
      observers.push(observer);
    } catch {
      // Older browsers simply omit unsupported metrics.
    }
  };
  observe("largest-contentful-paint", (entry) => { payload.lcpMs = Math.round(entry.startTime); });
  observe("layout-shift", (entry) => { if (!entry.hadRecentInput) payload.cls = Number(((payload.cls ?? 0) + Number(entry.value ?? 0)).toFixed(4)); });
  observe("event", (entry) => {
    if (entry.interactionId && entry.processingStart !== undefined) {
      const duration = Math.max(0, entry.processingStart + entry.duration - entry.startTime);
      payload.inpMs = Math.max(payload.inpMs ?? 0, Math.round(duration));
    }
  }, { durationThreshold: 40 });

  const report = () => {
    if (sent) return;
    sent = true;
    send(payload);
  };
  window.addEventListener("pagehide", report, { once: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") report(); }, { once: true });
  return () => { observers.forEach((observer) => observer.disconnect()); window.removeEventListener("pagehide", report); };
}
