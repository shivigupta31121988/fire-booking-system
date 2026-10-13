const mongoose = require('mongoose');

const UploadedFileSchema = new mongoose.Schema(
  {
    draftId: { type: String, index: true, required: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },
    originalName: { type: String, required: true },
    mimeType: String,
    size: Number,
    storedName: { type: String, required: true },
    uploadSeconds: Number, // time the server needed to receive the file
  },
  { timestamps: true }
);

module.exports = mongoose.model('UploadedFile', UploadedFileSchema);
