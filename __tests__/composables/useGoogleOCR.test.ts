import { describe, it, expect, vi, beforeEach } from "vitest";

const mockClient = vi.hoisted(() => ({
  action: vi.fn(),
}));

const mockApplyOcrToForm = vi.hoisted(() => vi.fn());
const mockParseOcrText = vi.hoisted(() => vi.fn());

vi.mock("convex-vue", () => ({
  useConvexClient: () => mockClient,
}));

vi.mock("~~/convex/_generated/api", () => ({
  api: {
    functions: {
      uploadReceipt: { uploadReceipt: { _name: "uploadReceipt" } },
      ocrOpenRouter: { processReceipt: { _name: "processReceipt" } },
    },
  },
}));

vi.mock("~/utils/ocrParser", () => ({
  applyOcrToForm: mockApplyOcrToForm,
  parseOcrText: mockParseOcrText,
}));

vi.mock("tesseract.js", () => ({
  default: { recognize: vi.fn() },
}));

const { useGoogleOCR } = await import("../../app/composables/useGoogleOCR");

function makeFile(name = "receipt.jpg", type = "image/jpeg") {
  return new File(["fake receipt image"], name, { type });
}

function givenOcrResult(result: unknown) {
  // First call to client.action is uploadReceipt, second is ocr.processReceipt
  mockClient.action
    .mockResolvedValueOnce({ storageId: "st_1", uploadBy: "user_1", orgId: "org_1", width: 800, height: 600, size: 100, uploadAt: Date.now() })
    .mockResolvedValue(result);
}

function givenOcrRejection(error: Error) {
  mockClient.action
    .mockResolvedValueOnce({ storageId: "st_1", uploadBy: "user_1", orgId: "org_1", width: 800, height: 600, size: 100, uploadAt: Date.now() })
    .mockRejectedValue(error);
}

beforeEach(() => {
  vi.resetAllMocks();
  mockApplyOcrToForm.mockImplementation((ocrResult: Record<string, unknown>, form: Record<string, unknown>) => ({
    ...form,
    store: ocrResult.store,
    date: ocrResult.date,
    total: ocrResult.total !== undefined ? parseFloat(String(ocrResult.total)) : form.total,
  }));
  mockParseOcrText.mockImplementation((text: string) => ({
    store: text.split("\n")[0] || undefined,
    date: undefined,
    total: undefined,
    raw: text,
  }));
});

describe("useGoogleOCR — success path", () => {
  it("processes a receipt through Document AI and returns OCR-populated form", async () => {
    const ocrResult = { store: "Target", date: "2024-12-25", total: "45.99", confidence: 0.9, rawText: "Target\nTotal $45.99" };
    givenOcrResult(ocrResult);
    mockApplyOcrToForm.mockReturnValue({ store: "Target", amount: 45.99, date: "2024-12-25", category: "other" });

    const { state, processReceipt } = useGoogleOCR();
    const form: Record<string, unknown> = { amount: 0, date: "", store: "", category: "other" };
    const file = makeFile();

    const returned = await processReceipt(file, form);

    expect(state.value.status).toBe("done");
    expect(state.value.progress).toBe(100);
    expect(state.value.result?.store).toBe("Target");
    expect(state.value.result?.date).toBe("2024-12-25");
    expect(state.value.result?.total).toBe("45.99");
    expect(state.value.result?.confidence).toBe(0.9);
    expect(returned.form.store).toBe("Target");
    expect(returned.form.amount).toBe(45.99);

    // uploadReceipt called first, then ocr.processReceipt, both with base64 image
    const calls = mockClient.action.mock.calls;
    expect(calls[0][0]).toBe((await import("~~/convex/_generated/api")).api.functions.uploadReceipt.uploadReceipt);
    expect(calls[0][1].contentType).toBe("image/jpeg");
    expect(calls[1][0]).toBe((await import("~~/convex/_generated/api")).api.functions.ocrOpenRouter.processReceipt);
    expect(calls[1][1].images[0].contentType).toBe("image/jpeg");
  });

  it("exposes line items from OCR result", async () => {
    const lineItems = [
      {
        description: "Milk",
        quantity: 2,
        unitPrice: 6,
        totalPrice: 12,
        categoryHint: "groceries",
        confidence: 0.9,
        lowConfidence: false,
      },
    ];
    givenOcrResult({ store: "Target", date: "2024-12-25", total: "45.99", confidence: 0.9, rawText: "Target\nTotal $45.99", lineItems });
    mockApplyOcrToForm.mockReturnValue({});

    const { state, processReceipt } = useGoogleOCR();
    await processReceipt(makeFile(), {});

    expect(state.value.status).toBe("done");
    expect(state.value.result?.lineItems).toEqual(lineItems);
  });

  it("advances progress to 100 on success", async () => {
    givenOcrResult({ store: "X", date: "2024-01-01", total: "1.00", confidence: 0.8, rawText: "x" });
    mockApplyOcrToForm.mockReturnValue({});

    const { state, processReceipt } = useGoogleOCR();
    await processReceipt(makeFile(), {});

    expect(state.value.status).toBe("done");
    expect(state.value.progress).toBe(100);
    expect(state.value.error).toBeUndefined();
  });
});

