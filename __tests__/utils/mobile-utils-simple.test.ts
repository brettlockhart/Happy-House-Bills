import { describe, it, expect } from "vitest";
import { getViewportConfig, DEFAULT_BREAKPOINTS, type ViewportConfig } from "~/utils/mobile-utils";

// Simple unit test for viewport config
describe("Viewport Configuration", () => {
  it("returns correct mobile viewport", () => {
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true });
    
    const config = getViewportConfig();
    expect(config.isMobile).toBe(true);
    expect(config.isTablet).toBe(false);
    expect(config.isDesktop).toBe(false);
    expect(config.breakpoint).toBe("xs");
    expect(config.width).toBe(375);
    expect(config.height).toBe(667);
    expect(config.orientation).toBe("portrait");
  });
  
  it("returns correct tablet viewport", () => {
    Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1024, configurable: true });
    
    const config = getViewportConfig();
    expect(config.isMobile).toBe(false);
    expect(config.isTablet).toBe(true);
    expect(config.isDesktop).toBe(false);
    expect(config.breakpoint).toBe("md");
    expect(config.width).toBe(768);
    expect(config.height).toBe(1024);
  });
  
  it("returns correct desktop viewport", () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
    
    const config = getViewportConfig();
    expect(config.isMobile).toBe(false);
    expect(config.isTablet).toBe(false);
    expect(config.isDesktop).toBe(true);
    expect(config.breakpoint).toBe("xl");
    expect(config.width).toBe(1280);
    expect(config.height).toBe(720);
  });
  
  it("handles landscape orientation", () => {
    Object.defineProperty(window, 'innerWidth', { value: 667, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 375, configurable: true });
    
    const config = getViewportConfig();
    expect(config.orientation).toBe("landscape");
  });
});

describe("Default Breakpoints", () => {
  it("has correct breakpoint values", () => {
    expect(DEFAULT_BREAKPOINTS.xs).toBe(375);
    expect(DEFAULT_BREAKPOINTS.sm).toBe(640);
    expect(DEFAULT_BREAKPOINTS.md).toBe(768);
    expect(DEFAULT_BREAKPOINTS.lg).toBe(1024);
    expect(DEFAULT_BREAKPOINTS.xl).toBe(1280);
  });
});