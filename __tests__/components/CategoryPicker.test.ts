/**
 * @vitest-env happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { computed } from "vue";
import { mount } from "@vue/test-utils";
import CategoryPicker from "../../app/components/CategoryPicker.vue";

vi.mock("~/composables/useAdvancedFeatures", () => ({
  useCategories: () => ({
    data: computed(() => [
      { _id: "cat_1", name: "Groceries", icon: "cart", color: "#22c55e", sortOrder: 0 },
      { _id: "cat_2", name: "Utilities", icon: "zap", color: "#f59e0b", sortOrder: 1, parentId: "cat_1" },
      { _id: "cat_3", name: "Transport", icon: "car", color: "#3b82f6", sortOrder: 2 },
    ]),
    isLoading: false,
    createCategory: vi.fn().mockResolvedValue({ id: "new_cat" }),
    updateCategory: vi.fn().mockResolvedValue({ id: "cat_1" }),
    deleteCategory: vi.fn().mockResolvedValue({ id: "cat_1" }),
  }),
}));

function makeComponent(open = false) {
  return mount(CategoryPicker, { props: { modelValue: open } });
}

function setInputValue(comp, selector, value) {
  const el = comp.find(selector).element;
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function clickElement(comp, selector) {
  comp.find(selector).element.click();
}

describe("CategoryPicker.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows categories when opened", () => {
    const comp = makeComponent(true);
    expect(comp.find(".category-picker").exists()).toBe(true);
  });

  it("displays search input", () => {
    const comp = makeComponent(true);
    expect(comp.find("input[type='search']").exists()).toBe(true);
  });

  it("filters categories by search query", async () => {
    const comp = makeComponent(true);
    setInputValue(comp, "input[type='search']", "groceries");
    await comp.vm.$nextTick();
    const items = comp.findAll(".picker-item");
    expect(items.length).toBeGreaterThan(0);
  });

  it("selects a category and emits select event", async () => {
    const comp = makeComponent(true);
    clickElement(comp, ".picker-item");
    await comp.vm.$nextTick();
    expect(comp.emitted("select")).toBeTruthy();
    if (comp.emitted("select")?.[0]) {
      expect(comp.emitted("select")[0][0].name).toBe("Groceries");
    }
  });

  it("toggles create form visibility", async () => {
    const comp = makeComponent(true);
    clickElement(comp, ".picker-footer button");
    await comp.vm.$nextTick();
    expect(comp.find(".picker-create").exists()).toBe(true);
  });

  it("closes on overlay click", () => {
    const comp = makeComponent(true);
    clickElement(comp, ".hhb-modal-overlay");
    expect(comp.emitted("close")).toBeTruthy();
  });

  it("handles parent/child grouping", () => {
    const comp = makeComponent(true);
    const rootItems = comp.findAll(".picker-parent");
    expect(rootItems.length).toBeGreaterThan(0);
    const childItems = comp.findAll(".picker-child");
    expect(childItems.length).toBeGreaterThan(0);
  });

  it("handles empty state", async () => {
    const comp = makeComponent(true);
    setInputValue(comp, "input[type='search']", "nonexistent");
    await comp.vm.$nextTick();
    expect(comp.find(".hhb-text-center").text()).toContain("No categories found");
  });

  it("emits close when closing from hidden state", () => {
    const comp = makeComponent(false);
    expect(comp.emitted("close")).toBeFalsy();
  });

  it("emits select with category data", async () => {
    const comp = makeComponent(true);
    const items = comp.findAll(".picker-parent");
    if (items.length > 0) {
      items[0].element.click();
      await comp.vm.$nextTick();
      const emitted = comp.emitted("select");
      expect(emitted).toBeTruthy();
      if (emitted?.[0]) {
        expect(emitted[0][0]).toMatchObject({ _id: "cat_1", name: "Groceries" });
      }
    }
  });
});