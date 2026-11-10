import Account from "../models/Account.js";

export const getAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find({ userId: req.user._id }).sort({ createdAt: 1 });
    res.json({ success: true, accounts });
  } catch (error) {
    next(error);
  }
};

export const getAccountById = async (req, res, next) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, userId: req.user._id });
    if (!account) return res.status(404).json({ success: false, message: "Account not found" });
    res.json({ success: true, account });
  } catch (error) {
    next(error);
  }
};

export const createAccount = async (req, res, next) => {
  try {
    const { name, accountType, bankName, accountNumberMasked, openingBalance } = req.body;
    const initialBal = Number(openingBalance) || 0;

    const account = await Account.create({
      userId: req.user._id,
      name,
      accountType,
      bankName: bankName || "",
      accountNumberMasked: accountNumberMasked || "",
      openingBalance: initialBal,
      currentBalance: initialBal,
      balanceSemantics: accountType === "CREDIT_CARD" ? "CARD_OUTSTANDING" : "ASSET"
    });

    res.status(201).json({ success: true, account });
  } catch (error) {
    next(error);
  }
};

export const updateAccount = async (req, res, next) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, userId: req.user._id });
    if (!account) return res.status(404).json({ success: false, message: "Account not found" });

    const { name, accountType, bankName, accountNumberMasked, openingBalance } = req.body;

    // Keep the transaction-derived balance intact while rebasing it when the
    // user changes the account's starting point. For example, changing the
    // opening balance from ₹80,000 to ₹83,000 raises the current balance by ₹3,000.
    if (openingBalance !== undefined) {
      const nextOpeningBalance = Number(openingBalance);
      if (!Number.isFinite(nextOpeningBalance)) {
        return res.status(400).json({ success: false, message: "Opening balance must be a valid number." });
      }

      const openingBalanceDelta = nextOpeningBalance - account.openingBalance;
      account.openingBalance = nextOpeningBalance;
      account.currentBalance = Math.round((account.currentBalance + openingBalanceDelta) * 100) / 100;
    }

    if (name !== undefined) account.name = name;
    if (accountType !== undefined) {
      account.accountType = accountType;
      account.balanceSemantics = accountType === "CREDIT_CARD" ? "CARD_OUTSTANDING" : "ASSET";
    }
    if (bankName !== undefined) account.bankName = bankName;
    if (accountNumberMasked !== undefined) account.accountNumberMasked = accountNumberMasked;

    await account.save();
    res.json({ success: true, account });
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const account = await Account.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!account) return res.status(404).json({ success: false, message: "Account not found" });
    res.json({ success: true, message: "Account deleted" });
  } catch (error) {
    next(error);
  }
};
