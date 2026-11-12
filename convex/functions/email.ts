import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { formatCurrency } from "./formatting";

export { formatCurrency };

interface SendEmailArgs {
  to: string[];
  subject: string;
  html: string;
  from?: string;
  orgId?: string;
  userId?: string;
}

interface ResendErrorResponse {
  name: string;
  message: string;
}

interface RateLimitContext {
  db: {
    query: (table: string) => {
      withIndex: (
        index: string,
        callback: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
      ) => { first: () => Promise<{ _id: string; count: number; lastSentAt?: number } | null> };
    };
    insert: (table: string, data: Record<string, unknown>) => Promise<string>;
    patch: (id: string, data: Record<string, unknown>) => Promise<void>;
  };
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const DAILY_EMAIL_CAP = 100;

interface IndexedQueryResult {
  _id: string;
  count: number;
  lastSentAt?: number;
}

export async function checkAndIncrementRateLimit(
  ctx: RateLimitContext,
  orgId: string,
  userId?: string,
): Promise<void> {
  const today = new Date().toISOString().split("T")[0] ?? "";
  let dbQuery: Promise<IndexedQueryResult | null>;

  if (userId) {
    dbQuery = ctx.db
      .query("emailRateLimits")
      .withIndex("by_org_date_user", (q) =>
        q.eq("orgId", orgId).eq("date", today).eq("userId", userId),
      )
      .first() as Promise<IndexedQueryResult | null>;
  } else {
    dbQuery = ctx.db
      .query("emailRateLimits")
      .withIndex("by_org_date", (q) => q.eq("orgId", orgId).eq("date", today))
      .first() as Promise<IndexedQueryResult | null>;
  }

  const rateLimit = await dbQuery;

  if (rateLimit) {
    if (rateLimit.count >= DAILY_EMAIL_CAP) {
      throw new Error(
        `Daily email limit exceeded for org ${orgId} (${DAILY_EMAIL_CAP}/day)`,
      );
    }

    if (
      userId &&
      rateLimit.lastSentAt &&
      Date.now() - rateLimit.lastSentAt < 60 * 60 * 1000
    ) {
      const mins = Math.round((60 * 60 * 1000 - (Date.now() - rateLimit.lastSentAt)) / 60000);
      throw new Error(
        `Rate limit: user cooldown active (${mins} min remaining)`,
      );
    }

    await ctx.db.patch(rateLimit._id, {
      count: rateLimit.count + 1,
      lastSentAt: userId ? Date.now() : rateLimit.lastSentAt,
    });
  } else {
    if (userId) {
      await ctx.db.insert("emailRateLimits", { orgId, userId, date: today, count: 1, lastSentAt: Date.now() });
    } else {
      await ctx.db.insert("emailRateLimits", { orgId, date: today, count: 1 });
    }
  }
}

export async function sendEmail(
  args: SendEmailArgs,
  ctx?: RateLimitContext,
): Promise<{ id: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@happyhousebills.com";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.happyhousebills.com";

  if (appUrl && !appUrl.startsWith("https://")) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must use HTTPS scheme for security; set it in .env",
    );
  }

  if (args.orgId && ctx) {
    await checkAndIncrementRateLimit(ctx, args.orgId, args.userId);
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: args.to,
      subject: args.subject,
      html: args.html,
      headers: {
        "List-Unsubscribe": `<${appUrl}/settings/notifications>`,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({} as ResendErrorResponse));
    throw new Error(`Resend API error: ${response.status} ${errorBody.message || response.statusText}`);
  }

  const result = await response.json() as { id: string };
  return { id: result.id };
}

function generateUnsubscribeLink(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.happyhousebills.com";
  if (!appUrl.startsWith("https://")) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must use HTTPS scheme for security; set it in .env",
    );
  }
  return `${appUrl}/settings/notifications`;
}

export function renderInviteEmail(
  inviteeEmail: string,
  inviterName: string,
  orgName: string,
  inviteToken: string,
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.happyhousebills.com";
  const deepLink = `${appUrl}/invite?token=${inviteToken}`;
  const unsubscribeLink = generateUnsubscribeLink();

  const inviter = escapeHtml(inviterName);
  const org = orgName ? escapeHtml(orgName) : "";

  return `<html>
<body style="font-family: system-ui, sans-serif; color: #0f172a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #10b981;">You're invited to join Happy House Bills</h2>
  <p>${inviter} has invited you to share household expense tracking with them${org ? ` for ${org}` : ""}.</p>
  <p>Click below to accept the invitation and create your account:</p>
  <a href="${deepLink}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px;">Accept Invite</a>
  <p style="color: #64748b; font-size: 12px;">This link expires in 7 days.</p>
  <p style="color: #64748b; font-size: 12px;"><a href="${unsubscribeLink}" style="color: #64748b;">Unsubscribe</a></p>
</body>
</html>`;
}

