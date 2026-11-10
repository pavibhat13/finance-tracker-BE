import express from "express";
import {
  createTransfer,
  linkTransactionsAsTransfer
} from "../controllers/transferController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createTransfer);
router.post("/link", linkTransactionsAsTransfer);

export default router;
