import { internal } from "../_generated/server";
import { v } from "convex/values";

export interface BankConfig {
  provider: "plaid" | "yodlee" | "mock";
  institutionId?: string;
  accountId?: string;
  clientId?: string;
  secret?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  mask: string;
  type: "checking" | "savings" | "credit";
  balance: number;
  currentBalance: number;
  isoCurrencyCode: string;
}

export interface BankTransaction {
  id: string;
  name: string;
  amount: number;
  date: string;
  isoCurrencyCode: string;
  pending: boolean;
  category?: string;
  accountName?: string;
}

export interface PlaidExchange {
  institution_id: string;
  name: string;
}

export interface PlaidItem {
  id: string;
  name: string;
  institutions: PlaidExchange[];
}

export interface SyncBankResult {
  success: boolean;
  accounts: BankAccount[];
  transactions: BankTransaction[];
  newAccounts: number;
  newTransactions: number;
  error?: string;
}

export const testBankConnection = internal({
  args: {
    provider: v.string(),
    credentials: v.any(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    switch (args.provider) {
      case "plaid": {
        const clientId = (args.credentials as { client_id?: string })?.client_id;
        const secret = (args.credentials as { secret?: string })?.secret;
        if (!clientId || !secret) {
          return { success: false, error: "Missing Plaid client_id or secret" };
        }
        return {
          success: true,
          error: undefined,
        };
      }
      case "yodlee": {
        const username = (args.credentials as { username?: string })?.username;
        const password = (args.credentials as { password?: string })?.password;
        if (!username || !password) {
          return { success: false, error: "Missing Yodlee credentials" };
        }
        return { success: true, error: undefined };
      }
      case "mock":
        return { success: true, error: undefined };
      default:
        return { success: false, error: `Unknown provider: ${args.provider}` };
    }
  },
});

export const syncBankAccounts = internal({
  args: {
    provider: v.string(),
    credentials: v.any(),
    orgId: v.string(),
  },
  handler: async (ctx, args): Promise<SyncBankResult> => {
    const result: SyncBankResult = { success: false, accounts: [], transactions: [], newAccounts: 0, newTransactions: 0 };

    switch (args.provider) {
      case "plaid": {
        const clientId = (args.credentials as { client_id?: string })?.client_id;
        const secret = (args.credentials as { secret?: string })?.secret;
        if (!clientId || !secret) {
          result.error = "Missing Plaid client_id or secret";
          return result;
        }

        // Mock Plaid API call
        await new Promise((r) => setTimeout(r, 1000));

        result.success = true;
        result.accounts = [
          {
            id: "acc_1",
            name: "Checking Account",
            mask: "####1234",
            type: "checking",
            balance: 5234.56,
            currentBalance: 5234.56,
            isoCurrencyCode: "USD",
          },
          {
            id: "acc_2",
            name: "Savings Account",
            mask: "####5678",
            type: "savings",
            balance: 25000.0,
            currentBalance: 25000.0,
            isoCurrencyCode: "USD",
          },
        ];
        result.newAccounts = 2;

        result.transactions = [
          {
            id: "tx_1",
            name: "Grocery Store",
            amount: -45.23,
            date: new Date().toISOString().split("T")[0],
            isoCurrencyCode: "USD",
            pending: false,
            category: "groceries",
          },
          {
            id: "tx_2",
            name: "Salary Deposit",
            amount: 3000.0,
            date: new Date().toISOString().split("T")[0],
            isoCurrencyCode: "USD",
            pending: false,
            category: "income",
          },
        ];
        result.newTransactions = 2;

        return result;
      }
      case "yodlee": {
        result.error = "Yodlee integration not yet implemented";
        return result;
      }
      case "mock": {
        await new Promise((r) => setTimeout(r, 500));
        result.success = true;
        result.accounts = [
          {
            id: "mock_acc_1",
            name: "Mock Account",
            mask: "####0000",
            type: "checking",
            balance: 1000.0,
            currentBalance: 1000.0,
            isoCurrencyCode: "USD",
          },
        ];
        result.newAccounts = 1;
        result.transactions = [
          {
            id: "mock_tx_1",
            name: "Mock Transaction",
            amount: -25.5,
            date: new Date().toISOString().split("T")[0],
            isoCurrencyCode: "USD",
            pending: false,
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

export const testBankConnectionMFA = internal({
  args: {
    provider: v.string(),
    credentials: v.any(),
    mfaCode: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    switch (args.provider) {
      case "plaid":
        if (!args.mfaCode) {
          return { success: false, error: "Plaid MFA code required" };
        }
        return { success: true, error: undefined };
      case "yodlee":
        if (!args.mfaCode) {
          return { success: false, error: "Yodlee MFA code required" };
        }
        return { success: true, error: undefined };
      case "mock":
        return { success: true, error: undefined };
      default:
        return { success: false, error: `Unknown provider: ${args.provider}` };
    }
  },
});