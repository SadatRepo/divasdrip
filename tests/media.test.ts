import { describe, expect, it } from "vitest";
import { parseImageDimensions, stripImageMetadata } from "../worker/services/media";

describe("image validation", () => {
  it("reads PNG dimensions from the IHDR header", () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 3, 32, 0, 0, 2, 88]);
    expect(parseImageDimensions(bytes, "image/png")).toEqual({ width: 800, height: 600 });
  });

  it("reads JPEG dimensions from a baseline frame header", () => {
    const bytes = new Uint8Array([255, 216, 255, 224, 0, 4, 0, 0, 255, 192, 0, 8, 8, 2, 88, 3, 32, 0, 0]);
    expect(parseImageDimensions(bytes, "image/jpeg")).toEqual({ width: 800, height: 600 });
  });

  it("rejects files whose bytes do not match the claimed image type", () => {
    expect(parseImageDimensions(new Uint8Array([1, 2, 3]), "image/png")).toBeNull();
    expect(parseImageDimensions(new Uint8Array([1, 2, 3]), "image/jpeg")).toBeNull();
  });
});


describe("image metadata sanitization", () => {
  it("removes JPEG metadata segments while preserving the image markers", () => {
    const bytes = new Uint8Array([255, 216, 255, 225, 0, 8, 69, 120, 105, 102, 0, 0, 255, 217]);
    const sanitized = stripImageMetadata(bytes, "image/jpeg");
    expect([...sanitized]).toEqual([255, 216, 255, 217]);
  });

  it("removes PNG text chunks while preserving image chunks", () => {
    const chunk = (type: string, data: number[]) => new Uint8Array([0, 0, 0, data.length, ...type.split("").map((value) => value.charCodeAt(0)), ...data, 0, 0, 0, 0]);
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]), ...chunk("tEXt", [69, 120, 105, 102, 0, 1]), ...chunk("IDAT", [1, 2]), ...chunk("IEND", [])]);
    const sanitized = stripImageMetadata(bytes, "image/png");
    const asText = String.fromCharCode(...sanitized);
    expect(asText).not.toContain("tEXt");
    expect(asText).toContain("IDAT");
  });
});
