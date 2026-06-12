/**
 * GET /api/kredytai/pricing — informacja o cenie sprawdzenia umowy.
 * Model: 1 cena = 49 zł za jedno sprawdzenie. Bez subskrypcji, bez free.
 */

const express = require("express");
const { getSingleCheckPlan, SINGLE_CHECK_PRICE_PLN, legalNote, getStripePriceId } = require("../config/pricing");

const router = express.Router();

router.get("/", (req, res) => {
  const plan = getSingleCheckPlan();
  res.json({
    currency: "PLN",
    price_pln: SINGLE_CHECK_PRICE_PLN,
    plan: {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      features: plan.features,
      valid_for_days: plan.valid_for_days,
      letters_included: plan.letters_included,
      cta_label: plan.cta_label,
    },
    stripe_configured: Boolean(getStripePriceId()),
    legal_note: legalNote,
  });
});

module.exports = router;
