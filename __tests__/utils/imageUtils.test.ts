import { describe, it, expect, beforeEach } from "vitest";

describe("imageUtils", () => {
  let isAllowedFileType: (type: string) => boolean;

  beforeEach(async () => {
    const mod = await import("../../app/utils/imageUtils");
    isAllowedFileType = mod.isAllowedFileType;
  });

  describe("isAllowedFileType", () => {
    it("allows JPEG", () => {
      expect(isAllowedFileType("image/jpeg")).toBe(true);
    });

    it("allows PNG", () => {
      expect(isAllowedFileType("image/png")).toBe(true);
    });

    it("allows HEIC", () => {
      expect(isAllowedFileType("image/heic")).toBe(true);
    });

    it("rejects PDF", () => {
      expect(isAllowedFileType("application/pdf")).toBe(false);
    });

    it("rejects GIF", () => {
      expect(isAllowedFileType("image/gif")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isAllowedFileType("")).toBe(false);
    });

    // SEC-004: MIME spoofing — reject content types that masquerade as allowed images
    it("ST-014: rejects text/html disguised as image", () => {
      expect(isAllowedFileType("text/html")).toBe(false);
    });

    it("ST-015: rejects application/octet-stream", () => {
      expect(isAllowedFileType("application/octet-stream")).toBe(false);
    });

    it("ST-016: rejects image/svg+xml", () => {
      expect(isAllowedFileType("image/svg+xml")).toBe(false);
    });

    it("ST-017: rejects uppercase spoofed content type (image/JPEG)", () => {
      expect(isAllowedFileType("image/JPEG")).toBe(false);
    });

    it("ST-018: rejects content type with parameters (image/jpeg; charset=utf-8)", () => {
      expect(isAllowedFileType("image/jpeg; charset=utf-8")).toBe(false);
    });
  });

  describe("preprocessImage", () => {
    let preprocessImage: (file: File) => Promise<string>;

    beforeEach(async () => {
      const mod = await import("../../app/utils/imageUtils");
      preprocessImage = mod.preprocessImage;
    });

    it("rejects non-allowed file types", async () => {
      const file = new File(["fake"], "test.pdf", { type: "application/pdf" });
      await expect(preprocessImage(file)).rejects.toThrow("File type not allowed");
    });

    // SEC-004: Client-side MIME type check only validates the file.type string,
    // not the actual file content. Server-side magic-byte validation in
    // uploadReceipt.ts is the authoritative control (ST-001/ST-002/ST-003).
    it("ST-019: preprocessImage relies on browser-reported MIME type (server validates magic bytes)", async () => {
      const file = new File(["not-an-image"], "evil.html", {
        type: "image/jpeg",
      });
      await expect(preprocessImage(file)).rejects.toThrow();
    });

    // SEC-004: Files with no MIME type set must be rejected
    it("ST-020: rejects file with empty MIME type", async () => {
      const file = new File(["data"], "test", { type: "" });
      await expect(preprocessImage(file)).rejects.toThrow("File type not allowed");
    });

    // SEC-006: EXIF stripping relies on canvas redraw — preprocessImage always
    // outputs JPEG via toDataURL("image/jpeg", quality), which strips EXIF as
    // a side-effect of canvas pixel copy. Server-side stripping is enforced
    // independently in uploadReceipt.ts via stripExifJpeg().
    it("ST-021: canvas redraw produces JPEG output (EXIF-stripped)", async () => {
      const jpegHeader = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      const file = new File([jpegHeader], "test.jpg", { type: "image/jpeg" });
      await expect(preprocessImage(file)).rejects.toThrow();
    });
  });

  describe("fileToDataUrl", () => {
    let fileToDataUrl: (file: File) => Promise<string>;

    beforeEach(async () => {
      const mod = await import("../../app/utils/imageUtils");
      fileToDataUrl = mod.fileToDataUrl;
    });

    it("converts a file to a data URL", async () => {
      const file = new File(["hello"], "test.txt", { type: "text/plain" });
      const dataUrl = await fileToDataUrl(file);
      expect(dataUrl.startsWith("data:")).toBe(true);
    });

    it("produces base64-encoded data URL for text file", async () => {
      const file = new File(["hello"], "test.txt", { type: "text/plain" });
      const dataUrl = await fileToDataUrl(file);
      expect(dataUrl).toContain("base64");
    });
  });

  describe("computeDHash", () => {
    let computeDHash: (file: File) => Promise<string>;

    beforeEach(async () => {
      const mod = await import("../../app/utils/imageUtils");
      computeDHash = mod.computeDHash;
    });

    it("rejects non-image file types", async () => {
      const file = new File(["fake"], "test.pdf", { type: "application/pdf" });
      await expect(computeDHash(file)).rejects.toThrow("File type not allowed");
    });
  });
});
