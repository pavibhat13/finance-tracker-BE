import express from "express";
import {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  learnRuleFromCorrection
} from "../controllers/ruleController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getRules);
router.post("/", createRule);
router.post("/learn", learnRuleFromCorrection);
router.put("/:id", updateRule);
router.delete("/:id", deleteRule);

export default router;
