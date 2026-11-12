import { describe, it, expect, vi } from "vitest";
import { getViewportConfig, setupTouchInteractions, detectPerformance, debounce, throttle } from "~/utils/mobile-utils";

// Mock window and document globals
Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true });
Object.defineProperty(window, 'performance', {
  value: {
    now: () => Date.now(),
    memory: { usedJSHeapSize: 50 * 1024 * 1024 }
  },
  configurable: true
});
Object.defineProperty(navigator, 'connection', {
  value: { effectiveType: '4g' },
  configurable: true
});

describe("Mobile Utils - Viewport Configuration", () => {
  it("returns correct viewport config for mobile", () => {
    const config = getViewportConfig();
    expect(config.isMobile).toBe(true);
    expect(config.isTablet).toBe(false);
    expect(config.isDesktop).toBe(false);
    expect(config.breakpoint).toBe("xs");
    expect(config.width).toBe(375);
    expect(config.height).toBe(667);
    expect(config.orientation).toBe("portrait");
  });
  
  it("returns correct viewport config for tablet", () => {
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
  
  it("returns correct viewport config for desktop", () => {
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

describe("Mobile Utils - Touch Interactions", () => {
  it("sets up touch interactions with correct handlers", () => {
    const mockElement = document.createElement("div");
    const touchHandlers = setupTouchInteractions(mockElement);
    
    expect(touchHandlers.touchStart).toBeTypeOf("function");
    expect(touchHandlers.touchMove).toBeTypeOf("function"); 
    expect(touchHandlers.touchEnd).toBeTypeOf("function");
    expect(touchHandlers.handleTap).toBeTypeOf("function");
  });
  
  it("handles touch start event correctly", () => {
    const mockElement = document.createElement("div");
    const touchHandlers = setupTouchInteractions(mockElement);
    
    const mockTouchEvent = {
      touches: [{ clientX: 100, clientY: 200 }],
      preventDefault: vi.fn(),
    };
    
    touchHandlers.touchStart(mockTouchEvent as unknown);
    expect(mockTouchEvent.preventDefault).not.toHaveBeenCalled(); // should only prevent for sliders
  });
  
  it("handles tap detection", () => {
    const mockElement = document.createElement("div");
    const touchHandlers = setupTouchInteractions(mockElement);
    
    let tapDetected = false;
    const mockCallback = vi.fn(() => {
      tapDetected = true;
    });
    
    touchHandlers.handleTap(mockCallback);
    
    const mockTouchEvent = {
      changedTouches: [{ clientX: 100, clientY: 200 }],
    };
    
    touchHandlers.touchEnd(mockTouchEvent as unknown);
    
    expect(tapDetected).toBe(false); // No tap because no start
  });
});

describe("Mobile Utils - Performance Detection", () => {
  it("detects performance metrics", () => {
    const metrics = detectPerformance();
    expect(metrics.fps).toBeGreaterThanOrEqual(0);
    expect(metrics.renderTime).toBeGreaterThanOrEqual(0);
    expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);
    expect(['slow', 'medium', 'fast']).toContain(metrics.networkQuality);
  });
  
  it("returns default metrics when performance unavailable", () => {
    // Test with mocked performance API unavailable
    const originalPerformance = window.performance;
    Object.defineProperty(window, 'performance', { value: undefined, configurable: true });
    
    const metrics = detectPerformance();
    expect(metrics.fps).toBeGreaterThanOrEqual(0);
    
    // Restore performance
    Object.defineProperty(window, 'performance', { value: originalPerformance, configurable: true });
  });
});

describe("Mobile Utils - Debounce Function", () => {
  it("debounces function calls", async () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);
    
    debouncedFunc();
    debouncedFunc();
    debouncedFunc();
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(func).toHaveBeenCalledTimes(1);
  });
});

describe("Mobile Utils - Throttle Function", () => {
  it("throttles function calls", async () => {
    const func = vi.fn();
    const throttledFunc = throttle(func, 100);
    
    throttledFunc();
    throttledFunc();
    throttledFunc();
    
    expect(func).toHaveBeenCalledTimes(1);
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    throttledFunc();
    expect(func).toHaveBeenCalledTimes(2);
  });
});

// Import the actual debounce and throttle functions at the end to avoid circular imports
vi.mock("~/utils/mobile-utils", async (importOriginal) => {
  const actual = await importOriginal() as unknown;
  return actual;
});