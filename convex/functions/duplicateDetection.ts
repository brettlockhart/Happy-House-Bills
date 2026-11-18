import type { Doc } from "../_generated/dataModel";

const DHASH_HAMMING_THRESHOLD = 10;

export function hammingDistance(a: string, b: string): number {
  const len = Math.max(a.length, b.length);
  let distance = 0;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    if (ca !== cb) distance++;
  }
  return distance;
}

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

interface DuplicateCtx {
  db: {
    query: (table: "expenses") => {
      withIndex: (
        indexName: "by_org",
        q: (q: { eq: (field: "orgId", value: string) => unknown }) => unknown,
      ) => {
        filter: (q: { eq: (field: string, value: unknown) => unknown }) => ({ collect: () => Promise<Doc<"expenses">[]> });
      };
    };
  };
}

export async function runDuplicateCheck(
  ctx: DuplicateCtx,
  input: DuplicateCheckInput,
): Promise<{ isDuplicate: boolean; matches: Array<DuplicateMatch> }> {
  const matches: Array<DuplicateMatch> = [];
  const seenIds = new Set<string>();

  const query = ctx.db.query("expenses");

  if (input.orgId) {
    const filtered = query.withIndex(
      "by_org",
      (q) => q.eq("orgId", input.orgId),
    );

    if (input.receiptPHash) {
      const candidates = (await filtered.filter((q) => q.eq("deletedAt", undefined)).collect()) as Array<Doc<"expenses">>;
      for (const exp of candidates) {
        if (exp.receiptPHash && hammingDistance(input.receiptPHash, exp.receiptPHash) <= DHASH_HAMMING_THRESHOLD && !seenIds.has(exp._id)) {
          seenIds.add(exp._id);
          matches.push({
            id: exp._id,
            store: null,
            date: exp.date,
            total: exp.amount,
            status: exp.status,
          });
        }
      }
    }

    if (input.receiptFingerprint) {
      const candidates = (await filtered.filter((q) => q.eq("deletedAt", undefined)).collect()) as Array<Doc<"expenses">>;
      for (const exp of candidates) {
        if (exp.receiptFingerprint && exp.receiptFingerprint === input.receiptFingerprint && !seenIds.has(exp._id)) {
          seenIds.add(exp._id);
          matches.push({
            id: exp._id,
            store: null,
            date: exp.date,
            total: exp.amount,
            status: exp.status,
          });
        }
      }
    }

    if (input.amount !== undefined && input.date) {
      const candidates = (await filtered.filter((q) => q.eq("deletedAt", undefined)).collect()) as Array<Doc<"expenses">>;
      for (const exp of candidates) {
        if (exp.amount === input.amount && exp.date === input.date && !seenIds.has(exp._id)) {
          seenIds.add(exp._id);
          matches.push({
            id: exp._id,
            store: null,
            date: exp.date,
            total: exp.amount,
            status: exp.status,
          });
        }
      }
    }
  }

  return { isDuplicate: matches.length > 0, matches };
}