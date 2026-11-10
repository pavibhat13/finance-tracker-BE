import { parseBankDate } from "../../utils/dateHelper.js";

/**
 * Fallback generic statement parser for arbitrary CSV/Excel bank sheets
 */
export const parseGenericRows = (rawRows = []) => {
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

    const dateKey = findKey(["date", "datetime", "time", "posted", "value", "txndate"]);
    const descKey = findKey(["description", "desc", "narration", "particular", "merchant", "details", "memo", "payee", "note"]);
    const debitKey = findKey(["debit", "withdrawal", "spent", "dr", "expense"]);
    const creditKey = findKey(["credit", "deposit", "received", "cr", "income"]);
    const amountKey = findKey(["amount", "amt", "total", "net"]);
    const typeKey = findKey(["type", "drcr"]);
    const refKey = findKey(["ref", "cheque", "chq", "utr", "txn", "transactionid", "id"]);
    const balanceKey = findKey(["balance", "closing", "closingbalance"]);

    const rawDate = row[dateKey];
    const rawDesc = row[descKey];

    if (!rawDate || !rawDesc) continue;

    const parsedDate = parseBankDate(rawDate);
    if (!parsedDate) continue;

    const parseNum = (val) => {
      if (val === undefined || val === null || val === "") return 0;
      const clean = String(val).replace(/,/g, "").replace(/₹|\$|€|£/g, "").replace(/\s+/g, "").trim();
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : Math.abs(num);
    };

    let amount = 0;
    let type = "EXPENSE";

    if (debitKey || creditKey) {
      const debit = parseNum(row[debitKey]);
      const credit = parseNum(row[creditKey]);

      if (debit > 0) {
        amount = debit;
        type = "EXPENSE";
      } else if (credit > 0) {
        amount = credit;
        type = "INCOME";
      }
    } else if (amountKey) {
      const rawAmt = String(row[amountKey]);
      const isNegative = rawAmt.startsWith("-");
      const isCredit =
        /cr$/i.test(rawAmt) ||
        (typeKey && /credit|income|cr/i.test(String(row[typeKey])));

      amount = parseNum(rawAmt);
      type = (isCredit || isNegative) ? "INCOME" : "EXPENSE";
    }

    if (amount === 0) continue;

    const refVal = refKey && row[refKey] ? String(row[refKey]).trim() : null;
    const balance = balanceKey ? parseNum(row[balanceKey]) : null;
    const descStr = String(rawDesc).trim();

    parsedRows.push({
      date: parsedDate,
      rawDescription: descStr,
      cleanDescription: descStr,
      amount: Math.round(amount * 100) / 100,
      type,
      referenceId: refVal && refVal !== "0" && refVal !== "-" ? refVal : null,
      balanceAfter: balance
    });
  }

  return parsedRows;
};
