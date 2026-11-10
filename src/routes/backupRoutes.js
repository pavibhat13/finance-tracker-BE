import express from "express";
import {
  exportJson,
  exportCsv,
  restoreJson
} from "../controllers/backupController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/export-json", exportJson);
router.get("/export-csv", exportCsv);
router.post("/restore", restoreJson);

export default router;
