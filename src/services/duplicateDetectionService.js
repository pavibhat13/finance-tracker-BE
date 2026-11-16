import Transaction from "../models/Transaction.js";
import { normalizeDescription } from "../utils/fingerprint.js";

/**
 * Loads duplicate detection context once in bulk for fast in-memory matching
 */
export const buildDuplicateDetectionContext = async (userId, accountId, rows) => {
  if (!rows || rows.length === 0) return null;

  let minTime = Infinity;
  let maxTime = -Infinity;
  const references = [];

  for (const r of rows) {
    const t = new Date(r.date).getTime();
    if (!isNaN(t)) {
      if (t < minTime) minTime = t;
      if (t > maxTime) maxTime = t;
    }
    if (r.referenceId) references.push(r.referenceId);
  }

  // Cover +/- 5 days around the min/max dates
  const startDate = new Date(minTime - 5 * 24 * 60 * 60 * 1000);
  const endDate = new Date(maxTime + 5 * 24 * 60 * 60 * 1000);

  const [existingByDate, existingByRefs] = await Promise.all([
    Transaction.find({
      userId,
      accountId,
      date: { $gte: startDate, $lte: endDate },
      status: { $ne: "VOID" }
    }).select("_id date amount type description fingerprint referenceId source transferGroupId"),
    references.length > 0
      ? Transaction.find({
          userId,
          referenceId: { $in: references },
          status: { $ne: "VOID" }
        }).select("_id referenceId")
      : []
  ]);

  const refMap = new Map();
  for (const t of existingByRefs) {
    if (t.referenceId) refMap.set(t.referenceId, t._id);
  }
  for (const t of existingByDate) {
    if (t.referenceId && !refMap.has(t.referenceId)) refMap.set(t.referenceId, t._id);
  }

  const fpMap = new Map();
  for (const t of existingByDate) {
    if (t.fingerprint) fpMap.set(t.fingerprint, t._id);
  }

  return {
    refMap,
    fpMap,
    existingByDate
  };
};

/**
 * Checks a row against existing transactions to detect duplicates
 */
export const checkRowDuplicate = async (userId, rowData, context = null) => {
  const { accountId, date, amount, referenceId, fingerprint, cleanDescription } = rowData;

  // Level 1: Exact reference match
  if (referenceId) {
    const existingRefId = context
      ? context.refMap.get(referenceId)
      : (await Transaction.findOne({ userId, referenceId, status: { $ne: "VOID" } }))?._id;

    if (existingRefId) {
      return {
        duplicateStatus: "EXACT_REFERENCE",
        duplicateReason: `Matched bank reference ID: ${referenceId}`,
        matchedTransactionId: existingRefId,
        isDuplicate: true,
        isDefiniteDuplicate: true
      };
    }
  }

  // Level 2: Exact fingerprint match
  if (fingerprint) {
    const existingFpId = context
      ? context.fpMap.get(fingerprint)
      : (await Transaction.findOne({ userId, fingerprint, status: { $ne: "VOID" } }))?._id;

    if (existingFpId) {
      return {
        duplicateStatus: "EXACT_FINGERPRINT",
        duplicateReason: "Identical transaction fingerprint (same date, amount, description and account)",
        matchedTransactionId: existingFpId,
        isDuplicate: true,
        isDefiniteDuplicate: true
      };
    }
  }

  // A self-transfer is recorded immediately in both accounts. When either
  // bank statement later arrives, skip the matching bank line so the manual
  // transfer is not represented twice in that account's ledger.
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  let manualTransfer = null;
  if (context) {
    const sTime = startOfDay.getTime();
    const eTime = endOfDay.getTime();
    manualTransfer = context.existingByDate.find(
      (t) =>
        t.amount === amount &&
        t.transferGroupId &&
        t.source === "MANUAL" &&
        new Date(t.date).getTime() >= sTime &&
        new Date(t.date).getTime() <= eTime
    );
  } else {
    manualTransfer = await Transaction.findOne({
      userId,
      accountId,
      amount,
      transferGroupId: { $ne: null },
      source: "MANUAL",
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: "VOID" }
    });
  }

  if (manualTransfer) {
    return {
      duplicateStatus: "EXACT_FINGERPRINT",
      duplicateReason: "Matches a manually recorded self-transfer on the same date and amount",
      matchedTransactionId: manualTransfer._id,
      isDuplicate: true,
      isDefiniteDuplicate: true
    };
  }

  // Check if matches a previously recorded recurring transaction
  const recStartDate = new Date(targetDate);
  recStartDate.setDate(recStartDate.getDate() - 3);
  const recEndDate = new Date(targetDate);
  recEndDate.setDate(recEndDate.getDate() + 3);

  let existingRecurring = null;
  if (context) {
    const rsTime = recStartDate.getTime();
    const reTime = recEndDate.getTime();
    existingRecurring = context.existingByDate.find(
      (t) =>
        t.amount === amount &&
        t.source === "RECURRING" &&
        new Date(t.date).getTime() >= rsTime &&
        new Date(t.date).getTime() <= reTime
    );
  } else {
    existingRecurring = await Transaction.findOne({
      userId,
      accountId,
      amount,
      source: "RECURRING",
      date: { $gte: recStartDate, $lte: recEndDate },
      status: { $ne: "VOID" }
    });
  }

  if (existingRecurring) {
    const formattedDate = new Date(existingRecurring.date).toISOString().split("T")[0];
    return {
      duplicateStatus: "EXACT_FINGERPRINT",
      duplicateReason: `Matches recurring bill '${existingRecurring.description}' recorded on ${formattedDate}`,
      matchedTransactionId: existingRecurring._id,
      isDuplicate: true,
      isDefiniteDuplicate: true
    };
  }

  // Level 3: Possible duplicate (Same account, exact same amount, within +/- 2 days)
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - 2);
  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + 2);

  let possibleMatches = [];
  if (context) {
    const stTime = startDate.getTime();
    const etTime = endDate.getTime();
    possibleMatches = context.existingByDate.filter(
      (t) =>
        t.amount === amount &&
        new Date(t.date).getTime() >= stTime &&
        new Date(t.date).getTime() <= etTime
    );
  } else {
    possibleMatches = await Transaction.find({
      userId,
      accountId,
      amount,
      date: { $gte: startDate, $lte: endDate },
      status: { $ne: "VOID" }
    });
  }

  if (possibleMatches.length > 0) {
    // Check if description is similar
    const norm = normalizeDescription(cleanDescription);
    const similarMatch = possibleMatches.find((pm) => {
      const pmNorm = normalizeDescription(pm.description);
      return (
        norm.includes(pmNorm) ||
        pmNorm.includes(norm) ||
        Math.abs(new Date(pm.date).getTime() - targetDate.getTime()) < 24 * 60 * 60 * 1000
      );
    });

    if (similarMatch) {
      return {
        duplicateStatus: "POSSIBLE_DUPLICATE",
        duplicateReason: `Similar transaction of ₹${amount} exists around ${new Date(similarMatch.date).toISOString().split("T")[0]}`,
        matchedTransactionId: similarMatch._id,
        isDuplicate: true,
        isDefiniteDuplicate: false // Staged row still included, user can uncheck if desired
      };
    }
  }

  return {
    duplicateStatus: "NONE",
    duplicateReason: "",
    matchedTransactionId: null,
    isDuplicate: false,
    isDefiniteDuplicate: false
  };
};
