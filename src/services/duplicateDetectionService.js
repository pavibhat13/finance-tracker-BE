import Transaction from "../models/Transaction.js";
import { normalizeDescription } from "../utils/fingerprint.js";

/**
 * Checks a row against existing transactions to detect duplicates
 */
export const checkRowDuplicate = async (userId, rowData) => {
  const { accountId, date, amount, referenceId, fingerprint, cleanDescription } = rowData;

  // Level 1: Exact reference match
  if (referenceId) {
    const existingByRef = await Transaction.findOne({
      userId,
      referenceId,
      status: { $ne: "VOID" }
    });

    if (existingByRef) {
      return {
        duplicateStatus: "EXACT_REFERENCE",
        duplicateReason: `Matched bank reference ID: ${referenceId}`,
        matchedTransactionId: existingByRef._id,
        isDuplicate: true,
        isDefiniteDuplicate: true
      };
    }
  }

  // Level 2: Exact fingerprint match
  if (fingerprint) {
    const existingByFp = await Transaction.findOne({
      userId,
      fingerprint,
      status: { $ne: "VOID" }
    });

    if (existingByFp) {
      return {
        duplicateStatus: "EXACT_FINGERPRINT",
        duplicateReason: "Identical transaction fingerprint (same date, amount, description and account)",
        matchedTransactionId: existingByFp._id,
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
  const manualTransfer = await Transaction.findOne({
    userId,
    accountId,
    amount,
    transferGroupId: { $ne: null },
    source: "MANUAL",
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $ne: "VOID" }
  });

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

  const existingRecurring = await Transaction.findOne({
    userId,
    accountId,
    amount,
    source: "RECURRING",
    date: { $gte: recStartDate, $lte: recEndDate },
    status: { $ne: "VOID" }
  });

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

  const possibleMatches = await Transaction.find({
    userId,
    accountId,
    amount,
    date: { $gte: startDate, $lte: endDate },
    status: { $ne: "VOID" }
  });

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
