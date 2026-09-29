type TurnstileResponse = { success?: boolean };

export function isTurnstileConfigured(value?: string) {
  return Boolean(value && value.trim() && !value.includes("replace-with"));
}

export async function verifyTurnstile(secret: string | undefined, token: string | undefined, fetcher: typeof fetch = fetch) {
  if (!isTurnstileConfigured(secret)) return true;
  if (!token?.trim()) return false;
  try {
    const body = new URLSearchParams({ secret: secret!.trim(), response: token.trim() });
    const response = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    if (!response.ok) return false;
    const result = await response.json() as TurnstileResponse;
    return result.success === true;
  } catch {
    return false;
  }
}
