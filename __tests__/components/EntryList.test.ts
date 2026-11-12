/**
 * @vitest-env happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref, computed } from "vue";
import EntryList from "../../app/components/EntryList.vue";

interface MockExpense {
  _id: string;
  amount: number;
  date: string;
  category: string;
  paidBy: string;
  notes?: string;
  status: string;
  enteredBy?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface MockSettlement {
  _id: string;
  amount: number;
  date: string;
  fromUser: string;
  toUser: string;
}

const mockApprove = vi.fn().mockResolvedValue({});
const mockReject = vi.fn().mockResolvedValue({});

const mockExpenses = ref<MockExpense[]>([]);
const mockSettlements = ref<MockSettlement[]>([]);

vi.mock("~/convex/_generated/api", () => ({
  api: {
    expenses: {
      list: { _name: "list" },
      pending: { _name: "pending" },
    },
    settlements: {
      list: { _name: "list" },
    },
  },
  BalanceResult: {} as never,
  Expense: {} as never,
  Settlement: {} as never,
}));

vi.mock("~/convex/_generated/dataModel", () => ({
  Doc: {} as never,
  Id: {} as never,
}));

vi.mock("~/composables/useExpenses", () => ({
  useExpenses: () => ({
    data: computed(() => mockExpenses.value),
    isLoading: { value: false },
    createExpense: vi.fn(),
  }),
  usePendingExpenses: () => ({
    data: computed(() => mockExpenses.value),
    isLoading: { value: false },
    approveExpense: mockApprove,
    rejectExpense: mockReject,
  }),
}));

vi.mock("~/composables/useSettlements", () => ({
  useSettlements: () => ({
    data: computed(() => mockSettlements.value),
    isLoading: { value: false },
    createSettlement: vi.fn(),
  }),
}));

vi.mock("~/utils/formatting", () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
  formatRelativeDate: (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  },
}));

describe("EntryList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExpenses.value = [];
    mockSettlements.value = [];
  });

  it("renders empty state when no entries", () => {
    const wrapper = mount(EntryList, {
      props: { currentUserId: "user1" },
    });

    expect(wrapper.text()).toContain("No expenses or settlements yet");
  });

  it("renders expense entries with description and amount", () => {
    mockExpenses.value = [
      {
        _id: "exp1",
        amount: 30,
        date: new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0],
        category: "groceries",
        notes: "Groceries",
        paidBy: "user2",
        status: "approved",
        enteredBy: "user1",
        createdAt: 123,
        updatedAt: 123,
      },
    ];

    const wrapper = mount(EntryList, {
      props: { currentUserId: "user1" },
    });

    expect(wrapper.text()).toContain("Groceries");
    expect(wrapper.text()).toContain("$30.00");
  });

  it("renders settlement entries", () => {
    mockSettlements.value = [
      {
        _id: "set1",
        amount: 20,
        date: new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0],
        fromUser: "user2",
        toUser: "user1",
        createdAt: 456,
        updatedAt: 456,
      },
    ];

    const wrapper = mount(EntryList, {
      props: { currentUserId: "user1" },
    });

    expect(wrapper.text()).toContain("Settlement");
    expect(wrapper.text()).toContain("$20.00");
  });

  it("sorts entries by date descending", () => {
    mockExpenses.value = [
      {
        _id: "exp1",
        amount: 30,
        date: "2025-10-25",
        category: "groceries",
        notes: "Older",
        paidBy: "user2",
        status: "approved",
        enteredBy: "user1",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        _id: "exp2",
        amount: 50,
        date: "2025-10-28",
        category: "utilities",
        notes: "Newer",
        paidBy: "user2",
        status: "approved",
        enteredBy: "user1",
        createdAt: 2,
        updatedAt: 2,
      },
    ];

    const wrapper = mount(EntryList, {
      props: { currentUserId: "user1" },
    });

    const entries = wrapper.findAll(".hhb-entry");
    expect(entries[0].text()).toContain("Newer");
    expect(entries[1].text()).toContain("Older");
  });

  it("shows approve/reject buttons for pending expenses entered by other user", () => {
    mockExpenses.value = [
      {
        _id: "exp1",
        amount: 30,
        date: "2025-10-26",
        category: "groceries",
        notes: "Pending",
        paidBy: "user2",
        status: "pending",
        enteredBy: "user2",
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const wrapper = mount(EntryList, {
      props: { currentUserId: "user1" },
    });

    const approveBtn = wrapper.find('[aria-label="Approve expense"]');
    const rejectBtn = wrapper.find('[aria-label="Reject expense"]');
    expect(approveBtn.exists()).toBe(true);
    expect(rejectBtn.exists()).toBe(true);
  });

  it("hides approve/reject buttons for own pending expenses", () => {
    mockExpenses.value = [
      {
        _id: "exp1",
        amount: 30,
        date: "2025-10-26",
        category: "groceries",
        notes: "My pending",
        paidBy: "user1",
        status: "pending",
        enteredBy: "user1",
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const wrapper = mount(EntryList, {
      props: { currentUserId: "user1" },
    });

    const approveBtn = wrapper.find('[aria-label="Approve expense"]');
    const rejectBtn = wrapper.find('[aria-label="Reject expense"]');
    expect(approveBtn.exists()).toBe(false);
    expect(rejectBtn.exists()).toBe(false);
  });

  it("hides approve/reject buttons for approved expenses", () => {
    mockExpenses.value = [
      {
        _id: "exp1",
        amount: 30,
        date: "2025-10-26",
        category: "groceries",
        notes: "Approved",
        paidBy: "user2",
        status: "approved",
        enteredBy: "user2",
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const wrapper = mount(EntryList, {
      props: { currentUserId: "user1" },
    });

    expect(wrapper.find('[aria-label="Approve expense"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Reject expense"]').exists()).toBe(false);
  });

  it("calls approveExpense when approve button clicked", async () => {
    mockExpenses.value = [
      {
        _id: "exp1",
        amount: 30,
        date: "2025-10-26",
        category: "groceries",
        notes: "Pending",
        paidBy: "user2",
        status: "pending",
        enteredBy: "user2",
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const wrapper = mount(EntryList, {
      props: { currentUserId: "user1" },
    });

    await wrapper.find('[aria-label="Approve expense"]').element.click();
    expect(mockApprove).toHaveBeenCalledWith({ expenseId: "exp1" });
  });

  it("calls rejectExpense when reject button clicked", async () => {
    mockExpenses.value = [
      {
        _id: "exp1",
        amount: 30,
        date: "2025-10-26",
        category: "groceries",
        notes: "Pending",
        paidBy: "user2",
        status: "pending",
        enteredBy: "user2",
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const wrapper = mount(EntryList, {
      props: { currentUserId: "user1" },
    });

    await wrapper.find('[aria-label="Reject expense"]').element.click();
    expect(mockReject).toHaveBeenCalledWith({ expenseId: "exp1" });
  });

  it("falls back to category when notes is empty", () => {
    mockExpenses.value = [
      {
        _id: "exp1",
        amount: 30,
        date: "2025-10-26",
        category: "utilities",
        notes: "",
        paidBy: "user2",
        status: "approved",
        enteredBy: "user2",
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const wrapper = mount(EntryList, {
      props: { currentUserId: "user1" },
    });

    expect(wrapper.text()).toContain("utilities");
  });
});
