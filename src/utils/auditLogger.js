import AuditLog from "../models/AuditLog.js";

/**
 * Creates an audit log entry safely
 */
export const logAudit = async ({ userId, entityType, entityId, action, before = null, after = null, reason = "" }) => {
  try {
    await AuditLog.create({
      userId,
      entityType,
      entityId: String(entityId),
      action,
      before,
      after,
      reason
    });
  } catch (err) {
    console.error("Failed to write audit log:", err.message);
  }
};
