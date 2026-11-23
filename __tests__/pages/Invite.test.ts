/**
 * @vitest-env happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";

// Plain mutable query object; Invite.vue reads route.query.token synchronously.
const routeQuery = { token: "" };
(globalThis as unknown as { useRoute: () => { query: typeof routeQuery } }).useRoute = () => ({ query: routeQuery });

globalThis.navigateTo = vi.fn();

const mockAcceptInvite = vi.fn();

vi.mock("~/composables/useOrgs", () => ({
  useOrgs: () => ({
    acceptInvite: mockAcceptInvite,
  }),
}));

const Invite = (await import("../../app/pages/invite.vue")).default;

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

describe("Invite.vue page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.navigateTo.mockClear();
    mockAcceptInvite.mockReset();
    routeQuery.token = "";
  });

  it("shows invalid invitation error when no token", () => {
    const wrapper = mount(Invite);
    expect(wrapper.find(".invite-error").exists()).toBe(true);
    expect(wrapper.text()).toContain("Invalid invitation");
    expect(wrapper.text()).toContain("No invitation token was provided");
  });

  it("shows loading state while accepting", async () => {
    routeQuery.token = "valid-token-123";
    mockAcceptInvite.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
    const wrapper = mount(Invite);
    // Auto-accept sets loading synchronously on mount.
    expect(wrapper.find(".invite-loading").exists()).toBe(true);
    expect(wrapper.text()).toContain("Accepting invitation");
  });

  it("shows success state when invite accepted", async () => {
    routeQuery.token = "valid-token-123";
    mockAcceptInvite.mockResolvedValue({
      orgName: "Test Household",
      role: "member",
    });
    const wrapper = mount(Invite);
    await tick();
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".invite-success").exists()).toBe(true);
    expect(wrapper.text()).toContain("Joined Test Household!");
    expect(wrapper.text()).toContain("member");
  });

  it("shows error state when accept fails", async () => {
    routeQuery.token = "valid-token-123";
    mockAcceptInvite.mockRejectedValue(new Error("Invalid invite token"));
    const wrapper = mount(Invite);
    await tick();
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".invite-error").exists()).toBe(true);
    expect(wrapper.text()).toContain("Invitation could not be accepted");
    expect(wrapper.text()).toContain("Invalid invite token");
  });

  it("shows error state when invite expired", async () => {
    routeQuery.token = "valid-token-123";
    mockAcceptInvite.mockRejectedValue(new Error("Invite has expired"));
    const wrapper = mount(Invite);
    await tick();
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".invite-error").exists()).toBe(true);
    expect(wrapper.text()).toContain("Invitation could not be accepted");
    expect(wrapper.text()).toContain("Invite has expired");
  });
});