export function renderExpenseNotificationEmail(
  expenseId: string,
  payerName: string,
  amount: number,
  category: string,
  notes: string | undefined,
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.happyhousebills.com";
  const deepLink = `${appUrl}/?expense=${expenseId}`;
  const unsubscribeLink = generateUnsubscribeLink();

  const payer = escapeHtml(payerName);
  const cat = escapeHtml(category);
  const noteHtml = notes ? ` — "${escapeHtml(notes)}"` : "";

  return `<html>
<body style="font-family: system-ui, sans-serif; color: #0f172a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #10b981;">New expense pending your confirmation</h2>
  <p><strong>${payer}</strong> added an expense of <strong>${formatCurrency(amount)}</strong> for <em>${cat}</em>${noteHtml}.</p>
  <p>Please review and confirm this expense:</p>
  <a href="${deepLink}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px;">Review Expense</a>
  <p style="color: #64748b; font-size: 12px;"><a href="${unsubscribeLink}" style="color: #64748b;">Unsubscribe</a></p>
</body>
</html>`;
}

export function renderSettlementNotificationEmail(
  fromUserName: string,
  toUserName: string,
  amount: number,
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.happyhousebills.com";
  const unsubscribeLink = generateUnsubscribeLink();

  const from = escapeHtml(fromUserName);
  const to = escapeHtml(toUserName);

  return `<html>
<body style="font-family: system-ui, sans-serif; color: #0f172a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #10b981;">Settlement recorded</h2>
  <p><strong>${from}</strong> has settled up with ${to} for <strong>${formatCurrency(amount)}</strong>.</p>
  <a href="${appUrl}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px;">View Balances</a>
  <p style="color: #64748b; font-size: 12px;"><a href="${unsubscribeLink}" style="color: #64748b;">Unsubscribe</a></p>
</body>
</html>`;
}

export function renderExpenseApprovedEmail(
  approverName: string,
  expenseId: string,
  amount: number,
  category: string,
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.happyhousebills.com";
  const deepLink = `${appUrl}/?expense=${expenseId}`;
  const unsubscribeLink = generateUnsubscribeLink();

  const approver = escapeHtml(approverName);
  const cat = escapeHtml(category);

  return `<html>
<body style="font-family: system-ui, sans-serif; color: #0f172a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #10b981;">Expense approved</h2>
  <p><strong>${approver}</strong> has approved your expense of <strong>${formatCurrency(amount)}</strong> for <em>${cat}</em>.</p>
  <a href="${deepLink}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px;">View Expense</a>
  <p style="color: #64748b; font-size: 12px;"><a href="${unsubscribeLink}" style="color: #64748b;">Unsubscribe</a></p>
</body>
</html>`;
}

export function renderExpenseRejectedEmail(
  rejectorName: string,
  expenseId: string,
  amount: number,
  category: string,
  rejectReason: string | undefined,
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.happyhousebills.com";
  const deepLink = `${appUrl}/?expense=${expenseId}`;
  const unsubscribeLink = generateUnsubscribeLink();

  const rejector = escapeHtml(rejectorName);
  const cat = escapeHtml(category);
  const reasonHtml = rejectReason ? `<p>Reason: ${escapeHtml(rejectReason)}</p>` : "";

  return `<html>
<body style="font-family: system-ui, sans-serif; color: #0f172a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #ef4444;">Expense rejected</h2>
  <p><strong>${rejector}</strong> has rejected your expense of <strong>${formatCurrency(amount)}</strong> for <em>${cat}</em>.</p>
  ${reasonHtml}
  <a href="${deepLink}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px;">View Expense</a>
  <p style="color: #64748b; font-size: 12px;"><a href="${unsubscribeLink}" style="color: #64748b;">Unsubscribe</a></p>
</body>
</html>`;
}

export const send = internalAction({
  args: {
    to: v.array(v.string()),
    subject: v.string(),
    html: v.string(),
    orgId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return sendEmail(
      {
        to: args.to,
        subject: args.subject,
        html: args.html,
        orgId: args.orgId,
        userId: args.userId,
      },
      ctx as unknown as RateLimitContext,
    );
  },
});
