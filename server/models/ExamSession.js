const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema({
    questionId: { type: mongoose.Schema.Types.Mixed },
    selectedOption: { type: mongoose.Schema.Types.Mixed, default: null },
    markedForReview: { type: Boolean, default: false },
    visited: { type: Boolean, default: false },
    timeTaken: { type: Number, default: 0 } // seconds
}, { _id: false });

// Module 2: Granular Attempt Logging Schema
const AttemptSchema = new mongoose.Schema({
    question_id: { type: String, required: true },
    subject_id: { type: String, default: 'General' },
    topic_id: { type: String, default: 'General' },
    subtopic_id: { type: String, default: 'General' },
    difficulty_level: { type: String, default: 'medium' },
    user_response: { type: mongoose.Schema.Types.Mixed, default: null },
    correct_response: { type: mongoose.Schema.Types.Mixed, default: '' },
    is_attempted: { type: Boolean, default: false },
    is_correct: { type: Boolean, default: false },
    time_spent_seconds: { type: Number, default: 0 },
    status: {
        type: String,
        enum: [
            'Unvisited',
            'Visited/Unanswered',
            'Answered',
            'Marked for Review',
            'Answered & Marked for Review'
        ],
        default: 'Unvisited'
    },
    // Auxiliary fields for backward compatibility
    questionId: { type: mongoose.Schema.Types.Mixed },
    selectedOption: { type: mongoose.Schema.Types.Mixed, default: null },
    markedForReview: { type: Boolean, default: false },
    visited: { type: Boolean, default: false },
    timeTaken: { type: Number, default: 0 }
}, { _id: false });

// Module 3: Summary Analytics Schema
const SummarySchema = new mongoose.Schema({
    total_questions: { type: Number, default: 0 },
    total_attempted: { type: Number, default: 0 },
    total_unattempted: { type: Number, default: 0 },
    marked_for_review: { type: Number, default: 0 },
    total_correct: { type: Number, default: 0 },
    total_incorrect: { type: Number, default: 0 },
    total_score: { type: Number, default: 0 },
    accuracy_percentage: { type: Number, default: 0 },
    total_time_allocated_seconds: { type: Number, default: 0 },
    total_time_consumed_seconds: { type: Number, default: 0 },
    avg_time_per_question: { type: Number, default: 0 },
    avg_time_correct: { type: Number, default: 0 },
    avg_time_incorrect: { type: Number, default: 0 },
    avg_time_skipped: { type: Number, default: 0 }
}, { _id: false });

// Module 3: Topic & Weak Area Diagnostic Schema
const TopicDiagnosticSchema = new mongoose.Schema({
    subject: { type: String, default: 'General' },
    topic: { type: String, default: 'General' },
    subtopic: { type: String, default: 'General' },
    total_in_topic: { type: Number, default: 0 },
    attempted_in_topic: { type: Number, default: 0 },
    unattempted_in_topic: { type: Number, default: 0 },
    correct_in_topic: { type: Number, default: 0 },
    incorrect_in_topic: { type: Number, default: 0 },
    total_time_in_topic: { type: Number, default: 0 },
    accuracy_rate: { type: Number, default: 0 },
    attempt_rate: { type: Number, default: 0 },
    avg_time_per_topic_question: { type: Number, default: 0 },
    classification: {
        type: String,
        enum: ['CRITICAL_WEAKNESS', 'MODERATE_WEAKNESS', 'STRENGTH', 'AVERAGE'],
        default: 'AVERAGE'
    }
}, { _id: false });

// Module 3: Time-Loss / Panic Analysis Schema
const PanicQuestionSchema = new mongoose.Schema({
    question_id: { type: String, required: true },
    subject_id: { type: String, default: '' },
    topic_id: { type: String, default: '' },
    time_spent_seconds: { type: Number, default: 0 },
    threshold_seconds: { type: Number, default: 0 },
    user_response: { type: mongoose.Schema.Types.Mixed, default: null },
    correct_response: { type: mongoose.Schema.Types.Mixed, default: '' }
}, { _id: false });

const ExamSessionSchema = new mongoose.Schema({
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnlineExam', required: true },
    studentId: { type: String, required: true },
    studentName: { type: String, default: 'Student' },
    studentEmail: { type: String, default: '' },
    rollNumber: { type: String, default: '' },
    fromLabIp: { type: Boolean, default: false },
    clientIp: { type: String, default: '' },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    submitted: { type: Boolean, default: false },
    submissionIdempotencyKey: { type: String, default: null },

    // Legacy answer list
    answers: [AnswerSchema],

    // Module 2: Granular Attempt Logging
    attempts: [AttemptSchema],

    // Module 3: Comprehensive Analytics
    summary: { type: SummarySchema, default: () => ({}) },
    topic_diagnostics: [TopicDiagnosticSchema],
    panic_questions: [PanicQuestionSchema],

    // Legacy fields maintained for backward compatibility
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    attempted: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    incorrect: { type: Number, default: 0 },
    unattempted: { type: Number, default: 0 },
    weakAreas: [{ subject: String, chapter: String, incorrect: Number }],
    malpracticeFlag: { type: Boolean, default: false },
    malpracticeReason: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ExamSession', ExamSessionSchema, 'exam_sessions');
