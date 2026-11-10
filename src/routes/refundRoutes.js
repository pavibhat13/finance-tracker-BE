import express from "express";
import { linkRefund, unlinkRefundTransaction } from "../controllers/refundController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/link", linkRefund);
router.post("/unlink", unlinkRefundTransaction);

export default router;
