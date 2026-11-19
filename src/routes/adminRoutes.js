import express from "express";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import {
  getAllUsers,
  inviteUser,
  updateUserRole,
  updateUserStatus,
  deleteAllowedUser
} from "../controllers/adminController.js";

const router = express.Router();

router.use(protect, adminOnly);

router.get("/users", getAllUsers);
router.post("/users/invite", inviteUser);
router.put("/users/:id/role", updateUserRole);
router.put("/users/:id/status", updateUserStatus);
router.delete("/users/:id", deleteAllowedUser);

export default router;
