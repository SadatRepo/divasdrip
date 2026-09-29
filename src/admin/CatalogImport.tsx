import { useState } from "react";
import { Link } from "../components/Link";
import { importAdminProducts, previewAdminProductImport, type CatalogueImportPreview } from "../lib/adminApi";

export function CatalogImport() {
  const [file, setFile] = useState<File | null>(null);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<CatalogueImportPreview>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const chooseFile = async (nextFile: File | null) => {
    setFile(nextFile);
    setPreview(undefined);
    setMessage("");
    setError("");
    if (nextFile) setCsv(await nextFile.text());
    else setCsv("");
  };

  const previewFile = async () => {
    if (!csv) return;
    setWorking(true);
    setError("");
    setMessage("");
    try { setPreview(await previewAdminProductImport(csv)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to preview CSV"); } finally { setWorking(false); }
  };

  const importFile = async () => {
    if (!csv || !preview?.valid) return;
    setWorking(true);
    setError("");
    setMessage("");
    try { const result = await importAdminProducts(csv); setMessage(result.imported + " products imported from " + result.rows + " rows."); setPreview(undefined); setFile(null); setCsv(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to import CSV"); } finally { setWorking(false); }
  };

  return <section><Link href="/admin/products" className="text-xs uppercase tracking-[0.16em] text-[#6E5F63]">← Products</Link><div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[11px] uppercase tracking-[0.22em] text-[#6E5F63]">Catalogue</p><h1 className="mt-2 font-serif text-4xl">Import products</h1></div><span className="text-sm text-[#6E5F63]">Preview before write</span></div><div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]"><div className="rounded-xl border border-[#D8CDC6] bg-white p-5"><h2 className="font-medium">CSV file</h2><p className="mt-2 text-sm leading-6 text-[#6E5F63]">One row per variant. Required columns: slug, name, category_slug, sku, price_in_cents and stock_on_hand. Use primary_image_id for published products.</p><input type="file" accept=".csv,text/csv" onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)} className="mt-6 block w-full text-sm" />{file ? <p className="mt-3 text-xs text-[#6E5F63]">{file.name} · {(file.size / 1024).toFixed(1)} KB</p> : null}<button type="button" disabled={!csv || working} onClick={() => void previewFile()} className="mt-6 w-full bg-[#8B4D5C] px-4 py-3 text-sm font-medium text-white disabled:bg-stone-300">{working ? "Checking…" : "Preview CSV"}</button>{preview ? <div className={"mt-5 border p-4 text-sm " + (preview.valid ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900")}><p className="font-medium">{preview.valid ? "Ready to import" : "Fix validation errors"}</p><p className="mt-2">{preview.productCount} products · {preview.rowCount} rows</p>{preview.errors.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">{preview.errors.slice(0, 20).map((item) => <li key={item}>{item}</li>)}</ul> : null}{preview.valid ? <button type="button" disabled={working} onClick={() => void importFile()} className="mt-4 w-full border border-[#8B4D5C] px-4 py-3 text-sm font-medium">{working ? "Importing…" : "Import catalogue"}</button> : null}</div> : null}{error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}{message ? <p className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p> : null}</div><aside className="h-fit rounded-xl border border-[#D8CDC6] bg-white p-5"><h2 className="font-medium">Import notes</h2><ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-[#6E5F63]"><li>Imports create new draft or published products; existing slugs and SKUs are rejected.</li><li>Prices and stock use integer minor units, such as 485000 for BDT 4,850.</li><li>Published rows must reference a ready media asset.</li><li>Every imported product and stock opening is audited.</li></ul></aside></div></section>;
}