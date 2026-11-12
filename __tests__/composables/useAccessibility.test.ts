import { describe, it, expect, beforeEach } from "vitest";

let localStorageData: { [key: string]: string } = {};

const localStorageMock = {
  getItem: (key: string) => localStorageData[key] ?? null,
  setItem: (key: string, value: string) => { localStorageData[key] = String(value); },
  removeItem: (key: string) => { localStorageData[key] = undefined as unknown; },
  clear: () => { localStorageData = {}; },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

const documentMock = {
  getElementById: () => null,
  querySelector: () => null,
  createElement: (tag: string) => {
    const el: Record<string, unknown> = {};
    if (tag === "div") {
      el.className = "";
      el.textContent = "";
      el.setAttribute = () => {};
      el.appendChild = () => {};
    }
    return el;
  },
  body: { appendChild: () => {} },
  documentElement: {
    classList: { add: () => {}, remove: () => {}, contains: () => false },
  },
};

Object.defineProperty(globalThis, 'document', {
  value: documentMock,
  writable: true,
  configurable: true,
});

const { useAccessibility } = await import("~/composables/useAccessibility");

describe("useAccessibility", () => {
  beforeEach(() => {
    localStorageData = {};
    localStorageData["hhb-font-size"] = "medium";
    localStorageData["hhb-high-contrast"] = "false";
    localStorageData["hhb-reduced-motion"] = "false";
  });

  it("initializes with default accessibility state", () => {
    const store = useAccessibility();
    expect(store.fontSize.value).toBe("medium");
    expect(store.highContrast.value).toBe(false);
    expect(store.reducedMotion.value).toBe(false);
    expect(store.screenReaderMode.value).toBe(false);
  });

  it("updates font size", () => {
    const store = useAccessibility();

    store.updateFontSize("large");

    expect(store.fontSize.value).toBe("large");
    expect(localStorageData["hhb-font-size"]).toBe("large");
  });

  it("toggles high contrast", () => {
    const store = useAccessibility();

    expect(store.highContrast.value).toBe(false);

    store.toggleHighContrast();

    expect(store.highContrast.value).toBe(true);
    expect(localStorageData["hhb-high-contrast"]).toBe("true");

    store.toggleHighContrast();

    expect(store.highContrast.value).toBe(false);
    expect(localStorageData["hhb-high-contrast"]).toBe("false");
  });

  it("toggles reduced motion", () => {
    const store = useAccessibility();

    expect(store.reducedMotion.value).toBe(false);

    store.toggleReducedMotion();

    expect(store.reducedMotion.value).toBe(true);
    expect(localStorageData["hhb-reduced-motion"]).toBe("true");
  });

  it("announces to screen reader", () => {
    const store = useAccessibility();

    store.announceToScreenReader("Test announcement");

    // Test that the function exists and can be called without error
    expect(typeof store.announceToScreenReader).toBe("function");
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