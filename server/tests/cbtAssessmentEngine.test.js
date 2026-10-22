/**
 * cbtAssessmentEngine.test.js
 *
 * Comprehensive Automated Test Suite for CBT Assessment Engine.
 * Verifies all 4 Modules:
 *  - Module 1: Session Management, Status Tracking & Timer State
 *  - Module 2: Granular Attempt Logging & Question Evaluation (MCQ, Multi-select, Numerical)
 *  - Module 3: Scoring & Comprehensive Analytics Engine (High-level, Topic Diagnostics, Panic Analysis)
 *  - Module 4: Verification, Zero-Division Edge Cases & ExamSession Idempotency
 */

const {
    QUESTION_STATUS,
    DIAGNOSTIC_CLASSIFICATION,
    safeDivide,
    roundTo,
    deriveQuestionStatus,
    isResponseValid,
    calculateServerTimerState,
    evaluateQuestionAnswer,
    calculateAssessmentAnalytics
} = require('../services/cbtAssessmentEngine');

const ExamSession = require('../models/ExamSession');
const OnlineExam = require('../models/OnlineExam');

describe('CBT Assessment Engine - Comprehensive Test Suite', () => {

    // ─────────────────────────────────────────────────────────────
    // MODULE 1: SESSION MANAGEMENT & TIMER ENGINE
    // ─────────────────────────────────────────────────────────────
    describe('Module 1: Status Derivation & Timer Calculation', () => {
        test('deriveQuestionStatus: correctly categorizes all 5 standardized states', () => {
            // 1. Unvisited
            expect(deriveQuestionStatus(false, null, false)).toBe(QUESTION_STATUS.UNVISITED);
            expect(deriveQuestionStatus(false, '', false)).toBe(QUESTION_STATUS.UNVISITED);

            // 2. Visited / Unanswered
            expect(deriveQuestionStatus(true, null, false)).toBe(QUESTION_STATUS.VISITED_UNANSWERED);
            expect(deriveQuestionStatus(true, '', false)).toBe(QUESTION_STATUS.VISITED_UNANSWERED);

            // 3. Answered
            expect(deriveQuestionStatus(true, 'A', false)).toBe(QUESTION_STATUS.ANSWERED);
            expect(deriveQuestionStatus(false, 'B', false)).toBe(QUESTION_STATUS.ANSWERED);
            expect(deriveQuestionStatus(true, 0, false)).toBe(QUESTION_STATUS.ANSWERED); // numeric 0 is valid

            // 4. Marked for Review (unanswered)
            expect(deriveQuestionStatus(false, null, true)).toBe(QUESTION_STATUS.MARKED_FOR_REVIEW);
            expect(deriveQuestionStatus(true, null, true)).toBe(QUESTION_STATUS.MARKED_FOR_REVIEW);

            // 5. Answered & Marked for Review
            expect(deriveQuestionStatus(true, 'C', true)).toBe(QUESTION_STATUS.ANSWERED_MARKED_FOR_REVIEW);
            expect(deriveQuestionStatus(false, ['1', '2'], true)).toBe(QUESTION_STATUS.ANSWERED_MARKED_FOR_REVIEW);
        });

        test('isResponseValid: correctly identifies valid vs empty responses', () => {
            expect(isResponseValid(null)).toBe(false);
            expect(isResponseValid(undefined)).toBe(false);
            expect(isResponseValid('')).toBe(false);
            expect(isResponseValid('   ')).toBe(false);
            expect(isResponseValid([])).toBe(false);

            expect(isResponseValid('A')).toBe(true);
            expect(isResponseValid(0)).toBe(true);
            expect(isResponseValid(-5.2)).toBe(true);
            expect(isResponseValid(['option_1'])).toBe(true);
        });

        test('calculateServerTimerState: calculates active countdown and detects expiry', () => {
            const start = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
            const durationMinutes = 180; // 3 hours

            const activeTimer = calculateServerTimerState(start, durationMinutes);
            expect(activeTimer.total_duration_seconds).toBe(10800);
            expect(activeTimer.elapsed_seconds).toBeGreaterThanOrEqual(1799);
            expect(activeTimer.remaining_seconds).toBeLessThanOrEqual(9001);
            expect(activeTimer.is_expired).toBe(false);

            // Expired session: started 200 minutes ago for 180 min exam
            const pastStart = new Date(Date.now() - 200 * 60 * 1000);
            const expiredTimer = calculateServerTimerState(pastStart, durationMinutes);
            expect(expiredTimer.is_expired).toBe(true);
            expect(expiredTimer.remaining_seconds).toBe(0);
            expect(expiredTimer.elapsed_seconds).toBeGreaterThanOrEqual(12000);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // MODULE 2: QUESTION EVALUATION & GRANULAR ATTEMPT LOGGING
    // ─────────────────────────────────────────────────────────────
    describe('Module 2: Question Answer Evaluation', () => {
        test('evaluateQuestionAnswer - Single Choice MCQ matching', () => {
            // Case-insensitive letter match
            expect(evaluateQuestionAnswer('A', 'A', 'MCQ')).toBe(true);
            expect(evaluateQuestionAnswer('a', 'A', 'MCQ')).toBe(true);
            expect(evaluateQuestionAnswer('B', 'C', 'MCQ')).toBe(false);

            // Letter to 1-based index mapping ('A' <-> '1', 'B' <-> '2')
            expect(evaluateQuestionAnswer('A', '1', 'MCQ')).toBe(true);
            expect(evaluateQuestionAnswer('2', 'B', 'MCQ')).toBe(true);
            expect(evaluateQuestionAnswer('4', 'D', 'MCQ')).toBe(true);
            expect(evaluateQuestionAnswer('3', 'A', 'MCQ')).toBe(false);

            // Option text matching with options array
            const options = ['Newton', 'Einstein', 'Galileo', 'Curie'];
            expect(evaluateQuestionAnswer('Newton', 'Newton', 'MCQ', 0, options)).toBe(true);
            expect(evaluateQuestionAnswer('A', 'Newton', 'MCQ', 0, options)).toBe(true);
            expect(evaluateQuestionAnswer('Newton', 'A', 'MCQ', 0, options)).toBe(true);
            expect(evaluateQuestionAnswer('Einstein', 'Newton', 'MCQ', 0, options)).toBe(false);
        });

        test('evaluateQuestionAnswer - Multi-Select matching', () => {
            // Array vs Array exact match (order independent)
            expect(evaluateQuestionAnswer(['A', 'C'], ['C', 'A'], 'MULTI_SELECT')).toBe(true);
            expect(evaluateQuestionAnswer(['a', 'b', 'c'], ['C', 'B', 'A'], 'MULTIPLE_CHOICE')).toBe(true);
            expect(evaluateQuestionAnswer(['A'], ['A', 'B'], 'MULTI_SELECT')).toBe(false);
            expect(evaluateQuestionAnswer(['A', 'B', 'C'], ['A', 'B'], 'MULTI_SELECT')).toBe(false);

            // Comma-separated string vs Array
            expect(evaluateQuestionAnswer('A, C', ['c', 'a'], 'MULTI_SELECT')).toBe(true);
        });

        test('evaluateQuestionAnswer - Numerical value matching with tolerance', () => {
            // Exact integer & float
            expect(evaluateQuestionAnswer(42, 42, 'NUMERICAL')).toBe(true);
            expect(evaluateQuestionAnswer('42.0', 42, 'NUMERICAL')).toBe(true);

            // Tolerance boundary testing
            // 3.1415 vs 3.14 with tolerance 0.01 (diff = 0.0015 <= 0.01) -> true
            expect(evaluateQuestionAnswer(3.1415, 3.14, 'NUMERICAL', 0.01)).toBe(true);

            // diff = 0.0015 > 0.0005 -> false
            expect(evaluateQuestionAnswer(3.1415, 3.14, 'NUMERICAL', 0.0005)).toBe(false);

            // Zero and negative numbers
            expect(evaluateQuestionAnswer(0, 0, 'NUMERICAL')).toBe(true);
            expect(evaluateQuestionAnswer(-15.5, -15.5, 'NUMERICAL')).toBe(true);
            expect(evaluateQuestionAnswer(-15.5, 15.5, 'NUMERICAL')).toBe(false);
        });

        test('evaluateQuestionAnswer - Empty and invalid inputs return false', () => {
            expect(evaluateQuestionAnswer(null, 'A', 'MCQ')).toBe(false);
            expect(evaluateQuestionAnswer('A', null, 'MCQ')).toBe(false);
            expect(evaluateQuestionAnswer('', 'A', 'MCQ')).toBe(false);
            expect(evaluateQuestionAnswer([], ['A'], 'MULTI_SELECT')).toBe(false);
            expect(evaluateQuestionAnswer('invalid', 42, 'NUMERICAL')).toBe(false);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // MODULE 3: SCORING & COMPREHENSIVE ANALYTICS ENGINE
    // ─────────────────────────────────────────────────────────────
    describe('Module 3: Assessment Scoring & Diagnostic Analytics', () => {
        const mockExam = {
            duration_minutes: 180,
            sections: [
                {
                    sectionName: 'Physics',
                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                },
                {
                    sectionName: 'Chemistry',
                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                }
            ],
            questions: [
                // Topic: Mechanics (Subject: Physics) - 4 questions
                { _id: 'q1', sectionName: 'Physics', subject: 'Physics', chapter: 'Mechanics', concept: 'Kinematics', level: 'easy', type: 'MCQ', answer: 'A', marks: 4, negativeMarks: 1 },
                { _id: 'q2', sectionName: 'Physics', subject: 'Physics', chapter: 'Mechanics', concept: 'Kinematics', level: 'medium', type: 'MCQ', answer: 'B', marks: 4, negativeMarks: 1 },
                { _id: 'q3', sectionName: 'Physics', subject: 'Physics', chapter: 'Mechanics', concept: 'Dynamics', level: 'hard', type: 'MCQ', answer: 'C', marks: 4, negativeMarks: 1 },
                { _id: 'q4', sectionName: 'Physics', subject: 'Physics', chapter: 'Mechanics', concept: 'Dynamics', level: 'hard', type: 'MCQ', answer: 'D', marks: 4, negativeMarks: 1 },

                // Topic: Thermodynamics (Subject: Physics) - 3 questions
                { _id: 'q5', sectionName: 'Physics', subject: 'Physics', chapter: 'Thermodynamics', concept: 'Heat Engines', level: 'medium', type: 'NUMERICAL', answer: 100, numericalTolerance: 1, marks: 4, negativeMarks: 1 },
                { _id: 'q6', sectionName: 'Physics', subject: 'Physics', chapter: 'Thermodynamics', concept: 'Heat Engines', level: 'medium', type: 'MCQ', answer: 'B', marks: 4, negativeMarks: 1 },
                { _id: 'q7', sectionName: 'Physics', subject: 'Physics', chapter: 'Thermodynamics', concept: 'Carnot Cycle', level: 'hard', type: 'MCQ', answer: 'A', marks: 4, negativeMarks: 1 },

                // Topic: Organic (Subject: Chemistry) - 3 questions
                { _id: 'q8', sectionName: 'Chemistry', subject: 'Chemistry', chapter: 'Organic Chemistry', concept: 'Alkanes', level: 'easy', type: 'MCQ', answer: 'A', marks: 4, negativeMarks: 1 },
                { _id: 'q9', sectionName: 'Chemistry', subject: 'Chemistry', chapter: 'Organic Chemistry', concept: 'Alkanes', level: 'easy', type: 'MCQ', answer: 'B', marks: 4, negativeMarks: 1 },
                { _id: 'q10', sectionName: 'Chemistry', subject: 'Chemistry', chapter: 'Organic Chemistry', concept: 'Alkenes', level: 'medium', type: 'MCQ', answer: 'C', marks: 4, negativeMarks: 1 }
            ]
        };

        test('calculateAssessmentAnalytics: computes exact scores, dwell times, and attempt records', () => {
            const submittedAnswers = [
                // Mechanics: q1 correct (60s), q2 correct (40s), q3 incorrect (150s), q4 unattempted (0s)
                { question_id: 'q1', user_response: 'A', visited: true, time_spent_seconds: 60 },
                { question_id: 'q2', user_response: 'B', visited: true, time_spent_seconds: 40 },
                { question_id: 'q3', user_response: 'A', visited: true, time_spent_seconds: 150 }, // incorrect
                // q4 not in answers -> unattempted

                // Thermodynamics: q5 correct (50s), q6 unattempted, q7 unattempted (all skipped except q5)
                { question_id: 'q5', user_response: '100.5', visited: true, time_spent_seconds: 50 }, // within tolerance 1 -> correct

                // Organic: q8 correct (30s), q9 correct (30s), q10 correct (30s) -> 100% accuracy
                { question_id: 'q8', user_response: 'A', visited: true, time_spent_seconds: 30 },
                { question_id: 'q9', user_response: 'B', visited: true, time_spent_seconds: 30, markedForReview: true },
                { question_id: 'q10', user_response: 'C', visited: true, time_spent_seconds: 30 }
            ];

            const result = calculateAssessmentAnalytics({
                exam: mockExam,
                submittedAnswers
            });

            // Summary checks
            const s = result.summary;
            expect(s.total_questions).toBe(10);
            expect(s.total_attempted).toBe(7); // q1, q2, q3, q5, q8, q9, q10
            expect(s.total_unattempted).toBe(3); // q4, q6, q7
            expect(s.total_correct).toBe(6); // q1, q2, q5, q8, q9, q10
            expect(s.total_incorrect).toBe(1); // q3

            // Score: 6 correct * 4 = 24. 1 incorrect * -1 = -1. Total = 23.
            expect(s.total_score).toBe(23);

            // Accuracy %: (6 / 7) * 100 = 85.71%
            expect(s.accuracy_percentage).toBeCloseTo(85.71, 1);

            // Time calculations:
            // Total time consumed: 60 + 40 + 150 + 50 + 30 + 30 + 30 = 390s
            expect(s.total_time_consumed_seconds).toBe(390);
            // Avg time per question: 390 / 10 = 39s
            expect(s.avg_time_per_question).toBe(39);
            // Avg time correct: (60 + 40 + 50 + 30 + 30 + 30) / 6 = 240 / 6 = 40s
            expect(s.avg_time_correct).toBe(40);
            // Avg time incorrect: 150 / 1 = 150s
            expect(s.avg_time_incorrect).toBe(150);
            // Avg time skipped: 0 / 3 = 0s
            expect(s.avg_time_skipped).toBe(0);

            // Marked for review check
            expect(s.marked_for_review).toBe(1); // q9 had markedForReview

            // Granular Attempts Check (Module 2 format)
            expect(result.attempts.length).toBe(10);
            const att1 = result.attempts.find(a => a.question_id === 'q1');
            expect(att1).toMatchObject({
                question_id: 'q1',
                subject_id: 'Physics',
                topic_id: 'Mechanics',
                subtopic_id: 'Kinematics',
                difficulty_level: 'easy',
                user_response: 'A',
                correct_response: 'A',
                is_attempted: true,
                is_correct: true,
                time_spent_seconds: 60,
                status: QUESTION_STATUS.ANSWERED
            });

            // Panic / Time Loss Analysis:
            // Threshold = 2 * avgTimePerQuestion = 2 * 39 = 78s.
            // q3: time = 150s (> 78s) and is_correct = false -> MUST be flagged as panic question
            expect(result.panic_questions.length).toBe(1);
            expect(result.panic_questions[0].question_id).toBe('q3');
            expect(result.panic_questions[0].time_spent_seconds).toBe(150);
            expect(result.panic_questions[0].threshold_seconds).toBe(78);
        });

        test('Topic Diagnostics: verifies STRENGTH, MODERATE_WEAKNESS, and CRITICAL_WEAKNESS classifications', () => {
            const diagnosticExam = {
                duration_minutes: 60,
                questions: [
                    // Topic 1: Algebra (3 questions: 3 attempted, 0 correct -> accuracy 0% < 40%) -> CRITICAL_WEAKNESS
                    { _id: 'a1', subject: 'Math', chapter: 'Algebra', concept: 'Quadratics', type: 'MCQ', answer: 'A' },
                    { _id: 'a2', subject: 'Math', chapter: 'Algebra', concept: 'Quadratics', type: 'MCQ', answer: 'B' },
                    { _id: 'a3', subject: 'Math', chapter: 'Algebra', concept: 'Quadratics', type: 'MCQ', answer: 'C' },

                    // Topic 2: Calculus (4 questions: 1 attempted, 1 correct -> attempt_rate = 25% < 50% and total = 4 >= 3) -> CRITICAL_WEAKNESS
                    { _id: 'c1', subject: 'Math', chapter: 'Calculus', concept: 'Limits', type: 'MCQ', answer: 'A' },
                    { _id: 'c2', subject: 'Math', chapter: 'Calculus', concept: 'Limits', type: 'MCQ', answer: 'B' },
                    { _id: 'c3', subject: 'Math', chapter: 'Calculus', concept: 'Limits', type: 'MCQ', answer: 'C' },
                    { _id: 'c4', subject: 'Math', chapter: 'Calculus', concept: 'Limits', type: 'MCQ', answer: 'D' },

                    // Topic 3: Geometry (2 questions: 2 attempted, 1 correct -> accuracy = 50% [40%-60%]) -> MODERATE_WEAKNESS
                    { _id: 'g1', subject: 'Math', chapter: 'Geometry', concept: 'Triangles', type: 'MCQ', answer: 'A' },
                    { _id: 'g2', subject: 'Math', chapter: 'Geometry', concept: 'Triangles', type: 'MCQ', answer: 'B' },

                    // Topic 4: Statistics (5 questions: 5 attempted, 5 correct -> accuracy = 100% >= 80%) -> STRENGTH
                    { _id: 's1', subject: 'Math', chapter: 'Statistics', concept: 'Mean', type: 'MCQ', answer: 'A' },
                    { _id: 's2', subject: 'Math', chapter: 'Statistics', concept: 'Mean', type: 'MCQ', answer: 'B' },
                    { _id: 's3', subject: 'Math', chapter: 'Statistics', concept: 'Mean', type: 'MCQ', answer: 'C' },
                    { _id: 's4', subject: 'Math', chapter: 'Statistics', concept: 'Mean', type: 'MCQ', answer: 'D' },
                    { _id: 's5', subject: 'Math', chapter: 'Statistics', concept: 'Mean', type: 'MCQ', answer: 'A' }
                ]
            };

            const submitted = [
                // Algebra: all wrong
                { question_id: 'a1', user_response: 'D' },
                { question_id: 'a2', user_response: 'D' },
                { question_id: 'a3', user_response: 'D' },

                // Calculus: only c1 attempted and correct (attempt rate = 25% < 50% on 4 questions)
                { question_id: 'c1', user_response: 'A' },

                // Geometry: 1 right, 1 wrong (50% accuracy)
                { question_id: 'g1', user_response: 'A' },
                { question_id: 'g2', user_response: 'C' },

                // Statistics: 5 right (100% accuracy)
                { question_id: 's1', user_response: 'A' },
                { question_id: 's2', user_response: 'B' },
                { question_id: 's3', user_response: 'C' },
                { question_id: 's4', user_response: 'D' },
                { question_id: 's5', user_response: 'A' }
            ];

            const result = calculateAssessmentAnalytics({
                exam: diagnosticExam,
                submittedAnswers: submitted
            });

            const diag = result.topic_diagnostics;

            const algebraDiag = diag.find(d => d.topic === 'Algebra');
            expect(algebraDiag.classification).toBe(DIAGNOSTIC_CLASSIFICATION.CRITICAL_WEAKNESS);
            expect(algebraDiag.accuracy_rate).toBe(0);

            const calculusDiag = diag.find(d => d.topic === 'Calculus');
            expect(calculusDiag.classification).toBe(DIAGNOSTIC_CLASSIFICATION.CRITICAL_WEAKNESS);
            expect(calculusDiag.attempt_rate).toBe(25);

            const geometryDiag = diag.find(d => d.topic === 'Geometry');
            expect(geometryDiag.classification).toBe(DIAGNOSTIC_CLASSIFICATION.MODERATE_WEAKNESS);
            expect(geometryDiag.accuracy_rate).toBe(50);

            const statisticsDiag = diag.find(d => d.topic === 'Statistics');
            expect(statisticsDiag.classification).toBe(DIAGNOSTIC_CLASSIFICATION.STRENGTH);
            expect(statisticsDiag.accuracy_rate).toBe(100);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // MODULE 4: VERIFICATION, ZERO-DIVISION & IDEMPOTENCY
    // ─────────────────────────────────────────────────────────────
    describe('Module 4: Edge Cases & Error Prevention', () => {
        test('safeDivide: prevents division by zero without NaN or Infinity', () => {
            expect(safeDivide(10, 0)).toBe(0);
            expect(safeDivide(0, 0)).toBe(0);
            expect(safeDivide(10, null)).toBe(0);
            expect(safeDivide(10, undefined)).toBe(0);
            expect(safeDivide(NaN, 10)).toBe(0);
            expect(safeDivide(5, 2)).toBe(2.5);
        });

        test('All-Skipped / Zero Submission Exam: never produces NaN', () => {
            const blankExam = {
                duration_minutes: 60,
                questions: [
                    { _id: 'bk1', subject: 'Physics', chapter: 'Optics', answer: 'A' },
                    { _id: 'bk2', subject: 'Physics', chapter: 'Optics', answer: 'B' }
                ]
            };

            const result = calculateAssessmentAnalytics({
                exam: blankExam,
                submittedAnswers: []
            });

            expect(result.summary.total_attempted).toBe(0);
            expect(result.summary.total_unattempted).toBe(2);
            expect(result.summary.accuracy_percentage).toBe(0);
            expect(result.summary.avg_time_per_question).toBe(0);
            expect(result.summary.avg_time_correct).toBe(0);
            expect(result.summary.avg_time_incorrect).toBe(0);
            expect(result.summary.avg_time_skipped).toBe(0);
            expect(Number.isNaN(result.summary.accuracy_percentage)).toBe(false);
            expect(result.panic_questions).toHaveLength(0);
        });

        test('Section question answering limit: ignores excess answered questions', () => {
            const sectionLimitExam = {
                sections: [
                    { sectionName: 'Section B (Optional)', allowedToAnswer: 2 }
                ],
                questions: [
                    { _id: 'sb1', sectionName: 'Section B (Optional)', answer: 'A', marks: 4 },
                    { _id: 'sb2', sectionName: 'Section B (Optional)', answer: 'B', marks: 4 },
                    { _id: 'sb3', sectionName: 'Section B (Optional)', answer: 'C', marks: 4 } // 3rd should be rejected
                ]
            };

            const result = calculateAssessmentAnalytics({
                exam: sectionLimitExam,
                submittedAnswers: [
                    { question_id: 'sb1', user_response: 'A' },
                    { question_id: 'sb2', user_response: 'B' },
                    { question_id: 'sb3', user_response: 'C' }
                ]
            });

            expect(result.summary.total_attempted).toBe(2);
            expect(result.summary.total_unattempted).toBe(1);
            const att3 = result.attempts.find(a => a.question_id === 'sb3');
            expect(att3.is_attempted).toBe(false);
            expect(att3.user_response).toBeNull();
        });

        test('Database Layer: ExamSession schema persistence & idempotency', async () => {
            // Create a test online exam
            const exam = new OnlineExam({
                title: 'Idempotency Test Exam',
                examType: 'JEE',
                targetCourse: 'JEE',
                durationMinutes: 180,
                totalMarks: 300,
                questions: [
                    { questionId: 'item_1', subject: 'Physics', chapter: 'Motion', answer: 'A', marks: 4, negativeMarks: 1 }
                ]
            });
            await exam.save();

            // Create initial session
            const session = new ExamSession({
                examId: exam._id,
                studentId: 'student_123',
                studentName: 'Test Student',
                durationMinutes: 180,
                startTime: new Date()
            });
            await session.save();

            // Simulate submission payload
            const analytics = calculateAssessmentAnalytics({
                exam: { questions: exam.questions, duration_minutes: 180 },
                submittedAnswers: [{ question_id: 'item_1', user_response: 'A', visited: true, time_spent_seconds: 45 }]
            });

            // First submission
            session.submitted = true;
            session.submitTime = new Date();
            session.submissionIdempotencyKey = 'key_unique_session_submission_001';
            session.summary = analytics.summary;
            session.attempts = analytics.attempts;
            session.topic_diagnostics = analytics.topic_diagnostics;
            session.panic_questions = analytics.panic_questions;
            session.score = analytics.summary.total_score;
            await session.save();

            // Verify stored data
            const retrievedSession = await ExamSession.findById(session._id);
            expect(retrievedSession.submitted).toBe(true);
            expect(retrievedSession.summary.total_score).toBe(4);
            expect(retrievedSession.attempts).toHaveLength(1);
            expect(retrievedSession.attempts[0].is_correct).toBe(true);
            expect(retrievedSession.submissionIdempotencyKey).toBe('key_unique_session_submission_001');

            // Verify duplicate submission prevention via idempotency key
            const duplicateCheck = await ExamSession.findOne({
                _id: session._id,
                submitted: true
            });
            expect(duplicateCheck).not.toBeNull();
            expect(duplicateCheck.submissionIdempotencyKey).toBe('key_unique_session_submission_001');
        });
    });
});
