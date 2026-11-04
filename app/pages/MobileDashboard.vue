<script setup lang="ts">
import { useResponsiveStore } from "~/composables/useResponsiveStore";
import { useOfflineState } from "~/composables/useOfflineState";
import { useAccessibility } from "~/composables/useAccessibility";
import { ResponsiveLayout } from "~/components/mobile/ResponsiveLayout.vue";

const responsiveStore = useResponsiveStore();
const offlineState = useOfflineState();
const accessibility = useAccessibility();
</script>

<template>
  <ResponsiveLayout>
    <div class="mobile-dashboard">
      <header class="dashboard-header">
        <h1 class="hhb-text-2xl hhb-font-bold">Happy House Bills</h1>
        
        <div class="hhb-flex hhb-gap-4 hhb-mb-4">
          <div class="hhb-flex hhb-items-center hhb-gap-2">
            <span class="hhb-text-sm">Font Size:</span>
            <select 
              v-model="accessibility.fontSize" 
              class="hhb-select hhb-p-2"
              aria-label="Font Size"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="extra-large">Extra Large</option>
            </select>
          </div>
          
          <button
            @click="accessibility.toggleHighContrast"
            class="hhb-btn hhb-btn-secondary hhb-text-sm"
            :aria-pressed="accessibility.highContrast"
          >
            High Contrast
          </button>
          
          <button
            @click="accessibility.toggleReducedMotion"
            class="hhb-btn hhb-btn-secondary hhb-text-sm"
            :aria-pressed="accessibility.reducedMotion"
          >
            Reduced Motion
          </button>
        </div>
        
        <div class="hhb-flex hhb-items-center hhb-gap-2">
          <span class="hhb-text-sm">Status:</span>
          <div class="hhb-flex hhb-items-center hhb-gap-1">
            <div 
              class="hhb-w-3 hhb-h-3 hhb-rounded-full"
              :class="offlineState.isOnline ? 'hhb-bg-green-500' : 'hhb-bg-red-500'"
              :aria-label="offlineState.isOnline ? 'Online' : 'Offline'"
            ></div>
            <span class="hhb-text-sm">{{ offlineState.isOnline ? 'Online' : 'Offline' }}</span>
          </div>
          
          {{ offlineState.wasOffline && offlineState.isOnline ? ' (Reconnected)' : '' }}
        </div>
      </header>
      
      <main class="dashboard-content">
        <div class="hhb-grid hhb-gap-4">
          <div class="hhb-col-12 hhb-md-col-6 hhb-lg-col-4">
            <div class="hhb-card hhb-p-4">
              <h2 class="hhb-text-lg hhb-font-semibold hhb-mb-2">Total Expenses</h2>
              <div class="hhb-text-2xl hhb-font-bold hhb-text-orange-600">$0.00</div>
            </div>
          </div>
          
          <div class="hhb-col-12 hhb-md-col-6 hhb-lg-col-4">
            <div class="hhb-card hhb-p-4">
              <h2 class="hhb-text-lg hhb-font-semibold hhb-mb-2">Categories</h2>
              <div class="hhb-text-2xl hhb-font-bold hhb-text-blue-600">0</div>
            </div>
          </div>
          
          <div class="hhb-col-12 hhb-md-col-6 hhb-lg-col-4">
            <div class="hhb-card hhb-p-4">
              <h2 class="hhb-text-lg hhb-font-semibold hhb-mb-2">Pending</h2>
              <div class="hhb-text-2xl hhb-font-bold hhb-text-yellow-600">0</div>
            </div>
          </div>
        </div>
        
        <div class="hhb-card hhb-p-6 hhb-mt-6">
          <h2 class="hhb-text-lg hhb-font-semibold hhb-mb-4">Quick Actions</h2>
          <div class="hhb-flex hhb-flex-col hhb-gap-3">
            <button class="hhb-btn hhb-btn-primary hhb-w-full">Add Expense</button>
            <button class="hhb-btn hhb-btn-secondary hhb-w-full">View Calendar</button>
            <button class="hhb-btn hhb-btn-outline hhb-w-full">Settle Up</button>
          </div>
        </div>
      </main>
    </div>
  </ResponsiveLayout>
</template>

<style>
.mobile-dashboard {
  max-width: var(--container-width, 100%);
  margin: 0 auto;
  padding: 1rem;
}

.dashboard-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--hhb-border-color);
}

.dashboard-content {
  margin-top: 1rem;
}

@media (min-width: 768px) {
  .mobile-dashboard {
    padding: 2rem;
  }
  
  .dashboard-header {
    margin-bottom: 2rem;
  }
}

.hhb-high-contrast {
  border-color: currentColor;
}

.hhb-reduced-motion * {
  animation: none !important;
  transition: none !important;
}
</style>

<script setup lang="ts">
// For testability
const testId = "mobile-dashboard";
</script>