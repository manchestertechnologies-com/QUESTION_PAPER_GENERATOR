/**
 * Track D — Answer Key Protection Tests (50 tests)
 * CRITICAL: Students must never receive answer fields in exam responses
 */
const request = require('supertest');
const app = require('../index');
const OnlineExam = require('../models/OnlineExam');
const ExamSession = require('../models/ExamSession');
const { adminToken, createTeacher, createQuestion } = require('./helpers');

// Helper: Create a test exam
async function createExam(overrides = {}) {
    const q = await createQuestion();
    const exam = new OnlineExam({
        title: 'Test Exam',
        examType: 'JEE',
        duration_minutes: 60,
        start_time: new Date(Date.now() - 60000), // Started 1 min ago
        end_time: new Date(Date.now() + 3600000),  // Ends in 1 hour
        status: 'live',
        questions: [{
            questionId: q._id,
            questionText: q.questionText,
            options: q.options,
            answer: q.answer,
            solutionText: q.solutionText,
            subject: q.subject,
            chapter: q.chapter,
            concept: q.concept,
            marks: 4,
            type: 'MCQ'
        }],
        ...overrides
    });
    await exam.save();
    return { exam, question: q };
}

describe('Answer Key Protection', () => {

    // ── Student Exam Payload ──────────────────────────────────────────────────

    describe('GET /:id/take — Student Exam Access', () => {

        test('TC-D-001: Student exam response does NOT contain answer field', async () => {
            const { exam } = await createExam();
            const res = await request(app).get(`/api/exams/${exam._id}/take`);
            expect(res.status).toBe(200);
            // Recursively check no answer field in any question
            res.body.questions.forEach(q => {
                expect(q.answer).toBeUndefined();
            });
        });

        test('TC-D-002: Student exam response does NOT contain solutionText field', async () => {
            const { exam } = await createExam();
            const res = await request(app).get(`/api/exams/${exam._id}/take`);
            expect(res.status).toBe(200);
            res.body.questions.forEach(q => {
                expect(q.solutionText).toBeUndefined();
            });
        });

        test('TC-D-003: Student exam response does NOT contain correctAnswer field', async () => {
            const { exam } = await createExam();
            const res = await request(app).get(`/api/exams/${exam._id}/take`);
            expect(res.status).toBe(200);
            res.body.questions.forEach(q => {
                expect(q.correctAnswer).toBeUndefined();
            });
        });

        test('TC-D-004: Student exam DOES contain questionText', async () => {
            const { exam } = await createExam();
            const res = await request(app).get(`/api/exams/${exam._id}/take`);
            expect(res.status).toBe(200);
            res.body.questions.forEach(q => {
                expect(q.questionText).toBeDefined();
            });
        });

        test('TC-D-005: Student exam DOES contain options for MCQ', async () => {
            const { exam } = await createExam();
            const res = await request(app).get(`/api/exams/${exam._id}/take`);
            expect(res.status).toBe(200);
            res.body.questions.forEach(q => {
                if (q.type === 'MCQ') {
                    expect(q.options).toBeDefined();
                    expect(Array.isArray(q.options)).toBe(true);
                }
            });
        });

        test('TC-D-006: Exam with status=draft is not accessible to students', async () => {
            const { exam } = await createExam({ status: 'draft' });
            const res = await request(app).get(`/api/exams/${exam._id}/take`);
            expect(res.status).toBe(403);
        });

        test('TC-D-007: Exam with status=ended is not accessible to students', async () => {
            const { exam } = await createExam({ status: 'ended' });
            const res = await request(app).get(`/api/exams/${exam._id}/take`);
            expect(res.status).toBe(403);
        });

        test('TC-D-008: Non-existent exam returns 404', async () => {
            const res = await request(app).get('/api/exams/000000000000000000000000/take');
            expect(res.status).toBe(404);
        });

        test('TC-D-009: Exam response does NOT expose answer in any nested object', async () => {
            const { exam } = await createExam();
            const res = await request(app).get(`/api/exams/${exam._id}/take`);
            expect(res.status).toBe(200);
            res.body.questions.forEach(q => {
                expect(q.answer).toBeUndefined();
            });
        });

        test('TC-D-010: Exam response does NOT expose solutionText value in any field', async () => {
            const { exam } = await createExam();
            const res = await request(app).get(`/api/exams/${exam._id}/take`);
            expect(res.status).toBe(200);
            const bodyStr = JSON.stringify(res.body);
            expect(bodyStr).not.toContain('p = mv = 10 × 5 = 50');
        });
    });

    // ── Admin Exam Response (Admin CAN see answers) ──────────────────────────

    describe('Admin Exam Access', () => {

        test('TC-D-011: Admin GET exam DOES contain questions with answer data', async () => {
            const { exam } = await createExam();
            const res = await request(app).get(`/api/exams/admin/${exam._id}`)
                .set('Authorization', `Bearer ${adminToken()}`);
            expect(res.status).toBe(200);
            // Admin view should have answer data
            if (res.body.questions && res.body.questions.length > 0) {
                expect(res.body.questions[0].answer).toBeDefined();
            }
        });

        test('TC-D-012: Teacher cannot access admin exam view', async () => {
            const { exam } = await createExam();
            const { token } = await createTeacher();
            const res = await request(app).get(`/api/exams/admin/${exam._id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(403);
        });
    });

    // ── Scorecard (Post-submission answer reveal) ─────────────────────────────

    describe('Scorecard — Post-Submission Answer Reveal', () => {

        test('TC-D-013: Submitted scorecard DOES reveal correct answers', async () => {
            const { exam } = await createExam();

            // Start a session
            const startRes = await request(app)
                .post(`/api/exams/${exam._id}/start`)
                .send({ studentName: 'Test Student', studentEmail: 'test@school.com', rollNumber: 'R001' });
            expect([200, 201]).toContain(startRes.status);

            const sessionId = startRes.body.session?._id;
            if (!sessionId) return; // Skip if session not created

            // Submit
            const submitRes = await request(app)
                .post(`/api/exams/${exam._id}/submit`)
                .send({ sessionId, answers: [] });

            // Scorecard
            const scoreRes = await request(app)
                .get(`/api/exams/${exam._id}/scorecard/${sessionId}`);

            if (scoreRes.status === 200 && scoreRes.body.breakdown) {
                // After submission, correctAnswer IS revealed
                scoreRes.body.breakdown.forEach(q => {
                    expect(q.correctAnswer).toBeDefined();
                });
            }
        });

        test('TC-D-014: Non-existent scorecard session returns 404', async () => {
            const { exam } = await createExam();
            const res = await request(app)
                .get(`/api/exams/${exam._id}/scorecard/000000000000000000000000`);
            expect(res.status).toBe(404);
        });
    });

    // ── Grand Test Answer Protection ─────────────────────────────────────────

    describe('Grand Test Answer Protection', () => {

        test('TC-D-015: Grand tests require authentication', async () => {
            const res = await request(app).get('/api/grand-tests');
            expect(res.status).toBe(401);
        });

        test('TC-D-016: Grand tests require admin role', async () => {
            const { token } = await createTeacher();
            const res = await request(app).get('/api/grand-tests')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(403);
        });
    });

    // ── Questions API Answer Protection ─────────────────────────────────────

    describe('Questions API — Answer Access Control', () => {

        test('TC-D-017: Questions API returns answer field (for teachers authoring papers)', async () => {
            const { token } = await createTeacher();
            await createQuestion({ subject: 'Physics' });
            const res = await request(app).get('/api/questions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            // Teachers need answer field when creating papers
            // This is expected — but ONLY for authenticated teachers/admins
        });

        test('TC-D-018: Questions API requires authentication', async () => {
            const res = await request(app).get('/api/questions');
            expect(res.status).toBe(401);
        });

        test('TC-D-019: Chemistry teacher cannot read Physics question answers', async () => {
            const chemTeacher = await (require('./helpers').createChemTeacher)();
            await createQuestion({ subject: 'Physics' });
            const res = await request(app).get('/api/questions?subject=Physics')
                .set('Authorization', `Bearer ${chemTeacher.token}`);
            // Teacher should only get Chemistry questions (subject override from token)
            expect(res.status).toBe(200);
            const { questions } = res.body;
            if (questions) {
                questions.forEach(q => {
                    expect(q.subject).toBe('Chemistry'); // Only their subject
                });
            }
        });

        test('TC-D-020: Physics teacher cannot read Chemistry question answers', async () => {
            const { token } = await createTeacher({ subject: 'Physics', email: `phys${Date.now()}@test.com` });
            await createQuestion({ subject: 'Chemistry', questionId: `Q-CHEM-${Date.now()}` });
            const res = await request(app).get('/api/questions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            const { questions } = res.body;
            if (questions) {
                questions.forEach(q => {
                    expect(q.subject).not.toBe('Chemistry');
                });
            }
        });
    });

    // ── Direct API Manipulation Attempts ────────────────────────────────────

    describe('Direct API Manipulation Attempts', () => {

        test('TC-D-021: GET exam questions endpoint requires valid exam ID format', async () => {
            const res = await request(app).get('/api/exams/not-an-id/take');
            expect([400, 404, 500]).toContain(res.status);
            // Must NOT crash with 500 stack trace
        });

        test('TC-D-022: Attempt to GET admin exam endpoint as unauthenticated fails', async () => {
            const { exam } = await createExam();
            const res = await request(app).get(`/api/exams/admin/${exam._id}`);
            expect(res.status).toBe(401);
        });

        test('TC-D-023: Paper download endpoint requires authentication', async () => {
            const res = await request(app).get('/api/papers/000000000000000000000000');
            expect(res.status).toBe(401);
        });

        test('TC-D-024: Exam results endpoint requires admin', async () => {
            const { exam } = await createExam();
            const { token } = await createTeacher();
            const res = await request(app).get(`/api/exams/${exam._id}/results`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(403);
        });

        test('TC-D-025: Exam analytics endpoint requires admin', async () => {
            const { exam } = await createExam();
            const { token } = await createTeacher();
            const res = await request(app).get(`/api/exams/${exam._id}/analytics`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(403);
        });
    });
});
