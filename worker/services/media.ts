export type ImageDimensions = { width: number; height: number };

function readUInt32BE(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function readUInt24LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16);
}

function readUInt32LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16) + (bytes[offset + 3] << 24);
}

function hasAscii(bytes: Uint8Array, offset: number, value: string) {
  return [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function validDimensions(width: number, height: number): ImageDimensions | null {
  return width > 0 && height > 0 && width <= 10_000 && height <= 10_000 ? { width, height } : null;
}


function concatBytes(parts: Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function sanitizePng(bytes: Uint8Array) {
  if (bytes.length < 24) return bytes;
  const parts: Uint8Array[] = [bytes.slice(0, 8)];
  let offset = 8;
  const keep = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);
  while (offset + 12 <= bytes.length) {
    const length = readUInt32BE(bytes, offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return bytes;
    const type = ascii(bytes, offset + 4, 4);
    if (keep.has(type)) parts.push(bytes.slice(offset, end));
    offset = end;
    if (type === "IEND") break;
  }
  return concatBytes(parts);
}

function sanitizeJpeg(bytes: Uint8Array) {
  if (bytes.length < 4) return bytes;
  const parts: Uint8Array[] = [bytes.slice(0, 2)];
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      parts.push(bytes.slice(offset));
      break;
    }
    const segmentStart = offset;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) {
      parts.push(bytes.slice(segmentStart));
      break;
    }
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) {
      parts.push(bytes.slice(segmentStart));
      break;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      parts.push(bytes.slice(segmentStart, offset));
      continue;
    }
    if (offset + 1 >= bytes.length) {
      parts.push(bytes.slice(segmentStart));
      break;
    }
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    const end = offset + length;
    if (length < 2 || end > bytes.length) return bytes;
    const removeMetadata = marker === 0xe1 || marker === 0xed || marker === 0xfe || marker === 0xe2;
    if (!removeMetadata) parts.push(bytes.slice(segmentStart, end));
    offset = end;
  }
  return concatBytes(parts);
}

function sanitizeWebp(bytes: Uint8Array) {
  if (bytes.length < 12) return bytes;
  const parts: Uint8Array[] = [bytes.slice(0, 12)];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const length = readUInt32LE(bytes, offset + 4);
    const paddedEnd = offset + 8 + length + (length % 2);
    if (paddedEnd > bytes.length) return bytes;
    const type = ascii(bytes, offset, 4);
    if (type !== "EXIF" && type !== "XMP " && type !== "ICCP" && type !== "JUNK") parts.push(bytes.slice(offset, paddedEnd));
    offset = paddedEnd;
  }
  const result = concatBytes(parts);
  result[4] = (result.length - 8) & 0xff;
  result[5] = ((result.length - 8) >>> 8) & 0xff;
  result[6] = ((result.length - 8) >>> 16) & 0xff;
  result[7] = ((result.length - 8) >>> 24) & 0xff;
  return result;
}

export function stripImageMetadata(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/png") return sanitizePng(bytes);
  if (mimeType === "image/jpeg") return sanitizeJpeg(bytes);
  if (mimeType === "image/webp") return sanitizeWebp(bytes);
  return bytes;
}

function parsePng(bytes: Uint8Array) {
  if (bytes.length < 24 || ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value) || !hasAscii(bytes, 12, "IHDR")) return null;
  return validDimensions(readUInt32BE(bytes, 16), readUInt32BE(bytes, 20));
}

function parseJpeg(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 1 >= bytes.length) break;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if (startOfFrame.has(marker)) return validDimensions((bytes[offset + 5] << 8) | bytes[offset + 6], (bytes[offset + 3] << 8) | bytes[offset + 4]);
    offset += segmentLength;
  }
  return null;
}

function parseWebp(bytes: Uint8Array) {
  if (bytes.length < 30 || !hasAscii(bytes, 0, "RIFF") || !hasAscii(bytes, 8, "WEBP")) return null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkSize = readUInt32LE(bytes, offset + 4);
    const data = offset + 8;
    if (data + chunkSize > bytes.length) break;
    if (hasAscii(bytes, offset, "VP8X") && chunkSize >= 10) return validDimensions(readUInt24LE(bytes, data + 4) + 1, readUInt24LE(bytes, data + 7) + 1);
    if (hasAscii(bytes, offset, "VP8L") && chunkSize >= 5 && bytes[data] === 0x2f) {
      const width = 1 + ((bytes[data + 1] | (bytes[data + 2] << 8)) & 0x3fff);
      const height = 1 + ((bytes[data + 2] >> 6) | (bytes[data + 3] << 2) | ((bytes[data + 4] & 0x0f) << 10));
      return validDimensions(width, height);
    }
    if (hasAscii(bytes, offset, "VP8 ") && chunkSize >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) return validDimensions((bytes[data + 6] | (bytes[data + 7] << 8)) & 0x3fff, (bytes[data + 8] | (bytes[data + 9] << 8)) & 0x3fff);
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  return null;
}

export function parseImageDimensions(bytes: Uint8Array, mimeType: string): ImageDimensions | null {
  if (mimeType === "image/png") return parsePng(bytes);
  if (mimeType === "image/jpeg") return parseJpeg(bytes);
  if (mimeType === "image/webp") return parseWebp(bytes);
  return null;
}
