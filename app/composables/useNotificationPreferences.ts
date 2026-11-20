import { computed } from "vue";
import { useConvexQuery, useConvexMutation } from "convex-vue";
import { api } from "~~/convex/_generated/api";
import type { Doc } from "~~/convex/_generated/dataModel";

export type NotificationPreferences = Doc<"notificationPreferences">;

export const DEFAULT_PREFERENCES = {
  expensePending: true,
  expenseApproved: true,
  expenseRejected: true,
  settlementCreated: true,
  inviteSent: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  batchWindowMs: 2000,
  emailFallback: true,
};

export function parseTimeToMinutes(value: string): number {
  const parts = value.split(":");
  const h = Number(parts[0] ?? "0");
  const m = Number(parts[1] ?? "0");
  return h * 60 + m;
}

export function isWithinQuietHours(
  prefs: Pick<NotificationPreferences, "quietHoursStart" | "quietHoursEnd">,
  now: Date = new Date(),
): boolean {
  if (!prefs.quietHoursStart || !prefs.quietHoursEnd) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  const start = parseTimeToMinutes(prefs.quietHoursStart);
  const end = parseTimeToMinutes(prefs.quietHoursEnd);
  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function isTypeEnabled(
  prefs: Partial<NotificationPreferences>,
  type: string,
): boolean {
  switch (type) {
    case "expense_pending":
      return prefs.expensePending !== false;
    case "expense_approved":
      return prefs.expenseApproved !== false;
    case "expense_rejected":
      return prefs.expenseRejected !== false;
    case "settlement_created":
      return prefs.settlementCreated !== false;
    case "invite_sent":
      return prefs.inviteSent !== false;
    case "goal_alert":
      return true;
    default:
      return true;
  }
}

export function useNotificationPreferences() {
  const result = useConvexQuery(api.functions.notificationPreferences.get, {});
  const updateMutation = useConvexMutation(api.functions.notificationPreferences.update);
  const resetMutation = useConvexMutation(api.functions.notificationPreferences.reset);

  const preferences = computed<NotificationPreferences>(() => {
    const data = result.data.value as NotificationPreferences | undefined;
    if (data) return data;
    return {
      ...DEFAULT_PREFERENCES,
      _id: "" as NotificationPreferences["_id"],
      _creationTime: 0,
      orgId: "",
      userId: "",
      updatedAt: 0,
    } as NotificationPreferences;
  });

  const isLoading = computed(
    () => result.isPending.value || updateMutation.isPending.value || resetMutation.isPending.value,
  );

  const isQuietHours = computed(() => isWithinQuietHours(preferences.value));

  return {
    preferences,
    isLoading,
    isQuietHours,
    updatePreferences: updateMutation.mutate,
    resetPreferences: resetMutation.mutate,
  };
}