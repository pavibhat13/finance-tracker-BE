import ImportBatch from "../models/ImportBatch.js";
import {
  processStatementUpload,
  getStagedRows,
  updateStagedRow,
  recheckBatchDuplicates,
  confirmBatchImport,
  cancelBatch
} from "../services/importService.js";

export const uploadStatement = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const { accountId, statementFormat, statementPassword } = req.body;
    if (!accountId) {
      return res.status(400).json({ success: false, message: "Please select an account for this statement." });
    }

    const batch = await processStatementUpload({
      userId: req.user._id,
      accountId,
      filePath: req.file.path,
      fileName: req.file.originalname,
      requestedFormat: statementFormat || "AUTO",
      password: statementPassword || ""
    });

    res.status(201).json({
      success: true,
      message: `Parsed ${batch.totalRows} statement records. Ready for review.`,
      batch
    });
  } catch (error) {
    next(error);
  }
};

export const getImportBatches = async (req, res, next) => {
  try {
    const batches = await ImportBatch.find({ userId: req.user._id })
      .populate("accountId", "name accountType")
      .sort({ createdAt: -1 });

    res.json({ success: true, batches });
  } catch (error) {
    next(error);
  }
};

export const getBatchById = async (req, res, next) => {
  try {
    const batch = await ImportBatch.findOne({ _id: req.params.id, userId: req.user._id })
      .populate("accountId", "name accountType");

    if (!batch) return res.status(404).json({ success: false, message: "Import batch not found" });

    res.json({ success: true, batch });
  } catch (error) {
    next(error);
  }
};

export const getStagedTransactions = async (req, res, next) => {
  try {
    const rows = await getStagedRows(req.params.id, req.user._id);
    res.json({ success: true, rows });
  } catch (error) {
    next(error);
  }
};

export const editStagedTransaction = async (req, res, next) => {
  try {
    const updated = await updateStagedRow(
      req.params.id,
      req.params.rowId,
      req.user._id,
      req.body
    );
    res.json({ success: true, row: updated });
  } catch (error) {
    next(error);
  }
};

export const recheckDuplicates = async (req, res, next) => {
  try {
    const rows = await recheckBatchDuplicates(req.params.id, req.user._id);
    res.json({ success: true, message: "Rechecked duplicates successfully", rows });
  } catch (error) {
    next(error);
  }
};

export const confirmImport = async (req, res, next) => {
  try {
    const result = await confirmBatchImport(req.params.id, req.user._id);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const cancelImport = async (req, res, next) => {
  try {
    const result = await cancelBatch(req.params.id, req.user._id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
