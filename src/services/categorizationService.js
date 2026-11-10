import Merchant from "../models/Merchant.js";
import CategorizationRule from "../models/CategorizationRule.js";
import { normalizeDescription } from "../utils/fingerprint.js";

/**
 * Categorizes a single description using merchant matching and rule priority
 */
export const categorizeTransaction = async (userId, description = "") => {
  const normalizedDesc = normalizeDescription(description);

  // 1. Try finding matching merchant
  const merchants = await Merchant.find({ userId, isActive: true });
  for (const merchant of merchants) {
    if (
      normalizedDesc.includes(merchant.normalizedName) ||
      merchant.normalizedName.includes(normalizedDesc)
    ) {
      if (merchant.defaultCategoryId) {
        return {
          merchantId: merchant._id,
          categoryId: merchant.defaultCategoryId,
          matchedBy: "MERCHANT"
        };
      }
    }
  }

  // 2. Query active categorization rules ordered by priority ascending
  const rules = await CategorizationRule.find({ userId, isActive: true }).sort({ priority: 1 });

  for (const rule of rules) {
    const pattern = rule.matchValue.trim().toLowerCase();
    let matches = false;

    switch (rule.matchType) {
      case "EXACT":
        matches = normalizedDesc === pattern;
        break;
      case "STARTS_WITH":
        matches = normalizedDesc.startsWith(pattern);
        break;
      case "REGEX":
        try {
          const reg = new RegExp(rule.matchValue, "i");
          matches = reg.test(description);
        } catch (e) {
          matches = false;
        }
        break;
      case "CONTAINS":
      default:
        matches = normalizedDesc.includes(pattern);
        break;
    }

    if (matches) {
      return {
        merchantId: null,
        categoryId: rule.categoryId,
        matchedBy: "RULE",
        ruleId: rule._id
      };
    }
  }

  return {
    merchantId: null,
    categoryId: null,
    matchedBy: "NONE"
  };
};

/**
 * Creates or updates a learned categorization rule from manual user correction
 */
export const learnRule = async ({ userId, matchValue, categoryId, matchType = "CONTAINS" }) => {
  if (!matchValue || !categoryId) return null;

  const normalized = matchValue.trim();

  // Check if rule already exists
  let rule = await CategorizationRule.findOne({
    userId,
    matchValue: normalized
  });

  if (rule) {
    rule.categoryId = categoryId;
    rule.matchType = matchType;
    rule.isActive = true;
    await rule.save();
    return rule;
  }

  rule = await CategorizationRule.create({
    userId,
    matchType,
    matchValue: normalized,
    categoryId,
    priority: 10
  });

  return rule;
};
