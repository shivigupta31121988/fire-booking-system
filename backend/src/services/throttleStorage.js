const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Transform, pipeline } = require('stream');
const config = require('../config');

// Slows the incoming stream down to a fixed speed. Back-pressure travels back to the browser,
// so the upload progress bar and the "seconds taken" reflect the simulated network speed.
class Throttle extends Transform {
  constructor(bytesPerSec) {
    super();
    this.bytesPerSec = bytesPerSec;
  }
  _transform(chunk, _enc, cb) {
    this.push(chunk);
    setTimeout(cb, (chunk.length / this.bytesPerSec) * 1000);
  }
}

class ThrottledDiskStorage {
  _handleFile(req, file, cb) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
    const storedName = crypto.randomUUID() + path.extname(file.originalname).toLowerCase();
    const dest = path.join(config.uploadDir, storedName);
    const out = fs.createWriteStream(dest);
    const parts = [file.stream];
    if (config.uploadSimKBps > 0) parts.push(new Throttle(config.uploadSimKBps * 1024));
    parts.push(out);
    pipeline(...parts, (err) => {
      if (err) {
        fs.unlink(dest, () => {});
        return cb(err);
      }
      cb(null, { storedName, size: out.bytesWritten });
    });
  }
  _removeFile(_req, file, cb) {
    fs.unlink(path.join(config.uploadDir, file.storedName), () => cb(null));
  }
}

module.exports = { ThrottledDiskStorage, Throttle };
