import express from "express";
import {
  register,
  login,
  logout,
  getMe,
  checkRegistrationStatus,
  changePassword
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { registerSchema, loginSchema, changePasswordSchema } from "../validators/authValidator.js";

const router = express.Router();

router.get("/status", checkRegistrationStatus);
router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/logout", logout);
router.get("/me", protect, getMe);
router.put("/change-password", protect, validate(changePasswordSchema), changePassword);

export default router;
