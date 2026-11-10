import {
  exportDataJson,
  exportTransactionsCsv,
  restoreDataJson
} from "../services/backupService.js";

export const exportJson = async (req, res, next) => {
  try {
    const data = await exportDataJson(req.user._id);
    const dateStr = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Disposition", `attachment; filename=finance-backup-${dateStr}.json`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(data, null, 2));
  } catch (error) {
    next(error);
  }
};

export const exportCsv = async (req, res, next) => {
  try {
    const csv = await exportTransactionsCsv(req.user._id);
    const dateStr = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Disposition", `attachment; filename=transactions-${dateStr}.csv`);
    res.setHeader("Content-Type", "text/csv");
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

export const restoreJson = async (req, res, next) => {
  try {
    const result = await restoreDataJson(req.user._id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
