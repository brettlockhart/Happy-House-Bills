import { describe, it, expect, beforeEach, vi } from "vitest";

let mockWidth = 375;
let mockHeight = 667;

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
  const actual = await importOriginal() as unknown;
  return {
    ...actual,
    getViewportConfig: getViewportConfigMock,
  };
});

const { useResponsiveStore } = await import("~/composables/useResponsiveStore");

describe("useResponsiveStore", () => {
  beforeEach(() => {
    mockWidth = 375;
    mockHeight = 667;
  });

  it("initializes with mobile viewport config", () => {
    const store = useResponsiveStore();
    expect(store.isMobile.value).toBe(true);
    expect(store.isTablet.value).toBe(false);
    expect(store.isDesktop.value).toBe(false);
    expect(store.viewport.value.breakpoint).toBe("xs");
    expect(store.viewport.value.width).toBe(375);
    expect(store.viewport.value.height).toBe(667);
  });

  it("updates on window resize - mobile to tablet", () => {
    const store = useResponsiveStore();

    mockWidth = 768;
    store.updateViewport();

    expect(store.isMobile.value).toBe(false);
    expect(store.isTablet.value).toBe(true);
    expect(store.isDesktop.value).toBe(false);
    expect(store.viewport.value.breakpoint).toBe("md");
    expect(store.viewport.value.width).toBe(768);
  });

  it("updates on window resize - tablet to desktop", () => {
    mockWidth = 768;
    const store = useResponsiveStore();

    mockWidth = 1024;
    store.updateViewport();

    expect(store.isMobile.value).toBe(false);
    expect(store.isTablet.value).toBe(false);
    expect(store.isDesktop.value).toBe(true);
    expect(store.viewport.value.breakpoint).toBe("lg");
    expect(store.viewport.value.width).toBe(1024);
  });

  it("handles orientation changes", () => {
    mockWidth = 667;
    mockHeight = 375;
    const store = useResponsiveStore();

    expect(store.viewport.value.orientation).toBe("landscape");
  });

  it("maintains readonly properties", () => {
    const store = useResponsiveStore();

    expect(store.viewport).toBeTypeOf("object");
    expect(store.breakpoints).toBeTypeOf("object");
    expect(store.isMobile).toBeTypeOf("object");
    expect(store.isTablet).toBeTypeOf("object");
    expect(store.isDesktop).toBeTypeOf("object");
    expect(typeof store.updateViewport).toBe("function");
  });

  it("returns correct breakpoint values", () => {
    const store = useResponsiveStore();

    expect(store.breakpoints.value.xs).toBe(375);
    expect(store.breakpoints.value.sm).toBe(640);
    expect(store.breakpoints.value.md).toBe(768);
    expect(store.breakpoints.value.lg).toBe(1024);
    expect(store.breakpoints.value.xl).toBe(1280);
  });
});