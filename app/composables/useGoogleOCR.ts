import { ref, readonly } from "vue";
import { useConvexClient } from "convex-vue";
import { api } from "~/convex/_generated/api";
import { applyOcrToForm, parseOcrText } from "~/utils/ocrParser";

export interface OcrState {
  status: "idle" | "preprocessing" | "uploading" | "processing" | "done" | "error";
  progress: number;
  result?: {
    store?: string;
    date?: string;
    total?: string;
    storageId?: string;
    confidence?: number;
    lowConfidence?: boolean;
  };
  error?: string;
}

interface UploadResult {
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

export function useGoogleOCR() {
  const client = useConvexClient();
  const state = ref<OcrState>({
    status: "idle",
    progress: 0,
  });

  async function processReceipt(
    file: File,
    form: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    state.value = { status: "preprocessing", progress: 10 };

    try {
      const base64 = await fileToDataUrl(file);
      const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");

      state.value = { status: "uploading", progress: 30 };

      const uploadResult = (await client.action(api.functions.uploadReceipt.uploadReceipt, {
        image: base64Data,
        contentType: file.type || "image/jpeg",
      })) as UploadResult;

      state.value.result = {
        storageId: uploadResult.storageId,
      };

      state.value = { status: "processing", progress: 50, result: state.value.result };

      let ocrResult: { store?: string; date?: string; total?: string; confidence: number; rawText: string; lowConfidence?: boolean };

      try {
        ocrResult = await client.action(api.functions.ocr.processReceipt, {
          image: base64Data,
          contentType: file.type || "image/jpeg",
        });
      } catch (docAiError) {
        const sanitizedError = docAiError instanceof Error ? docAiError.message : String(docAiError);
        console.warn("Document AI failed, falling back to Tesseract.js:", sanitizedError);
        ocrResult = await processWithTesseract(file);
      }

      state.value = {
        status: "done",
        progress: 100,
        result: {
          ...state.value.result,
          ...ocrResult,
        },
      };

      return applyOcrToForm(
        { store: ocrResult.store, date: ocrResult.date, total: ocrResult.total, raw: ocrResult.rawText },
        form,
      );
    } catch (e: unknown) {
      state.value = {
        status: "error",
        progress: 0,
        error: (e as Error)?.message || "OCR processing failed",
      };
      throw e;
    }
  }

  async function processWithTesseract(file: File): Promise<{ store?: string; date?: string; total?: string; confidence: number; rawText: string }> {
    const Tesseract = (await import("tesseract.js")).default;
    const dataUrl = await fileToDataUrl(file);

    const { data: { text } } = await Tesseract.recognize(
      dataUrl,
      "eng",
      {
        logger: (m: { progress?: number; status?: string }) => {
          if (m.progress !== undefined) {
            state.value.progress = 50 + m.progress * 50;
          }
        },
      },
    );

    const ocrResult = parseOcrText(text);

    return {
      store: ocrResult.store,
      date: ocrResult.date,
      total: ocrResult.total,
      confidence: 70,
      rawText: text,
    };
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