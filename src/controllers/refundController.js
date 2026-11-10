import { linkRefundToPurchase, unlinkRefund } from "../services/refundService.js";

export const linkRefund = async (req, res, next) => {
  try {
    const { refundTransactionId, originalTransactionId } = req.body;
    const result = await linkRefundToPurchase(req.user._id, {
      refundTransactionId,
      originalTransactionId
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const unlinkRefundTransaction = async (req, res, next) => {
  try {
    const { refundTransactionId } = req.body;
    const result = await unlinkRefund(req.user._id, refundTransactionId);
    res.json({ success: true, message: "Refund unlinked successfully", refund: result });
  } catch (error) {
    next(error);
  }
};
