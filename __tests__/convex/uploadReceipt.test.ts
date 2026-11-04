import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuthenticatedOrg, requireAuthenticatedUser } = vi.hoisted(() => ({
  requireAuthenticatedOrg: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock("../../convex/_generated/server", () => ({
  action: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  query: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  mutationGeneric: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  queryGeneric: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
}));

vi.mock("convex/values", () => ({
  v: {
    object: () => ({ _isValidator: true }),
    string: () => ({ _isValidator: true }),
    number: () => ({ _isValidator: true }),
    union: () => ({ _isValidator: true }),
    literal: () => ({ _isValidator: true }),
    optional: () => ({ _isValidator: true }),
    id: () => ({ _isValidator: true }),
  },
}));

vi.mock("../../convex/auth", () => ({
  requireAuthenticatedOrg,
  requireAuthenticatedUser,
}));

function makeJpegBuffer(width: number, height: number): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const sof0 = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, app0, sof0, eoi]);
}

function makeJpegWithExifBuffer(width: number, height: number): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const app1 = Buffer.from([
    0xff, 0xe1, 0x00, 0x10,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00,
  ]);
  const sof0 = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, app1, sof0, eoi]);
}

function makePngBuffer(width: number, height: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write("IHDR", 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 0x08;
  ihdr[17] = 0x02;
  return Buffer.concat([sig, ihdr]);
}

function makeHeicBuffer(): Buffer {
  return Buffer.from([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
    0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
}

function makeCtx() {
  return {
    auth: { getUserIdentity: async () => null },
    storage: {
      store: vi.fn().mockResolvedValue("storage_id"),
    },
  };
}

describe("uploadReceipt (SEC-001, SEC-004, SEC-005)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("requires authentication (SEC-001)", async () => {
    requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated"));

    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    await expect(
      uploadReceipt.handler(
        { auth: { getUserIdentity: async () => null } } as never,
        { image: "base64data", contentType: "image/jpeg" },
      ),
    ).rejects.toThrow("Unauthenticated");
  });

  // SEC-004: Server must verify file magic bytes match declared Content-Type, not just trust the client string
  it("ST-001: rejects content-type/MIME spoofing — PNG bytes with JPEG content-type", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const png = makePngBuffer(800, 600);
    const base64 = png.toString("base64");

    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    await expect(
      uploadReceipt.handler(
        makeCtx() as never,
        { image: base64, contentType: "image/jpeg" },
      ),
    ).rejects.toThrow("Content-Type mismatch");
  });

  // SEC-004: Server must verify file magic bytes match declared Content-Type
  it("ST-002: rejects content-type/MIME spoofing — JPEG bytes with PNG content-type", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const jpeg = makeJpegBuffer(800, 600);
    const base64 = jpeg.toString("base64");

    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    await expect(
      uploadReceipt.handler(
        makeCtx() as never,
        { image: base64, contentType: "image/png" },
      ),
    ).rejects.toThrow("Content-Type mismatch");
  });

  // SEC-004: Server must verify file magic bytes match declared Content-Type
  it("ST-003: rejects content-type/MIME spoofing — JPEG bytes with HEIC content-type", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const jpeg = makeJpegBuffer(800, 600);
    const base64 = jpeg.toString("base64");

    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    await expect(
      uploadReceipt.handler(
        makeCtx() as never,
        { image: base64, contentType: "image/heic" },
      ),
    ).rejects.toThrow("Content-Type mismatch");
  });

  // SEC-004: Server rejects files with unrecognized magic bytes (non-image)
  it("ST-004: rejects files with unrecognized magic bytes", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    await expect(
      uploadReceipt.handler(
        makeCtx() as never,
        { image: btoa("not-an-image"), contentType: "image/jpeg" },
      ),
    ).rejects.toThrow("Unable to determine file type from magic bytes");
  });

  // SEC-004: Token/ID generation must use crypto.randomUUID, not Math.random
  it("ST-005: generates filename using crypto.randomUUID (not Math.random)", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const jpeg = makeJpegBuffer(800, 600);
    const base64 = jpeg.toString("base64");

    const ctx = makeCtx();
    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    await uploadReceipt.handler(ctx as never, {
      image: base64,
      contentType: "image/jpeg",
    });

    const callArgs = ctx.storage.store.mock.calls[0];
    const filename = callArgs[0];
    expect(filename).toMatch(/^receipt-org_test-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/);
  });

  // SEC-001: Cross-tenant isolation — orgId in filename comes from JWT, not client input
  it("ST-006: filename uses JWT-derived orgId (not client-supplied)", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_victim", orgId: "org_victim" });

    const jpeg = makeJpegBuffer(800, 600);
    const base64 = jpeg.toString("base64");

    const ctx = makeCtx();
    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    await uploadReceipt.handler(ctx as never, {
      image: base64,
      contentType: "image/jpeg",
    });

    const callArgs = ctx.storage.store.mock.calls[0];
    const filename = callArgs[0];
    expect(filename).toMatch(/^receipt-org_victim-/);
  });

  // SEC-001: Response includes orgId and userId from JWT, not from client input
  it("ST-007: response embeds server-derived orgId and userId", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const jpeg = makeJpegBuffer(800, 600);
    const base64 = jpeg.toString("base64");

    const ctx = makeCtx();
    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    const result = await uploadReceipt.handler(ctx as never, {
      image: base64,
      contentType: "image/jpeg",
    });

    expect(result.orgId).toBe("org_test");
    expect(result.uploadBy).toBe("user_test");
    expect(result.storageId).toBe("storage_id");
  });

  // SEC-005: Server enforces file size limit (not just client-side check)
  it("ST-008: server enforces 5MB size limit", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const jpeg = makeJpegBuffer(800, 600);
    const pad = Buffer.alloc(6 * 1024 * 1024, 0xff);
    const largeBuffer = Buffer.concat([jpeg, pad]);
    const largeBase64 = largeBuffer.toString("base64");

    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    await expect(
      uploadReceipt.handler(
        makeCtx() as never,
        { image: largeBase64, contentType: "image/jpeg" },
      ),
    ).rejects.toThrow("File too large");
  });

  // SEC-005: Server enforces dimension limits (not just client-side resize)
  it("ST-009: server rejects images exceeding 5000px", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const jpeg = makeJpegBuffer(5001, 100);
    const base64 = jpeg.toString("base64");

    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    await expect(
      uploadReceipt.handler(
        makeCtx() as never,
        { image: base64, contentType: "image/jpeg" },
      ),
    ).rejects.toThrow("exceeds maximum dimensions");
  });

  // SEC-006: Server-side EXIF stripping — APP1 marker must be removed from JPEG before storage
  it("ST-010: strips EXIF APP1 segment from JPEG before storage (SEC-006)", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const jpegWithExif = makeJpegWithExifBuffer(800, 600);
    const base64 = jpegWithExif.toString("base64");

    const ctx = makeCtx();
    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    await uploadReceipt.handler(ctx as never, {
      image: base64,
      contentType: "image/jpeg",
    });

    const callArgs = ctx.storage.store.mock.calls[0];
    const storedBuffer = callArgs[1];
    const storedBytes = new Uint8Array(storedBuffer);

    expect(storedBytes.length).toBeLessThan(jpegWithExif.length);
    expect(storedBytes[0]).toBe(0xff);
    expect(storedBytes[1]).toBe(0xd8);

    let hasApp1 = false;
    for (let i = 2; i < storedBytes.length - 1; i++) {
      if (storedBytes[i] === 0xff && storedBytes[i + 1] === 0xe1) {
        hasApp1 = true;
        break;
      }
    }
    expect(hasApp1).toBe(false);
  });

  // SEC-007: Storage metadata with orgId, userId, upload timestamp for TTL enforcement
  it("ST-011: stores metadata (orgId, userId, uploadAt) via customMetadata (SEC-007)", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const jpeg = makeJpegBuffer(800, 600);
    const base64 = jpeg.toString("base64");

    const ctx = makeCtx();
    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    await uploadReceipt.handler(ctx as never, {
      image: base64,
      contentType: "image/jpeg",
    });

    const callArgs = ctx.storage.store.mock.calls[0];
    const opts = callArgs[2];
    expect(opts).toHaveProperty("customMetadata");
    expect(opts.customMetadata.orgId).toBe("org_test");
    expect(opts.customMetadata.userId).toBe("user_test");
    expect(opts.customMetadata.uploadAt).toBeDefined();
    expect(opts.customMetadata.width).toBe("800");
    expect(opts.customMetadata.height).toBe("600");
  });

  it("rejects invalid content type (SEC-004)", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    await expect(
      uploadReceipt.handler(
        makeCtx() as never,
        { image: btoa("fake"), contentType: "application/pdf" },
      ),
    ).rejects.toThrow("Invalid file type");
  });

  it("rejects oversized image (>5MB) (SEC-005)", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 0xff);
    const largeBase64 = largeBuffer.toString("base64");

    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    await expect(
      uploadReceipt.handler(
        makeCtx() as never,
        { image: largeBase64, contentType: "image/jpeg" },
      ),
    ).rejects.toThrow("File too large");
  });

  it("rejects image exceeding max dimensions (SEC-005)", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const jpeg = makeJpegBuffer(6000, 4000);
    const base64 = jpeg.toString("base64");

    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    await expect(
      uploadReceipt.handler(
        makeCtx() as never,
        { image: base64, contentType: "image/jpeg" },
      ),
    ).rejects.toThrow("exceeds maximum dimensions");
  });

  it("uploads valid JPEG and returns storage ID", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const jpeg = makeJpegBuffer(800, 600);
    const base64 = jpeg.toString("base64");

    const ctx = makeCtx();
    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    const result = await uploadReceipt.handler(ctx as never, {
      image: base64,
      contentType: "image/jpeg",
    });

    expect(result.storageId).toBe("storage_id");
    expect(result.uploadBy).toBe("user_test");
    expect(result.orgId).toBe("org_test");
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.size).toBe(jpeg.length);
    expect(result.uploadAt).toBeDefined();
    expect(ctx.storage.store).toHaveBeenCalled();
  });

  // SEC-004: HEIC files with valid ftyp heic magic bytes are accepted
  it("ST-012: stores valid HEIC file with correct magic bytes (SEC-004)", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const heic = makeHeicBuffer();
    const base64 = heic.toString("base64");

    const ctx = makeCtx();
    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    const result = await uploadReceipt.handler(ctx as never, {
      image: base64,
      contentType: "image/heic",
    });

    expect(result.storageId).toBe("storage_id");
    const call = ctx.storage.store.mock.calls[0];
    expect(call[0]).toMatch(/\.heic$/);
  });

  it("rejects images with unparseable dimensions (non-image magic bytes)", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    await expect(
      uploadReceipt.handler(
        makeCtx() as never,
        { image: btoa("invalid"), contentType: "image/jpeg" },
      ),
    ).rejects.toThrow("Unable to determine file type from magic bytes");
  });

  // SEC-004: PNG files with matching magic bytes are accepted
  it("ST-013: stores valid PNG file with correct magic bytes (SEC-004)", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const png = makePngBuffer(800, 600);
    const base64 = png.toString("base64");

    const ctx = makeCtx();
    const { uploadReceipt } = await import("../../convex/functions/uploadReceipt");
    const result = await uploadReceipt.handler(ctx as never, {
      image: base64,
      contentType: "image/png",
    });

    expect(result.storageId).toBe("storage_id");
    const call = ctx.storage.store.mock.calls[0];
    expect(call[0]).toMatch(/\.png$/);
  });
});
