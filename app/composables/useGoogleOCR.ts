import { ref, readonly } from "vue";
import { useConvexClient } from "convex-vue";
import { api } from "~~/convex/_generated/api";
import { applyOcrToForm, parseOcrText } from "~/utils/ocrParser";

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  categoryHint: "groceries" | "utilities" | "other";
  confidence: number;
  lowConfidence: boolean;
}

export interface OcrResult {
  store?: string;
  date?: string;
  total?: string;
  rawText?: string;
  storageId?: string;
  storageIds?: string[];
  confidence?: number;
  lowConfidence?: boolean;
  lineItems?: LineItem[];
  source?: "openrouter" | "tesseract";
  partial?: boolean;
}

export interface OcrState {
  status: "idle" | "preprocessing" | "uploading" | "processing" | "done" | "error";
  progress: number;
  result?: OcrResult;
  error?: string;
}

export interface OcrOutcome {
  form: Record<string, unknown>;
  result?: OcrResult;
}

interface UploadResult {
  storageId: string;
}

interface Frame {
  base64: string;
  contentType: string;
}

const MAX_PHOTOS = 4;
const MAX_FRAMES = 8;
const MAX_IMAGE_WIDTH = 2000;
const UPLOAD_TIMEOUT_MS = 30000;
const AI_TIMEOUT_MS = 90000;
const LOCAL_OCR_TIMEOUT_MS = 60000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timeout));
}

async function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function dataUrlToFrame(dataUrl: string, contentType: string): Frame {
  return { base64: dataUrl.replace(/^data:image\/\w+;base64,/, ""), contentType };
}

/**
 * Normalises and optionally tiles a receipt. Re-encoding strips metadata (EXIF)
 * and bounds memory/network use. Unsupported decoders fall back to the original.
 */
async function buildFramesForFile(file: File): Promise<Frame[]> {
  const fallback = [dataUrlToFrame(await fileToDataUrl(file), file.type || "image/jpeg")];
  try {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") return fallback;
    const bitmap = await createImageBitmap(file);
    if (!bitmap.width || !bitmap.height) {
      bitmap.close();
      return fallback;
    }

    const scale = Math.min(1, MAX_IMAGE_WIDTH / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const isTall = height / width >= 1.6;
    const tileHeight = isTall ? Math.round(width * 1.4) : height;
    const overlap = isTall ? Math.round(tileHeight * 0.15) : 0;
    const step = Math.max(1, tileHeight - overlap);
    const frames: Frame[] = [];
    const canvas = document.createElement("canvas");
    canvas.width = width;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return fallback;
    }

    for (let y = 0; y < height && frames.length < MAX_FRAMES; y += step) {
      const h = Math.min(tileHeight, height - y);
      const sourceY = Math.round(y / scale);
      const sourceH = Math.min(Math.round(h / scale), bitmap.height - sourceY);
      canvas.height = h;
      ctx.clearRect(0, 0, width, h);
      ctx.drawImage(bitmap, 0, sourceY, bitmap.width, sourceH, 0, 0, width, h);
      frames.push(dataUrlToFrame(canvas.toDataURL("image/jpeg", 0.85), "image/jpeg"));
      if (y + h >= height) break;
    }
    bitmap.close();
    return frames.length > 0 ? frames : fallback;
  } catch {
    return fallback;
  }
}

async function buildFrames(files: File[]): Promise<Frame[]> {
  const selected = files.slice(0, MAX_PHOTOS);
  const frames: Frame[] = [];
  // Decode sequentially to avoid a large mobile memory spike.
  for (const file of selected) {
    const next = await buildFramesForFile(file);
    for (const frame of next) {
      if (frames.length >= MAX_FRAMES) return frames;
      frames.push(frame);
    }
  }
  return frames;
}

