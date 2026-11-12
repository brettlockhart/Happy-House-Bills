"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "../auth";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic"] as const;
const MAX_DIMENSION = 5000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const OCR_DAILY_LIMIT = 50;

type AllowedType = (typeof ALLOWED_TYPES)[number];

function detectMimeType(buffer: Uint8Array): string | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer[0] === 0x00 &&
    buffer[1] === 0x00 &&
    buffer[2] === 0x00 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70 &&
    buffer[8] === 0x68 &&
    buffer[9] === 0x65 &&
    buffer[10] === 0x69 &&
    buffer[11] === 0x63
  ) {
    return "image/heic";
  }

  return null;
}

function getImageDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 2) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return parseJpegDimensions(buffer);
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return parsePngDimensions(buffer);
  }

  return null;
}

function parseJpegDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i < buffer.length - 8) {
    if (buffer[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buffer[i + 1];
    if (marker === undefined) break;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) {
      i += 2;
      continue;
    }
    const b2 = buffer[i + 2];
    const b3 = buffer[i + 3];
    if (b2 === undefined || b3 === undefined) break;
    const length = (b2 << 8) | b3;
    if (marker === 0xc0 || marker === 0xc2) {
      const h1 = buffer[i + 5], h2 = buffer[i + 6], w1 = buffer[i + 7], w2 = buffer[i + 8];
      if (h1 === undefined || h2 === undefined || w1 === undefined || w2 === undefined) return null;
      return { width: (w1 << 8) | w2, height: (h1 << 8) | h2 };
    }
    i += length + 2;
  }
  return null;
}

function parsePngDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const width = dv.getUint32(16, false);
  const height = dv.getUint32(20, false);
  return { width, height };
}

interface DocumentAIResponse {
  document: {
    text: string;
    pages: Array<{
      tokens: Array<{
        detectedBreak: { type: number };
        layout: { confidence: number; boundingPoly: { vertices: Array<{ x: number; y: number }> } };
        textAnchor: { textSegments: Array<{ startIndex: string; endIndex: string }> };
      }>;
      formFields: Array<{
        fieldName: { textAnchor: { textSegments: Array<{ startIndex: string; endIndex: string }> }; confidence: number };
        fieldValue: { textAnchor: { textSegments: Array<{ startIndex: string; endIndex: string }> }; confidence: number };
      }>;
      paragraphs: Array<{
        layout: { confidence: number; boundingPoly: { vertices: Array<{ x: number; y: number }> } };
        textAnchor: { textSegments: Array<{ startIndex: string; endIndex: string }> };
      }>;
    }>;
    entities: Array<{
      type: string;
      mentionText: string;
      confidence: number;
      properties: Array<{ type: string; mentionText: string; confidence: number }>;
    }>;
  };
}

interface OcrResult {
  store?: string;
  date?: string;
  total?: string;
  confidence: number;
  rawText: string;
  lowConfidence: boolean;
}

function extractText(textAnchor: { textSegments: Array<{ startIndex: string; endIndex: string }> }, fullText: string): string {
  if (!textAnchor?.textSegments?.length) return "";
  let result = "";
  for (const segment of textAnchor.textSegments) {
    const start = parseInt(segment.startIndex || "0", 10);
    const end = parseInt(segment.endIndex || "0", 10);
    if (start >= 0 && end <= fullText.length && start < end) {
      result += fullText.slice(start, end);
    }
  }
  return result.trim();
}

function extractEntities(document: DocumentAIResponse["document"]): OcrResult {
  const rawText = document.text || "";
  let store: string | undefined;
  let date: string | undefined;
  let total: string | undefined;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const entity of document.entities || []) {
    const type = entity.type.toLowerCase();
    const text = entity.mentionText?.trim();
    const conf = entity.confidence || 0;

    if (!text) continue;

    confidenceSum += conf;
    confidenceCount++;

    if (type.includes("supplier") || type.includes("vendor") || type.includes("merchant") || type.includes("store")) {
      if (!store) store = text;
    } else if (type.includes("date") || type.includes("invoice_date") || type.includes("receipt_date")) {
      if (!date) date = text;
    } else if (type.includes("total") || type.includes("amount") || type.includes("invoice_total") || type.includes("grand_total")) {
      if (!total) total = text.replace(/[^\d.]/g, "");
    }

    for (const prop of entity.properties || []) {
      const propType = prop.type.toLowerCase();
      const propText = prop.mentionText?.trim();
      const propConf = prop.confidence || 0;

      if (!propText) continue;

      confidenceSum += propConf;
      confidenceCount++;

      if ((propType.includes("supplier") || propType.includes("vendor") || propType.includes("merchant")) && !store) {
        store = propText;
      } else if ((propType.includes("date")) && !date) {
        date = propText;
      } else if ((propType.includes("total") || propType.includes("amount")) && !total) {
        total = propText.replace(/[^\d.]/g, "");
      }
    }
  }

  if (!store) {
    for (const page of document.pages || []) {
      for (const field of page.formFields || []) {
        const fieldName = extractText(field.fieldName.textAnchor, rawText).toLowerCase();
        const fieldValue = extractText(field.fieldValue.textAnchor, rawText);
        const fieldConf = field.fieldValue.confidence || 0;

        if (!fieldValue) continue;

        confidenceSum += fieldConf;
        confidenceCount++;

        if ((fieldName.includes("merchant") || fieldName.includes("store") || fieldName.includes("supplier") || fieldName.includes("vendor")) && !store) {
          store = fieldValue;
        } else if ((fieldName.includes("date")) && !date) {
          date = fieldValue;
        } else if ((fieldName.includes("total") || fieldName.includes("amount")) && !total) {
          total = fieldValue.replace(/[^\d.]/g, "");
        }
      }
    }
  }

  if (!store && document.pages?.[0]?.paragraphs?.[0]) {
    const firstPara = extractText(document.pages[0].paragraphs[0].textAnchor, rawText);
    if (firstPara && firstPara.length <= 50) {
      store = firstPara;
    }
  }

  if (!date) {
    const datePatterns = [
      /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/,
      /\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/,
      /\b\d{1,2}[-/]\d{1,2}[-/]\d{2}\b/,
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i,
    ];
    for (const pattern of datePatterns) {
      const match = rawText.match(pattern);
      if (match) {
        date = match[0];
        break;
      }
    }
  }

  if (!total) {
    const moneyMatches = rawText.match(/\$?\d+\.\d{2}/g);
    if (moneyMatches && moneyMatches.length > 0) {
      const lastMatch = moneyMatches[moneyMatches.length - 1];
      if (lastMatch) {
        total = lastMatch.replace(/\$/g, "");
      }
    }
  }

  const avgConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;
  const lowConfidence = avgConfidence < 60;

  return {
    store,
    date,
    total,
    confidence: avgConfidence,
    rawText,
    lowConfidence,
  };
}

