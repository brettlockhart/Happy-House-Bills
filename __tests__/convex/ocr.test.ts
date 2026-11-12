import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { requireAuthenticatedOrg } = vi.hoisted(() => ({
  requireAuthenticatedOrg: vi.fn(),
}));

const mockDocumentClient = vi.hoisted(() => vi.fn());
const mockProcessDocument = vi.fn();

vi.mock("../../convex/_generated/server", () => ({
  action: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
}));

vi.mock("convex/values", () => ({
  v: {
    string: () => ({ _isValidator: true }),
  },
}));

vi.mock("../../convex/auth", () => ({
  requireAuthenticatedOrg,
}));

vi.mock("@google-cloud/documentai", () => ({
  DocumentProcessorServiceClient: mockDocumentClient.mockImplementation(function () {
    return { processDocument: mockProcessDocument };
  }),
}));

function makeCtx() {
  return {
    auth: { getUserIdentity: async () => null },
    db: {
      query: () => ({
        withIndex: () => ({
          first: async () => null,
        }),
      }),
      insert: async () => "test-id",
      patch: async () => {},
    },
  } as never;
}

const originalEnv = { ...process.env };

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      process.env[key] = undefined as unknown;
    } else {
      process.env[key] = value;
    }
  }
}

function restoreEnv() {
  // Clear all process.env keys not in originalEnv
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      process.env[key] = undefined as unknown;
    }
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
}

const VALID_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAgGBgUGCQgKCgkMDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIA";

beforeEach(() => {
  mockDocumentClient.mockClear();
  requireAuthenticatedOrg.mockReset();
  mockProcessDocument.mockReset();
  setEnv({
    GOOGLE_CLOUD_PROJECT: "test-project",
    GOOGLE_CLOUD_LOCATION: "us",
    GOOGLE_DOCUMENT_AI_PROCESSOR_ID: "test-processor",
  });
});

afterEach(() => {
  restoreEnv();
});

async function importOcr() {
  return await import("../../convex/functions/ocr");
}

describe("processReceipt (SEC-015)", () => {
  // SEC-015: OCR action requires an authenticated organisation; unauthenticated calls are rejected
  it("requires authentication (SEC-015)", async () => {
    requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated"));

    const { processReceipt } = await importOcr();
    await expect(
      processReceipt.handler(makeCtx(), { image: VALID_JPEG_BASE64, contentType: "image/jpeg" }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("throws when GOOGLE_CLOUD_PROJECT is missing", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });
    setEnv({ GOOGLE_CLOUD_PROJECT: undefined });

    const { processReceipt } = await importOcr();
    await expect(
      processReceipt.handler(makeCtx(), { image: VALID_JPEG_BASE64, contentType: "image/jpeg" }),
    ).rejects.toThrow("Google Document AI not configured");
  });

  it("throws when GOOGLE_DOCUMENT_AI_PROCESSOR_ID is missing", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });
    setEnv({ GOOGLE_DOCUMENT_AI_PROCESSOR_ID: undefined });

    const { processReceipt } = await importOcr();
    await expect(
      processReceipt.handler(makeCtx(), { image: VALID_JPEG_BASE64, contentType: "image/jpeg" }),
    ).rejects.toThrow("Google Document AI not configured");
  });

  it("throws when Document AI returns no document", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });
    mockProcessDocument.mockResolvedValue([{}]);

    const { processReceipt } = await importOcr();
    await expect(
      processReceipt.handler(makeCtx(), { image: VALID_JPEG_BASE64, contentType: "image/jpeg" }),
    ).rejects.toThrow("Document AI returned no document");
  });

  // SEC-015: Document AI client/network failures must propagate as errors (not swallowed)
  it("propagates Document AI client errors (SEC-015)", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });
    mockProcessDocument.mockRejectedValue(new Error("Document API unavailable"));

    const { processReceipt } = await importOcr();
    await expect(
      processReceipt.handler(makeCtx(), { image: VALID_JPEG_BASE64, contentType: "image/jpeg" }),
    ).rejects.toThrow("Document API unavailable");
  });

  it("calls processDocument with the processor name and base64 image", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });
    mockProcessDocument.mockResolvedValue([
      {
        document: {
          text: "WALMART\nDate: 12/25/2024\nTOTAL $45.99",
          entities: [],
          pages: [],
        },
      },
    ]);

    const { processReceipt } = await importOcr();
    await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    const args = mockProcessDocument.mock.calls[0][0];
    expect(args.name).toBe("projects/test-project/locations/us/processors/test-processor");
    expect(args.rawDocument.mimeType).toBe("image/jpeg");
    expect(typeof args.rawDocument.content).toBe("string");
  });
});

