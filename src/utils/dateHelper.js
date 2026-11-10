const MONTH_NAMES = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
};

/**
 * Parses bank statement date into a valid JavaScript Date object
 * Supports:
 * - Excel serial number (e.g. 45234)
 * - DD/MM/YYYY or DD-MM-YYYY
 * - DD/MM/YY or DD-MM-YY
 * - DD-MMM-YYYY or DD/MMM/YYYY (e.g., 14-Nov-2026)
 * - YYYY-MM-DD (ISO)
 */
export const parseBankDate = (val) => {
  if (!val) return null;

  // Handle Excel serial date numbers
  if (typeof val === "number") {
    // Excel epoch starts at 1899-12-30 due to the 1900 leap year bug
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? null : date;
  }

  const str = String(val).trim();
  if (!str) return null;

  // Check if already an ISO date: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  // Check DD-MMM-YYYY or DD/MMM/YYYY, e.g. 15-Nov-2026 or 15-NOV-26
  const ddMmmYyyyMatch = str.match(/^(\d{1,2})[-/]([a-zA-Z]{3})[-/](\d{2,4})$/);
  if (ddMmmYyyyMatch) {
    const day = ddMmmYyyyMatch[1].padStart(2, "0");
    const monStr = ddMmmYyyyMatch[2].toLowerCase();
    const month = MONTH_NAMES[monStr] || "01";
    let year = ddMmmYyyyMatch[3];
    if (year.length === 2) {
      year = "20" + year;
    }
    const d = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const partsMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (partsMatch) {
    const day = partsMatch[1].padStart(2, "0");
    const month = partsMatch[2].padStart(2, "0");
    let year = partsMatch[3];
    if (year.length === 2) {
      year = "20" + year;
    }
    const d = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
};

/**
 * Formats a Date object to YYYY-MM-DD
 */
export const formatDateISO = (d) => {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};
