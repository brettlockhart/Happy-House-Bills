import { useConvexQuery, useConvexMutation } from "convex-vue";
import { api } from "~~/convex/_generated/api";
import type { Id } from "~~/convex/_generated/dataModel";

export function useNotifications() {
  const notifications = useConvexQuery(api.functions.notifications.list, () => ({ limit: 50 }));
  const unreadCount = useConvexQuery(api.functions.notifications.unreadCount, () => ({}));

  const markRead = useConvexMutation(api.functions.notifications.markRead);
  const markAllRead = useConvexMutation(api.functions.notifications.markAllRead);

  return {
    notifications,
    unreadCount,
    markRead: async (notificationId: Id<"notifications">) => {
      await markRead.mutate({ notificationId });
    },
    markAllRead: async () => {
      await markAllRead.mutate({});
    },
  };
}