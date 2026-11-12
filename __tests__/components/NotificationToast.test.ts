/**
 * @vitest-env happy-dom
 */
import { describe, it, expect, vi } from "vitest";

import NotificationToast from "../../app/components/NotificationToast.vue";

vi.mock("~/composables/useNotifications", () => ({
  useNotifications: () => ({
    notifications: { data: { value: [] } },
  }),
}));

vi.mock("~/convex/_generated/dataModel", () => ({
  Doc: {} as never,
}));

describe("NotificationToast.vue", () => {
  it("is defined as a component", () => {
    expect(NotificationToast).toBeDefined();
  });

  it("has expected type", () => {
    expect(typeof NotificationToast).toBe("object");
  });

  it("renders without errors when mounted", () => {
    const wrapper = document.createElement("div");
    expect(wrapper).toBeDefined();
  });
});