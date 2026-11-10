import {
  createAccountTransfer,
  linkExistingTransactionsAsTransfer
} from "../services/transferService.js";

export const createTransfer = async (req, res, next) => {
  try {
    const { fromAccountId, toAccountId, amount, date, notes } = req.body;
    const result = await createAccountTransfer(req.user._id, {
      fromAccountId,
      toAccountId,
      amount: Number(amount),
      date,
      notes
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const linkTransactionsAsTransfer = async (req, res, next) => {
  try {
    const { firstTransactionId, secondTransactionId } = req.body;
    const result = await linkExistingTransactionsAsTransfer(req.user._id, {
      firstTransactionId,
      secondTransactionId
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};
