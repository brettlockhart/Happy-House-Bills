import { computed, ref } from "vue";
import { apiGateway } from "~/utils/api-gateway";
import type { IntegrationType } from "~/convex/functions/integrations";

export interface Integration {
  id: string;
  type: IntegrationType;
  provider: string;
  name: string;
  status: "connected" | "disconnected" | "error" | "pending";
  lastSyncAt?: string;
  errorMessage?: string;
}

export interface SyncLog {
  id: string;
  status: "success" | "failed" | "partial";
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export function useIntegrations() {
  const isPending = ref(false);
  const error = ref<string | undefined>(undefined);
  const integrations = computed<Integration[]>(() => {
    // Read from Convex via useConvexQuery
    // This will be wired up in the component
    return [] as Integration[];
  });

  const syncStatus = computed<SyncLog[]>(() => {
    return [] as SyncLog[];
  });

  const connectIntegration = async (
    type: IntegrationType,
    provider: string,
    name: string,
  ): Promise<{ success: boolean; error?: string }> => {
    isPending.value = true;
    error.value = undefined;

    try {
      const result = await apiGateway.post(`/api/convex/integrations/connect`, {
        type,
        provider,
        name,
      });

      if (!result.ok) {
        error.value = result.error ?? "Failed to connect integration";
        return { success: false, error: error.value };
      }

      return { success: true };
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : "Unexpected error";
      return { success: false, error: error.value ?? "Unexpected error" };
    } finally {
      isPending.value = false;
    }
  };

  const disconnectIntegration = async (
    integrationId: string,
  ): Promise<{ success: boolean; error?: string }> => {
    isPending.value = true;
    error.value = undefined;

    try {
      const result = await apiGateway.post(`/api/convex/integrations/disconnect`, {
        integrationId,
      });

      if (!result.ok) {
        error.value = result.error ?? "Failed to disconnect integration";
        return { success: false, error: error.value };
      }

      return { success: true };
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : "Unexpected error";
      return { success: false, error: error.value ?? "Unexpected error" };
    } finally {
      isPending.value = false;
    }
  };

  const syncIntegration = async (
    integrationId: string,
  ): Promise<{ success: boolean; error?: string; syncLog?: SyncLog }> => {
    isPending.value = true;
    error.value = undefined;

    try {
      const result = await apiGateway.post(`/api/convex/integrations/sync`, {
        integrationId,
      });

      if (!result.ok) {
        error.value = result.error ?? "Failed to sync integration";
        return { success: false, error: error.value };
      }

      return {
        success: true,
        error: undefined,
        syncLog: result.data as SyncLog,
      };
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : "Unexpected error";
      return { success: false, error: error.value ?? "Unexpected error" };
    } finally {
      isPending.value = false;
    }
  };

  const getSyncLogs = async (integrationId: string): Promise<SyncLog[]> => {
    try {
      const result = await apiGateway.post(`/api/convex/integrations/sync-logs`, {
        integrationId,
      });

      if (!result.ok) {
        return [] as SyncLog[];
      }

      return result.data as SyncLog[];
    } catch {
      return [] as SyncLog[];
    }
  };

  return {
    integrations,
    syncStatus,
    isPending,
    error,
    connectIntegration,
    disconnectIntegration,
    syncIntegration,
    getSyncLogs,
  };
}