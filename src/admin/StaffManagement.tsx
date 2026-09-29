import { useEffect, useState, type FormEvent } from "react";
import { createAdminStaff, disableStaffMfa, enableStaffMfa, getAdminStaff, getMfaStatus, setupStaffMfa, updateAdminStaff, type AdminPermission, type AdminRole, type AdminStaff, type MfaStatus } from "../lib/adminApi";

const roles: AdminRole[] = ["admin", "editor", "operations", "support", "viewer"];
const permissions: AdminPermission[] = ["catalog:read", "catalog:write", "orders:read", "orders:write", "media:write", "audit:read", "staff:read", "staff:write", "settings:read", "settings:write", "inventory:read", "inventory:write", "exports:read"];

export function StaffManagement() {
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [form, setForm] = useState({ email: "", displayName: "", role: "viewer" as AdminRole, password: "", permissions: [] as AdminPermission[] });
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; uri: string; expiresInMinutes: number } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mfaWorking, setMfaWorking] = useState(false);

  const load = () => getAdminStaff().then(setStaff).catch((error: Error) => setMessage(error.message)).finally(() => setLoading(false));
  const loadMfa = () => getMfaStatus().then(setMfaStatus).catch((error: Error) => setMessage(error.message));
  useEffect(() => { void load(); void loadMfa(); }, []);

  const togglePermission = (permission: AdminPermission) => setForm((current) => ({ ...current, permissions: current.permissions.includes(permission) ? current.permissions.filter((item) => item !== permission) : [...current.permissions, permission] }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await createAdminStaff({ ...form, active: true });
      setForm({ email: "", displayName: "", role: "viewer", password: "", permissions: [] });
      setMessage("Staff account created.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create staff account");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (account: AdminStaff) => {
    setMessage("");
    try {
      await updateAdminStaff(account.id, { active: !account.active });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update staff account");
    }
  };

  const beginMfa = async () => {
    setMfaWorking(true);
    setMessage("");
    try {
      setMfaSetup(await setupStaffMfa());
      setMfaCode("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start MFA setup");
    } finally {
      setMfaWorking(false);
    }
  };

  const confirmMfa = async () => {
    if (!mfaCode) return;
    setMfaWorking(true);
    setMessage("");
    try {
      await enableStaffMfa(mfaCode);
      setMfaSetup(null);
      setMfaCode("");
      await loadMfa();
      setMessage("MFA is enabled for your staff account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to enable MFA");
    } finally {
      setMfaWorking(false);
    }
  };

  const disableMfa = async () => {
    if (!mfaCode) return;
    setMfaWorking(true);
    setMessage("");
    try {
      await disableStaffMfa(mfaCode);
      setMfaCode("");
      await loadMfa();
      setMessage("MFA has been disabled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to disable MFA");
    } finally {
      setMfaWorking(false);
    }
  };

  return <section>
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-[11px] uppercase tracking-[0.22em] text-[#6E5F63]">Governance</p><h1 className="mt-2 font-serif text-4xl">Staff access</h1></div><span className="text-sm text-[#6E5F63]">{staff.length} accounts</span></div>
    {mfaStatus?.available ? <section className="mt-8 rounded-[14px] border border-[#D8CDC6] bg-white p-5 shadow-[0_5px_18px_rgba(36,28,30,.035)]"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8B4D5C]">Your sign-in security</p><h2 className="mt-2 font-serif text-2xl">Authenticator app</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6E5F63]">Protect {mfaStatus.email} with a six-digit TOTP code. Setup uses any authenticator app that supports standard otpauth links.</p></div><span className={"text-sm font-medium " + (mfaStatus.enabled ? "text-emerald-700" : "text-[#6E5F63]")}>{mfaStatus.enabled ? "Enabled" : "Not enabled"}</span></div>{!mfaStatus.enabled && !mfaSetup ? <button type="button" onClick={() => void beginMfa()} disabled={mfaWorking} className="mt-5 rounded-lg bg-[#8B4D5C] px-4 py-3 text-sm font-bold text-white disabled:bg-[#D8CDC6]">{mfaWorking ? "Preparing…" : "Set up MFA"}</button> : null}{!mfaStatus.enabled && mfaSetup ? <div className="mt-5 grid gap-5 lg:grid-cols-2"><div><p className="text-sm font-medium">1. Add this account</p><p className="mt-2 text-xs leading-5 text-[#6E5F63]">Copy the secret into your authenticator app, or use the URI if your app supports importing it.</p><p className="mt-4 text-xs uppercase tracking-[0.14em] text-[#6E5F63]">Secret</p><code className="mt-2 block break-all rounded-lg bg-[#F7F2EE] p-3 text-sm tracking-[0.12em]">{mfaSetup.secret}</code><p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#6E5F63]">Setup URI</p><textarea readOnly value={mfaSetup.uri} className="mt-2 min-h-20 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] p-3 text-xs text-[#6E5F63]" /></div><div><p className="text-sm font-medium">2. Confirm the code</p><p className="mt-2 text-xs leading-5 text-[#6E5F63]">Enter the current six-digit code. This setup expires in {mfaSetup.expiresInMinutes} minutes.</p><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Six-digit code" className="mt-4 h-11 w-full rounded-lg border border-[#D8CDC6] px-3 tracking-[0.3em] focus:border-[#8B4D5C] focus:outline-none" /><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => void confirmMfa()} disabled={mfaWorking || mfaCode.length !== 6} className="rounded-lg bg-[#8B4D5C] px-4 py-3 text-sm font-bold text-white disabled:bg-[#D8CDC6]">{mfaWorking ? "Checking…" : "Enable MFA"}</button><button type="button" onClick={() => { setMfaSetup(null); setMfaCode(""); }} className="rounded-lg border border-[#D8CDC6] px-4 py-3 text-sm">Cancel</button></div></div></div> : null}{mfaStatus.enabled ? <div className="mt-5 max-w-sm"><label className="block text-sm font-medium">Current authenticator code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Six-digit code" className="mt-2 h-11 w-full rounded-lg border border-[#D8CDC6] px-3 tracking-[0.3em] focus:border-[#8B4D5C] focus:outline-none" /></label><button type="button" onClick={() => void disableMfa()} disabled={mfaWorking || mfaCode.length !== 6} className="mt-4 rounded-lg border border-[#A13642] px-4 py-3 text-sm font-bold text-[#A13642] disabled:border-[#D8CDC6] disabled:text-[#6E5F63]">{mfaWorking ? "Checking…" : "Disable MFA"}</button></div> : null}</section> : null}
    <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_25rem]">
      <div className="overflow-hidden rounded-xl border border-[#D8CDC6] bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-[#D8CDC6] text-xs uppercase tracking-[0.14em] text-[#6E5F63]"><tr><th className="px-5 py-4">Account</th><th className="px-5 py-4">Role</th><th className="px-5 py-4">Explicit permissions</th><th className="px-5 py-4">Status</th><th className="px-5 py-4"></th></tr></thead><tbody>{staff.map((account) => <tr key={account.id} className="border-b border-stone-100 last:border-0"><td className="px-5 py-4"><p className="font-medium">{account.displayName}</p><p className="mt-1 text-xs text-[#6E5F63]">{account.email}</p></td><td className="px-5 py-4 capitalize">{account.role}</td><td className="max-w-xs px-5 py-4 text-xs text-[#6E5F63]">{account.permissions.length ? account.permissions.join(", ") : "Role defaults only"}</td><td className="px-5 py-4"><span className={account.active ? "text-emerald-700" : "text-[#6E5F63]"}>{account.active ? "Active" : "Inactive"}</span></td><td className="px-5 py-4 text-right"><button type="button" onClick={() => void toggleActive(account)} className="text-xs underline">{account.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div>{loading ? <p className="p-8 text-sm text-[#6E5F63]">Loading staff accounts…</p> : null}{!loading && !staff.length ? <p className="p-8 text-sm text-[#6E5F63]">No staff accounts found.</p> : null}</div>
      <form onSubmit={(event) => void submit(event)} className="h-fit rounded-xl border border-[#D8CDC6] bg-white p-5"><h2 className="font-medium">Add staff account</h2><p className="mt-1 text-xs leading-5 text-[#6E5F63]">Passwords are hashed in the Worker and never stored in the browser.</p><div className="mt-5 space-y-3"><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email address" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="Display name" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AdminRole })} className="h-11 w-full border border-[#D8CDC6] bg-white px-3 text-sm">{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select><input required minLength={10} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Temporary password (10+ characters)" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><fieldset><legend className="text-sm font-medium">Additional permissions</legend><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{permissions.map((permission) => <label key={permission} className="flex items-center gap-2 text-xs text-[#6E5F63]"><input type="checkbox" checked={form.permissions.includes(permission)} onChange={() => togglePermission(permission)} />{permission}</label>)}</div></fieldset><button disabled={saving} className="w-full bg-[#8B4D5C] px-4 py-3 text-sm font-medium text-white disabled:bg-stone-400">{saving ? "Creating…" : "Create account"}</button>{message ? <p className="text-xs text-[#6E5F63]" role="status">{message}</p> : null}</div></form>
    </div>
  </section>;
}
