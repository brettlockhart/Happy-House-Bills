/**
 * @vitest-env happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

globalThis.navigateTo = vi.fn();

const groupsData = ref([{ orgId: "org_1", role: "admin", status: "active" }]);
const groupsPending = ref(false);

vi.mock("convex-vue", () => ({
  useConvexQuery: () => ({
    data: groupsData,
    isPending: groupsPending,
    error: ref(null),
  }),
}));

vi.mock("~~/convex/_generated/api", () => ({
  api: {
    functions: {
      groups: {
        listMine: { _name: "groups.listMine" },
      },
    },
  },
}));

const Groups = (await import("../../app/pages/groups.vue")).default;

describe("Groups.vue page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.navigateTo.mockClear();
    groupsData.value = [{ orgId: "org_1", role: "admin", status: "active" }];
    groupsPending.value = false;
  });

  it("renders the groups header", () => {
    const wrapper = mount(Groups);
    expect(wrapper.find("h1").exists()).toBe(true);
    expect(wrapper.find("h1").text()).toBe("Your groups");
  });

  it("renders create group and join group buttons", () => {
    const wrapper = mount(Groups);
    const buttons = wrapper.findAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    expect(buttons[0].text()).toBe("Create new group");
    expect(buttons[1].text()).toBe("Join via invite");
  });

  it("shows loading hint while isPending", () => {
    groupsPending.value = true;
    const wrapper = mount(Groups);
    expect(wrapper.text()).toContain("Loading your groups…");
  });

  it("shows empty state when no groups", () => {
    groupsData.value = [];
    const wrapper = mount(Groups);
    expect(wrapper.text()).toContain("You don't belong to any groups yet");
  });

  it("renders group list items with name and role", () => {
    const wrapper = mount(Groups);
    const groupList = wrapper.findAll(".hhb-group");
    expect(groupList.length).toBe(1);
    expect(wrapper.text()).toContain("org_1");
    expect(wrapper.text()).toContain("admin");
  });
});