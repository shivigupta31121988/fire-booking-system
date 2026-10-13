const config = require('../config');
const Application = require('../models/Application');
const { JOBS } = require('./rules');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);

const jobTemplates = () => JOBS.map((j) => ({ key: j.key, name: j.name, owner: j.owner, status: 'PENDING' }));

async function runUnderwriting(applicationId) {
  const app = await Application.findById(applicationId);
  if (!app || ['APPROVED', 'REFERRED'].includes(app.status)) return;

  app.status = 'UNDERWRITING';
  app.jobs.forEach((j) => { if (j.status === 'RUNNING') j.status = 'PENDING'; });
  await app.save();

  const ctx = { a: app.payload.answers, docs: app.documents.map((d) => ({ name: d.name, size: d.size })), quote: app.quote };

  for (const job of JOBS) {
    const state = app.jobs.find((j) => j.key === job.key);
    if (!state || state.status !== 'PENDING') continue;

    state.status = 'RUNNING';
    state.startedAt = new Date();
    await app.save();

    await sleep(rand(config.uwJobMinMs, config.uwJobMaxMs)); // simulated processing time

    let result;
    try { result = job.run(ctx); } catch (e) { result = { status: 'FAILED', notes: `Rule error: ${e.message}` }; }
    state.status = result.status;
    state.notes = result.notes;
    state.completedAt = new Date();
    state.durationMs = state.completedAt - state.startedAt;
    await app.save();
  }

  // All jobs executed: actuarial sign-off.
  const failed = app.jobs.filter((j) => j.status === 'FAILED');
  const warned = app.jobs.filter((j) => j.status === 'WARN');
  app.decision = failed.length
    ? { outcome: 'REFERRED', decidedAt: new Date(), decidedBy: 'Actuarial sign-off (automated)',
        notes: failed.map((j) => `${j.name}: ${j.notes}`) }
    : { outcome: 'APPROVED', decidedAt: new Date(), decidedBy: 'Actuarial sign-off (automated)',
        notes: warned.length ? warned.map((j) => `Condition: ${j.name}. ${j.notes}`) : ['All checks passed with no conditions.'] };
  app.status = app.decision.outcome;
  await app.save();
}

async function resumePending() {
  const pending = await Application.find({ status: { $in: ['SUBMITTED', 'UNDERWRITING'] } }).select('_id');
  pending.forEach((p) => runUnderwriting(p._id).catch((e) => console.error('UW resume failed', e)));
}

module.exports = { runUnderwriting, resumePending, jobTemplates };
