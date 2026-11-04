import { describe, it, expect } from "vitest";
import { parseOcrText, parseTotal, parseDate, parseStore, applyOcrToForm, generateFingerprint } from "../../app/utils/ocrParser";

describe("ocrParser", () => {
  describe("parseTotal", () => {
    it("extracts total after 'TOTAL' keyword", () => {
      const text = "SUBTOTAL\n$10.00\nTOTAL\n$45.99";
      expect(parseTotal(text)).toBe("45.99");
    });

    it("extracts amount on same line as 'Total:'", () => {
      const text = "Total: $15.50";
      expect(parseTotal(text)).toBe("15.50");
    });

    it("extracts last currency amount as fallback", () => {
      const text = "Item A\n$10.00\nItem B\n$5.00\n$3.00";
      expect(parseTotal(text)).toBe("3.00");
    });

    it("handles amount due pattern", () => {
      const text = "AMOUNT DUE\n$100.00";
      expect(parseTotal(text)).toBe("100.00");
    });

    it("extracts from grand total", () => {
      const text = "Grand Total: $99.99";
      expect(parseTotal(text)).toBe("99.99");
    });

    it("returns undefined when no currency matches", () => {
      const text = "no numbers here";
      expect(parseTotal(text)).toBeUndefined();
    });
  });

  describe("parseDate", () => {
    it("extracts MM/DD/YYYY dates", () => {
      const text = "Date: 12/25/2024";
      expect(parseDate(text)).toBe("2024-12-25");
    });

    it("extracts MM/DD/YY dates (2-digit year)", () => {
      const text = "Date: 1/5/25";
      expect(parseDate(text)).toBe("2025-01-05");
    });

    it("extracts YYYY-MM-DD dates", () => {
      const text = "Date: 2024-12-25";
      expect(parseDate(text)).toBe("2024-12-25");
    });

    it("extracts month name dates", () => {
      const text = "Jan 15, 2024";
      expect(parseDate(text)).toBe("2024-01-15");
    });

    it("handles dash-separated dates", () => {
      const text = "Date: 12-25-2024";
      expect(parseDate(text)).toBe("2024-12-25");
    });

    it("returns undefined when no date found", () => {
      const text = "TOTAL $45.99";
      expect(parseDate(text)).toBeUndefined();
    });
  });

  describe("parseStore", () => {
    it("extracts merchant name from receipt", () => {
      const text = "TARGET\n123 MAIN ST\nSTOREFIELD\nDate: 12/25/2024\nTOTAL\n$45.99";
      expect(parseStore(text)).toBe("TARGET");
    });

    it("skips common non-store lines", () => {
      const text = "THANK YOU FOR SHOPPING\nInvoice #12345\nDate: 12/25/2024\nTOTAL $45.99";
      expect(parseStore(text)).toBeUndefined();
    });

    it("returns first valid line that looks like a store name", () => {
      const text = "WALMART SUPERCENTER\n...";
      expect(parseStore(text)).toBe("WALMART SUPERCENTER");
    });

    it("returns undefined for empty text", () => {
      expect(parseStore("")).toBeUndefined();
    });
  });

  describe("parseOcrText", () => {
    it("returns all fields from receipt text", () => {
      const text = "TARGET\nDate: 12/25/2024\nTOTAL\n$45.99";
      const result = parseOcrText(text);
      expect(result.store).toBe("TARGET");
      expect(result.date).toBe("2024-12-25");
      expect(result.total).toBe("45.99");
      expect(result.raw).toBe(text);
    });
  });

  describe("applyOcrToForm", () => {
    it("populates empty form fields only", () => {
      const ocrResult = { store: "Target", date: "2024-12-25", total: "45.99", raw: "" };
      const form = { total: 0, date: "", store: "", notes: "custom" };
      const result = applyOcrToForm(ocrResult, form);
      expect(result.total).toBe(45.99);
      expect(result.date).toBe("2024-12-25");
      expect(result.store).toBe("Target");
      expect(result.notes).toBe("custom");
    });

    it("does not overwrite user-entered values", () => {
      const ocrResult = { store: "Target", date: "2024-12-25", total: "45.99", raw: "" };
      const form = { total: 20.00, date: "2024-01-01", store: "Walmart", notes: "" };
      const result = applyOcrToForm(ocrResult, form);
      expect(result.total).toBe(20.00);
      expect(result.date).toBe("2024-01-01");
      expect(result.store).toBe("Walmart");
    });

    it("parses string total to float", () => {
      const ocrResult = { total: "45.99", raw: "" };
      const form = { total: 0 };
      const result = applyOcrToForm(ocrResult, form);
      expect(result.total).toBe(45.99);
    });

    // SEC-010: Raw OCR text may contain script tags; applyOcrToForm must store it as a
    // plain string value (not evaluated). Rendering layer is responsible for text-only
    // interpolation (Vue {{ }} auto-escaping), never v-html.
    it("ST-022: preserves script tags as literal string (XSS-safe transport)", () => {
      const ocrResult = { store: "<script>alert(1)</script>", raw: "<script>alert(1)</script>", total: "10.00" };
      const form = { total: 0, store: "", date: "" };
      const result = applyOcrToForm(ocrResult, form);
      expect(result.store).toBe("<script>alert(1)</script>");
      expect(result.total).toBe(10);
    });
  });

  describe("generateFingerprint", () => {
    it("generates fingerprint from store, date, and total", () => {
      expect(generateFingerprint("Walmart", "2024-01-01", 45.99)).toBe("Walmart|2024-01-01|45.99");
    });

    it("generates fingerprint with string total", () => {
      expect(generateFingerprint("Target", "2024-12-25", "15.5")).toBe("Target|2024-12-25|15.5");
    });

    it("returns undefined when all fields are undefined", () => {
      expect(generateFingerprint(undefined, undefined, undefined)).toBeUndefined();
    });

    it("handles partial fields (store only)", () => {
      expect(generateFingerprint("Costco", undefined, undefined)).toBe("Costco||");
    });

    it("handles partial fields (date and total only)", () => {
      expect(generateFingerprint(undefined, "2024-06-15", 100)).toBe("|2024-06-15|100");
    });
  });
});
