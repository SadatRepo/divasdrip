import { describe, expect, it, vi, afterEach } from 'vitest';
import { parseCart } from '../src/lib/cart';
import { formatPrice } from '../src/lib/format';
describe('cart recovery', () => {
  it('ignores corrupted storage and malformed entries', () => { for (const value of ['null','{}','bad','[null,{"quantity":2}]']) expect(parseCart(value)).toEqual([]); });
  it('merges duplicate lines and limits their quantity', () => { const item = { productId:'p',variantId:'v',quantity:15 }; expect(parseCart(JSON.stringify([item,item]))).toEqual([{...item,quantity:20}]); });
  it('displays fractional BDT instead of rounding a payable total', () => { expect(formatPrice(245050)).toContain('2,450.50'); });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link } from '../src/components/Link';
import { uploadMedia } from '../src/lib/adminApi';
afterEach(() => vi.unstubAllGlobals());
it('renders link contents for product cards and checkout navigation', () => {
  expect(renderToStaticMarkup(createElement(Link, { href:'/checkout', children:'Continue to checkout' }))).toContain('>Continue to checkout</a>');
});
it('allows the browser to set multipart upload boundaries', async () => {
  vi.stubGlobal('localStorage', { getItem: () => 'test-token' });
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({id:'image'}), {status:201}));
  vi.stubGlobal('fetch',fetchMock);
  await uploadMedia(new File(['image'],'photo.webp',{type:'image/webp'}),'Product photo');
  const init = fetchMock.mock.calls[0][1];
  expect(init.body).toBeInstanceOf(FormData);
  expect(init.headers.has('Content-Type')).toBe(false);
});
