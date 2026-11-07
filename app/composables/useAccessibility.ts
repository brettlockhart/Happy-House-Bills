import { computed, type Ref } from "vue";

type FontSize = "small" | "medium" | "large" | "extra-large";

export interface AccessibilityState {
  reducedMotion: Ref<boolean>;
  highContrast: Ref<boolean>;
  screenReaderMode: Ref<boolean>;
  fontSize: Ref<FontSize>;
  announceToScreenReader: (message: string) => void;
  updateFontSize(size: FontSize): void;
  toggleHighContrast(): void;
  toggleReducedMotion(): void;
}

const reducedMotionState = ref<boolean>(false);
const highContrastState = ref<boolean>(false);
const screenReaderModeState = ref<boolean>(false);
const fontSizeState = ref<FontSize>("medium");

const announcementElement = ref<HTMLElement | null>(null);

const updateFontSize = (size: "small" | "medium" | "large" | "extra-large") => {
  fontSizeState.value = size;
  if (typeof window !== "undefined") {
    localStorage.setItem("hhb-font-size", size);
    updateFontSizeClass();
  }
};

const toggleHighContrast = () => {
  highContrastState.value = !highContrastState.value;
  if (typeof window !== "undefined") {
    localStorage.setItem("hhb-high-contrast", highContrastState.value.toString());
    updateHighContrastClass();
  }
};

const toggleReducedMotion = () => {
  reducedMotionState.value = !reducedMotionState.value;
  if (typeof window !== "undefined") {
    localStorage.setItem("hhb-reduced-motion", reducedMotionState.value.toString());
    updateReducedMotionClass();
  }
};

const updateFontSizeClass = () => {
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.classList.remove("hhb-font-size-small", "hhb-font-size-medium", "hhb-font-size-large", "hhb-font-size-extra-large");
    root.classList.add(`hhb-font-size-${fontSizeState.value}`);
  }
};

const updateHighContrastClass = () => {
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    if (highContrastState.value) {
      root.classList.add("hhb-high-contrast");
    } else {
      root.classList.remove("hhb-high-contrast");
    }
  }
};

const updateReducedMotionClass = () => {
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    if (reducedMotionState.value) {
      root.classList.add("hhb-reduced-motion");
    } else {
      root.classList.remove("hhb-reduced-motion");
    }
  }
};

const announceToScreenReader = (message: string) => {
  if (typeof document !== "undefined") {
    if (!announcementElement.value) {
      const el = document.createElement("div");
      el.setAttribute("aria-live", "polite");
      el.setAttribute("aria-atomic", "true");
      el.className = "sr-only";
      document.body.appendChild(el);
      announcementElement.value = el;
    }
    
    announcementElement.value.textContent = message;
    setTimeout(() => {
      if (announcementElement.value) {
        announcementElement.value.textContent = "";
      }
    }, 1000);
  }
};

export function useAccessibility(): AccessibilityState {
  if (typeof window !== "undefined") {
    const storedFontSize = localStorage.getItem("hhb-font-size") as FontSize | null;
    const storedHighContrast = localStorage.getItem("hhb-high-contrast") === "true";
    const storedReducedMotion = localStorage.getItem("hhb-reduced-motion") === "true";
    
    if (storedFontSize) fontSizeState.value = storedFontSize;
    if (storedHighContrast) highContrastState.value = storedHighContrast;
    if (storedReducedMotion) reducedMotionState.value = storedReducedMotion;
    
    updateFontSizeClass();
    updateHighContrastClass();
    updateReducedMotionClass();
  }
  
  return {
    reducedMotion: computed(() => reducedMotionState.value),
    highContrast: computed(() => highContrastState.value),
    screenReaderMode: computed(() => screenReaderModeState.value),
    fontSize: computed(() => fontSizeState.value),
    announceToScreenReader,
    updateFontSize,
    toggleHighContrast,
    toggleReducedMotion,
  };
}