import { CartContents, type CartContentsProps } from "../components/CartContents";
export function Cart(props: CartContentsProps) {
  return <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8"><p className="text-xs uppercase tracking-[0.2em] text-[#8B4D5C]">Your selection</p><h1 className="mb-8 mt-3 font-serif text-5xl">Shopping bag</h1><CartContents {...props} /></section>;
}
