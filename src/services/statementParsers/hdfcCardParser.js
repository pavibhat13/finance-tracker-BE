import { parseBankDate } from "../../utils/dateHelper.js";

/**
 * Parser for HDFC Credit Card statements (CSV / Excel)
 * Standard columns:
 * - Date
 * - Transaction Description / Details
 * - Amount (often formatted with 'Dr' or 'Cr', or separate Debit/Credit columns)
 */
export const parseHdfcCardRows = (rawRows = []) => {
  const parsedRows = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

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

    const dateKey = findKey(["date", "datetime", "txndate", "transactiondate"]);
    const descKey = findKey(["transactiondescription", "details", "description", "particulars", "merchant"]);
    const amountKey = findKey(["amount", "amt", "transamount"]);
    const debitKey = findKey(["purchasesdebits", "purchases", "debits", "debit", "withdrawal"]);
    const creditKey = findKey(["paymentcredit", "paymentscredits", "payment", "credit"]);
    const financeKey = findKey(["financecharges", "financecharge"]);
    const drcrKey = findKey(["drcr", "debitcredit", "indicator"]);

    const rawDate = row[dateKey];
    const rawDesc = row[descKey];

    // Skip summary block rows such as "Opening Bal", "Total Dues"
    if (!rawDate && !rawDesc) continue;
    const strDesc = String(rawDesc || "").toLowerCase();
    if (strDesc.includes("opening bal") || strDesc.includes("total dues")) continue;

    const parsedDate = parseBankDate(rawDate);
    if (!parsedDate) continue;

    const descStr = String(rawDesc || "Card Transaction").trim();

    // Check if separate debit and credit columns exist
    let type = "EXPENSE";
    let amount = 0;

    const parseNum = (val) => {
      if (val === undefined || val === null || val === "") return 0;
      const clean = String(val).replace(/,/g, "").replace(/₹/g, "").replace(/\s+/g, "").trim();
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : Math.abs(num);
    };

    if ((debitKey || creditKey) && debitKey !== creditKey) {
      const debit = parseNum(row[debitKey]);
      const credit = parseNum(row[creditKey]);

      if (debit > 0) {
        type = "EXPENSE";
        amount = debit;
      } else if (credit > 0) {
        amount = credit;
        type = "INCOME";
      }
    } else if (amountKey) {
      const rawAmtStr = String(row[amountKey]).trim();
      const isCr =
        /cr$/i.test(rawAmtStr) ||
        (drcrKey && /^(cr|credit)/i.test(String(row[drcrKey]).trim())) ||
        rawAmtStr.startsWith("-");

      amount = parseNum(rawAmtStr);

      if (isCr) {
        type = "INCOME";
      } else {
        type = "EXPENSE";
      }
    }

    if (amount === 0) continue;

    // Detect reference number if embedded in description or column
    const refKey = findKey(["ref", "reference", "authcode", "auth"]);
    let referenceId = refKey && row[refKey] ? String(row[refKey]).trim() : null;

    if (!referenceId) {
      const authMatch = descStr.match(/AUTH[:\s]+([A-Z0-9]+)/i);
      if (authMatch) referenceId = authMatch[1];
    }

    parsedRows.push({
      date: parsedDate,
      rawDescription: descStr,
      cleanDescription: cleanHdfcCardDescription(descStr),
      amount: Math.round(amount * 100) / 100,
      type,
      referenceId: referenceId && referenceId !== "-" ? referenceId : null,
      balanceAfter: null
    });
  }

  return parsedRows;
};

const isRefundDescription = (desc = "") => {
  const upper = desc.toUpperCase();
  return (
    upper.includes("REFUND") ||
    upper.includes("REVERSAL") ||
    upper.includes("CHARGEBACK") ||
    upper.includes("RTN")
  );
};

export const cleanHdfcCardDescription = (desc = "") => {
  let clean = desc.trim();
  // Strip trailing city / country e.g. "UBER INDIA BANGALORE IN" -> "UBER INDIA"
  clean = clean.replace(/\s+(IN|IND|MUMBAI|BANGALORE|NEW DELHI|HYDERABAD|CHENNAI|PUNE|GURGAON|NOIDA)\b.*$/i, "");
  // Strip common prefixes
  clean = clean.replace(/^(POS|E-COMMERCE|PAYMENT\s+RECEIVED|AUTOPAY\s+DEBIT)\s+/i, "");
  return clean.trim() || desc.trim();
};
