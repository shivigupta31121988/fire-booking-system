const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config');
const { schema } = require('./services/schemaService');
const { resumePending } = require('./services/underwritingService');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, mongo: mongoose.connection.readyState === 1 }));
// The single JSON the UI renders both pages from.
app.get('/api/form-schema', (_req, res) => res.json(schema));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/files', require('./routes/files'));
app.use('/api/applications', require('./routes/applications'));

app.use((err, _req, res, _next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ error: `File is larger than ${schema.upload.maxFileSizeMB} MB` });
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Something went wrong' : err.message });
});

mongoose
  .connect(config.mongoUri)
  .then(() => {
    app.listen(config.port, () => {
      console.log(`API on http://localhost:${config.port}  (upload simulation: ${config.uploadSimKBps || 'off'} KB/s)`);
    });
    return resumePending();
  })
  .catch((e) => {
    console.error('MongoDB connection failed:', e.message);
    process.exit(1);
  });
