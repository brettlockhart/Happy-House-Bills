export interface OcrResult {
  store?: string;
  date?: string;
  total?: string;
  raw: string;
}

export function parseOcrText(text: string): OcrResult {
  return {
    store: parseStore(text),
    date: parseDate(text),
    total: parseTotal(text),
    raw: text,
  };
}

export function parseStore(text: string): string | undefined {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return undefined;

  const skipPatterns = [
    /invoice/i,
    /receipt/i,
    /thank/i,
    /total/i,
    /subtotal/i,
    /^cash/i,
    /^change/i,
    /^balance/i,
    /^date/i,
    /^time/i,
    /^tax/i,
    /#\d+$/,
    /^\d{4,}/,
    /^\$/,
    /^card|chip|visa|mastercard|amex/i,
    /^\*+\s*\d{4}/,
    /transaction/i,
    /merchant/i,
    /authorization/i,
  ];

  for (const line of lines) {
    if (skipPatterns.some((p) => p.test(line))) continue;
    const upper = line.toUpperCase();
    if (upper.length >= 3 && upper === upper.replace(/[^A-Z]/g, "").slice(0, 4) && upper.length <= 30) {
      return line;
    }
    if (line.length >= 3 && !line.includes("$") && !/^\d/.test(line)) {
      return line;
    }
  }

  return undefined;
}

export function parseDate(text: string): string | undefined {
  const patterns = [
    { regex: /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/, yearFirst: true },
    { regex: /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/, monthFirst: true },
    { regex: /(\d{1,2})[/-](\d{1,2})[/-](\d{2})/, monthFirst: true },
    { regex: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i, monthName: true },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (!match) continue;

    if (pattern.monthName && match[1]) {
      const months: Record<string, string> = {
        jan: "01", feb: "02", mar: "03", apr: "04",
        may: "05", jun: "06", jul: "07", aug: "08",
        sep: "09", oct: "10", nov: "11", dec: "12",
      };
      const monthNum = months[match[1]!.toLowerCase()];
      if (!monthNum) continue;
      return `${match[3]}-${monthNum}-${match[2]!.padStart(2, "0")}`;
    }

    if (pattern.yearFirst) {
      const year = match[1]!;
      const month = match[2]!.padStart(2, "0");
      const day = match[3]!.padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    if (pattern.monthFirst) {
      const year = match[3]!.length === 2 ? `20${match[3]}` : match[3]!;
      const month = match[1]!.padStart(2, "0");
      const day = match[2]!.padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  return undefined;
}

export function parseTotal(text: string): string | undefined {
  const lines = text.split("\n").map((l) => l.trim());

  const primaryPatterns: RegExp[] = [
    /\bAMOUNT\s+DUE\b/i,
    /\bBALANCE\s+DUE\b/i,
    /\bGRAND\s+TOTAL\b/i,
    /\bTOTAL\b/i,
  ];

  const fallbackPatterns: RegExp[] = [
    /\bSUB\s*TOTAL\b/i,
    /\bSUBTOTAL\b/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (primaryPatterns.some((p) => p.test(line))) {
      const nextLine = lines[i + 1] ?? "";
      const moneyMatch = nextLine.match(/\$?\d+\.\d{2}/g);
      if (moneyMatch && moneyMatch.length > 0) {
        return moneyMatch[moneyMatch.length - 1]!.replace(/\$/g, "");
      }
      const sameLineMatch = line.match(/\$?\d+\.\d{2}/g);
      if (sameLineMatch && sameLineMatch.length > 0) {
        return sameLineMatch[sameLineMatch.length - 1]!.replace(/\$/g, "");
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (fallbackPatterns.some((p) => p.test(line))) {
      const nextLine = lines[i + 1] ?? "";
      const moneyMatch = nextLine.match(/\$?\d+\.\d{2}/g);
      if (moneyMatch && moneyMatch.length > 0) {
        return moneyMatch[moneyMatch.length - 1]!.replace(/\$/g, "");
      }
      const sameLineMatch = line.match(/\$?\d+\.\d{2}/g);
      if (sameLineMatch && sameLineMatch.length > 0) {
        return sameLineMatch[sameLineMatch.length - 1]!.replace(/\$/g, "");
      }
    }
  }

  const allMoneyMatches = text.match(/\$?\d+\.\d{2}/g);
  if (allMoneyMatches && allMoneyMatches.length > 0) {
    return allMoneyMatches[allMoneyMatches.length - 1]!.replace(/\$/g, "");
  }

  return undefined;
}

export function applyOcrToForm(
  ocrResult: OcrResult,
  form: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...form };

  if (ocrResult.total !== undefined) {
    const existingTotal = form.total as number | string | undefined;
    if (!existingTotal || existingTotal === 0 || existingTotal === "") {
      result.total = parseFloat(ocrResult.total);
    }
  }

  if (ocrResult.date !== undefined) {
    const existingDate = form.date as string | undefined;
    if (!existingDate || existingDate === "") {
      result.date = ocrResult.date;
    }
  }

  if (ocrResult.store !== undefined) {
    const existingStore = form.store as string | undefined;
    if (!existingStore || existingStore === "") {
      result.store = ocrResult.store;
    }
  }

   return result;
}

export function generateFingerprint(
  store?: string,
  date?: string,
  total?: number | string,
): string | undefined {
  if (!store && !date && !total) return undefined;
  const s = store ?? "";
  const d = date ?? "";
  const t = total !== undefined ? String(total) : "";
  return `${s}|${d}|${t}`;
}
