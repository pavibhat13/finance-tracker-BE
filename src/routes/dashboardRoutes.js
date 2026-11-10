import express from "express";
import {
  getSummary,
  getMonthlyTrendsData,
  getCategoryBreakdownData,
  getMonthComparisonData
} from "../controllers/dashboardController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/summary", getSummary);
router.get("/monthly-trends", getMonthlyTrendsData);
router.get("/category-breakdown", getCategoryBreakdownData);
router.get("/month-comparison", getMonthComparisonData);

export default router;
