const config = require('../config');
const { schema } = require('./schemaService');

// Demo rating tables. Illustrative only, not real Irish market rates.
const BASE_RATE_PER_1000 = {
  residential_block: 0.8, office: 0.95, retail: 1.4, industrial: 2.1,
  mixed_use: 1.25, hospitality: 1.8, other: 1.5,
};
const MATERIAL = { concrete_steel: 0.9, masonry: 1.0, timber: 1.35, mixed: 1.15 };
const ROOF = { slate_tile: 1.0, flat_membrane: 1.05, metal: 1.0, thatch: 1.8, other: 1.1 };
const PROTECTION_DISCOUNT = {
  sprinklers: 0.15, smoke_detection: 0.05, monitored_alarm: 0.07,
  extinguishers: 0.02, fire_doors: 0.05, emergency_lighting: 0.01,
};
const MIN_ANNUAL_PREMIUM = 250;
const MULTI_YEAR_DISCOUNT = 0.05;

const round2 = (n) => Math.round(n * 100) / 100;

function quote(a) {
  const term = schema.policyTermYears;
  const baseRate = BASE_RATE_PER_1000[a.buildingType] ?? 1.5;
  const material = MATERIAL[a.constructionMaterial] ?? 1.0;
  const roof = ROOF[a.roofType] ?? 1.0;
  const age = a.yearBuilt < 1940 ? 1.15 : a.yearBuilt < 1980 ? 1.08 : 1.0;
  const height = a.heightMetres > 30 ? 1.25 : a.heightMetres > 18 ? 1.12 : 1.0;
  const claimsCount = a.hasPriorClaims === 'yes' ? Number(a.numberOfClaims) || 0 : 0;
  const claims = 1 + 0.12 * Math.min(claimsCount, 5);
  const discount = Math.min(
    0.3,
    (a.fireProtection || []).reduce((s, k) => s + (PROTECTION_DISCOUNT[k] || 0), 0)
  );

  const gross = (a.sumInsured / 1000) * baseRate * material * roof * age * height * claims;
  let annual = gross * (1 - discount) * (1 - MULTI_YEAR_DISCOUNT);
  annual = Math.max(annual, MIN_ANNUAL_PREMIUM);

  const annualPremium = round2(annual);
  const termPremium = round2(annualPremium * term);
  const levy = round2(termPremium * config.levyRate);
  return {
    currency: schema.currency,
    termYears: term,
    annualPremium,
    termPremium,
    levyRate: config.levyRate,
    levy,
    totalPayable: round2(termPremium + levy),
    breakdown: {
      baseRatePer1000: baseRate, material, roof, age, height, claims,
      protectionDiscount: round2(discount), multiYearDiscount: MULTI_YEAR_DISCOUNT,
    },
    note: 'Indicative price. Subject to underwriting.',
  };
}

module.exports = { quote };
