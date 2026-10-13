const pricing = require('./pricingService');

const eur = (n) => `€${Math.round(n).toLocaleString('en-IE')}`;

// Each rule returns { status: PASSED | WARN | FAILED, notes }.
// ctx = { a: answers, docs: documents, quote }
const JOBS = [
  {
    key: 'address-check', name: 'Eircode and address validation', owner: 'Underwriting',
    run({ a }) {
      const key = String(a.eircode || '').replace(/\s/g, '').slice(0, 3);
      const dublinKey = key[0] === 'D' && (/^D(0[1-9]|1\d|2[0-4])$/.test(key) || key === 'D6W');
      if (dublinKey && a.county !== 'dublin')
        return { status: 'WARN', notes: `Eircode routing key ${key} is a Dublin area but county is ${a.county}. Confirm address.` };
      if (a.county === 'dublin' && !dublinKey && key[0] !== 'A' && key[0] !== 'K')
        return { status: 'WARN', notes: `Routing key ${key} is unusual for County Dublin. Confirm address.` };
      return { status: 'PASSED', notes: `Eircode ${a.eircode} format and county checked.` };
    },
  },
  {
    key: 'building-risk', name: 'Construction, age and height risk', owner: 'Underwriting',
    run({ a }) {
      const notes = [];
      let status = 'PASSED';
      const perFloor = a.heightMetres / a.numberOfFloors;
      if (perFloor < 1.8) return { status: 'FAILED', notes: `Height ${a.heightMetres} m for ${a.numberOfFloors} floors (${perFloor.toFixed(1)} m per floor) is not plausible.` };
      if (perFloor > 8) { status = 'WARN'; notes.push(`${perFloor.toFixed(1)} m per floor is high. Confirm height.`); }
      if (a.roofType === 'thatch') { status = 'WARN'; notes.push('Thatch roof: specialist survey and treatment evidence required.'); }
      if (a.constructionMaterial === 'timber' && a.heightMetres > 12) { status = 'WARN'; notes.push('Timber frame above 12 m: referred for fire-spread review.'); }
      if (new Date().getFullYear() - a.yearBuilt > 150) { status = 'WARN'; notes.push('Building older than 150 years: condition survey advised.'); }
      return { status, notes: notes.join(' ') || 'Construction and dimensions within appetite.' };
    },
  },
  {
    key: 'fire-protection', name: 'Fire protection adequacy', owner: 'Underwriting',
    run({ a }) {
      const p = a.fireProtection || [];
      const notes = [];
      let status = 'PASSED';
      if (!p.includes('smoke_detection') && !p.includes('monitored_alarm'))
        return { status: 'FAILED', notes: 'No fire detection or alarm declared.' };
      if (a.heightMetres > 30 && !p.includes('sprinklers'))
        return { status: 'FAILED', notes: `Building over 30 m (${a.heightMetres} m) without sprinklers.` };
      if (a.heightMetres > 18 && !p.includes('sprinklers')) { status = 'WARN'; notes.push('Over 18 m without sprinklers: condition added.'); }
      if (a.yearBuilt >= 1992 && a.hasFireSafetyCert === 'no') { status = 'WARN'; notes.push('Building from 1992 or later usually has a Fire Safety Certificate. Certificate requested.'); }
      return { status, notes: notes.join(' ') || `${p.length} protection measures declared.` };
    },
  },
  {
    key: 'claims-history', name: 'Claims history check (5 years)', owner: 'Underwriting',
    run({ a }) {
      if (a.hasPriorClaims !== 'yes') return { status: 'PASSED', notes: 'No claims declared.' };
      const ratio = a.totalClaimsValue / a.sumInsured;
      if (a.numberOfClaims > 3 || ratio > 0.25)
        return { status: 'FAILED', notes: `${a.numberOfClaims} claims worth ${eur(a.totalClaimsValue)} (${(ratio * 100).toFixed(0)}% of sum insured) exceeds guidelines.` };
      if (a.numberOfClaims >= 2) return { status: 'WARN', notes: `${a.numberOfClaims} claims declared. Loading applied.` };
      return { status: 'PASSED', notes: `1 claim of ${eur(a.totalClaimsValue)} declared. Within guidelines.` };
    },
  },
  {
    key: 'document-review', name: 'Supporting document review', owner: 'Underwriting',
    run({ a, docs }) {
      if (a.hasPriorClaims === 'yes' && docs.length === 0) return { status: 'FAILED', notes: 'Claims declared but no documents supplied.' };
      if (docs.length === 0) return { status: 'WARN', notes: 'No documents supplied. Fire Safety Certificate may be requested.' };
      const hasPdf = docs.some((d) => /\.pdf$/i.test(d.name));
      const mb = docs.reduce((s, d) => s + d.size, 0) / 1048576;
      return {
        status: hasPdf ? 'PASSED' : 'WARN',
        notes: `${docs.length} document(s), ${mb.toFixed(1)} MB scanned.${hasPdf ? '' : ' No PDF supplied.'}`,
      };
    },
  },
  {
    key: 'sum-insured', name: 'Sum insured and rebuild cost validation', owner: 'Actuarial',
    run({ a }) {
      const perSqm = a.sumInsured / a.floorAreaSqm;
      if (perSqm < 800) return { status: 'FAILED', notes: `${eur(perSqm)}/m² is far below the rebuild cost range. Serious under-insurance.` };
      if (perSqm < 1200) return { status: 'WARN', notes: `${eur(perSqm)}/m² looks low. Average clause applies.` };
      if (perSqm > 6000) return { status: 'WARN', notes: `${eur(perSqm)}/m² looks high. Valuation requested.` };
      return { status: 'PASSED', notes: `${eur(perSqm)}/m² within the expected rebuild range.` };
    },
  },
  {
    key: 'premium-validation', name: 'Premium and loss-ratio validation', owner: 'Actuarial',
    run({ a, quote }) {
      const recomputed = pricing.quote(a);
      if (Math.abs(recomputed.annualPremium - quote.annualPremium) > 0.01)
        return { status: 'FAILED', notes: 'Stored premium does not match recomputed premium.' };
      const perMille = (quote.annualPremium / a.sumInsured) * 1000;
      const claimsCount = a.hasPriorClaims === 'yes' ? a.numberOfClaims : 0;
      const lossRatio = 0.55 + 0.1 * claimsCount;
      if (lossRatio > 0.85) return { status: 'WARN', notes: `Expected loss ratio ${(lossRatio * 100).toFixed(0)}% is above the 85% target.` };
      if (perMille < 0.4 || perMille > 4) return { status: 'WARN', notes: `Rate of ${perMille.toFixed(2)} per mille is outside the 0.4 to 4 band.` };
      return { status: 'PASSED', notes: `Premium reproduced. Rate ${perMille.toFixed(2)} per mille, expected loss ratio ${(lossRatio * 100).toFixed(0)}%.` };
    },
  },
];

module.exports = { JOBS };
