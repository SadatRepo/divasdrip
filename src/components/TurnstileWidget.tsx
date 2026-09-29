import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string | number;
  remove?: (widgetId: string | number) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script="true"]');
    if (existing) {
      existing.addEventListener("load", () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable")));
      existing.addEventListener("error", () => reject(new Error("Turnstile failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = "true";
    script.addEventListener("load", () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable")));
    script.addEventListener("error", () => reject(new Error("Turnstile failed to load")));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function TurnstileWidget({ siteKey, onToken }: { siteKey?: string; onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  useEffect(() => {
    if (!siteKey || !container.current) return;
    let widgetId: string | number | undefined;
    let api: TurnstileApi | undefined;
    void loadTurnstile().then((nextApi) => {
      if (!container.current) return;
      api = nextApi;
      widgetId = api.render(container.current, { sitekey: siteKey, callback: (token) => onTokenRef.current(token), "expired-callback": () => onTokenRef.current(""), "error-callback": () => onTokenRef.current("") });
    }).catch(() => onToken(""));
    return () => {
      if (widgetId !== undefined) api?.remove?.(widgetId);
    };
  }, [siteKey]);
  return siteKey ? <div ref={container} className="min-h-[65px]" aria-label="Security verification" /> : null;
}
