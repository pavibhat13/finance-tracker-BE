import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { parseStatementFile } from "../src/services/statementParsers/index.js";

const sampleDir = path.resolve(process.cwd(), "../sample-statements");

test("Parse HDFC Bank Statement CSV", async () => {
  const file = path.join(sampleDir, "hdfc_bank_statement.csv");
  const result = await parseStatementFile(file, "HDFC_BANK");

  assert.equal(result.format, "HDFC_BANK");
  assert.equal(result.rows.length, 10);

  // Check first row (Salary Credit)
  const salary = result.rows[0];
  assert.equal(salary.type, "INCOME");
  assert.equal(salary.amount, 120000);
  assert.equal(salary.referenceId, "SAL20261101");

  // Check second row (Swiggy Debit)
  const swiggy = result.rows[1];
  assert.equal(swiggy.type, "EXPENSE");
  assert.equal(swiggy.amount, 450);
  assert.equal(swiggy.cleanDescription, "SWIGGY");
  assert.equal(swiggy.referenceId, "UPI11029384");
});

test("Parse SBI Bank Statement CSV", async () => {
  const file = path.join(sampleDir, "sbi_bank_statement.csv");
  const result = await parseStatementFile(file, "SBI_BANK");

  assert.equal(result.format, "SBI_BANK");
  assert.equal(result.rows.length, 7);

  // Check first row (Transfer Inward)
  const trf = result.rows[0];
  assert.equal(trf.type, "INCOME");
  assert.equal(trf.amount, 25000);

  // Check second row (Electricity bill)
  const bill = result.rows[1];
  assert.equal(bill.type, "EXPENSE");
  assert.equal(bill.amount, 1850);
});

test("Parse HDFC Credit Card Statement CSV with Dr/Cr and Refunds", async () => {
  const file = path.join(sampleDir, "hdfc_credit_card_statement.csv");
  const result = await parseStatementFile(file, "HDFC_CREDIT_CARD");

  assert.equal(result.format, "HDFC_CREDIT_CARD");
  assert.equal(result.rows.length, 6);

  // Check Netflix expense (Dr)
  const netflix = result.rows[0];
  assert.equal(netflix.type, "EXPENSE");
  assert.equal(netflix.amount, 649);

  // Check Swiggy refund (Cr)
  const refund = result.rows[4];
  assert.equal(refund.type, "INCOME");
  assert.equal(refund.amount, 450);
});
