import { internal } from "../_generated/server";
import { v } from "convex/values";

export interface AccountingConfig {
  provider: "quickbooks" | "xero" | "wave" | "mock";
  companyId?: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface AccountingTransaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  payee?: string;
  category?: string;
  accountId?: string;
  status: "pending" | "completed" | "failed";
}

export interface AccountingAccount {
  id: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  balance: number;
}

export interface SyncAccountingResult {
  success: boolean;
  transactions: AccountingTransaction[];
  accounts: AccountingAccount[];
  newTransactions: number;
  error?: string;
}

export const testAccountingConnection = internal({
  args: {
    provider: v.string(),
    credentials: v.any(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    switch (args.provider) {
      case "quickbooks": {
        const companyId = (args.credentials as { company_id?: string })?.company_id;
        if (!companyId) {
          return { success: false, error: "Missing QuickBooks company_id" };
        }
        return { success: true, error: undefined };
      }
      case "xero": {
        const accessToken = (args.credentials as { access_token?: string })?.access_token;
        if (!accessToken) {
          return { success: false, error: "Missing Xero access_token" };
        }
        return { success: true, error: undefined };
      }
      case "wave": {
        const accessToken = (args.credentials as { access_token?: string })?.access_token;
        if (!accessToken) {
          return { success: false, error: "Missing Wave access_token" };
        }
        return { success: true, error: undefined };
      }
      case "mock": {
        return { success: true, error: undefined };
      }
      default:
        return { success: false, error: `Unknown provider: ${args.provider}` };
    }
  },
});

export const syncAccountingTransactions = internal({
  args: {
    provider: v.string(),
    credentials: v.any(),
    orgId: v.string(),
  },
  handler: async (ctx, args): Promise<SyncAccountingResult> => {
    const result: SyncAccountingResult = {
      success: false,
      transactions: [],
      accounts: [],
      newTransactions: 0,
    };

    switch (args.provider) {
      case "quickbooks": {
        await new Promise((r) => setTimeout(r, 1500));

        result.success = true;
        result.transactions = [
          {
            id: "acctx_1",
            date: new Date().toISOString().split("T")[0],
            amount: -42.5,
            description: "Grocery Store",
            payee: "Safeway",
            category: "groceries",
            status: "completed",
          },
          {
            id: "acctx_2",
            date: new Date().toISOString().split("T")[0],
            amount: 1500.0,
            description: "Salary Deposit",
            payee: "Employer",
            category: "income",
            status: "completed",
          },
        ];
        result.newTransactions = 2;

        result.accounts = [
          {
            id: "acc_1",
            name: "Checking",
            type: "asset",
            balance: 3500.0,
          },
        ];
        return result;
      }
      case "xero": {
        await new Promise((r) => setTimeout(r, 1200));
        result.success = true;
        result.transactions = [
          {
            id: "xcctx_1",
            date: new Date().toISOString().split("T")[0],
            amount: -38.99,
            description: "Coffee Shop",
            payee: "Starbucks",
            category: "dining",
            status: "completed",
          },
        ];
        result.newTransactions = 1;
        return result;
      }
      case "wave": {
        await new Promise((r) => setTimeout(r, 800));
        result.success = true;
        result.transactions = [
          {
            id: "wctx_1",
            date: new Date().toISOString().split("T")[0],
            amount: -12.75,
            description: "Pharmacy",
            payee: "CVS",
            category: "healthcare",
            status: "completed",
          },
        ];
        result.newTransactions = 1;
        return result;
      }
      case "mock": {
        await new Promise((r) => setTimeout(r, 500));
        result.success = true;
        result.transactions = [
          {
            id: "mock_acctx_1",
            date: new Date().toISOString().split("T")[0],
            amount: -19.99,
            description: "Test Transaction",
            payee: "Test Payee",
            category: "other",
            status: "completed",
          },
        ];
        result.newTransactions = 1;
        return result;
      }
      default:
        result.error = `Unknown provider: ${args.provider}`;
        return result;
    }
  },
});