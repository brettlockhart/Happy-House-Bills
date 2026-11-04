import { describe, it, expect, vi, beforeEach } from "vitest";
import { useResponsiveStore } from "~/composables/useResponsiveStore";

// Mock window resize event
let mockWidth = 375;
let mockHeight = 667;

// Create a proper mock function
const getViewportConfigMock = () => ({
  breakpoint: mockWidth < 640 ? "xs" : 
              mockWidth < 768 ? "sm" :
              mockWidth < 1024 ? "md" :
              mockWidth < 1280 ? "lg" : "xl",
  isMobile: mockWidth < 768,
  isTablet: mockWidth >= 768 && mockWidth < 1024,
  isDesktop: mockWidth >= 1024,
  orientation: mockHeight > mockWidth ? "portrait" : "landscape",
  width: mockWidth,
  height: mockHeight,
});

vi.mock("~/utils/mobile-utils", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getViewportConfig: getViewportConfigMock,
  };
});

describe("useResponsiveStore", () => {
  beforeEach(() => {
    mockWidth = 375;
    mockHeight = 667;
  });
  
  it("initializes with mobile viewport config", () => {
    const store = useResponsiveStore();
    expect(store.isMobile).toBe(true);
    expect(store.isTablet).toBe(false);
    expect(store.isDesktop).toBe(false);
    expect(store.viewport.breakpoint).toBe("xs");
  });
  
  it("updates on window resize - mobile to tablet", () => {
    const store = useResponsiveStore();
    
    mockWidth = 768;
    store.updateViewport();
    
    expect(store.isMobile).toBe(false);
    expect(store.isTablet).toBe(true);
    expect(store.isDesktop).toBe(false);
    expect(store.viewport.breakpoint).toBe("md");
  });
  
  it("updates on window resize - tablet to desktop", () => {
    mockWidth = 768;
    const store = useResponsiveStore();
    
    mockWidth = 1024;
    store.updateViewport();
    
    expect(store.isMobile).toBe(false);
    expect(store.isTablet).toBe(false);
    expect(store.isDesktop).toBe(true);
    expect(store.viewport.breakpoint).toBe("lg");
  });
  
  it("handles orientation changes", () => {
    mockWidth = 667;
    mockHeight = 375;
    const store = useResponsiveStore();
    
    expect(store.viewport.orientation).toBe("landscape");
  });
  
  it("maintains readonly properties", () => {
    const store = useResponsiveStore();
    
    expect(store.viewport).toBeTypeOf("object");
    expect(store.breakpoints).toBeTypeOf("object");
    expect(store.isMobile).toBeTypeOf("boolean");
    expect(store.isTablet).toBeTypeOf("boolean");
    expect(store.isDesktop).toBeTypeOf("boolean");
    expect(typeof store.updateViewport).toBe("function");
  });
  
  it("returns correct breakpoint values", () => {
    const store = useResponsiveStore();
    
    expect(store.breakpoints.xs).toBe(375);
    expect(store.breakpoints.sm).toBe(640);
    expect(store.breakpoints.md).toBe(768);
    expect(store.breakpoints.lg).toBe(1024);
    expect(store.breakpoints.xl).toBe(1280);
  });
});