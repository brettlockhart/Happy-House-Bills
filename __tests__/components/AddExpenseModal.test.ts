/**
 * @vitest-env happy-dom
 */
import { ref } from "vue";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";

import AddExpenseModal from "../../app/components/AddExpenseModal.vue";

const mockProcessReceipt = vi.hoisted(() => vi.fn());
const mockResetOcr = vi.hoisted(() => vi.fn());
const mockOcrState = ref({ status: "idle", progress: 0, result: undefined, error: undefined });

vi.mock("~/composables/useGoogleOCR", () => ({
  useGoogleOCR: () => ({
    state: mockOcrState,
    processReceipt: mockProcessReceipt,
    reset: mockResetOcr,
  }),
}));

vi.mock("~/convex/_generated/api", () => ({
  api: {
    expenses: {
      create: { _name: "create" },
    },
  },
  BalanceResult: {} as never,
  Expense: {} as never,
}));

vi.mock("~/convex/_generated/dataModel", () => ({
  Doc: {} as never,
  Id: {} as never,
}));

vi.mock("convex-vue", () => ({
  useConvexMutation: () => ({
    mutate: vi.fn().mockResolvedValue({ id: "new_expense" }),
    isPending: { value: false },
    error: { value: null },
  }),
  useConvexQuery: () => ({
    data: { value: undefined },
    isPending: { value: false },
    error: { value: null },
  }),
}));

describe("AddExpenseModal.vue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockOcrState.value = { status: "idle", progress: 0, result: undefined, error: undefined };
  });

  it("renders nothing when isOpen is false", () => {
    const wrapper = mount(AddExpenseModal, {
      props: { isOpen: false, currentUserId: "user_1" },
    });
    expect(wrapper.find(".hhb-modal-overlay").exists()).toBe(false);
  });

  it("renders when isOpen is true", () => {
    const wrapper = mount(AddExpenseModal, {
      props: { isOpen: true, currentUserId: "user_1" },
    });
    expect(wrapper.find(".hhb-modal-overlay").exists()).toBe(true);
    expect(wrapper.find("h2").text()).toBe("Add Expense");
  });

  it("shows 'Edit Expense' heading when expense prop is provided", () => {
    const wrapper = mount(AddExpenseModal, {
      props: {
        isOpen: true,
        currentUserId: "user_1",
        expense: { _id: "1", amount: 50, date: "2024-01-01", category: "groceries", paidBy: "user_1", status: "pending", enteredBy: "user_1" },
      },
    });
    expect(wrapper.find("h2").text()).toBe("Edit Expense");
  });

  it("emits close when Cancel button clicked", async () => {
    const wrapper = mount(AddExpenseModal, {
      props: { isOpen: true, currentUserId: "user_1" },
    });
    const cancelButton = wrapper.findAll('button[type="button"]').find((b) => b.text() === "Cancel");
    await cancelButton!.element.click();
    expect(wrapper.emitted("close")).toBeTruthy();
    wrapper.unmount();
  });

  it("emits submit with form data and paidBy from currentUserId", async () => {
    const wrapper = mount(AddExpenseModal, {
      props: { isOpen: true, currentUserId: "user_1" },
    });
    const amountInput = wrapper.find('input[type="number"]').element as HTMLInputElement;
    amountInput.value = "100";
    amountInput.dispatchEvent(new Event("input", { bubbles: true }));
    const notesInput = wrapper.find("textarea").element as HTMLTextAreaElement;
    notesInput.value = "Test notes";
    notesInput.dispatchEvent(new Event("input", { bubbles: true }));
    await wrapper.find("form").element.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(wrapper.emitted("submit")).toBeTruthy();
    const submitPayload = wrapper.emitted("submit")![0][0] as Record<string, unknown>;
    expect(submitPayload.amount).toBe(100);
    expect(submitPayload.notes).toBe("Test notes");
    expect(submitPayload.category).toBe("other");
    expect(submitPayload.paidBy).toBe("user_1");
  });

  describe("OCR flow and progress states", () => {
    it("hides OCR status block when status is idle", () => {
      const wrapper = mount(AddExpenseModal, {
        props: { isOpen: true, currentUserId: "user_1" },
      });
      expect(wrapper.find(".ocr-status").exists()).toBe(false);
    });

    it("shows OCR status block with progress text and bar when processing", async () => {
      mockOcrState.value = { status: "processing", progress: 50, result: undefined, error: undefined };
      const wrapper = mount(AddExpenseModal, {
        props: { isOpen: true, currentUserId: "user_1" },
      });
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".ocr-status").exists()).toBe(true);
      expect(wrapper.find(".ocr-progress span").text()).toBe("Running OCR...");
      const progress = wrapper.find("progress");
      expect(progress.exists()).toBe(true);
      expect(progress.element.value).toBe(50);
      expect(progress.element.max).toBe(100);
    });

    it("shows 'OCR complete — review fields' when status is done", async () => {
      mockOcrState.value = { status: "done", progress: 100, result: { store: "Target" }, error: undefined };
      const wrapper = mount(AddExpenseModal, {
        props: { isOpen: true, currentUserId: "user_1" },
      });
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".ocr-progress span").text()).toBe("OCR complete — review fields");
    });

    it("shows 'OCR failed' and the error message when status is error", async () => {
      mockOcrState.value = { status: "error", progress: 0, result: undefined, error: "Document AI unavailable" };
      const wrapper = mount(AddExpenseModal, {
        props: { isOpen: true, currentUserId: "user_1" },
      });
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".ocr-progress span").text()).toBe("OCR failed");
      expect(wrapper.find(".ocr-error").text()).toBe("Document AI unavailable");
    });

    it("maps all OCR statuses to the correct status text", async () => {
      const cases: Array<{ status: string; expected: string }> = [
        { status: "preprocessing", expected: "Preprocessing image..." },
        { status: "uploading", expected: "Uploading receipt..." },
        { status: "processing", expected: "Running OCR..." },
        { status: "done", expected: "OCR complete — review fields" },
        { status: "error", expected: "OCR failed" },
      ];

      for (const { status, expected } of cases) {
        mockOcrState.value = { status: status as "preprocessing" | "uploading" | "processing" | "done" | "error", progress: 0, result: undefined, error: undefined };
        const wrapper = mount(AddExpenseModal, {
          props: { isOpen: true, currentUserId: "user_1" },
        });
        await wrapper.vm.$nextTick();
        expect(wrapper.find(".ocr-progress span").text()).toBe(expected);
        wrapper.unmount();
      }
    });

    it("disables submit button while processing or uploading", async () => {
      for (const status of ["processing", "uploading"] as const) {
        mockOcrState.value = { status, progress: 50, result: undefined, error: undefined };
        const wrapper = mount(AddExpenseModal, {
          props: { isOpen: true, currentUserId: "user_1" },
        });
        await wrapper.vm.$nextTick();
        expect(wrapper.find('button[type="submit"]').element.disabled).toBe(true);
        wrapper.unmount();
      }

      mockOcrState.value = { status: "done", progress: 100, result: undefined, error: undefined };
      const wrapper = mount(AddExpenseModal, {
        props: { isOpen: true, currentUserId: "user_1" },
      });
      await wrapper.vm.$nextTick();
      expect(wrapper.find('button[type="submit"]').element.disabled).toBe(false);
    });
  });
});
