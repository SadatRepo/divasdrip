import { useState, type FormEvent } from "react";
import { loginStaff, setAdminToken } from "../lib/adminApi";

export function AdminLogin({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"staff" | "token">("staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setWorking(true);
    try {
      if (mode === "token") {
        const response = await fetch((import.meta.env.VITE_API_BASE_URL ?? "/api") + "/admin/products", { headers: { Authorization: "Bearer " + token } });
        if (!response.ok) throw new Error("The admin token was not accepted. Check the token and try again.");
        setAdminToken(token);
        onAuthenticated();
        return;
      }
      const result = await loginStaff(email, password, challenge ? otp : undefined, challenge || undefined);
      if ("mfaRequired" in result) {
        setChallenge(String(result.challenge));
        setOtp("");
        return;
      }
      onAuthenticated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in");
    } finally {
      setWorking(false);
    }
  };

  const switchMode = (nextMode: "staff" | "token") => {
    setMode(nextMode);
    setChallenge("");
    setOtp("");
    setError("");
  };

  return <section className="mx-auto max-w-md px-6 py-20">
    <p className="text-[11px] uppercase tracking-[0.22em] text-[#6E5F63]">Divasdrip / Admin</p>
    <h1 className="mt-3 font-serif text-4xl">Sign in to workspace</h1>
    <p className="mt-4 text-sm leading-6 text-[#6E5F63]">Staff sessions are the production path. The admin token remains available for local bootstrap and development.</p>
    <div className="mt-8 flex border-b border-[#D8CDC6] text-sm">
      <button type="button" onClick={() => switchMode("staff")} className={"border-b-2 px-4 py-3 " + (mode === "staff" ? "border-[#8B4D5C] font-medium" : "border-transparent text-[#6E5F63]")}>Staff account</button>
      <button type="button" onClick={() => switchMode("token")} className={"border-b-2 px-4 py-3 " + (mode === "token" ? "border-[#8B4D5C] font-medium" : "border-transparent text-[#6E5F63]")}>Local token</button>
    </div>
    <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
      {mode === "staff" ? <>
        <label className="block text-sm font-medium">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={Boolean(challenge)} className="mt-2 block h-12 w-full border border-[#D8CDC6] bg-white px-3 outline-none focus:ring-1 focus:ring-[#8B4D5C] disabled:bg-[#F7F2EE]" /></label>
        <label className="block text-sm font-medium">Password<input required minLength={10} type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={Boolean(challenge)} className="mt-2 block h-12 w-full border border-[#D8CDC6] bg-white px-3 outline-none focus:ring-1 focus:ring-[#8B4D5C] disabled:bg-[#F7F2EE]" /></label>
        {challenge ? <label className="block text-sm font-medium">Authenticator code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="mt-2 block h-12 w-full border border-[#D8CDC6] bg-white px-3 tracking-[0.3em] outline-none focus:ring-1 focus:ring-[#8B4D5C]" /></label> : null}
      </> : <label className="block text-sm font-medium">Admin token<input required type="password" value={token} onChange={(event) => setToken(event.target.value)} className="mt-2 block h-12 w-full border border-[#D8CDC6] bg-white px-3 outline-none focus:ring-1 focus:ring-[#8B4D5C]" /></label>}
      {challenge ? <button type="button" onClick={() => { setChallenge(""); setOtp(""); setError(""); }} className="text-xs text-[#6E5F63] underline">Start over</button> : null}
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
      <button disabled={working} className="w-full bg-[#8B4D5C] px-6 py-4 text-sm font-medium text-white hover:bg-[#743D4C] disabled:bg-[#D8CDC6]">{working ? "Checking…" : challenge ? "Verify and open workspace" : "Open workspace"}</button>
    </form>
  </section>;
}
