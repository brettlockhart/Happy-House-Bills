import { ref, computed, readonly } from "vue";

export interface OfflineState {
  isOnline: boolean;
  wasOffline: boolean;
  queuedActions: Array<() => Promise<void>>;
  syncStatus: "idle" | "syncing" | "failed" | "completed";
  retryCount: number;
  maxRetries: number;
  lastSyncTime: Date | null;
  sync: () => Promise<void>;
  addToQueue: (action: () => Promise<void>) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
}

const isOnlineState = ref<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
const wasOfflineState = ref<boolean>(false);
const queuedActions = ref<Array<() => Promise<void>>>([]);
const syncStatusState = ref<OfflineState["syncStatus"]>("idle");
const retryCountState = ref<number>(0);
const maxRetriesState = ref<number>(3);
const lastSyncTimeState = ref<Date | null>(null);

const updateOnlineStatus = (online: boolean) => {
  isOnlineState.value = online;
  if (!online) {
    wasOfflineState.value = true;
    syncStatusState.value = "failed";
  }
};

const sync = async () => {
  if (queuedActions.value.length === 0) return;
  
  syncStatusState.value = "syncing";
  
  try {
    for (let i = 0; i < queuedActions.value.length; i++) {
      try {
        await queuedActions.value[i]();
        queuedActions.value.splice(i, 1);
        i--;
      } catch (error) {
        retryCountState.value++;
        if (retryCountState.value >= maxRetriesState.value) {
          syncStatusState.value = "failed";
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCountState.value));
      }
    }
    
    syncStatusState.value = "completed";
    lastSyncTimeState.value = new Date();
    retryCountState.value = 0;
  } catch (error) {
    syncStatusState.value = "failed";
    throw error;
  }
};

const addToQueue = (action: () => Promise<void>) => {
  queuedActions.value.push(action);
  if (!isOnlineState.value) {
    syncStatusState.value = "syncing";
    sync();
  }
};

const removeFromQueue = (index: number) => {
  if (index >= 0 && index < queuedActions.value.length) {
    queuedActions.value.splice(index, 1);
  }
};

const clearQueue = () => {
  queuedActions.value = [];
};

export function useOfflineState(): OfflineState {
  if (typeof window !== "undefined") {
    const handleOnline = () => updateOnlineStatus(true);
    const handleOffline = () => updateOnlineStatus(false);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }
  
  return {
    isOnline: readonly(isOnlineState),
    wasOffline: readonly(wasOfflineState),
    queuedActions: readonly(queuedActions),
    syncStatus: readonly(syncStatusState),
    retryCount: readonly(retryCountState),
    maxRetries: readonly(maxRetriesState),
    lastSyncTime: readonly(lastSyncTimeState),
    sync,
    addToQueue,
    removeFromQueue,
    clearQueue,
  };
}