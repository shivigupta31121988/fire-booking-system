const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema(
  {
    key: String,
    name: String,
    owner: { type: String, enum: ['Underwriting', 'Actuarial'] },
    status: { type: String, enum: ['PENDING', 'RUNNING', 'PASSED', 'WARN', 'FAILED'], default: 'PENDING' },
    startedAt: Date,
    completedAt: Date,
    durationMs: Number,
    notes: String,
  },
  { _id: false }
);

const ApplicationSchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true, index: true },
    draftId: { type: String, index: true },
    status: { type: String, enum: ['SUBMITTED', 'UNDERWRITING', 'APPROVED', 'REFERRED'], default: 'SUBMITTED' },
    // The exact JSON object the UI sent (answers + document ids), kept as received after validation.
    payload: mongoose.Schema.Types.Mixed,
    quote: mongoose.Schema.Types.Mixed,
    documents: [
      {
        _id: false,
        fileId: String,
        name: String,
        size: Number,
        uploadSeconds: Number,
      },
    ],
    jobs: [JobSchema],
    decision: {
      outcome: { type: String, enum: ['APPROVED', 'REFERRED'] },
      decidedAt: Date,
      decidedBy: String,
      notes: [String],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Application', ApplicationSchema);
