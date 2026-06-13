const { z } = require("zod");

const userIdSchema = z.string().min(3).max(100).regex(/^[A-Za-z0-9_-]+$/);

const schemas = {
  createAnalysis: z.object({
    user_id: userIdSchema.optional(),
    source_type: z.enum(["paste", "photo", "pdf"]).optional(),
    ocr_text: z.string().min(50).max(200_000).optional(),
    ocr_confidence: z.coerce.number().min(0).max(1).optional(),
    payment_provider: z.enum(["stripe", "apple_iap"]).optional(),
    email: z.string().email().optional(),
  }),
  generateLetter: z.object({
    analysis_id: z.string().min(5).max(40),
    type: z.enum(["reklamacja", "skd", "rzecznik_finansowy", "uokik"]),
    form_data: z.object({
      name: z.string().min(2).max(200).optional(),
      address: z.string().max(500).optional(),
      pesel: z.string().max(20).optional(),
      contract_number: z.string().max(100).optional(),
      bank_account: z.string().max(40).optional(),
      city: z.string().max(100).optional(),
    }).partial().optional(),
  }),
  overrideExtracted: z.object({
    // dopuszczamy edycję top-level kluczowych pól; nie dotykamy installments po nazwie (osobno)
    overrides: z.object({
      principal_pln: z.coerce.number().min(0).max(10_000_000).optional(),
      interest_rate_annual_pct: z.coerce.number().min(0).max(100).optional(),
      late_interest_rate_annual_pct: z.coerce.number().min(0).max(100).optional(),
      declared_rrso_pct: z.coerce.number().min(0).max(500).optional(),
      total_amount_to_pay_pln: z.coerce.number().min(0).max(10_000_000).optional(),
      total_fees_pln: z.coerce.number().min(0).max(10_000_000).optional(),
      repayment_months: z.coerce.number().int().min(1).max(600).optional(),
      contract_date: z.string().optional(),
      first_installment_date: z.string().optional(),
      loan_type: z.enum(["konsumencki", "hipoteczny", "samochodowy", "ratalny", "pożyczka"]).optional(),
      interest_type: z.enum(["stała", "zmienna"]).optional(),
      interest_reference: z.string().nullable().optional(),
      early_repayment_info: z.string().nullable().optional(),
      withdrawal_right_info: z.string().nullable().optional(),
      lender_name: z.string().max(200).optional(),
      months_paid_so_far: z.coerce.number().int().min(0).max(600).optional(),
      total_paid_so_far_pln: z.coerce.number().min(0).max(100_000_000).optional(),
      current_balance_pln: z.coerce.number().min(0).max(100_000_000).optional(),
      early_repayment_done: z.coerce.boolean().optional(),
      early_repayment_planned: z.coerce.boolean().optional(),
      early_repayment_date: z.string().nullable().optional(),
    }).partial(),
  }),
  // stripeCheckout zostawiamy dla backward compat, ale plan tylko single_check
  stripeCheckout: z.object({
    plan: z.enum(["single_check"]),
    user_id: userIdSchema,
    email: z.string().email().optional(),
  }),
  chatQuestion: z.object({
    question: z.string().min(3).max(500),
  }),
  iapVerifyReceipt: z.object({
    user_id: userIdSchema,
    analysis_id: z.string().min(5).max(40).optional(),
    transaction_id: z.string().min(1).max(100),
    original_transaction_id: z.string().min(1).max(100).optional(),
    product_id: z.string().min(3).max(200),
    app_account_token: z.string().uuid().optional(),
  }),
};

function validateBody(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) return next();
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "validation_error",
        details: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    req.validated = result.data;
    next();
  };
}

module.exports = { schemas, validateBody, userIdSchema };
