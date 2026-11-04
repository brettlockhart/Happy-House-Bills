export interface InviteEmailData {
  inviteeEmail: string;
  inviterName: string;
  orgName: string;
  inviteToken: string;
}

export interface ExpenseEmailData {
  expenseId: string;
  payerName: string;
  amount: number;
  category: string;
  notes?: string;
}

export interface SettlementEmailData {
  fromUserName: string;
  toUserName: string;
  amount: number;
}

export interface ExpenseApprovedEmailData {
  approverName: string;
  expenseId: string;
  amount: number;
  category: string;
}

export interface ExpenseRejectedEmailData {
  rejectorName: string;
  expenseId: string;
  amount: number;
  category: string;
  rejectReason?: string;
}

export type EmailType =
  | "invite"
  | "expenseNotification"
  | "settlementNotification"
  | "expenseApproved"
  | "expenseRejected";

export const emailSubjects: Record<EmailType, string> = {
  invite: "You're invited to join Happy House Bills",
  expenseNotification: "New expense pending your confirmation",
  settlementNotification: "Settlement recorded",
  expenseApproved: "Expense approved",
  expenseRejected: "Expense rejected",
};

export { formatCurrency } from "~/utils/formatting";

export function getEmailTypeLabel(type: EmailType): string {
  const labels: Record<EmailType, string> = {
    invite: "Invitation",
    expenseNotification: "New Expense",
    settlementNotification: "Settlement",
    expenseApproved: "Expense Approved",
    expenseRejected: "Expense Rejected",
  };
  return labels[type];
}
