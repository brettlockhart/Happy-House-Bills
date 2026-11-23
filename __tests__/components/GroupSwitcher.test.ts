/**
 * @vitest-env happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref, computed, h } from "vue";

// Mock defineAsyncComponent so happy-dom's async component handling works in tests
(globalThis as unknown as Record<string, unknown>).defineAsyncComponent = () => mockOrgSwitcher;

const mockHasOrg = ref(true);
const mockOrgId = ref("org_1");

vi.mock("~/composables/useAuth", () => ({
  useAuth: () => ({
    isSignedIn: ref(true),
    isLoaded: ref(true),
    user: ref({ id: "user_1", fullName: "Test User" }),
    userId: ref("user_1"),
    sessionId: ref("session_1"),
    orgId: computed(() => mockOrgId.value),
    hasOrg: computed(() => mockHasOrg.value),
    isFullyLoaded: ref(true),
  }),
}));

// Mock the @clerk/vue import to return a sync OrganizationSwitcher component
const mockOrgSwitcher = {
  name: "OrganizationSwitcher",
  props: ["afterCreateOrganizationUrl", "afterLeaveOrganizationUrl", "afterSelectOrganizationUrl"],
  render() {
    return h("div", { "data-testid": "org-switcher" }, "Organization Switcher");
  },
};

vi.mock("@clerk/vue", () => ({
  OrganizationSwitcher: mockOrgSwitcher,
}));

const GroupSwitcher = (await import("../../app/components/GroupSwitcher.vue")).default;

describe("GroupSwitcher.vue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockHasOrg.value = true;
    mockOrgId.value = "org_1";
  });

  it("renders OrganizationSwitcher when hasOrg is true", async () => {
    const wrapper = mount(GroupSwitcher);
    await flushPromises();
    expect(wrapper.find('[data-testid="org-switcher"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("does not render OrganizationSwitcher when hasOrg is false", async () => {
    mockHasOrg.value = false;
    const wrapper = mount(GroupSwitcher);
    await flushPromises();
    expect(wrapper.find('[data-testid="org-switcher"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("does not render OrganizationSwitcher when orgId is null", async () => {
    mockOrgId.value = null;
    mockHasOrg.value = false;
    const wrapper = mount(GroupSwitcher);
    await flushPromises();
    expect(wrapper.find('[data-testid="org-switcher"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("passes correct props to OrganizationSwitcher", async () => {
    const wrapper = mount(GroupSwitcher);
    await flushPromises();
    const orgSwitcher = wrapper.findComponent({ name: "OrganizationSwitcher" });
    expect(orgSwitcher.exists()).toBe(true);
    expect(orgSwitcher.props("afterCreateOrganizationUrl")).toBe("/groups");
    expect(orgSwitcher.props("afterLeaveOrganizationUrl")).toBe("/groups");
    expect(orgSwitcher.props("afterSelectOrganizationUrl")).toBe("/");
    wrapper.unmount();
  });
});