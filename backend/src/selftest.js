// Dependency-free checks of schema, validation, pricing and rules. Run: npm test
const assert = require('assert');
const { validate } = require('./services/validationService');
const pricing = require('./services/pricingService');
const { JOBS } = require('./services/rules');

const good = {
  applicantName: 'Murphy Properties Ltd', email: 'info@murphy.ie', phone: '087 123 4567',
  policyStartDate: '2999-01-01', addressLine1: '1 Grafton Street', townCity: 'Dublin', county: 'dublin',
  eircode: 'd02 x285', buildingType: 'office', constructionMaterial: 'concrete_steel', roofType: 'flat_membrane',
  yearBuilt: 2005, numberOfFloors: 5, heightMetres: 18, floorAreaSqm: 2500,
  fireProtection: ['sprinklers', 'smoke_detection', 'monitored_alarm'], hasFireSafetyCert: 'yes',
  sumInsured: 6000000, hasPriorClaims: 'no', declaration: true,
};

let r = validate({ answers: good });
assert.deepStrictEqual(r.errors, [], JSON.stringify(r.errors));
assert.strictEqual(r.clean.eircode, 'D02 X285');

r = validate({ answers: { ...good, eircode: 'ZZZ 999', phone: '12', hasPriorClaims: 'yes' } });
const fields = r.errors.map((e) => e.field).sort();
assert.deepStrictEqual(fields, ['claimsDescription', 'eircode', 'numberOfClaims', 'phone', 'totalClaimsValue']);

const q = pricing.quote(r.clean);
assert.ok(q.annualPremium >= 250 && q.totalPayable > q.termPremium);

const ctx = { a: validate({ answers: good }).clean, docs: [{ name: 'fsc.pdf', size: 1048576 }] };
ctx.quote = pricing.quote(ctx.a);
for (const j of JOBS) {
  const out = j.run(ctx);
  assert.ok(['PASSED', 'WARN', 'FAILED'].includes(out.status), j.key);
  console.log(`${out.status.padEnd(6)} ${j.name}: ${out.notes}`);
}
console.log('selftest ok');
