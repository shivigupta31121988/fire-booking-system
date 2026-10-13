const express = require('express');
const path = require('path');
const config = require('../config');
const UploadedFile = require('../models/UploadedFile');

const router = express.Router();

// GET /api/files/:id           -> download
// GET /api/files/:id?inline=1  -> view in browser (PDF, images)
router.get('/:id', async (req, res, next) => {
  try {
    const doc = await UploadedFile.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ error: 'File not found' });
    const full = path.join(config.uploadDir, doc.storedName);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.query.inline) {
      return res.sendFile(full, {
        headers: {
          'Content-Type': doc.mimeType || 'application/octet-stream',
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
        },
      });
    }
    res.download(full, doc.originalName);
  } catch (e) { next(e); }
});

module.exports = router;
