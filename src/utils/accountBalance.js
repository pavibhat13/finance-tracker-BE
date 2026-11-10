/**
 * Returns the change to an account's displayed balance for a transaction.
 * Bank/cash balances increase for income; credit-card outstanding balances
 * increase for spending and decrease for payments, refunds, and credits.
 */
export const getAccountBalanceDelta = (accountType, transactionType, amount) => {
  const value = Number(amount) || 0;
  const normalDelta = transactionType === "INCOME" ? value : -value;

  return accountType === "CREDIT_CARD" ? -normalDelta : normalDelta;
};
