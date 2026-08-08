const mongoose = require('mongoose');

const PaperSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subject: { type: String, required: true },
    classes: [{ type: String }],
    teacherId: { type: String, required: true }, // String to support both MongoDB ObjectId and Supabase User UUID
    questions: [{ type: String }], // Array of Supabase Question UUIDs or question objects
    questionObjects: [{ type: mongoose.Schema.Types.Mixed }], // Cached full question snapshots
    templateId: { type: String },
    pattern: [{
        sectionName: String,
        numQuestions: Number,
        type: { type: String },
        description: String,
        marks: Number
    }],
    createdAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['Pending Approval', 'Approved', 'Rejected'], default: 'Pending Approval' }
});

module.exports = mongoose.model('Paper', PaperSchema, 'papers');
