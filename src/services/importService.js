import fs from "fs";
import ImportBatch from "../models/ImportBatch.js";
import ImportStaging from "../models/ImportStaging.js";
import Transaction from "../models/Transaction.js";
import Account from "../models/Account.js";
import Category from "../models/Category.js";
import { parseStatementFile } from "./statementParsers/index.js";
import { generateFingerprint } from "../utils/fingerprint.js";
import { checkRowDuplicate } from "./duplicateDetectionService.js";
import { categorizeTransaction } from "./categorizationService.js";
import { logAudit } from "../utils/auditLogger.js";
import { getAccountBalanceDelta } from "../utils/accountBalance.js";

/**
 * Uploads, parses, detects duplicates, categorizes, and stages rows
 */
export const processStatementUpload = async ({
  userId,
  accountId,
  filePath,
  fileName,
  requestedFormat = "AUTO",
  password = ""
}) => {
  // Create initial batch
  const batch = await ImportBatch.create({
    userId,
    accountId,
    fileName,
    statementFormat: requestedFormat,
    status: "PARSING"
  });

  try {
    const parseResult = await parseStatementFile(filePath, requestedFormat, password);
    batch.statementFormat = parseResult.format;

    const stagedDocs = [];
    let duplicateCount = 0;
    let acceptedCount = 0;

    for (let i = 0; i < parseResult.rows.length; i++) {
      const row = parseResult.rows[i];
      const rowNumber = i + 1;

      // Generate SHA-256 fingerprint
      const fingerprint = generateFingerprint({
        accountId,
        date: row.date,
        amount: row.amount,
        type: row.type,
        description: row.cleanDescription
      });

      // Run duplicate detection
      const dupCheck = await checkRowDuplicate(userId, {
        accountId,
        date: row.date,
        amount: row.amount,
        referenceId: row.referenceId,
        fingerprint,
        cleanDescription: row.cleanDescription
      });

      if (dupCheck.isDefiniteDuplicate) {
        duplicateCount++;
      } else {
        acceptedCount++;
      }

      // Run auto-categorization
      let catResult = await categorizeTransaction(userId, row.cleanDescription);
      if (
        !catResult.categoryId &&
        row.type === "INCOME" &&
        /\b(refund|reversal|chargeback)\b/i.test(row.cleanDescription)
      ) {
        const refundCategory = await Category.findOneAndUpdate(
          { userId, name: "Online Refund", type: "INCOME" },
          { $setOnInsert: { userId, name: "Online Refund", type: "INCOME", color: "#8b5cf6", icon: "undo-2" } },
          { upsert: true, new: true }
        );
        catResult = { ...catResult, categoryId: refundCategory._id };
      }

      stagedDocs.push({
        batchId: batch._id,
        userId,
        accountId,
        rowNumber,
        date: row.date,
        rawDescription: row.rawDescription,
        cleanDescription: row.cleanDescription,
        amount: row.amount,
        type: row.type,
        referenceId: row.referenceId,
        balanceAfter: row.balanceAfter,
        merchantId: catResult.merchantId,
        categoryId: catResult.categoryId,
        fingerprint,
        duplicateStatus: dupCheck.duplicateStatus,
        duplicateReason: dupCheck.duplicateReason,
        matchedTransactionId: dupCheck.matchedTransactionId,
        included: !dupCheck.isDefiniteDuplicate, // Definite duplicate defaults to excluded
        isManuallyCategorized: false
      });
    }

    if (stagedDocs.length > 0) {
      await ImportStaging.insertMany(stagedDocs);
    }

    batch.totalRows = parseResult.rows.length;
    batch.acceptedRows = acceptedCount;
    batch.duplicateRows = duplicateCount;
    batch.status = "REVIEW";
    await batch.save();

    // Clean up temporary file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return batch;
  } catch (error) {
    batch.status = "FAILED";
    batch.errorMessage = error.message;
    await batch.save();

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw error;
  }
};

/**
 * Get staged rows with populate
 */
export const getStagedRows = async (batchId, userId) => {
  return await ImportStaging.find({ batchId, userId })
    .sort({ rowNumber: 1 })
    .populate("categoryId", "name type color icon")
    .populate("merchantId", "name")
    .populate("matchedTransactionId", "date description amount type");
};

/**
 * Updates a single staged row
 */
export const updateStagedRow = async (batchId, rowId, userId, updateData) => {
  const staged = await ImportStaging.findOne({ _id: rowId, batchId, userId });
  if (!staged) throw new Error("Staged transaction row not found");

  const allowedUpdates = [
    "cleanDescription",
    "amount",
    "type",
    "categoryId",
    "included",
    "notes",
    "isManuallyCategorized"
  ];

  allowedUpdates.forEach((field) => {
    if (updateData[field] !== undefined) {
      staged[field] = updateData[field];
    }
  });

  if (updateData.categoryId) {
    staged.isManuallyCategorized = true;
  }

  // Recalculate fingerprint if key financial fields changed
  if (updateData.amount || updateData.cleanDescription || updateData.type) {
    staged.fingerprint = generateFingerprint({
      accountId: staged.accountId,
      date: staged.date,
      amount: staged.amount,
      type: staged.type,
      description: staged.cleanDescription
    });
  }

  await staged.save();
  return staged;
};

/**
 * Re-runs duplicate detection on all staged rows in a batch
 */
