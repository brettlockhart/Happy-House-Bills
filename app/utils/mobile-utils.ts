export interface ViewportConfig {
  breakpoint: string;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: "portrait" | "landscape";
  width: number;
  height: number;
}

export interface TouchInteraction {
  touchStart: (event: TouchEvent) => void;
  touchMove: (event: TouchEvent) => void;
  touchEnd: (event: TouchEvent) => void;
  handleTap: (callback: (event: TouchEvent) => void) => void;
}

export interface OfflineStatus {
  isOnline: boolean;
  wasOffline: boolean;
  queuedActions: Array<() => Promise<void>>;
  syncStatus: "idle" | "syncing" | "failed" | "completed";
}

export interface AccessibilityState {
  reducedMotion: boolean;
  highContrast: boolean;
  screenReaderMode: boolean;
  fontSize: "small" | "medium" | "large" | "extra-large";
  announceToScreenReader: (message: string) => void;
}

export interface PerformanceMetrics {
  fps: number;
  renderTime: number;
  memoryUsage: number;
  networkQuality: "slow" | "medium" | "fast";
}

export interface ResponsiveBreakpoints {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export const DEFAULT_BREAKPOINTS: ResponsiveBreakpoints = {
  xs: 375,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

export function getViewportConfig(): ViewportConfig {
  const width = typeof window !== "undefined" ? window.innerWidth : 0;
  const height = typeof window !== "undefined" ? window.innerHeight : 0;
  
  const breakpoints = DEFAULT_BREAKPOINTS;
  
  let breakpoint: ViewportConfig["breakpoint"] = "xl";
  if (width < breakpoints.sm) breakpoint = "xs";
  else if (width < breakpoints.md) breakpoint = "sm";
  else if (width < breakpoints.lg) breakpoint = "md";
  else if (width < breakpoints.xl) breakpoint = "lg";
  
  let orientation: ViewportConfig["orientation"] = "landscape";
  if (height > width) orientation = "portrait";
  
  return {
    breakpoint,
    isMobile: width < breakpoints.md,
    isTablet: width >= breakpoints.md && width < breakpoints.lg,
    isDesktop: width >= breakpoints.lg,
    orientation,
    width,
    height,
  };
}

export function setupTouchInteractions(element: HTMLElement): TouchInteraction {
  let tapCallback: ((event: TouchEvent) => void) | null = null;
  let startX = 0;
  let startY = 0;
  
  const handleTouchStart = (event: TouchEvent) => {
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  };
  
  const handleTouchMove = (event: TouchEvent) => {
    const deltaX = Math.abs(event.touches[0].clientX - startX);
    const deltaY = Math.abs(event.touches[0].clientY - startY);
    if (deltaX > 10 && deltaY > 10) {
      event.preventDefault();
    }
  };
  
  const handleTouchEnd = (event: TouchEvent) => {
    const deltaX = Math.abs(event.changedTouches[0].clientX - startX);
    const deltaY = Math.abs(event.changedTouches[0].clientY - startY);
    
    if (deltaX < 10 && deltaY < 10 && tapCallback) {
      tapCallback(event);
    }
  };
  
  element.addEventListener("touchstart", handleTouchStart, { passive: true });
  element.addEventListener("touchmove", handleTouchMove, { passive: false });
  element.addEventListener("touchend", handleTouchEnd, { passive: true });
  
  const handleTap = (callback: (event: TouchEvent) => void) => {
    tapCallback = callback;
  };
  
  return { touchStart: handleTouchStart, touchMove: handleTouchMove, touchEnd: handleTouchEnd, handleTap };
}

export function detectPerformance(): PerformanceMetrics {
  try {
    const now = performance.now();
    const startTime = now;
    let frameCount = 0;
    
    const measurePerformance = () => {
      frameCount++;
      const elapsed = performance.now() - startTime;
      
      if (elapsed >= 1000) {
        const fps = Math.round((frameCount / elapsed) * 1000);
        const renderTime = elapsed / frameCount;
        const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
        
        let networkQuality: PerformanceMetrics["networkQuality"] = "medium";
        const connection = (navigator as any).connection || (navigator as any).mozConnection;
        if (connection) {
          if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") networkQuality = "slow";
          else if (connection.effectiveType === "3g") networkQuality = "medium";
          else networkQuality = "fast";
        }
        
        return { fps, renderTime, memoryUsage, networkQuality };
      }
      
      requestAnimationFrame(measurePerformance);
    };
    
    requestAnimationFrame(measurePerformance);
    
    return { fps: 0, renderTime: 0, memoryUsage: 0, networkQuality: "medium" };
  } catch (error) {
    // Return default metrics if performance API is not available
    return { fps: 0, renderTime: 0, memoryUsage: 0, networkQuality: "medium" };
  }
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: number;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}