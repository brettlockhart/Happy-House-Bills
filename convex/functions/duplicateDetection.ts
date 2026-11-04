import type { GenericQueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

const DHASH_HAMMING_THRESHOLD = 10;

interface DuplicateMatch {
  id: string;
  store: string | null;
  date: string | null;
  total: number | null;
  status: "pending" | "approved" | "rejected";
}

interface DuplicateCheckInput {
  orgId: string;
  receiptPHash?: string;
  receiptFingerprint?: string;
  amount?: number;
  date?: string;
}

export async function runDuplicateCheck(
  ctx: GenericQueryCtx,
  expense: DuplicateCheckInput,
): Promise<{
  isDuplicate: boolean;
  matches: DuplicateMatch[];
}> {
  if (
    !expense.receiptPHash &&
    !expense.receiptFingerprint &&
    !(expense.amount && expense.date)
  ) {
    return { isDuplicate: false, matches: [] };
  }

  const existing = await ctx.db
    .query("expenses")
    .withIndex("by_org", (q) => q.eq("orgId", expense.orgId))
    .filter((q) =>
      q.and(
        q.eq(q.field("deletedAt"), undefined),
      ),
    )
    .collect();

  const matches: DuplicateMatch[] = [];

  for (const exp of existing as (Doc<"expenses"> & { _id: Id<"expenses"> })[]) {
    if (
      exp.receiptFingerprint &&
      expense.receiptFingerprint &&
      exp.receiptFingerprint === expense.receiptFingerprint
    ) {
      matches.push({
        id: exp._id.toString(),
        store: exp.notes ?? null,
        date: exp.date,
        total: exp.amount,
        status: exp.status,
      });
      continue;
    }

    if (
      exp.receiptPHash &&
      expense.receiptPHash &&
      hammingDistance(exp.receiptPHash, expense.receiptPHash) <=
        DHASH_HAMMING_THRESHOLD
    ) {
      matches.push({
        id: exp._id.toString(),
        store: exp.notes ?? null,
        date: exp.date,
        total: exp.amount,
        status: exp.status,
      });
    }

    if (
      expense.amount !== undefined &&
      expense.date &&
      exp.date === expense.date &&
      Math.abs(exp.amount - expense.amount) <= 0.01
    ) {
      const alreadyMatched = matches.some((m) => m.id === exp._id.toString());
      if (!alreadyMatched) {
        matches.push({
          id: exp._id.toString(),
          store: exp.notes ?? null,
          date: exp.date,
          total: exp.amount,
          status: exp.status,
        });
      }
    }
  }

  return { isDuplicate: matches.length > 0, matches };
}

export function hammingDistance(hashA: string, hashB: string): number {
  const maxLen = Math.max(hashA.length, hashB.length);
  let distance = 0;
  for (let i = 0; i < maxLen; i++) {
    if (hashA[i] !== hashB[i]) distance++;
  }
  return distance;
}
