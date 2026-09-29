export function StorePageContent({ title, content }: { title: string; content: string }) {
  const paragraphs = content.split(String.fromCharCode(10) + String.fromCharCode(10)).map((paragraph) => paragraph.trim()).filter(Boolean);
  return <><h1 className="mt-3 font-serif text-5xl tracking-tight">{title}</h1><div className="mt-10 space-y-6 text-base leading-8 text-[#6E5F63]">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></>;
}
