/**
 * @vitest-env happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";

import NotificationBell from "../../app/components/NotificationBell.vue";

const mockUnreadCountValue = vi.hoisted(() => ({ value: 0 }));
const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();

vi.mock("~/composables/useNotifications", () => ({
  useNotifications: () => ({
    notifications: {
      data: { value: [] },
    },
    unreadCount: {
      data: mockUnreadCountValue,
    },
    markRead: mockMarkRead,
    markAllRead: mockMarkAllRead,
  }),
}));

vi.mock("~/convex/_generated/dataModel", () => ({
  Doc: {} as never,
}));

describe("NotificationBell.vue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUnreadCountValue.value = 0;
  });

  it("renders bell button with SVG", () => {
    const wrapper = mount(NotificationBell, {
      props: { modelValue: false },
    });
    expect(wrapper.find("svg").exists()).toBe(true);
  });

  it("emits update:modelValue when bell button clicked", async () => {
    const wrapper = mount(NotificationBell, {
      props: { modelValue: false },
    });
    await wrapper.find("button").element.click();
    expect(wrapper.emitted("update:modelValue")).toBeTruthy();
  });

  it("has correct aria label with unread count", () => {
    mockUnreadCountValue.value = 3;
    const wrapper = mount(NotificationBell, {
      props: { modelValue: false },
    });
    const ariaLabel = wrapper.find("button").attributes("aria-label");
    expect(ariaLabel).toContain("3 unread");
  });

  it("has correct aria label when no unread count", () => {
    mockUnreadCountValue.value = 0;
    const wrapper = mount(NotificationBell, {
      props: { modelValue: false },
    });
    const ariaLabel = wrapper.find("button").attributes("aria-label");
    expect(ariaLabel).not.toContain("unread");
  });

  it("shows badge when unread count > 0", () => {
    mockUnreadCountValue.value = 5;
    const wrapper = mount(NotificationBell, {
      props: { modelValue: false },
    });
    expect(wrapper.find(".text-xs.font-bold.rounded-full").exists()).toBe(true);
  });

  it("shows '9+' badge when unread count > 9", () => {
    mockUnreadCountValue.value = 12;
    const wrapper = mount(NotificationBell, {
      props: { modelValue: false },
    });
    const badge = wrapper.find(".text-xs.font-bold.rounded-full");
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe("9+");
  });
});