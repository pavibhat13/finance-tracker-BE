import express from "express";
import {
  getRecurring,
  getDueRecurring,
  executeRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring
} from "../controllers/recurringController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getRecurring);
router.get("/due", getDueRecurring);
router.post("/", createRecurring);
router.post("/:id/execute", executeRecurring);
router.put("/:id", updateRecurring);
router.delete("/:id", deleteRecurring);

export default router;
