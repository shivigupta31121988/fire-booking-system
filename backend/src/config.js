const path = require('path');

const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

module.exports = {
  port: num(process.env.PORT, 3000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ie_insurance',
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
  // Simulated network speed for uploads in KB/s. 0 = no throttling (real speed).
  // Default 1024 KB/s so a 20 MB file visibly takes ~20 seconds.
  uploadSimKBps: num(process.env.UPLOAD_SIM_KBPS, 1024),
  // Each underwriting / actuarial job takes a random time between these (ms).
  uwJobMinMs: num(process.env.UW_JOB_MIN_MS, 2000),
  uwJobMaxMs: num(process.env.UW_JOB_MAX_MS, 5000),
  // Demo rate for the Irish non-life insurance levy applied to premium (configurable, not tax advice).
  levyRate: num(process.env.IE_LEVY_RATE, 0.03),
};
