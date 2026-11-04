import { ref, computed } from "vue";
import type { EmailType } from "~/utils/email-templates";
import { emailSubjects } from "~/utils/email-templates";

export interface EmailSettings {
  expenseNotifications: boolean;
  settlementNotifications: boolean;
  weeklySummary: boolean;
  securityAlerts: boolean;
}

const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  expenseNotifications: true,
  settlementNotifications: true,
  weeklySummary: true,
  securityAlerts: true,
};

export function useEmail() {
  const isSending = ref(false);
  const error = ref<Error | null>(null);

  async function sendEmail(_args: {
    to: string[];
    subject: string;
    html: string;
  }): Promise<void> {
    isSending.value = true;
    error.value = null;
    try {
      throw new Error("Email sending must be done server-side; email.send is internal-only");
    } catch (e) {
      error.value = e as Error;
      throw e;
    } finally {
      isSending.value = false;
    }
  }

  function getDefaultSubject(type: EmailType): string {
    return emailSubjects[type];
  }

  function getDefaultSettings(): EmailSettings {
    return { ...DEFAULT_EMAIL_SETTINGS };
  }

  function hasUnsubscribed(settings: EmailSettings | null | undefined): boolean {
    return !settings;
  }

  const isSendingEmail = computed(() => isSending.value);

  return {
    sendEmail,
    isSending,
    error,
    isSendingEmail,
    getDefaultSubject,
    getDefaultSettings,
    hasUnsubscribed,
  };
}
