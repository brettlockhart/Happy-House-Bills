/**
 * @vitest-env happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

import AddExpenseModal from "../../app/components/AddExpenseModal.vue";

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
}));

describe("AddExpenseModal.vue", () => {
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
    await wrapper.find('button[type="button"]').trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits submit with form data and paidBy from currentUserId", async () => {
    const wrapper = mount(AddExpenseModal, {
      props: { isOpen: true, currentUserId: "user_1" },
    });
    await wrapper.find('input[type="number"]').setValue("100");
    await wrapper.find("textarea").setValue("Test notes");
    await wrapper.find("form").trigger("submit.prevent");
    expect(wrapper.emitted("submit")).toBeTruthy();
    const submitPayload = wrapper.emitted("submit")![0][0] as Record<string, unknown>;
    expect(submitPayload.amount).toBe(100);
    expect(submitPayload.notes).toBe("Test notes");
    expect(submitPayload.category).toBe("other");
    expect(submitPayload.paidBy).toBe("user_1");
  });
});