describe("extractEntities (via processReceipt)", () => {
  function givenDocument(document: unknown) {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });
    mockProcessDocument.mockResolvedValue([{ document }]);
  }

  it("extracts store, date, and total from top-level entities", async () => {
    givenDocument({
      text: "WALMART SUPERCENTER\nDate: 12/25/2024\nTOTAL $45.99",
      entities: [
        { type: "supplier_name", mentionText: "WALMART SUPERCENTER", confidence: 0.9 },
        { type: "invoice_date", mentionText: "12/25/2024", confidence: 0.8 },
        { type: "total_amount", mentionText: "$45.99", confidence: 0.95 },
      ],
      pages: [],
    });

    const { processReceipt } = await importOcr();
    const result = await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    expect(result.store).toBe("WALMART SUPERCENTER");
    expect(result.date).toBe("12/25/2024");
    expect(result.total).toBe("45.99");
    expect(result.rawText).toBe("WALMART SUPERCENTER\nDate: 12/25/2024\nTOTAL $45.99");
    expect(result.confidence).toBeCloseTo((0.9 + 0.8 + 0.95) / 3);
  });

  it("extracts store from entity properties when top-level store entity missing", async () => {
    givenDocument({
      text: "MERCHANT LTD\nInvoice #12345\nAmount due: 19.99",
      entities: [
        {
          type: "other_info",
          mentionText: "unrelated info",
          confidence: 0.5,
          properties: [
            { type: "merchant_name", mentionText: "MERCHANT LTD", confidence: 0.85 },
          ],
        },
        { type: "total_amount", mentionText: "19.99", confidence: 0.9 },
      ],
      pages: [],
    });

    const { processReceipt } = await importOcr();
    const result = await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    expect(result.store).toBe("MERCHANT LTD");
    expect(result.total).toBe("19.99");
  });

  it("extracts date from entity properties when top-level date entity missing", async () => {
    givenDocument({
      text: "STORE X\nReceipt date 03/15/2024\nTotal $10.00",
      entities: [
        { type: "store", mentionText: "STORE X", confidence: 0.9 },
        {
          type: "other_info",
          mentionText: "unrelated info",
          confidence: 0.4,
          properties: [{ type: "receipt_date", mentionText: "03/15/2024", confidence: 0.7 }],
        },
        { type: "total_amount", mentionText: "$10.00", confidence: 0.9 },
      ],
      pages: [],
    });

    const { processReceipt } = await importOcr();
    const result = await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    expect(result.store).toBe("STORE X");
    expect(result.date).toBe("03/15/2024");
    expect(result.total).toBe("10.00");
  });

  it("extracts from form fields when no matching entities", async () => {
    givenDocument({
      text: "ACME STORE\nDate: 01/01/2024\nTOTAL $99.99",
      entities: [{ type: "other", mentionText: "irrelevant", confidence: 0.3 }],
      pages: [
        {
          formFields: [
            {
              fieldName: {
                textAnchor: { textSegments: [{ startIndex: "0", endIndex: "4" }] },
                confidence: 0.8,
              },
              fieldValue: {
                textAnchor: { textSegments: [{ startIndex: "5", endIndex: "12" }] },
                confidence: 0.8,
              },
            },
          ],
          paragraphs: [],
        },
      ],
    });

    const { processReceipt } = await importOcr();
    const result = await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    // fieldName "ACME" does not match store/date/total keywords; date/total come from regex fallbacks
    expect(result.date).toBe("01/01/2024");
    expect(result.total).toBe("99.99");
    expect(result.rawText).toBe("ACME STORE\nDate: 01/01/2024\nTOTAL $99.99");
  });

  it("extracts store from form field named merchant/store/supplier/vendor", async () => {
    givenDocument({
      text: "Merchant WHOLE FOODS MARKET\nTotal $50.00",
      entities: [],
      pages: [
        {
          formFields: [
            {
              fieldName: {
                textAnchor: { textSegments: [{ startIndex: "0", endIndex: "8" }] },
                confidence: 0.9,
              },
              fieldValue: {
                textAnchor: { textSegments: [{ startIndex: "9", endIndex: "27" }] },
                confidence: 0.9,
              },
            },
          ],
          paragraphs: [],
        },
      ],
    });

    const { processReceipt } = await importOcr();
    const result = await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    expect(result.store).toBe("WHOLE FOODS MARKET");
  });

  it("falls back to first paragraph when it is 50 chars or fewer and no store found", async () => {
    givenDocument({
      text: "BOUTIQUE SHOP\n123 High Street\nTotal 25.00",
      entities: [],
      pages: [
        {
          formFields: [],
          paragraphs: [
            {
              textAnchor: { textSegments: [{ startIndex: "0", endIndex: "13" }] },
              layout: { confidence: 0.9, boundingPoly: { vertices: [] } },
            },
          ],
        },
      ],
    });

    const { processReceipt } = await importOcr();
    const result = await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    expect(result.store).toBe("BOUTIQUE SHOP");
  });

  it("does not use first paragraph as store when it exceeds 50 chars", async () => {
    givenDocument({
      text: "This is a very long paragraph that definitely exceeds fifty characters in length here",
      entities: [],
      pages: [
        {
          formFields: [],
          paragraphs: [
            {
              textAnchor: { textSegments: [{ startIndex: "0", endIndex: "60" }] },
              layout: { confidence: 0.9, boundingPoly: { vertices: [] } },
            },
          ],
        },
      ],
    });

    const { processReceipt } = await importOcr();
    const result = await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    expect(result.store).toBeUndefined();
  });

  it("falls back to YYYY-MM-DD date pattern from raw text", async () => {
    givenDocument({
      text: "Invoice 2024-07-04 Total $12.50",
      entities: [],
      pages: [],
    });

    const { processReceipt } = await importOcr();
    const result = await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    expect(result.date).toBe("2024-07-04");
  });

  it("falls back to DD/MM/YYYY date pattern from raw text", async () => {
    givenDocument({
      text: "Receipt Date: 4/7/2024 Total $12.50",
      entities: [],
      pages: [],
    });

    const { processReceipt } = await importOcr();
    const result = await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    expect(result.date).toBe("4/7/2024");
  });

  it("falls back to DD/MM/YY date pattern from raw text", async () => {
    givenDocument({
      text: "Date: 4/7/24 Total $12.50",
      entities: [],
      pages: [],
    });

    const { processReceipt } = await importOcr();
    const result = await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    expect(result.date).toBe("4/7/24");
  });

  it("falls back to month-name date pattern from raw text", async () => {
    givenDocument({
      text: "Jan 15, 2024 Total $12.50",
      entities: [],
      pages: [],
    });

    const { processReceipt } = await importOcr();
    const result = await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    expect(result.date).toBe("Jan 15, 2024");
  });

  it("falls back to last money amount as total when no total entity", async () => {
    givenDocument({
      text: "Subtotal $10.00 Tax $1.00 Total $11.00",
      entities: [],
      pages: [],
    });

    const { processReceipt } = await importOcr();
    const result = await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    expect(result.total).toBe("11.00");
  });

  it("returns undefined fields and zero confidence for an empty document", async () => {
    givenDocument({ text: "", entities: [], pages: [] });

    const { processReceipt } = await importOcr();
    const result = await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    expect(result.store).toBeUndefined();
    expect(result.date).toBeUndefined();
    expect(result.total).toBeUndefined();
    expect(result.rawText).toBe("");
    expect(result.confidence).toBe(0);
  });

  it("ignores entities with empty mentionText and does not count them in confidence", async () => {
    givenDocument({
      text: "STORE NAME Total $5.00",
      entities: [
        { type: "supplier_name", mentionText: "", confidence: 0.9 },
        { type: "store", mentionText: "STORE NAME", confidence: 0.8 },
        { type: "total_amount", mentionText: "$5.00", confidence: 0.9 },
      ],
      pages: [],
    });

    const { processReceipt } = await importOcr();
    const result = await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    expect(result.store).toBe("STORE NAME");
    expect(result.total).toBe("5.00");
    expect(result.confidence).toBeCloseTo((0.8 + 0.9) / 2);
  });

  it("uses default location 'us' when GOOGLE_CLOUD_LOCATION is unset", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });
    setEnv({ GOOGLE_CLOUD_LOCATION: undefined });
    mockProcessDocument.mockResolvedValue([
      { document: { text: "", entities: [], pages: [] } },
    ]);

    const { processReceipt } = await importOcr();
    await processReceipt.handler(makeCtx(), {
      image: VALID_JPEG_BASE64,
      contentType: "image/jpeg",
    });

    expect(mockProcessDocument).toHaveBeenCalledWith(
      expect.objectContaining({ name: "projects/test-project/locations/us/processors/test-processor" }),
    );
  });
});
