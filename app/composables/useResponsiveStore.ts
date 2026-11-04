import { ref, computed, readonly } from "vue";
import { getViewportConfig, type ViewportConfig } from "~/utils/mobile-utils";

export interface ResponsiveState {
  viewport: ViewportConfig;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: ViewportConfig["orientation"];
  breakpoints: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  updateViewport(): void;
}

const viewportState = ref<ViewportConfig>(getViewportConfig());
const breakpoints = ref({
  xs: 375,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
});
const updateViewport = () => {
  viewportState.value = getViewportConfig();
};

const isMobile = computed(() => viewportState.value.isMobile);
const isTablet = computed(() => viewportState.value.isTablet);
const isDesktop = computed(() => viewportState.value.isDesktop);

export function useResponsiveStore(): ResponsiveState {
  if (typeof window !== "undefined") {
    window.addEventListener("resize", updateViewport);
  }
  
  return {
    viewport: readonly(viewportState),
    isMobile,
    isTablet,
    isDesktop,
    orientation: computed(() => viewportState.value.orientation),
    breakpoints: readonly(breakpoints),
    updateViewport,
  };
}