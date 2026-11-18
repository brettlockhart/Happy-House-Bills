import { computed, ref, onMounted, onUnmounted } from "vue";
import { useConvexClient, useConvexQuery } from "convex-vue";
import { api } from "~~/convex/_generated/api";
import type { Id } from "~~/convex/_generated/dataModel";

interface PendingUpgrade {
  _id: Id<"expenses">;
  store?: string;
  date: string;
  amount: number;
}

/**
 * Handles "return to online" AI upgrades for receipts that were read offline
 * (Tesseract). When connectivity returns, the original stored receipt image is
 * re-read by the LLM for higher accuracy and proper structure.
 */
export function useReceiptAI() {
  const client = useConvexClient();
  const pendingQuery = useConvexQuery(api.functions.receiptUpgrades.needsAiUpgrade, {});

  const pendingUpgrades = computed(
    () => (pendingQuery.data.value ?? []) as PendingUpgrade[],
  );
  const pendingCount = computed(() => pendingUpgrades.value.length);
  const isUpgrading = ref(false);
  const syncError = ref<string | null>(null);

  async function upgradeReceipt(expenseId: Id<"expenses">) {
    return client.action(api.functions.ocrOpenRouter.reprocessReceipt, { expenseId });
  }

  async function dismissReceipt(expenseId: Id<"expenses">) {
    return client.mutation(api.functions.receiptUpgrades.dismissOcrUpgrade, { expenseId });
  }

  async function syncWhenOnline() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      syncError.value = "Connect to the internet to improve receipts with AI.";
      return;
    }
    if (isUpgrading.value) return;
    const items = pendingUpgrades.value;
    if (items.length === 0) return;

    isUpgrading.value = true;
    syncError.value = null;
    let failures = 0;
    try {
      for (const item of items) {
        try {
          await upgradeReceipt(item._id);
        } catch (e) {
          failures++;
          console.warn("AI receipt upgrade failed for", item._id, e);
        }
      }
      if (failures > 0) {
        syncError.value = `${failures} receipt${failures > 1 ? "s" : ""} couldn't be upgraded. Try again shortly.`;
      }
    } finally {
      isUpgrading.value = false;
    }
  }

  function handleOnline() {
    void syncWhenOnline();
  }

  onMounted(() => {
    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      void syncWhenOnline();
    }
  });
  onUnmounted(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", handleOnline);
    }
  });

  return {
    pendingUpgrades,
    pendingCount,
    isUpgrading,
    syncError,
    upgradeReceipt,
    dismissReceipt,
    syncWhenOnline,
  };
}
