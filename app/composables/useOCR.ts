import { ref, readonly } from "vue";
import Tesseract from "tesseract.js";
import { preprocessImage } from "~/utils/imageUtils";
import { parseOcrText, applyOcrToForm } from "~/utils/ocrParser";
import { useConvexClient } from "convex-vue";
import { api } from "~/convex/_generated/api";

export interface OcrState {
  status: "idle" | "preprocessing" | "uploading" | "processing" | "done" | "error";
  progress: number;
  result?: {
    store?: string;
    date?: string;
    total?: string;
    storageId?: string;
    previewUrl?: string;
  };
  error?: string;
}

export interface UploadResult {
  storageId: string;
  uploadBy: string;
  orgId: string;
  width: number;
  height: number;
  size: number;
  uploadAt: number;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function useOCR() {
  const client = useConvexClient();
  const state = ref<OcrState>({
    status: "idle",
    progress: 0,
  });

  async function processReceipt(
    file: File,
    form: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    state.value = { status: "preprocessing", progress: 20 };

    try {
      const base64 = await preprocessImage(file);

      state.value = { status: "uploading", progress: 40 };

      const uploadResult = (await client.action(api.uploadReceipt, {
        image: base64,
        contentType: "image/jpeg",
      })) as UploadResult;

      const previewUrl = uploadResult.storageId
        ? `${process.env.NUXT_PUBLIC_CONVEX_URL || ""}${uploadResult.storageId}`
        : undefined;

      state.value.result = {
        storageId: uploadResult.storageId,
        previewUrl,
      };

      state.value = { status: "processing", progress: 60, result: state.value.result };

      const { data: { text } } = await Tesseract.recognize(
        await fileToDataUrl(file),
        "eng",
        {
          logger: (m: { progress?: number; status?: string }) => {
            if (m.progress !== undefined) {
              state.value.progress = 60 + m.progress * 35;
            }
          },
        },
      );

      const ocrResult = parseOcrText(text);
      state.value = {
        status: "done",
        progress: 100,
        result: {
          ...state.value.result,
          ...ocrResult,
        },
      };

      return applyOcrToForm(ocrResult, form);
    } catch (e: unknown) {
      state.value = {
        status: "error",
        progress: 0,
        error: (e as Error)?.message || "OCR processing failed",
      };
      throw e;
    }
  }

  function reset() {
    state.value = { status: "idle", progress: 0 };
  }

  return {
    state: readonly(state),
    processReceipt,
    reset,
  };
}
