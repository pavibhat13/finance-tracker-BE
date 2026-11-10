import {
  getDashboardSummary,
  getMonthlyTrends,
  getCategoryBreakdown,
  getMonthComparison
} from "../services/dashboardService.js";

export const getSummary = async (req, res, next) => {
  try {
    const month = req.query.month || new Date().getMonth() + 1;
    const year = req.query.year || new Date().getFullYear();
    const data = await getDashboardSummary(req.user._id, { month, year });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getMonthlyTrendsData = async (req, res, next) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const data = await getMonthlyTrends(req.user._id, year);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getCategoryBreakdownData = async (req, res, next) => {
  try {
    const month = req.query.month || new Date().getMonth() + 1;
    const year = req.query.year || new Date().getFullYear();
    const data = await getCategoryBreakdown(req.user._id, { month, year });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getMonthComparisonData = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const data = await getMonthComparison(req.user._id, { month, year });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
