import express from "express";
import {
  getStatus,
  handleCloseMonth,
  handleReopenMonth
} from "../controllers/monthlyCloseController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/status", getStatus);
router.post("/close", handleCloseMonth);
router.post("/reopen", handleReopenMonth);

export default router;
