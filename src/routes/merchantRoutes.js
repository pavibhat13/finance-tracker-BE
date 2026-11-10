import express from "express";
import {
  getMerchants,
  createMerchant,
  updateMerchant,
  deleteMerchant
} from "../controllers/merchantController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getMerchants);
router.post("/", createMerchant);
router.put("/:id", updateMerchant);
router.delete("/:id", deleteMerchant);

export default router;
