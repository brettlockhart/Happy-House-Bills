import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AIReviewModal from "../../app/components/AIReviewModal.vue";

const review = {
  _id: "expense_1",
  store: "Saved Store",
  date: "2024-01-01",
  amount: 50,
  suggestion: {
    store: "AI Store",
    date: "2024-01-02",
    amount: 45.99,
    confidence: 90,
    lineItems: [{ description: "Milk", totalPrice: 12 }],
  },
};

describe("AIReviewModal", () => {
  it("shows saved and AI values without applying them automatically", () => {
    const wrapper = mount(AIReviewModal, { props: { isOpen: true, reviews: [review] } });
    expect(wrapper.text()).toContain("Saved Store");
    expect(wrapper.text()).toContain("AI Store");
    expect(wrapper.text()).toContain("$50.00");
    expect(wrapper.text()).toContain("$45.99");
    expect(wrapper.emitted("apply")).toBeUndefined();
    expect(wrapper.emitted("dismiss")).toBeUndefined();
  });

  it("emits apply and dismiss only on explicit user action", async () => {
    const wrapper = mount(AIReviewModal, { props: { isOpen: true, reviews: [review] } });
    (wrapper.find('button.hhb-btn--primary').element as HTMLButtonElement).click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("apply")?.[0]).toEqual(["expense_1"]);
    (wrapper.find('button.hhb-btn--secondary').element as HTMLButtonElement).click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("dismiss")?.[0]).toEqual(["expense_1"]);
  });
});
