import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

export function navigate(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  const hash = to.split("#")[1];
  if (hash) window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }), 0);
  else window.scrollTo({ top: 0, behavior: "smooth" });
}

export function Link({ href, children, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || href?.startsWith("mailto:")) return;
    if (!href || props.target === "_blank" || props.download !== undefined) return;
    const destination = new URL(href, window.location.href);
    if (destination.origin !== window.location.origin || !["http:", "https:"].includes(destination.protocol)) return;
    event.preventDefault();
    navigate(destination.pathname + destination.search + destination.hash);
  };

  return <a href={href} onClick={handleClick} {...props}>{children}</a>;
}