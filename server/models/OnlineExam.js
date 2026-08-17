const mongoose = require('mongoose');

const OnlineExamSchema = new mongoose.Schema({
    title: { type: String, required: true },
    examType: { type: String, enum: ['JEE', 'NEET', 'CET'], required: true },
    blueprintId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamBlueprint' },
    sourcePapers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Paper' }],
    questions: [{
        questionId: { type: mongoose.Schema.Types.Mixed, required: true },
        subject: String,
        chapter: String,
        concept: String,
        questionText: String,
        options: [String],
        answer: String,
        imageUrl: String,
        marks: { type: Number, default: 4 },
        type: { type: String, default: 'MCQ' },
        sectionName: String,
        questionTextTranslation: String,
        optionsTranslation: [String]
    }],
    instructions: { type: String, default: '' },
    start_time: { type: Date },
    end_time: { type: Date },
    duration_minutes: { type: Number, default: 180 },
    status: { type: String, enum: ['draft', 'scheduled', 'live', 'ended'], default: 'draft' },
    shuffleQuestions: { type: Boolean, default: false },
    examMode: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'ONLINE' },
    sections: [{
        sectionName: String,
        numQuestions: Number,
        allowedToAnswer: Number,
        markingRules: {
            correct: Number,
            incorrect: Number,
            unattempted: Number
        }
    }],
    allowedStudents: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

OnlineExamSchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('OnlineExam', OnlineExamSchema, 'online_exams');
