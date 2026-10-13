const { schema, allFields, isVisible, isRequired } = require('./schemaService');

const isEmpty = (v) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Validates the answers in the JSON payload against the same schema the UI renders from.
 * opts.pageIds limits validation to some pages (used by the quote preview).
 * Returns { errors: [{field,message}], clean } where clean holds only visible, known fields.
 */
function validate(payload, opts = {}) {
  const errors = [];
  const clean = {};
  const answers = (payload && payload.answers) || {};

  for (const f of allFields()) {
    if (opts.pageIds && !opts.pageIds.includes(f.pageId)) continue;
    if (f.type === 'file' || f.type === 'readonly') continue;
    if (!isVisible(f, answers)) continue;

    const v = answers[f.key];
    const required = isRequired(f, answers);
    const err = (message) => errors.push({ field: f.key, message });

    if (isEmpty(v) || (f.type === 'checkbox' && v === false)) {
      if (required) err(f.type === 'checkbox' ? 'You must confirm to continue' : `${f.label} is required`);
      else if (f.type === 'checkbox') clean[f.key] = false;
      continue;
    }

    const val = f.validators || {};
    let value = v;

    switch (f.type) {
      case 'number':
        if (typeof v !== 'number' || !Number.isFinite(v)) { err(`${f.label} must be a number`); continue; }
        if (val.min !== undefined && v < val.min) err(`${f.label} must be at least ${val.min}`);
        if (val.max !== undefined && v > val.max) err(`${f.label} must be at most ${val.max}`);
        break;
      case 'text':
      case 'textarea':
        if (typeof v !== 'string') { err(`${f.label} must be text`); continue; }
        value = v.trim();
        if (f.transform === 'uppercase') value = value.toUpperCase();
        if (val.minLength !== undefined && value.length < val.minLength) err(`${f.label} must be at least ${val.minLength} characters`);
        if (val.maxLength !== undefined && value.length > val.maxLength) err(`${f.label} must be at most ${val.maxLength} characters`);
        if (val.pattern && !new RegExp(val.pattern, 'i').test(value)) err(val.patternMessage || `${f.label} is not valid`);
        break;
      case 'date':
        if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) { err(`${f.label} must be a date`); continue; }
        if (val.minDate === 'today' && v < todayIso()) err(val.minDateMessage || `${f.label} cannot be in the past`);
        break;
      case 'select':
      case 'radio':
        if (!(f.options || []).some((o) => o.value === v)) err(`${f.label} has an invalid option`);
        break;
      case 'checkboxGroup':
        if (!Array.isArray(v) || !v.every((x) => (f.options || []).some((o) => o.value === x))) err(`${f.label} has an invalid option`);
        else value = [...new Set(v)];
        break;
      case 'checkbox':
        if (v !== true) err('You must confirm to continue');
        break;
      default:
        break;
    }
    clean[f.key] = value;
  }
  return { errors, clean };
}

module.exports = { validate, schema };
