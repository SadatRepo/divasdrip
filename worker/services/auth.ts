const encoder = new TextEncoder();
const TOTP_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string) {
  return new Uint8Array(value.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base32Encode(bytes: Uint8Array) {
  let output = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += TOTP_ALPHABET[(buffer >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += TOTP_ALPHABET[(buffer << (5 - bits)) & 31];
  return output;
}

function base32Decode(value: string) {
  const normalized = value.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of normalized) {
    const index = TOTP_ALPHABET.indexOf(character);
    if (index < 0) return new Uint8Array();
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

function counterBytes(counter: number) {
  const bytes = new Uint8Array(8);
  let remaining = Math.floor(counter);
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = remaining % 256;
    remaining = Math.floor(remaining / 256);
  }
  return bytes;
}

export async function createTotpCode(secret: string, timestamp = Date.now()) {
  const keyBytes = base32Decode(secret);
  if (!keyBytes.length) return "";
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes(Math.floor(timestamp / 1000 / 30))));
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

export async function verifyTotpCode(secret: string, code: string, timestamp = Date.now()) {
  if (!/^[0-9]{6}$/.test(code)) return false;
  for (const drift of [-30_000, 0, 30_000]) if ((await createTotpCode(secret, timestamp + drift)) === code) return true;
  return false;
}

export function createTotpSecret() {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

export function createTotpUri(email: string, secret: string) {
  return "otpauth://totp/" + encodeURIComponent("DIVASDRIP:" + email) + "?secret=" + secret + "&issuer=DIVASDRIP&algorithm=SHA1&digits=6&period=30";
}

async function derivePassword(password: string, salt: Uint8Array) {
  const baseKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: 120_000, hash: "SHA-256" }, baseKey, 256);
  return new Uint8Array(bits);
}

export async function createPasswordRecord(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt);
  return { salt: bytesToHex(salt), hash: bytesToHex(hash) };
}

export async function verifyPassword(password: string, saltHex: string, hashHex: string) {
  const actual = await derivePassword(password, hexToBytes(saltHex));
  const expected = hexToBytes(hashHex);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

export async function createSessionToken() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return bytesToHex(new Uint8Array(digest));
}

export function readCookie(cookieHeader: string | undefined, name: string) {
  return cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(name + "="))?.slice(name.length + 1);
}
