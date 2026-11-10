import Merchant from "../models/Merchant.js";
import { normalizeDescription } from "../utils/fingerprint.js";

export const getMerchants = async (req, res, next) => {
  try {
    const merchants = await Merchant.find({ userId: req.user._id })
      .populate("defaultCategoryId", "name type color icon")
      .sort({ name: 1 });
    res.json({ success: true, merchants });
  } catch (error) {
    next(error);
  }
};

export const createMerchant = async (req, res, next) => {
  try {
    const { name, defaultCategoryId } = req.body;
    const normalizedName = normalizeDescription(name);

    const merchant = await Merchant.create({
      userId: req.user._id,
      name,
      normalizedName,
      defaultCategoryId: defaultCategoryId || null
    });

    res.status(201).json({ success: true, merchant });
  } catch (error) {
    next(error);
  }
};

export const updateMerchant = async (req, res, next) => {
  try {
    const updates = { ...req.body };
    if (updates.name) {
      updates.normalizedName = normalizeDescription(updates.name);
    }

    const merchant = await Merchant.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updates,
      { new: true }
    );
    if (!merchant) return res.status(404).json({ success: false, message: "Merchant not found" });
    res.json({ success: true, merchant });
  } catch (error) {
    next(error);
  }
};

export const deleteMerchant = async (req, res, next) => {
  try {
    const merchant = await Merchant.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!merchant) return res.status(404).json({ success: false, message: "Merchant not found" });
    res.json({ success: true, message: "Merchant deleted" });
  } catch (error) {
    next(error);
  }
};
