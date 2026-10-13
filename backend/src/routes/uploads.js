const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config');
const { schema } = require('../services/schemaService');
const { ThrottledDiskStorage } = require('../services/throttleStorage');
const UploadedFile = require('../models/UploadedFile');

const router = express.Router();
const DRAFT_RE = /^[a-zA-Z0-9-]{8,64}$/;
const allowed = schema.upload.accept.map((e) => e.toLowerCase());

const upload = multer({
  storage: new ThrottledDiskStorage(),
  limits: { fileSize: schema.upload.maxFileSizeMB * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      const e = new Error(`File type ${ext || '(none)'} is not allowed`);
      e.status = 415;
      return cb(e);
    }
    cb(null, true);
  },
});

const toDto = (f) => ({
  id: String(f._id), name: f.originalName, size: f.size, mimeType: f.mimeType, uploadSeconds: f.uploadSeconds,
});

// One file per request so the browser can report progress and seconds per file.
router.post(
  '/',
  (req, res, next) => {
    if (!DRAFT_RE.test(String(req.query.draftId || ''))) return res.status(400).json({ error: 'draftId is required' });
    req.uploadStart = Date.now();
    next();
  },
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file received' });
      const existing = await UploadedFile.countDocuments({ draftId: req.query.draftId, applicationId: null });
      if (existing >= schema.upload.maxFiles) {
        await fs.promises.unlink(path.join(config.uploadDir, req.file.storedName)).catch(() => {});
        return res.status(400).json({ error: `Maximum ${schema.upload.maxFiles} files` });
      }
      const doc = await UploadedFile.create({
        draftId: req.query.draftId,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        storedName: req.file.storedName,
        uploadSeconds: Math.round(((Date.now() - req.uploadStart) / 1000) * 10) / 10,
      });
      res.status(201).json(toDto(doc));
    } catch (e) { next(e); }
  }
);

router.get('/', async (req, res, next) => {
  try {
    if (!DRAFT_RE.test(String(req.query.draftId || ''))) return res.status(400).json({ error: 'draftId is required' });
    const docs = await UploadedFile.find({ draftId: req.query.draftId, applicationId: null }).sort({ createdAt: 1 });
    res.json(docs.map(toDto));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await UploadedFile.findOne({ _id: req.params.id, applicationId: null });
    if (!doc) return res.status(404).json({ error: 'File not found or already submitted' });
    await fs.promises.unlink(path.join(config.uploadDir, doc.storedName)).catch(() => {});
    await doc.deleteOne();
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