export const recheckBatchDuplicates = async (batchId, userId) => {
  const stagedRows = await ImportStaging.find({ batchId, userId });

  let duplicateCount = 0;
  let acceptedCount = 0;

  for (const row of stagedRows) {
    const dupCheck = await checkRowDuplicate(userId, {
      accountId: row.accountId,
      date: row.date,
      amount: row.amount,
      referenceId: row.referenceId,
      fingerprint: row.fingerprint,
      cleanDescription: row.cleanDescription
    });

    row.duplicateStatus = dupCheck.duplicateStatus;
    row.duplicateReason = dupCheck.duplicateReason;
    row.matchedTransactionId = dupCheck.matchedTransactionId;

    if (dupCheck.isDefiniteDuplicate) {
      row.included = false;
      duplicateCount++;
    } else {
      acceptedCount++;
    }

    await row.save();
  }

  await ImportBatch.findByIdAndUpdate(batchId, {
    duplicateRows: duplicateCount,
    acceptedRows: acceptedCount
  });

  return await getStagedRows(batchId, userId);
};

/**
 * Idempotent batch confirmation
 */
export const confirmBatchImport = async (batchId, userId) => {
  // Atomic check-and-set: status must be "REVIEW"
  const batch = await ImportBatch.findOneAndUpdate(
    { _id: batchId, userId, status: "REVIEW" },
    { status: "CONFIRMED", confirmedAt: new Date() },
    { new: true }
  );

  if (!batch) {
    const existing = await ImportBatch.findOne({ _id: batchId, userId });
    if (!existing) throw new Error("Import batch not found");
    if (existing.status === "CONFIRMED") {
      throw new Error("This batch has already been confirmed. Duplicate confirmation prevented.");
    }
    throw new Error(`Cannot confirm batch with current status: ${existing.status}`);
  }

  const account = await Account.findOne({ _id: batch.accountId, userId });
  if (!account) throw new Error("Target account not found");

  // Find all approved/included rows
  const includedRows = await ImportStaging.find({
    batchId,
    userId,
    included: true
  }).sort({ rowNumber: 1 });

  if (includedRows.length === 0) {
    return {
      message: "No rows were marked as included. Batch completed with 0 transactions.",
      insertedCount: 0
    };
  }

  const transactionsToInsert = [];
  let balanceDelta = 0;
  const latestStatementBalanceRow = includedRows
    .filter((row) => Number.isFinite(row.balanceAfter))
    .sort((a, b) => b.date - a.date || b.rowNumber - a.rowNumber)[0];
  const statementClosingBalance = latestStatementBalanceRow?.balanceAfter ?? null;

  for (const row of includedRows) {
    // Final deduplication guard
    if (row.referenceId) {
      const exists = await Transaction.findOne({
        userId,
        referenceId: row.referenceId,
        status: { $ne: "VOID" }
      });
      if (exists) continue; // Skip to preserve strict duplicate prevention
    }

    transactionsToInsert.push({
      userId,
      accountId: row.accountId,
      date: row.date,
      description: row.cleanDescription,
      merchantId: row.merchantId,
      amount: row.amount,
      type: row.type,
      categoryId: row.categoryId,
      referenceId: row.referenceId,
      fingerprint: row.fingerprint,
      source: "IMPORT",
      status: "ACTIVE",
      notes: row.notes,
      isManuallyCategorized: row.isManuallyCategorized,
      importBatchId: batch._id
    });

    balanceDelta += getAccountBalanceDelta(account.accountType, row.type, row.amount);
  }

  let insertedDocs = [];
  if (transactionsToInsert.length > 0) {
    insertedDocs = await Transaction.insertMany(transactionsToInsert);
  }

  // A statement's final running balance is authoritative. Fall back to the
  // transaction delta for formats that do not provide a balance column.
  if (statementClosingBalance !== null) {
    // Retain manual/recurring activity entered after the statement end date.
    // Those transactions are not part of the downloaded statement, but they
    // still need to be reflected in the live account balance.
    const laterManualTransactions = await Transaction.find({
      userId,
      accountId: batch.accountId,
      status: { $ne: "VOID" },
      source: { $in: ["MANUAL", "RECURRING"] },
      date: { $gt: latestStatementBalanceRow.date }
    }).select("type amount description");

    const manualBalanceDelta = laterManualTransactions.reduce((total, transaction) => {
      return total + getAccountBalanceDelta(account.accountType, transaction.type, transaction.amount);
    }, 0);

    await Account.findByIdAndUpdate(batch.accountId, {
      $set: {
        currentBalance: Math.round((statementClosingBalance + manualBalanceDelta) * 100) / 100,
        lastStatementBalance: statementClosingBalance,
        lastStatementBalanceDate: latestStatementBalanceRow.date
      }
    });
  } else if (transactionsToInsert.length > 0) {
    await Account.findByIdAndUpdate(batch.accountId, {
      $inc: { currentBalance: balanceDelta }
    });
  }

  await logAudit({
    userId,
    entityType: "IMPORT_BATCH",
    entityId: batch._id,
    action: "CONFIRM_IMPORT",
    after: {
      totalRows: batch.totalRows,
      insertedCount: insertedDocs.length,
      balanceDelta,
      statementClosingBalance
    },
    reason: `Confirmed bank statement import: ${batch.fileName}`
  });

  return {
    success: true,
    message: `Successfully imported ${insertedDocs.length} transactions.`,
    insertedCount: insertedDocs.length,
    batch
  };
};

/**
 * Cancels an import batch
 */
export const cancelBatch = async (batchId, userId) => {
  const batch = await ImportBatch.findOne({ _id: batchId, userId });
  if (!batch) throw new Error("Import batch not found");

  if (batch.status === "CONFIRMED") {
    throw new Error("Cannot cancel a batch that has already been confirmed.");
  }

  batch.status = "CANCELLED";
  await batch.save();

  // Delete staged rows to clean up
  await ImportStaging.deleteMany({ batchId, userId });

  return {
    success: true,
    message: "Import batch cancelled and staged records cleared."
  };
};
