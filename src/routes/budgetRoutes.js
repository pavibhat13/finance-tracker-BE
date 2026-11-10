import express from "express";
import {
  getBudgets,
  createOrUpdateBudget,
  updateBudget,
  deleteBudget
} from "../controllers/budgetController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { upsertBudgetSchema } from "../validators/budgetValidator.js";

const router = express.Router();

router.use(protect);

router.get("/", getBudgets);
router.post("/", validate(upsertBudgetSchema), createOrUpdateBudget);
router.put("/:id", updateBudget);
router.delete("/:id", deleteBudget);

export default router;
