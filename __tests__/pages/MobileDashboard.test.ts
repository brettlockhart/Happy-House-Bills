import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import MobileDashboard from "~/pages/MobileDashboard.vue";

// Mock composables
vi.mock("~/composables/useResponsiveStore", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useResponsiveStore: vi.fn(() => {
      return {
        isMobile: { value: true },
        isTablet: { value: false },
        isDesktop: { value: false },
        viewport: {
          breakpoint: "xs",
          isMobile: true,
          isTablet: false,
          isDesktop: false,
          orientation: "portrait",
          width: 375,
          height: 667,
        },
        orientation: { value: "portrait" },
        updateViewport: vi.fn(),
      };
    }),
  };
});

vi.mock("~/composables/useOfflineState", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useOfflineState: vi.fn(() => {
      return {
        isOnline: { value: true },
        wasOffline: { value: false },
        queuedActions: { value: [] },
        syncStatus: { value: "idle" },
        retryCount: { value: 0 },
        maxRetries: { value: 3 },
        lastSyncTime: { value: null },
        sync: vi.fn().mockResolvedValue(undefined),
        addToQueue: vi.fn(),
        removeFromQueue: vi.fn(),
        clearQueue: vi.fn(),
      };
    }),
  };
});

vi.mock("~/composables/useAccessibility", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useAccessibility: vi.fn(() => {
      return {
        reducedMotion: { value: false },
        highContrast: { value: false },
        screenReaderMode: { value: false },
        fontSize: { value: "medium" },
        announceToScreenReader: vi.fn(),
        updateFontSize: vi.fn(),
        toggleHighContrast: vi.fn(),
        toggleReducedMotion: vi.fn(),
      };
    }),
  };
});

vi.mock("~/components/mobile/ResponsiveLayout.vue", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    default: {
      template: '<div class="mock-responsive-layout"><slot/></div>',
      setup() {
        return {};
      },
    },
  };
});

describe("MobileDashboard.vue", () => {
  it("renders dashboard with correct structure", () => {
    const wrapper = mount(MobileDashboard);
    
    expect(wrapper.find(".mobile-dashboard").exists()).toBe(true);
    expect(wrapper.find(".dashboard-header").exists()).toBe(true);
    expect(wrapper.find("h1").text()).toContain("Happy House Bills");
  });
  
  it("renders font size selector", () => {
    const wrapper = mount(MobileDashboard);
    
    expect(wrapper.findAll("select")[0].exists()).toBe(true);
    expect(wrapper.find("select option[value=\"small\"]").exists()).toBe(true);
    expect(wrapper.find("select option[value=\"medium\"]").exists()).toBe(true);
    expect(wrapper.find("select option[value=\"large\"]").exists()).toBe(true);
    expect(wrapper.find("select option[value=\"extra-large\"]").exists()).toBe(true);
  });
  
  it("renders high contrast toggle button", () => {
    const wrapper = mount(MobileDashboard);
    
    const highContrastButton = wrapper.findAll('button').find(btn => 
      btn.text().includes("High Contrast")
    );
    
    expect(highContrastButton.exists()).toBe(true);
    expect(highContrastButton.attributes("aria-pressed")).toBe("false");
  });
  
  it("renders reduced motion toggle button", () => {
    const wrapper = mount(MobileDashboard);
    
    const reducedMotionButton = wrapper.findAll('button').find(btn => 
      btn.text().includes("Reduced Motion")
    );
    
    expect(reducedMotionButton.exists()).toBe(true);
    expect(reducedMotionButton.attributes("aria-pressed")).toBe("false");
  });
  
  it("renders online status indicator", () => {
    const wrapper = mount(MobileDashboard);
    
    expect(wrapper.find(".hhb-bg-green-500").exists()).toBe(true);
    expect(wrapper.find(".hhb-text-green-500").exists()).toBe(true);
  });
  
  it("renders dashboard metrics cards", () => {
    const wrapper = mount(MobileDashboard);
    
    expect(wrapper.findAll(".hhb-card")).toHaveLength(3);
    expect(wrapper.find("h2").text()).toContain("Total Expenses");
    expect(wrapper.find("h2").text()).toContain("Categories");
    expect(wrapper.findAll("h2")[1].text()).toContain("Pending");
  });
  
  it("renders quick actions buttons", () => {
    const wrapper = mount(MobileDashboard);
    
    const buttons = wrapper.findAll("button");
    const buttonTexts = buttons.map(btn => btn.text());
    
    expect(buttonTexts.some(text => text.includes("Add Expense"))).toBe(true);
    expect(buttonTexts.some(text => text.includes("View Calendar"))).toBe(true);
    expect(buttonTexts.some(text => text.includes("Settle Up"))).toBe(true);
  });
  
  it("has correct accessibility attributes", () => {
    const wrapper = mount(MobileDashboard);
    
    const fontSizeSelect = wrapper.find("select");
    expect(fontSizeSelect.attributes("aria-label")).toBe("Font Size");
    
    const highContrastButton = wrapper.findAll('button').find(btn => 
      btn.text().includes("High Contrast")
    );
    expect(highContrastButton.attributes("aria-pressed")).toBe("false");
    
    const reducedMotionButton = wrapper.findAll('button').find(btn => 
      btn.text().includes("Reduced Motion")
    );
    expect(reducedMotionButton.attributes("aria-pressed")).toBe("false");
    
    const onlineIndicator = wrapper.find("div[aria-label]");
    expect(onlineIndicator.attributes("aria-label")).toBe("Online");
  });
  
  it("shows reconnection message when offline", async () => {
    // Update offline state mock
    vi.mock("~/composables/useOfflineState", async (importOriginal) => {
      const actual = await importOriginal() as any;
      return {
        ...actual,
        useOfflineState: vi.fn(() => {
          return {
            isOnline: { value: false },
            wasOffline: { value: true },
            queuedActions: { value: [] },
            syncStatus: { value: "failed" },
            retryCount: { value: 0 },
            maxRetries: { value: 3 },
            lastSyncTime: { value: null },
            sync: vi.fn().mockResolvedValue(undefined),
            addToQueue: vi.fn(),
            removeFromQueue: vi.fn(),
            clearQueue: vi.fn(),
          };
        }),
      };
    });
    
    const wrapper = mount(MobileDashboard);
    
    expect(wrapper.find(".hhb-bg-red-500").exists()).toBe(true);
    expect(wrapper.find(".hhb-text-red-500").exists()).toBe(true);
    expect(wrapper.text()).toContain("(Reconnected)");
  });
  
  it("maintains responsive layout structure", () => {
    const wrapper = mount(MobileDashboard);
    
    expect(wrapper.find(".hhb-grid").exists()).toBe(true);
    expect(wrapper.find(".hhb-col-12").exists()).toBe(true);
    
    // Check for responsive grid classes
    expect(wrapper.find(".hhb-md-col-6").exists()).toBe(true);
    expect(wrapper.find(".hhb-lg-col-4").exists()).toBe(true);
  });
});