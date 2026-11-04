import { action } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "../auth";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic"] as const;
const MAX_DIMENSION = 5000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

type AllowedType = (typeof ALLOWED_TYPES)[number];

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/heic":
      return "heic";
    default:
      return "jpg";
  }
}

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
  while (i < buffer.length - 1) {
    if (buffer[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buffer[i + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) {
      i += 2;
      continue;
    }
    const length = (buffer[i + 2] << 8) | buffer[i + 3];
    if (marker === 0xc0 || marker === 0xc2) {
      const height = (buffer[i + 5] << 8) | buffer[i + 6];
      const width = (buffer[i + 7] << 8) | buffer[i + 8];
      return { width, height };
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

function stripExifJpeg(buffer: Uint8Array): Uint8Array {
  const result: number[] = [0xff, 0xd8];
  let i = 2;
  while (i < buffer.length - 1) {
    if (buffer[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buffer[i + 1];
    if (marker === 0xd9) {
      result.push(0xff, 0xd9);
      break;
    }
    if (marker === 0xda) {
      for (let j = i; j < buffer.length; j++) {
        result.push(buffer[j]);
      }
      break;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      result.push(0xff, marker);
      i += 2;
      continue;
    }
    const length = (buffer[i + 2] << 8) | buffer[i + 3];
    if (marker === 0xe1) {
      i += length + 2;
      continue;
    }
    for (let j = i; j < i + length + 2; j++) {
      result.push(buffer[j]);
    }
    i += length + 2;
  }
  return new Uint8Array(result);
}

export const uploadReceipt = action({
  args: {
    image: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);

    if (!ALLOWED_TYPES.includes(args.contentType as AllowedType)) {
      throw new Error("Invalid file type. Allowed: JPEG, PNG, HEIC");
    }

    const buffer = Buffer.from(args.image, "base64");

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

    const cleaned = args.contentType === "image/jpeg" ? stripExifJpeg(uint8) : uint8;

    const extension = getExtension(args.contentType);
    const filename = `receipt-${orgId}-${crypto.randomUUID()}.${extension}`;

    const storageId = await ctx.storage.store(filename, cleaned, {
      contentType: args.contentType,
      customMetadata: {
        orgId,
        userId,
        uploadAt: Date.now().toString(),
        width: dimensions ? dimensions.width.toString() : "0",
        height: dimensions ? dimensions.height.toString() : "0",
      },
    });

    return {
      storageId,
      uploadBy: userId,
      orgId,
      width: dimensions ? dimensions.width : 0,
      height: dimensions ? dimensions.height : 0,
      size: cleaned.length,
      uploadAt: Date.now(),
    };
  },
});