describe("useGoogleOCR — Document AI failure → Tesseract fallback", () => {
  it("falls back to Tesseract when Document AI errors, then completes", async () => {
    const docAiError = new Error("Document AI unavailable");
    givenOcrRejection(docAiError);

    const tesseract = await import("tesseract.js");
    const recognize = tesseract.default.recognize;
    (recognize as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { text: "TARGET STORE\nTotal $10.00", confidence: 82 } });

    const { state, processReceipt } = useGoogleOCR();
    const returned = await processReceipt(makeFile(), {});

    expect(state.value.status).toBe("done");
    expect(state.value.progress).toBe(100);
    expect(state.value.result?.store).toBe("TARGET STORE");
    expect(state.value.result?.confidence).toBe(82);
    expect(state.value.result?.rawText).toBe("TARGET STORE\nTotal $10.00");
    expect(returned.form.store).toBe("TARGET STORE");
  });

  it("sets error state and re-throws when both Document AI and Tesseract fail", async () => {
    const docAiError = new Error("Document AI unavailable");
    givenOcrRejection(docAiError);

    const tesseract = await import("tesseract.js");
    const recognize = tesseract.default.recognize;
    (recognize as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Tesseract failed"));

    const { state, processReceipt } = useGoogleOCR();
    await expect(processReceipt(makeFile(), {})).rejects.toThrow("Tesseract failed");

    expect(state.value.status).toBe("error");
    expect(state.value.progress).toBe(0);
    expect(state.value.error).toBe("Tesseract failed");
  });
});

describe("useGoogleOCR — reset", () => {
  it("returns state to idle with progress 0", async () => {
    givenOcrResult({ store: "X", date: "2024-01-01", total: "1.00", confidence: 0.8, rawText: "x" });
    mockApplyOcrToForm.mockReturnValue({});

    const { state, reset, processReceipt } = useGoogleOCR();
    await processReceipt(makeFile(), {});
    expect(state.value.status).toBe("done");

    reset();
    expect(state.value.status).toBe("idle");
    expect(state.value.progress).toBe(0);
  });
});

describe("useGoogleOCR — reliability", () => {
  it("keeps uploaded attachment IDs when AI falls back to on-device OCR", async () => {
    givenOcrRejection(new Error("rate limited"));
    const tesseract = await import("tesseract.js");
    (tesseract.default.recognize as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { text: "TARGET STORE\nTotal $10.00", confidence: 82 },
    });
    const { state, processReceipt } = useGoogleOCR();
    await processReceipt(makeFile(), {});
    expect(state.value.result?.source).toBe("tesseract");
    expect(state.value.result?.storageIds).toEqual(["st_1"]);
  });

  it("ignores a stale OCR run that finishes after a newer run", async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    const first = new Promise((resolve) => { resolveFirst = resolve; });
    let ocrCalls = 0;
    mockClient.action.mockImplementation((fn) => {
      if (fn._name === "uploadReceipt") return Promise.resolve({ storageId: "st_1" });
      ocrCalls++;
      if (ocrCalls === 1) return first;
      return Promise.resolve({ store: "NEW", total: "20", confidence: 90 });
    });

    const { state, processReceipt } = useGoogleOCR();
    const runA = processReceipt(makeFile("a.jpg"), {});
    await vi.waitFor(() => expect(ocrCalls).toBe(1));
    await processReceipt(makeFile("b.jpg"), {});
    resolveFirst!({ store: "OLD", total: "10", confidence: 90 });
    await runA;
    expect(state.value.result?.store).toBe("NEW");
    expect(state.value.result?.total).toBe("20");
  });

  it("processes every photo on-device while offline and uploads later", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    const tesseract = await import("tesseract.js");
    (tesseract.default.recognize as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { text: "STORE A\nTotal $1.00", confidence: 80 } })
      .mockResolvedValueOnce({ data: { text: "Section B\nTotal $2.00", confidence: 85 } });
    mockParseOcrText.mockImplementation((_text: string) => ({ store: "STORE A", total: "3.00" }));

    try {
      const { state, processReceipt, uploadPending } = useGoogleOCR();
      const outcome = await processReceipt([makeFile("a.jpg"), makeFile("b.jpg")], {});
      expect(mockClient.action).not.toHaveBeenCalled();
      expect(outcome.result?.source).toBe("tesseract");
      expect(outcome.result?.rawText).toContain("Section B");
      expect(outcome.result?.rawText).toContain("next receipt section");
      expect(state.value.result?.confidence).toBe(83);

      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      mockClient.action
        .mockResolvedValueOnce({ storageId: "st_online_1" })
        .mockResolvedValueOnce({ storageId: "st_online_2" });
      const uploaded = await uploadPending();
      expect(uploaded.storageIds).toEqual(["st_online_1", "st_online_2"]);
    } finally {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    }
  });
});
