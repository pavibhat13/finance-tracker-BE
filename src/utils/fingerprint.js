import crypto from "crypto";

/**
 * Normalizes description for duplicate detection and rule matching
 */
export const normalizeDescription = (desc = "") => {
  return String(desc)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Generates Level-2 SHA-256 fingerprint
 * Based on: AccountId + YYYY-MM-DD + Amount + Type + Normalized Description
 */
export const generateFingerprint = ({ accountId, date, amount, type, description }) => {
  const d = new Date(date);
  const dateStr = !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : String(date);
  const normalizedDesc = normalizeDescription(description);
  const normalizedAmt = Number(amount).toFixed(2);
  const normalizedType = String(type).toUpperCase();
  const accId = String(accountId);

  const rawString = `${accId}|${dateStr}|${normalizedAmt}|${normalizedType}|${normalizedDesc}`;
  return crypto.createHash("sha256").update(rawString).digest("hex");
};
