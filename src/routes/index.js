import express from "express";
import authRoutes from "./authRoutes.js";
import accountRoutes from "./accountRoutes.js";
import categoryRoutes from "./categoryRoutes.js";
import merchantRoutes from "./merchantRoutes.js";
import ruleRoutes from "./ruleRoutes.js";
import transactionRoutes from "./transactionRoutes.js";
import importRoutes from "./importRoutes.js";
import budgetRoutes from "./budgetRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import recurringRoutes from "./recurringRoutes.js";
import transferRoutes from "./transferRoutes.js";
import refundRoutes from "./refundRoutes.js";
import monthlyCloseRoutes from "./monthlyCloseRoutes.js";
import backupRoutes from "./backupRoutes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/accounts", accountRoutes);
router.use("/categories", categoryRoutes);
router.use("/merchants", merchantRoutes);
router.use("/rules", ruleRoutes);
router.use("/transactions", transactionRoutes);
router.use("/imports", importRoutes);
router.use("/budgets", budgetRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/analytics", dashboardRoutes);
router.use("/recurring", recurringRoutes);
router.use("/transfers", transferRoutes);
router.use("/refunds", refundRoutes);
router.use("/monthly-closes", monthlyCloseRoutes);
router.use("/backups", backupRoutes);

export default router;
