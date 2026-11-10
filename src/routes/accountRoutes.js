import express from "express";
import {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount
} from "../controllers/accountController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { createAccountSchema } from "../validators/accountValidator.js";

const router = express.Router();

router.use(protect);

router.get("/", getAccounts);
router.get("/:id", getAccountById);
router.post("/", validate(createAccountSchema), createAccount);
router.put("/:id", updateAccount);
router.delete("/:id", deleteAccount);

export default router;
