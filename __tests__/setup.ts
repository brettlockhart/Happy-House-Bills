import { reactive, ref, computed } from "vue";

globalThis.reactive = reactive;
globalThis.ref = ref;
globalThis.computed = computed;
globalThis.watchEffect = () => {};

// Mock localStorage for composables that use it
let mockLocalStorage: { [key: string]: string } = {};
const localStorageMock = {
  getItem: (key: string) => mockLocalStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockLocalStorage[key] = String(value); },
  removeItem: (key: string) => { mockLocalStorage[key] = undefined as unknown; },
  clear: () => { mockLocalStorage = {}; },
};

// Mock navigator.onLine
const mockOnline = true;
const navigatorMock = {
  ...globalThis.navigator,
  onLine: mockOnline,
};

Object.defineProperty(globalThis, 'navigator', {
  value: navigatorMock,
  writable: true,
  configurable: true,
});

// Mock document for composables that use it
const documentMock = {
  getElementById: () => null,
  querySelector: () => null,
  createElement: (tag: string) => {
    const el: Record<string, unknown> = {
      className: "",
      textContent: "",
      style: {},
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      _listeners: {},
      setAttribute: () => {},
      appendChild: () => {},
      insertBefore: () => el,
      removeChild: () => {},
      addEventListener: (type: string, handler: (e: unknown) => void) => {
        (el._listeners[type] = el._listeners[type] || []).push(handler);
      },
      removeEventListener: () => {},
      dispatchEvent: (event: unknown) => {
        (el._listeners[(event as { type: string }).type] || []).forEach((h) => h(event));
        return true;
      },
    };
    if (tag === "div") {
      el.className = "";
      el.textContent = "";
    }
    return el;
  },
  body: { appendChild: () => {}, insertBefore: () => null },
  documentElement: {
    classList: { add: () => {}, remove: () => {}, contains: () => false },
  },
};

Object.defineProperty(globalThis, 'document', {
  value: documentMock,
  writable: true,
  configurable: true,
});

// Mock window for composables that use it
const windowMock = {
  localStorage: localStorageMock,
  navigator: navigatorMock,
  document: documentMock,
  addEventListener: () => {},
  removeEventListener: () => {},
  Event: class Event {
    constructor(type: string, init: { bubbles?: boolean; cancelable?: boolean } = {}) {
      this.type = type;
      this.bubbles = init.bubbles === true;
      this.cancelable = init.cancelable === true;
      this.defaultPrevented = false;
      this.target = null;
      this.currentTarget = null;
    }
    preventDefault() {
      this.defaultPrevented = true;
    }
    stopPropagation() {}
    stopImmediatePropagation() {}
  },
};

Object.defineProperty(globalThis, 'window', {
  value: windowMock,
  writable: true,
  configurable: true,
});