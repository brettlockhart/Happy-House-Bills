/**
 * @vitest-env happy-dom
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CategoryBadge from "../../app/components/CategoryBadge.vue";

describe("CategoryBadge.vue", () => {
  it("renders category name", () => {
    const wrapper = mount(CategoryBadge, {
      props: { category: "Groceries", color: "#22c55e" },
    });
    expect(wrapper.text()).toContain("Groceries");
  });

  it("applies colour border", () => {
    const wrapper = mount(CategoryBadge, {
      props: { category: "Groceries", color: "#22c55e" },
    });
    expect(wrapper.find(".hhb-category-badge").element.style.borderColor).toBe("#22c55e");
  });

  it("renders icon when provided", () => {
    const wrapper = mount(CategoryBadge, {
      props: { category: "Groceries", color: "#22c55e", icon: "cart" },
    });
    expect(wrapper.find(".hhb-badge-icon").exists()).toBe(true);
    expect(wrapper.find(".hhb-badge-icon").text()).toBe("cart");
  });

  it("does not render icon when not provided", () => {
    const wrapper = mount(CategoryBadge, {
      props: { category: "Groceries", color: "#22c55e" },
    });
    expect(wrapper.find(".hhb-badge-icon").exists()).toBe(false);
  });

  it("applies background colour tint", () => {
    const wrapper = mount(CategoryBadge, {
      props: { category: "Groceries", color: "#22c55e" },
    });
    expect(wrapper.find(".hhb-category-badge").element.style.backgroundColor).toBe("#22c55e1a");
  });
});
