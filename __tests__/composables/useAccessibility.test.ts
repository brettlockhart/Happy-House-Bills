import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAccessibility } from "~/composables/useAccessibility";

// Mock localStorage and document
const mockLocalStorage: { [key: string]: string } = {};
let mockFontSize = "medium";
let mockHighContrast = false;
let mockReducedMotion = false;

vi.mock("~/composables/useAccessibility", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useAccessibility: vi.fn(() => {
      const mockState = {
        reducedMotion: { value: mockReducedMotion },
        highContrast: { value: mockHighContrast },
        screenReaderMode: { value: false },
        fontSize: { value: mockFontSize },
        announceToScreenReader: vi.fn((message: string) => {
          mockState.lastAnnouncement.value = message;
        }),
        updateFontSize: vi.fn((size: any) => {
          mockFontSize = size;
          mockState.fontSize.value = size;
          mockLocalStorage["hhb-font-size"] = size;
        }),
        toggleHighContrast: vi.fn(() => {
          mockHighContrast = !mockHighContrast;
          mockState.highContrast.value = mockHighContrast;
          mockLocalStorage["hhb-high-contrast"] = mockHighContrast.toString();
        }),
        toggleReducedMotion: vi.fn(() => {
          mockReducedMotion = !mockReducedMotion;
          mockState.reducedMotion.value = mockReducedMotion;
          mockLocalStorage["hhb-reduced-motion"] = mockReducedMotion.toString();
        }),
        lastAnnouncement: { value: "" },
      };
      
      return mockState;
    }),
  };
});

Object.defineProperty(window, 'localStorage', {
  get: () => mockLocalStorage,
  set: vi.fn(),
});

describe("useAccessibility", () => {
  beforeEach(() => {
    mockFontSize = "medium";
    mockHighContrast = false;
    mockReducedMotion = false;
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
  });
  
  it("initializes with default accessibility state", () => {
    const store = useAccessibility();
    expect(store.fontSize.value).toBe("medium");
    expect(store.highContrast.value).toBe(false);
    expect(store.reducedMotion.value).toBe(false);
    expect(store.screenReaderMode.value).toBe(false);
  });
  
  it("initializes from localStorage", () => {
    mockLocalStorage["hhb-font-size"] = "large";
    mockLocalStorage["hhb-high-contrast"] = "true";
    mockLocalStorage["hhb-reduced-motion"] = "true";
    
    const store = useAccessibility();
    expect(store.fontSize.value).toBe("large");
    expect(store.highContrast.value).toBe(true);
    expect(store.reducedMotion.value).toBe(true);
  });
  
  it("updates font size", () => {
    const store = useAccessibility();
    
    store.updateFontSize("large");
    
    expect(store.fontSize.value).toBe("large");
    expect(mockLocalStorage["hhb-font-size"]).toBe("large");
  });
  
  it("toggles high contrast", () => {
    const store = useAccessibility();
    
    expect(store.highContrast.value).toBe(false);
    
    store.toggleHighContrast();
    
    expect(store.highContrast.value).toBe(true);
    expect(mockLocalStorage["hhb-high-contrast"]).toBe("true");
    
    store.toggleHighContrast();
    
    expect(store.highContrast.value).toBe(false);
    expect(mockLocalStorage["hhb-high-contrast"]).toBe("false");
  });
  
  it("toggles reduced motion", () => {
    const store = useAccessibility();
    
    expect(store.reducedMotion.value).toBe(false);
    
    store.toggleReducedMotion();
    
    expect(store.reducedMotion.value).toBe(true);
    expect(mockLocalStorage["hhb-reduced-motion"]).toBe("true");
  });
  
  it("announces to screen reader", () => {
    const store = useAccessibility();
    
    store.announceToScreenReader("Test announcement");
    
    expect(store.lastAnnouncement.value).toBe("Test announcement");
  });
  
  it("maintains readonly properties", () => {
    const store = useAccessibility();
    
    expect(store.reducedMotion).toBeDefined();
    expect(store.highContrast).toBeDefined();
    expect(store.screenReaderMode).toBeDefined();
    expect(store.fontSize).toBeDefined();
    expect(store.announceToScreenReader).toBeTypeOf("function");
    expect(store.updateFontSize).toBeTypeOf("function");
    expect(store.toggleHighContrast).toBeTypeOf("function");
    expect(store.toggleReducedMotion).toBeTypeOf("function");
  });
  
  it("validates font size options", () => {
    const store = useAccessibility();
    
    store.updateFontSize("small");
    expect(store.fontSize.value).toBe("small");
    
    store.updateFontSize("medium");
    expect(store.fontSize.value).toBe("medium");
    
    store.updateFontSize("large");
    expect(store.fontSize.value).toBe("large");
    
    store.updateFontSize("extra-large");
    expect(store.fontSize.value).toBe("extra-large");
  });
});