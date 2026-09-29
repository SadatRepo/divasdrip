import { useEffect, useState } from "react";
import { deleteAdminMedia, getAdminOrphanMedia, getAdminProductImages, getAdminProducts, setAdminProductImages, uploadMedia, type AdminOrphanMedia, type AdminProduct, type AdminProductImage } from "../lib/adminApi";

type ManagedImage = { mediaId: string; url: string; objectKey: string; altText: string; isCover: boolean; sortOrder: number };

function apiMediaUrl(objectKey: string) {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";
  return apiBase + "/media/" + encodeURIComponent(objectKey);
}

function toManagedImage(image: AdminProductImage): ManagedImage {
  return { mediaId: image.media_id, url: apiMediaUrl(image.object_key), objectKey: image.object_key, altText: image.alt_text, isCover: Number(image.is_cover) === 1, sortOrder: image.sort_order };
}

export function MediaManagement() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [images, setImages] = useState<ManagedImage[]>([]);
  const [orphans, setOrphans] = useState<AdminOrphanMedia[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [altText, setAltText] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const loadOrphans = () => getAdminOrphanMedia().then(setOrphans).catch((error: Error) => setMessage(error.message));

  useEffect(() => {
    getAdminProducts().then((nextProducts) => { setProducts(nextProducts); if (nextProducts[0]) setProductId(nextProducts[0].id); }).catch((error: Error) => setMessage(error.message));
    loadOrphans();
  }, []);

  useEffect(() => {
    if (!productId) { setImages([]); return; }
    getAdminProductImages(productId).then((nextImages) => setImages(nextImages.map(toManagedImage))).catch((error: Error) => setMessage(error.message));
  }, [productId]);

  const normalized = (nextImages: ManagedImage[]) => nextImages.map((image, index) => ({ ...image, sortOrder: index, isCover: nextImages.some((item) => item.isCover) ? image.isCover : index === 0 }));

  const save = async (nextImages = images) => {
    setSaving(true);
    setMessage("");
    try {
      const ordered = normalized(nextImages);
      const result = await setAdminProductImages(productId, ordered.map((image) => ({ mediaId: image.mediaId, isCover: image.isCover, sortOrder: image.sortOrder })));
      setImages(ordered.map((image, index) => ({ ...image, sortOrder: index, isCover: result.images[index]?.isCover ?? image.isCover })));
      setMessage("Gallery saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save gallery");
    } finally {
      setSaving(false);
    }
  };

  const uploadAndAdd = async () => {
    if (!files.length || !productId) return;
    setSaving(true);
    setMessage("");
    try {
      const fallbackAlt = products.find((product) => product.id === productId)?.name || "Product image";
      const additions: ManagedImage[] = [];
      for (const nextFile of files) {
        const uploaded = await uploadMedia(nextFile, altText || fallbackAlt);
        additions.push({ mediaId: uploaded.id, url: uploaded.url, objectKey: uploaded.objectKey, altText: altText || fallbackAlt, isCover: images.length === 0 && additions.length === 0, sortOrder: images.length + additions.length });
      }
      setFiles([]);
      setAltText("");
      await save([...images, ...additions]);
      await loadOrphans();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload image");
      setSaving(false);
    }
  };

  const removeOrphan = async (media: AdminOrphanMedia) => {
    if (!window.confirm("Delete this unused upload from R2? This cannot be undone.")) return;
    setDeletingId(media.id);
    setMessage("");
    try {
      await deleteAdminMedia(media.id);
      setOrphans((current) => current.filter((item) => item.id !== media.id));
      setMessage("Unused upload deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete upload");
    } finally {
      setDeletingId("");
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);
  };

  const setCover = (mediaId: string) => setImages(images.map((image) => ({ ...image, isCover: image.mediaId === mediaId })));

  return <section>
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-[11px] uppercase tracking-[0.22em] text-[#8B4D5C]">Catalogue</p><h1 className="mt-2 font-serif text-4xl text-[#241C1E]">Product media</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6E5F63]">Manage product galleries and review uploads that are not attached to a product.</p></div><span className="text-sm text-[#6E5F63]">R2 gallery management</span></div>
    <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_24rem]">
      <div className="rounded-[14px] border border-[#D8CDC6] bg-white p-5 shadow-[0_5px_18px_rgba(36,28,30,.035)]">
        <label className="block text-sm font-medium">Product<select value={productId} onChange={(event) => setProductId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#D8CDC6] bg-white px-3 text-sm focus:border-[#8B4D5C] focus:outline-none">{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <div className="mt-6 space-y-3">{images.map((image, index) => <div key={image.mediaId} className="flex items-center gap-3 rounded-lg border border-[#D8CDC6] p-3"><img src={image.url} alt={image.altText} className="h-20 w-16 rounded bg-[#F7F2EE] object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{image.altText || image.objectKey}</p><p className="mt-1 text-xs text-[#6E5F63]">{image.isCover ? "Cover image" : "Gallery image"}</p><div className="mt-2 flex flex-wrap gap-3 text-xs"><button type="button" onClick={() => move(index, -1)} className="underline disabled:text-stone-300" disabled={index === 0}>Move left</button><button type="button" onClick={() => move(index, 1)} className="underline disabled:text-stone-300" disabled={index === images.length - 1}>Move right</button><button type="button" onClick={() => setCover(image.mediaId)} className="underline">Set cover</button><button type="button" onClick={() => setImages(images.filter((item) => item.mediaId !== image.mediaId))} className="text-[#A13642] underline">Remove</button></div></div></div>)}</div>
        {!images.length ? <p className="mt-6 border border-dashed border-[#D8CDC6] p-8 text-center text-sm text-[#6E5F63]">No images attached to this product.</p> : null}
        <button type="button" disabled={saving || !productId} onClick={() => void save()} className="mt-6 w-full rounded-lg bg-[#8B4D5C] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#743D4C] disabled:bg-[#D8CDC6]">{saving ? "Saving..." : "Save gallery order"}</button>
      </div>
      <div className="h-fit rounded-[14px] border border-[#D8CDC6] bg-white p-5 shadow-[0_5px_18px_rgba(36,28,30,.035)]">
        <h2 className="font-serif text-2xl text-[#241C1E]">Add image</h2><p className="mt-1 text-xs leading-5 text-[#6E5F63]">Upload bytes to R2, then attach them to the selected product gallery.</p>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} className="mt-5 block w-full text-xs" />{files.length ? <p className="mt-2 text-xs text-[#6E5F63]">{files.length} file(s) selected</p> : null}
        <input value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Alt text" className="mt-3 h-11 w-full rounded-lg border border-[#D8CDC6] px-3 text-sm focus:border-[#8B4D5C] focus:outline-none" />
        <button type="button" disabled={!files.length || saving} onClick={() => void uploadAndAdd()} className="mt-4 w-full rounded-lg border border-[#8B4D5C] px-4 py-3 text-sm font-bold text-[#8B4D5C] transition hover:bg-[#F5E5E1] disabled:border-[#D8CDC6] disabled:text-[#6E5F63]">{saving ? "Uploading..." : "Upload and attach"}</button>
      </div>
    </div>
    <section className="mt-8 rounded-[14px] border border-[#D8CDC6] bg-white p-5 shadow-[0_5px_18px_rgba(36,28,30,.035)]">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8B4D5C]">Storage hygiene</p><h2 className="mt-2 font-serif text-2xl text-[#241C1E]">Unused uploads</h2><p className="mt-1 text-sm leading-6 text-[#6E5F63]">Only assets with no product-image reference appear here. Review before deleting them from R2.</p></div><span className="text-sm text-[#6E5F63]">{orphans.length} unused</span></div>
      {orphans.length ? <div className="mt-5 divide-y divide-[#D8CDC6] rounded-lg border border-[#D8CDC6]">{orphans.map((media) => <div key={media.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">{media.status === "ready" ? <img src={apiMediaUrl(media.object_key)} alt={media.alt_text} className="h-16 w-12 rounded bg-[#F7F2EE] object-cover" /> : <div className="flex h-16 w-12 items-center justify-center rounded bg-[#F7F2EE] text-[10px] uppercase text-[#8B4D5C]">{media.status}</div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{media.alt_text || media.object_key}</p><p className="mt-1 text-xs text-[#6E5F63]">{media.status} · {media.mime_type} · {media.width && media.height ? media.width + "×" + media.height + " px · " : ""}uploaded {new Date(media.created_at).toLocaleDateString()}</p></div><button type="button" onClick={() => void removeOrphan(media)} disabled={deletingId === media.id} className="rounded-lg border border-[#A13642] px-3 py-2 text-xs font-bold text-[#A13642] disabled:opacity-50">{deletingId === media.id ? "Deleting..." : "Delete unused"}</button></div>)}</div> : <p className="mt-5 rounded-lg border border-dashed border-[#D8CDC6] p-6 text-center text-sm text-[#6E5F63]">No unused media assets found.</p>}
    </section>
    {message ? <p className="mt-4 text-sm text-[#6E5F63]" role="status">{message}</p> : null}
  </section>;
}
