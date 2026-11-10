import { parseBankDate } from "../../utils/dateHelper.js";

/**
 * Parser for HDFC Savings / Current Account statements (CSV / Excel)
 * Standard columns:
 * - Date
 * - Narration / Description
 * - Chq./Ref.No.
 * - Value Dt
 * - Withdrawal Amt. (Debit)
 * - Deposit Amt. (Credit)
 * - Closing Balance
 */
export const parseHdfcBankRows = (rawRows = []) => {
  const parsedRows = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    // Find keys ignoring case, spaces, and punctuation
    const keys = Object.keys(row);
    const findKey = (patterns) => {
      const exact = keys.find((k) => {
        const clean = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        return patterns.some((p) => clean === p);
      });
      if (exact) return exact;

      return keys.find((k) => {
        const clean = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        return patterns.some((p) => (p.length > 2 ? clean.includes(p) : clean === p));
      });
    };

    const dateKey = findKey(["date", "txndate"]);
    const narrationKey = findKey(["narration", "description", "particulars", "details"]);
    const refKey = findKey(["chqrefno", "chqref", "refno", "reference", "cheque", "ref"]);
    const withdrawalKey = findKey(["withdrawalamt", "withdrawal", "debit", "dr"]);
    const depositKey = findKey(["depositamt", "deposit", "credit", "cr"]);
    const balanceKey = findKey(["closingbalance", "balance"]);

    const rawDate = row[dateKey];
    const rawNarration = row[narrationKey];

    // Skip empty lines, headers repeated in data, or summary rows
    if (!rawDate || !rawNarration) continue;

    const parsedDate = parseBankDate(rawDate);
    if (!parsedDate) continue; // Not a valid date row

    const parseAmount = (val) => {
      if (val === undefined || val === null || val === "") return 0;
      const clean = String(val).replace(/,/g, "").replace(/₹/g, "").replace(/\s+/g, "").trim();
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : Math.abs(num);
    };

    const withdrawal = parseAmount(row[withdrawalKey]);
    const deposit = parseAmount(row[depositKey]);
    const balance = balanceKey ? parseAmount(row[balanceKey]) : null;
    const referenceId = refKey && row[refKey] ? String(row[refKey]).trim() : null;

    if (withdrawal === 0 && deposit === 0) continue;

    let type = "EXPENSE";
    let amount = withdrawal;

    if (deposit > 0 && withdrawal === 0) {
      type = "INCOME";
      amount = deposit;
    }

    const narrationStr = String(rawNarration).trim();

    parsedRows.push({
      date: parsedDate,
      rawDescription: narrationStr,
      cleanDescription: cleanHdfcNarration(narrationStr),
      amount: Math.round(amount * 100) / 100,
      type,
      referenceId: referenceId && referenceId !== "0" && referenceId !== "-" ? referenceId : null,
      balanceAfter: balance
    });
  }

  return parsedRows;
};

/**
 * Cleans HDFC narration (e.g., UPI-SWIGGY-12345678-ORDER -> SWIGGY)
 */
export const cleanHdfcNarration = (narration = "") => {
  let clean = narration.trim();
  // If UPI narration: UPI-NAME-VPA-REMARK
  if (/^UPI/i.test(clean)) {
    const parts = clean.split(/[-/]/);
    if (parts.length >= 2 && parts[1].trim()) {
      return parts[1].trim();
    }
  }
  // POS transactions: POS XXXXXX MERCHANT NAME
  if (/^POS/i.test(clean)) {
    const withoutPrefix = clean.replace(/^POS\s+[0-9X*]+\s+/i, "");
    if (withoutPrefix.trim()) return withoutPrefix.trim();
  }
  return clean;
};
