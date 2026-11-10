import express from "express";
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  voidTransaction,
  getTransactionSummary,
  bulkCategorizeTransactions
} from "../controllers/transactionController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
  createTransactionSchema,
  updateTransactionSchema
} from "../validators/transactionValidator.js";

const router = express.Router();

router.use(protect);

router.get("/summary", getTransactionSummary);
router.patch("/bulk-categorize", bulkCategorizeTransactions);
router.get("/", getTransactions);
router.get("/:id", getTransactionById);
router.post("/", validate(createTransactionSchema), createTransaction);
router.put("/:id", validate(updateTransactionSchema), updateTransaction);
router.delete("/:id", voidTransaction);

export default router;
