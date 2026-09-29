import { useEffect, useRef } from "react";
import { CartContents, type CartContentsProps } from "./CartContents";
export function CartDrawer({ open, onClose, ...props }: CartContentsProps & { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, [open]);
  return <dialog ref={dialog} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="bag-title" className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-md border-0 bg-[#FBF8F3] p-0 text-[#241C1E] shadow-xl backdrop:bg-black/40"><div className="flex h-full flex-col p-5 sm:p-6"><div className="flex items-center justify-between border-b border-[#D8CDC6] pb-4"><h2 id="bag-title" className="font-serif text-3xl">Your bag</h2><button type="button" onClick={onClose} aria-label="Close bag" className="h-11 w-11 text-2xl">×</button></div><CartContents {...props} onNavigate={onClose} /></div></dialog>;
}
