import express from "express";
import {
  uploadStatement,
  getImportBatches,
  getBatchById,
  getStagedTransactions,
  editStagedTransaction,
  recheckDuplicates,
  confirmImport,
  cancelImport
} from "../controllers/importController.js";
import { protect } from "../middleware/authMiddleware.js";
import { uploadStatement as uploadMulter } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/upload", uploadMulter.single("file"), uploadStatement);
router.get("/", getImportBatches);
router.get("/:id", getBatchById);
router.get("/:id/staging", getStagedTransactions);
router.patch("/:id/staging/:rowId", editStagedTransaction);
router.post("/:id/recheck", recheckDuplicates);
router.post("/:id/confirm", confirmImport);
router.post("/:id/cancel", cancelImport);

export default router;
