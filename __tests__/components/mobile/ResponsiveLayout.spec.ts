import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ResponsiveLayout from "~/components/mobile/ResponsiveLayout.vue";

// Mock the composables
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

vi.mock("~/composables/useTouchInteractions", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useTouchInteractions: vi.fn(() => {
      return {
        elementRef: { value: null },
      };
    }),
  };
});

describe("ResponsiveLayout.vue", () => {
  it("renders responsive layout container", () => {
    const wrapper = mount(ResponsiveLayout, {
      slots: {
        default: "<div>Content</div>",
      },
    });
    
    expect(wrapper.find(".responsive-layout").exists()).toBe(true);
    expect(wrapper.find('[role="main"]').exists()).toBe(true);
    expect(wrapper.find('div[role="main"][aria-label="Mobile Responsive Layout"]').exists()).toBe(true);
  });
  
  it("applies mobile classes for mobile viewport", () => {
    const wrapper = mount(ResponsiveLayout, {
      slots: {
        default: "<div>Content</div>",
      },
    });
    
    expect(wrapper.find(".hhb-mobile").exists()).toBe(true);
    expect(wrapper.find(".hhb-breakpoint-xs").exists()).toBe(true);
    expect(wrapper.find(".hhb-portrait").exists()).toBe(true);
  });
  
  it("applies tablet classes for tablet viewport", () => {
    // Update mock to simulate tablet viewport
    vi.mock("~/composables/useResponsiveStore", async (importOriginal) => {
      const actual = await importOriginal() as any;
      return {
        ...actual,
        useResponsiveStore: vi.fn(() => {
          return {
            isMobile: { value: false },
            isTablet: { value: true },
            isDesktop: { value: false },
            viewport: {
              breakpoint: "md",
              isMobile: false,
              isTablet: true,
              isDesktop: false,
              orientation: "portrait",
              width: 768,
              height: 1024,
            },
            orientation: { value: "portrait" },
            updateViewport: vi.fn(),
          };
        }),
      };
    });
    
    const wrapper = mount(ResponsiveLayout, {
      slots: {
        default: "<div>Content</div>",
      },
    });
    
    expect(wrapper.find(".hhb-tablet").exists()).toBe(true);
    expect(wrapper.find(".hhb-breakpoint-md").exists()).toBe(true);
  });
  
  it("applies desktop classes for desktop viewport", () => {
    // Update mock to simulate desktop viewport
    vi.mock("~/composables/useResponsiveStore", async (importOriginal) => {
      const actual = await importOriginal() as any;
      return {
        ...actual,
        useResponsiveStore: vi.fn(() => {
          return {
            isMobile: { value: false },
            isTablet: { value: false },
            isDesktop: { value: true },
            viewport: {
              breakpoint: "xl",
              isMobile: false,
              isTablet: false,
              isDesktop: true,
              orientation: "landscape",
              width: 1280,
              height: 720,
            },
            orientation: { value: "landscape" },
            updateViewport: vi.fn(),
          };
        }),
      };
    });
    
    const wrapper = mount(ResponsiveLayout, {
      slots: {
        default: "<div>Content</div>",
      },
    });
    
    expect(wrapper.find(".hhb-desktop").exists()).toBe(true);
    expect(wrapper.find(".hhb-breakpoint-xl").exists()).toBe(true);
    expect(wrapper.find(".hhb-landscape").exists()).toBe(true);
  });
  
  it("applies touch target classes for mobile", () => {
    const wrapper = mount(ResponsiveLayout, {
      slots: {
        default: "<div>Content</div>",
      },
    });
    
    expect(wrapper.find(".hhb-touch-targets").exists()).toBe(true);
  });
  
  it("renders slot content", () => {
    const wrapper = mount(ResponsiveLayout, {
      slots: {
        default: "<div class='test-content'>Slot Content</div>",
      },
    });
    
    expect(wrapper.find(".test-content").exists()).toBe(true);
    expect(wrapper.find(".test-content").text()).toBe("Slot Content");
  });
  
  it("has proper ARIA attributes", () => {
    const wrapper = mount(ResponsiveLayout, {
      slots: {
        default: "<div>Content</div>",
      },
    });
    
    const mainElement = wrapper.find('[role="main"]');
    expect(mainElement.attributes("role")).toBe("main");
    expect(mainElement.attributes("aria-label")).toBe("Mobile Responsive Layout");
  });
  
  it("updates viewport on resize", async () => {
    const mockUpdateViewport = vi.fn();
    
    // Re-mock with custom update function
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
            updateViewport: mockUpdateViewport,
          };
        }),
      };
    });
    
    const wrapper = mount(ResponsiveLayout, {
      slots: {
        default: "<div>Content</div>",
      },
    });
    
    // Trigger resize event
    await wrapper.vm.$nextTick();
    
    expect(mockUpdateViewport).toHaveBeenCalled();
  });
});