export function useGoogleOCR() {
  const client = useConvexClient();
  const state = ref<OcrState>({ status: "idle", progress: 0 });
  let latestRunId = 0;
  let pendingFrames: Frame[] = [];

  function isOffline() {
    return typeof navigator !== "undefined" && navigator.onLine === false;
  }

  async function uploadFrames(frames: Frame[], runId: number): Promise<string[]> {
    const storageIds: string[] = [];
    for (const frame of frames) {
      if (runId !== latestRunId) return storageIds;
      const uploaded = (await withTimeout(
        client.action(api.functions.uploadReceipt.uploadReceipt, {
          image: frame.base64,
          contentType: frame.contentType,
        }),
        UPLOAD_TIMEOUT_MS,
        "Receipt upload timed out. Check your connection and try again.",
      )) as UploadResult;
      storageIds.push(uploaded.storageId);
      if (runId === latestRunId) {
        state.value = {
          status: "uploading",
          progress: 30 + Math.round((storageIds.length / frames.length) * 15),
          result: state.value.result,
        };
      }
    }
    return storageIds;
  }

  async function processWithTesseract(files: File[]): Promise<OcrResult> {
    const Tesseract = (await import("tesseract.js")).default;
    const texts: string[] = [];
    const confidences: number[] = [];

    for (let i = 0; i < files.length; i++) {
      const dataUrl = await fileToDataUrl(files[i]!);
      const { data } = await Tesseract.recognize(dataUrl, "eng", {
        logger: (m: { progress?: number }) => {
          if (m.progress !== undefined) {
            const perFile = (i + m.progress) / files.length;
            state.value.progress = 50 + Math.round(perFile * 45);
          }
        },
      });
      texts.push(data.text);
      if (typeof data.confidence === "number") confidences.push(data.confidence);
    }

    const rawText = texts.join("\n\n--- next receipt section ---\n\n");
    const parsed = parseOcrText(rawText);
    const confidence = confidences.length
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : undefined;
    return {
      ...parsed,
      rawText,
      confidence,
      lowConfidence: confidence === undefined || confidence < 75 || !parsed.total,
      lineItems: [],
      source: "tesseract",
      partial: files.length > 1 && texts.length !== files.length,
    };
  }

  async function processReceipt(input: File | File[], form: Record<string, unknown>): Promise<OcrOutcome> {
    const files = (Array.isArray(input) ? input : [input]).filter(Boolean);
    if (files.length === 0) return { form };
    const runId = ++latestRunId;
    state.value = { status: "preprocessing", progress: 10 };

    try {
      const frames = await buildFrames(files);
      if (runId !== latestRunId) return { form };
      pendingFrames = frames;
      let storageIds: string[] = [];
      let ocrResult: OcrResult;

      if (isOffline()) {
        state.value = { status: "processing", progress: 50 };
        ocrResult = await withTimeout(
          processWithTesseract(files),
          LOCAL_OCR_TIMEOUT_MS,
          "On-device OCR timed out",
        );
      } else {
        try {
          state.value = { status: "uploading", progress: 30 };
          storageIds = await uploadFrames(frames, runId);
        } catch (uploadError) {
          console.warn("Receipt upload failed; using on-device OCR:", uploadError);
          state.value = { status: "processing", progress: 50 };
          ocrResult = await withTimeout(
            processWithTesseract(files),
            LOCAL_OCR_TIMEOUT_MS,
            "On-device OCR timed out",
          );
          ocrResult.storageIds = [];
          ocrResult.storageId = undefined;
          return finish(ocrResult);
        }

        if (runId !== latestRunId) return { form };
        state.value = {
          status: "processing",
          progress: 50,
          result: { storageId: storageIds[0], storageIds },
        };
        try {
          ocrResult = await withTimeout(
            client.action(api.functions.ocrOpenRouter.processReceipt, {
              images: frames.map((f) => ({ image: f.base64, contentType: f.contentType })),
            }),
            AI_TIMEOUT_MS,
            "AI analysis timed out",
          );
        } catch (aiError) {
          console.warn("AI OCR failed; using on-device OCR:", aiError);
          ocrResult = await withTimeout(
            processWithTesseract(files),
            LOCAL_OCR_TIMEOUT_MS,
            "On-device OCR timed out",
          );
        }
      }

      ocrResult.storageIds = storageIds;
      ocrResult.storageId = storageIds[0];
      return finish(ocrResult);
    } catch (e: unknown) {
      if (runId === latestRunId) {
        state.value = {
          status: "error",
          progress: 0,
          error: (e as Error)?.message || "OCR processing failed",
          result: state.value.result, // preserve successfully uploaded attachments
        };
      }
      throw e;
    }

    function finish(result: OcrResult): OcrOutcome {
      if (runId !== latestRunId) return { form };
      state.value = { status: "done", progress: 100, result };
      return {
        form: applyOcrToForm(
          { store: result.store, date: result.date, total: result.total, raw: result.rawText ?? "" },
          form,
        ),
        result,
      };
    }
  }

  /** Uploads frames captured during on-device OCR once connectivity is available. */
  async function uploadPending(): Promise<{ storageId?: string; storageIds: string[] }> {
    const existing = state.value.result?.storageIds;
    if (existing?.length) return { storageId: existing[0], storageIds: existing };
    if (!pendingFrames.length || isOffline()) return { storageIds: [] };
    const runId = ++latestRunId;
    const ids = await uploadFrames(pendingFrames, runId);
    if (state.value.result) {
      state.value.result = { ...state.value.result, storageId: ids[0], storageIds: ids };
    }
    return { storageId: ids[0], storageIds: ids };
  }

  function reset() {
    latestRunId++;
    pendingFrames = [];
    state.value = { status: "idle", progress: 0 };
  }

  return {
    state: readonly(state),
    processReceipt,
    uploadPending,
    reset,
  };
}
