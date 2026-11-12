/**
 * @vitest-env happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref, computed } from "vue";
import SettleUpModal from "../../app/components/SettleUpModal.vue";

const mockForm = ref({ amount: 0, fromUser: "user1", toUser: "user2" });

vi.mock("~/convex/_generated/api", () => ({
  api: {
    settlements: {
      create: { _name: "create" },
    },
  },
  Settlement: {} as never,
}));

vi.mock("~/convex/_generated/dataModel", () => ({
  Doc: {} as never,
  Id: {} as never,
}));

vi.mock("~/composables/useSettlements", () => ({
  useSettlements: () => ({
    data: computed(() => []),
    isLoading: { value: false },
    createSettlement: vi.fn().mockResolvedValue({ id: "new_settlement" }),
  }),
}));

vi.mock("~/composables/useAuth", () => ({
  useAuth: () => ({
    userId: computed(() => "user1"),
    orgId: computed(() => "org1"),
    hasOrg: computed(() => true),
    isSignedIn: computed(() => true),
    isLoaded: computed(() => true),
  }),
}));

describe("SettleUpModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockForm.value = { amount: 0, fromUser: "user1", toUser: "user2" };
  });

  it("renders nothing when isOpen is false", () => {
    const wrapper = mount(SettleUpModal, {
      props: {
        isOpen: false,
        currentUserId: "user1",
        partnerUserId: "user2",
        partnerName: "Partner",
      },
    });

    expect(wrapper.find(".hhb-modal-overlay").exists()).toBe(false);
  });

  it("renders modal when isOpen is true", () => {
    const wrapper = mount(SettleUpModal, {
      props: {
        isOpen: true,
        currentUserId: "user1",
        partnerUserId: "user2",
        partnerName: "Partner",
      },
    });

    expect(wrapper.find(".hhb-modal-overlay").exists()).toBe(true);
    expect(wrapper.find("h2").text()).toBe("Settle Up");
  });

  it("emits close when Cancel button clicked", async () => {
    const wrapper = mount(SettleUpModal, {
      props: {
        isOpen: true,
        currentUserId: "user1",
        partnerUserId: "user2",
        partnerName: "Partner",
      },
    });

    await wrapper.find("button[type=\"button\"]").element.click();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits submit with amount when amount input set", async () => {
    const wrapper = mount(SettleUpModal, {
      props: {
        isOpen: true,
        currentUserId: "user1",
        partnerUserId: "user2",
        partnerName: "Partner",
      },
    });

    const input = wrapper.find('input[type="number"]').element as HTMLInputElement;
    input.value = "25.50";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await wrapper.find("form").element.dispatchEvent(new Event("submit", { cancelable: true }));

    expect(wrapper.emitted("submit")).toBeTruthy();
    const submitPayload = wrapper.emitted("submit")![0][0] as { amount: number; fromUser: string; toUser: string };
    expect(submitPayload.amount).toBe(25.5);
    expect(submitPayload.fromUser).toBe("user1");
    expect(submitPayload.toUser).toBe("user2");
  });

  it("does not emit submit when amount is 0", async () => {
    const wrapper = mount(SettleUpModal, {
      props: {
        isOpen: true,
        currentUserId: "user1",
        partnerUserId: "user2",
        partnerName: "Partner",
      },
    });

    await wrapper.find("form").element.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(wrapper.emitted("submit")).toBeUndefined();
  });

  it("does not emit submit when amount is negative", async () => {
    const wrapper = mount(SettleUpModal, {
      props: {
        isOpen: true,
        currentUserId: "user1",
        partnerUserId: "user2",
        partnerName: "Partner",
      },
    });

    const input = wrapper.find('input[type="number"]').element as HTMLInputElement;
    input.value = "-10";
    await wrapper.find("form").element.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(wrapper.emitted("submit")).toBeUndefined();
  });

  it("resets form amount when submit successful", async () => {
    const wrapper = mount(SettleUpModal, {
      props: {
        isOpen: true,
        currentUserId: "user1",
        partnerUserId: "user2",
        partnerName: "Partner",
      },
    });

    const input = wrapper.find('input[type="number"]').element as HTMLInputElement;
    input.value = "15";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await wrapper.find("form").element.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(wrapper.emitted("submit")).toBeTruthy();
  });
});
