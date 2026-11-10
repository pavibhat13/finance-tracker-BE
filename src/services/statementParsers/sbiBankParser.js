import { parseBankDate } from "../../utils/dateHelper.js";

/**
 * Parser for State Bank of India (SBI) Account statements (CSV / Excel)
 * Standard columns:
 * - Txn Date
 * - Value Date
 * - Description
 * - Ref No./Cheque No.
 * - Debit
 * - Credit
 * - Balance
 */
export const parseSbiBankRows = (rawRows = []) => {
  const parsedRows = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    const keys = Object.keys(row);
    const findKey = (patterns) => {
      // 1. Try exact equality first
      const exact = keys.find((k) => {
        const clean = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        return patterns.some((p) => clean === p);
      });
      if (exact) return exact;

      // 2. Try prefix/includes for patterns longer than 2 characters
      return keys.find((k) => {
        const clean = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        return patterns.some((p) => (p.length > 2 ? clean.includes(p) : clean === p));
      });
    };

    const dateKey = findKey(["date", "txndate", "transactiondate"]);
    const descriptionKey = findKey(["details", "description", "narration", "particulars", "remarks"]);
    const refKey = findKey(["refnochequeno", "refnocheque", "refno", "chequeno", "ref", "utr"]);
    const debitKey = findKey(["debit", "withdrawal", "dr", "debitamt"]);
    const creditKey = findKey(["credit", "deposit", "cr", "creditamt"]);
    const balanceKey = findKey(["balance", "closingbalance"]);

    const rawDate = row[dateKey];
    const rawDesc = row[descriptionKey];

    if (!rawDate || !rawDesc) continue;

    const parsedDate = parseBankDate(rawDate);
    if (!parsedDate) continue;

    const parseAmount = (val) => {
      if (val === undefined || val === null || val === "") return 0;
      const clean = String(val).replace(/,/g, "").replace(/₹/g, "").replace(/\s+/g, "").trim();
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : Math.abs(num);
    };

    const debit = parseAmount(row[debitKey]);
    const credit = parseAmount(row[creditKey]);
    const balance = balanceKey ? parseAmount(row[balanceKey]) : null;
    const refVal = refKey && row[refKey] ? String(row[refKey]).trim() : null;

    if (debit === 0 && credit === 0) continue;

    let type = "EXPENSE";
    let amount = debit;

    if (credit > 0 && debit === 0) {
      type = "INCOME";
      amount = credit;
    }

    const descStr = String(rawDesc).trim();

    parsedRows.push({
      date: parsedDate,
      rawDescription: descStr,
      cleanDescription: cleanSbiDescription(descStr),
      amount: Math.round(amount * 100) / 100,
      type,
      referenceId: refVal && refVal !== "0" && refVal !== "-" ? refVal : null,
      balanceAfter: balance
    });
  }

  return parsedRows;
};

/**
 * Cleans SBI transaction descriptions:
 * e.g. TRANSFER-TO 50999999999 / SWIGGY / UPI/1234567890/Swiggy
 */
export const cleanSbiDescription = (desc = "") => {
  let clean = desc.trim();
  if (/^TO\s+TRANSFER/i.test(clean) || /^BY\s+TRANSFER/i.test(clean)) {
    const parts = clean.split(/[-/]/);
    if (parts.length >= 2 && parts[parts.length - 1].trim()) {
      return parts[parts.length - 1].trim();
    }
  }
  if (/^UPI/i.test(clean)) {
    const parts = clean.split(/[/]/);
    if (parts.length >= 3 && parts[parts.length - 1].trim()) {
      return parts[parts.length - 1].trim();
    }
  }
  return clean;
};
