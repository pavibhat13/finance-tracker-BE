import fs from "fs";
import path from "path";
import csvParser from "csv-parser";
import officeCrypto from "officecrypto-tool";
// SheetJS is a CommonJS package. In this ESM server, its API is exposed through
// the default export rather than the module namespace.
import XLSX from "xlsx";
const xlsxLib = XLSX.default || XLSX;
import { parseHdfcBankRows } from "./hdfcBankParser.js";
import { parseSbiBankRows } from "./sbiBankParser.js";
import { parseHdfcCardRows } from "./hdfcCardParser.js";
import { parseGenericRows } from "./genericParser.js";

/**
 * Reads file rows into JavaScript objects
 */
export const readFileRows = async (filePath, password = "") => {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".csv") {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on("data", (data) => results.push(data))
        .on("end", () => resolve(results))
        .on("error", (err) => reject(err));
    });
  } else if (ext === ".xls" || ext === ".xlsx") {
    const fileBuffer = fs.readFileSync(filePath);
    let workbook;

    if (officeCrypto.isEncrypted(fileBuffer)) {
      if (!password) {
        throw new Error("This statement is password-protected. Enter its password and upload it again.");
      }

      try {
        const decryptedBuffer = await officeCrypto.decrypt(fileBuffer, { password });
        workbook = xlsxLib.read(decryptedBuffer, { type: "buffer" });
      } catch {
        throw new Error("Unable to unlock the statement. Check the password and try again.");
      }
    } else {
      workbook = xlsxLib.read(fileBuffer, { type: "buffer" });
    }
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Statements exported by banks often start with account/report details, not
    // the column headers. Read the whole sheet first so we can find the actual
    // transaction table instead of always treating row 1 as its header.
    const grid = xlsxLib.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false
    });
    const headerIndex = findStatementHeaderRow(grid);

    if (headerIndex === -1) {
      // Preserve the normal SheetJS behaviour for simple spreadsheets whose
      // headers do not resemble a bank statement.
      return xlsxLib.utils.sheet_to_json(worksheet, { defval: "" });
    }

    const headers = grid[headerIndex].map((header, index) => {
      const value = String(header || "").trim();
      return value || `Column ${index + 1}`;
    });

    return grid
      .slice(headerIndex + 1)
      .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
      .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
  } else {
    throw new Error(`Unsupported file extension: ${ext}`);
  }
};

const findStatementHeaderRow = (grid) => {
  const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  return grid.findIndex((row) => {
    const fields = row.map(normalize).filter(Boolean);
    const hasDate = fields.some((field) =>
      ["date", "datetime", "txndate", "transactiondate", "valuedt", "valuedate", "posteddate"].includes(field)
    );
    const hasDescription = fields.some((field) =>
      ["narration", "description", "details", "particulars", "merchant", "payee"].some((term) => field.includes(term))
    );
    const hasAmount = fields.some((field) =>
      ["withdrawal", "deposit", "debit", "credit", "amount", "amt", "dr", "cr"].some((term) => field.includes(term))
    );
    return hasDate && hasDescription && hasAmount;
  });
};

/**
 * Automatically inspects headers to detect statement format
 */
export const autoDetectFormat = (rows = []) => {
  if (!rows || rows.length === 0) return "GENERIC";

  const firstRow = rows[0];
  const keysStr = Object.keys(firstRow).join(" ").toLowerCase();

  // HDFC Bank: Date Narration Chq./Ref.No. Value Dt Withdrawal Amt. Deposit Amt. Closing Balance
  if (keysStr.includes("narration") && (keysStr.includes("chq") || keysStr.includes("withdrawal") || keysStr.includes("deposit"))) {
    return "HDFC_BANK";
  }

  // SBI Bank: Date Details Ref No/Cheque No Debit Credit Balance
  if (
    (keysStr.includes("details") && (keysStr.includes("ref no") || keysStr.includes("cheque") || keysStr.includes("debit"))) ||
    keysStr.includes("txndate")
  ) {
    return "SBI_BANK";
  }

  // HDFC Credit Card: Purchases / Debits, Payment / Credit, Finance Charges, Total Dues, Transaction Description
  if (
    keysStr.includes("purchases") ||
    keysStr.includes("payment / credit") ||
    keysStr.includes("finance charges") ||
    keysStr.includes("transaction description") ||
    keysStr.includes("total dues") ||
    keysStr.includes("reward") ||
    keysStr.includes("drcr") ||
    (keysStr.includes("date") && keysStr.includes("description") && (keysStr.includes("amt") || keysStr.includes("rewards")))
  ) {
    return "HDFC_CREDIT_CARD";
  }

  return "GENERIC";
};

/**
 * Parses statement file and returns normalized rows
 */
export const parseStatementFile = async (filePath, requestedFormat = "AUTO", password = "") => {
  const rawRows = await readFileRows(filePath, password);

  let format = requestedFormat;
  if (!format || format === "AUTO") {
    format = autoDetectFormat(rawRows);
  }

  let normalizedRows = [];

  switch (format) {
    case "HDFC_BANK":
      normalizedRows = parseHdfcBankRows(rawRows);
      break;
    case "SBI_BANK":
      normalizedRows = parseSbiBankRows(rawRows);
      break;
    case "HDFC_CREDIT_CARD":
      normalizedRows = parseHdfcCardRows(rawRows);
      break;
    case "GENERIC":
    default:
      normalizedRows = parseGenericRows(rawRows);
      break;
  }

  // If specific parser returned 0 rows, fallback to generic
  if (normalizedRows.length === 0 && rawRows.length > 0) {
    normalizedRows = parseGenericRows(rawRows);
  }

  return {
    format,
    totalRawRows: rawRows.length,
    rows: normalizedRows
  };
};
