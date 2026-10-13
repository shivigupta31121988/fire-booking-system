const express = require('express');
const { schema, allFields, isRequired } = require('../services/schemaService');
const { validate } = require('../services/validationService');
const pricing = require('../services/pricingService');
const { runUnderwriting, jobTemplates } = require('../services/underwritingService');
const Application = require('../models/Application');
const UploadedFile = require('../models/UploadedFile');

const router = express.Router();

const newReference = () =>
  `FIRE-IE-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

// Indicative quote. Needs page 1 only, so the UI can show it on page 2.
router.post('/quote', (req, res) => {
  const { errors, clean } = validate(req.body, { pageIds: ['building'] });
  if (errors.length) return res.status(422).json({ errors });
  // claims answers (if already given) feed the quote but are not required here
  const a = (req.body && req.body.answers) || {};
  if (a.hasPriorClaims === 'yes') { clean.hasPriorClaims = 'yes'; clean.numberOfClaims = Number(a.numberOfClaims) || 0; }
  res.json(pricing.quote(clean));
});

// Final submit. All business logic runs here from the JSON object the UI sends.
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    if (body.product !== schema.product || body.schemaVersion !== schema.schemaVersion)
      return res.status(409).json({ errors: [{ field: '_schema', message: 'Form version is out of date. Refresh the page.' }] });
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(String(body.draftId || '')))
      return res.status(400).json({ errors: [{ field: '_draft', message: 'draftId is missing' }] });

    const { errors, clean } = validate(body);

    // Documents: only trust ids that belong to this draft; take metadata from our DB.
    const ids = Array.isArray(body.documents) ? body.documents.map((d) => d && d.id).filter(Boolean) : [];
    const files = ids.length
      ? await UploadedFile.find({ _id: { $in: ids }, draftId: body.draftId, applicationId: null })
      : [];
    const fileField = allFields().find((f) => f.type === 'file');
    if (fileField && isRequired(fileField, (body.answers || {})) && files.length === 0)
      errors.push({ field: fileField.key, message: 'Upload at least one document' });
    if (errors.length) return res.status(422).json({ errors });

    const quote = pricing.quote(clean);
    const app = await Application.create({
      reference: newReference(),
      draftId: body.draftId,
      status: 'SUBMITTED',
      payload: { schemaVersion: schema.schemaVersion, product: schema.product, country: schema.country,
                 currency: schema.currency, policyTermYears: schema.policyTermYears, answers: clean },
      quote,
      documents: files.map((f) => ({ fileId: String(f._id), name: f.originalName, size: f.size, uploadSeconds: f.uploadSeconds })),
      jobs: jobTemplates(),
    });
    await UploadedFile.updateMany({ _id: { $in: files.map((f) => f._id) } }, { applicationId: app._id });

    // Underwriting and actuarial jobs run in the background.
    runUnderwriting(app._id).catch((e) => console.error('Underwriting failed', e));

    res.status(201).json({ id: String(app._id), reference: app.reference, quote });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const app = await Application.findById(req.params.id).catch(() => null);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    res.json(app);
  } catch (e) { next(e); }
});

router.get('/', async (_req, res, next) => {
  try {
    const apps = await Application.find().sort({ createdAt: -1 }).limit(50).select('reference status quote.totalPayable createdAt');
    res.json(apps);
  } catch (e) { next(e); }
});

module.exports = router;
