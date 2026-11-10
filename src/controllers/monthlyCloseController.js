import {
  getMonthlyCloseStatus,
  closeMonth,
  reopenMonth
} from "../services/monthlyCloseService.js";

export const getStatus = async (req, res, next) => {
  try {
    const month = req.query.month || new Date().getMonth() + 1;
    const year = req.query.year || new Date().getFullYear();
    const result = await getMonthlyCloseStatus(req.user._id, { month, year });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const handleCloseMonth = async (req, res, next) => {
  try {
    const { month, year, reason } = req.body;
    const record = await closeMonth(req.user._id, {
      month: parseInt(month, 10),
      year: parseInt(year, 10),
      reason
    });
    res.json({ success: true, message: "Month successfully closed and locked.", record });
  } catch (error) {
    next(error);
  }
};

export const handleReopenMonth = async (req, res, next) => {
  try {
    const { month, year, reason } = req.body;
    const record = await reopenMonth(req.user._id, {
      month: parseInt(month, 10),
      year: parseInt(year, 10),
      reason
    });
    res.json({ success: true, message: "Month successfully reopened.", record });
  } catch (error) {
    next(error);
  }
};
