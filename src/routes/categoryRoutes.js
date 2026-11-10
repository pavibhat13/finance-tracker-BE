import express from "express";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from "../controllers/categoryController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { createCategorySchema } from "../validators/categoryValidator.js";

const router = express.Router();

router.use(protect);

router.get("/", getCategories);
router.post("/", validate(createCategorySchema), createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;