type QueryBuilder = {
  eq: (field: string, value: unknown) => QueryBuilder;
};

interface RateLimitContext {
  db: {
    query: (table: string) => {
      withIndex: (
        index: string,
        callback: (q: QueryBuilder) => unknown,
      ) => { first: () => Promise<{ _id: string; count: number; lastSentAt?: number } | null> };
    };
    insert: (table: string, data: Record<string, unknown>) => Promise<string>;
    patch: (id: string, data: Record<string, unknown>) => Promise<void>;
  };
}

async function checkAndIncrementOcrRateLimit(
  ctx: RateLimitContext,
  orgId: string,
  userId: string,
): Promise<void> {
  const today = new Date().toISOString().split("T")[0] ?? "";
  const dbQuery = ctx.db
    .query("emailRateLimits")
    .withIndex("by_org_date_user", (q) =>
      q.eq("orgId", orgId).eq("date", today).eq("userId", userId),
    )
    .first() as Promise<{ _id: string; count: number; lastSentAt?: number } | null>;

  const rateLimit = await dbQuery;

  if (rateLimit) {
    if (rateLimit.count >= OCR_DAILY_LIMIT) {
      throw new Error(
        `Daily OCR limit exceeded for org ${orgId} (${OCR_DAILY_LIMIT}/day)`,
      );
    }
    await ctx.db.patch(rateLimit._id, {
      count: rateLimit.count + 1,
      lastSentAt: Date.now(),
    });
  } else {
    await ctx.db.insert("emailRateLimits", { orgId, userId, date: today, count: 1, lastSentAt: Date.now() });
  }
}

export const processReceipt = action({
  args: {
    image: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args): Promise<OcrResult> => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);

    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    const locationRaw = process.env.GOOGLE_CLOUD_LOCATION;
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;

    const isMissing = (v: string | undefined) => !v || v === "undefined";
    if (isMissing(projectId) || isMissing(processorId)) {
      throw new Error("Google Document AI not configured: GOOGLE_CLOUD_PROJECT and GOOGLE_DOCUMENT_AI_PROCESSOR_ID required");
    }

    const location = isMissing(locationRaw) ? "us" : locationRaw;

    if (!ALLOWED_TYPES.includes(args.contentType as AllowedType)) {
      throw new Error("Invalid file type. Allowed: JPEG, PNG, HEIC");
    }

    const buffer = Buffer.from(args.image, "base64");

    if (buffer.length === 0) {
      throw new Error("Empty image data");
    }

    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error("File too large. Maximum size is 5MB");
    }

    const uint8 = new Uint8Array(buffer);
    const detectedType = detectMimeType(uint8);

    if (!detectedType) {
      throw new Error("Unable to determine file type from magic bytes");
    }

    if (detectedType !== args.contentType) {
      throw new Error(
        `Content-Type mismatch: declared ${args.contentType} but file signature is ${detectedType}`,
      );
    }

    const dimensions = getImageDimensions(uint8);

    if (dimensions) {
      if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
        throw new Error(
          `Image exceeds maximum dimensions of ${MAX_DIMENSION}x${MAX_DIMENSION}`,
        );
      }
    }

    await checkAndIncrementOcrRateLimit(ctx as unknown as RateLimitContext, orgId, userId);

    const { DocumentProcessorServiceClient } = await import("@google-cloud/documentai");
    const client = new DocumentProcessorServiceClient();

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    const [result] = await client.processDocument({
      name,
      rawDocument: {
        content: buffer.toString("base64"),
        mimeType: args.contentType,
      },
    });

    const docAIResponse = result.document as unknown as DocumentAIResponse["document"] | undefined;
    if (!docAIResponse) {
      throw new Error("Document AI returned no document");
    }

    return extractEntities(docAIResponse);
  },
});