<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useResponsiveStore } from "~/composables/useResponsiveStore";

const responsiveStore = useResponsiveStore();
const elementRef = ref<HTMLElement | null>(null);

const responsiveClasses = computed(() => {
  const classes = [];
  const vp = responsiveStore.viewport.value;

  if (responsiveStore.isMobile.value) classes.push("hhb-mobile");
  if (responsiveStore.isTablet.value) classes.push("hhb-tablet");
  if (responsiveStore.isDesktop.value) classes.push("hhb-desktop");

  classes.push(`hhb-breakpoint-${vp.breakpoint}`);

  if (responsiveStore.orientation.value === "portrait") {
    classes.push("hhb-portrait");
  } else {
    classes.push("hhb-landscape");
  }

  if (vp.isMobile) {
    classes.push("hhb-touch-targets");
  }

  return classes.join(" ");
});

const handleResize = () => {
  responsiveStore.updateViewport();
};

onMounted(() => {
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
});
</script>

<template>
  <div 
    ref="elementRef"
    class="responsive-layout"
    :class="responsiveClasses"
    role="main"
    aria-label="Mobile Responsive Layout"
  >
    <slot/>
  </div>
</template>

<style>
.responsive-layout {
  width: 100%;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

/* Breakpoint styles */
.hhb-xs {
  --container-width: 100%;
  --grid-columns: 1;
}

.hhb-sm {
  --container-width: 640px;
  --grid-columns: 2;
}

.hhb-md {
  --container-width: 768px;
  --grid-columns: 2;
}

.hhb-lg {
  --container-width: 1024px;
  --grid-columns: 3;
}

.hhb-xl {
  --container-width: 1280px;
  --grid-columns: 4;
}

/* Touch target sizing */
.hhb-touch-targets button,
.hhb-touch-targets a[href],
.hhb-touch-targets input[type="button"],
.hhb-touch-targets input[type="submit"],
.hhb-touch-targets input[type="file"] {
  min-height: 44px;
  min-width: 44px;
}

/* Orientation styles */
.hhb-portrait {
  --orientation: portrait;
}

.hhb-landscape {
  --orientation: landscape;
}

/* Safe areas for mobile */
.hhb-mobile {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* Accessibility improvements */
.hhb-mobile[aria-label] {
  font-size: var(--font-size-base);
}

/* High contrast mode support */
.hhb-high-contrast {
  border: 1px solid currentColor;
}

/* Reduced motion support */
.hhb-reduced-motion * {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
</style>