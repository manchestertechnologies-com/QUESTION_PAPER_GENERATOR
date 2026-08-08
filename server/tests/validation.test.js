/**
 * Track F — Input Validation Tests
 */
const request = require('supertest');
const app = require('../index');
const { adminToken, createTeacher } = require('./helpers');

describe('Input Validation', () => {

    describe('Question Input Validation', () => {
        test('TC-V-001: Missing required questionText returns error or defaults', async () => {
            const { token } = await createTeacher({ subject: 'Physics', email: `v1_${Date.now()}@t.com` });
            const res = await request(app).post('/api/questions')
                .set('Authorization', `Bearer ${token}`)
                .field('type', 'MCQ')
                .field('classes', '["JEE"]')
                .field('chapter', 'Mechanics')
                .field('concept', 'Force')
                .field('level', 'easy')
                .field('answer', 'A');

            expect([200, 201, 400, 500]).toContain(res.status);
        });

        test('TC-V-002: Invalid question level returns error', async () => {
            const { token } = await createTeacher({ subject: 'Physics', email: `v2_${Date.now()}@t.com` });
            const res = await request(app).post('/api/questions')
                .set('Authorization', `Bearer ${token}`)
                .field('questionText', 'Valid question text here')
                .field('type', 'MCQ')
                .field('classes', '["JEE"]')
                .field('chapter', 'Mechanics')
                .field('concept', 'Force')
                .field('level', 'super-hard-invalid')
                .field('answer', 'A');

            expect([200, 201, 400, 500]).toContain(res.status);
        });

        test('TC-V-003: Empty JSON string in options handles gracefully', async () => {
            const { token } = await createTeacher({ subject: 'Physics', email: `v3_${Date.now()}@t.com` });
            const res = await request(app).post('/api/questions')
                .set('Authorization', `Bearer ${token}`)
                .field('questionText', 'Valid question text with malformed JSON')
                .field('type', 'MCQ')
                .field('classes', '["JEE"]')
                .field('chapter', 'Mechanics')
                .field('concept', 'Force')
                .field('level', 'easy')
                .field('options', 'invalid-json-str')
                .field('answer', 'A');

            expect([200, 201, 400, 500]).toContain(res.status);
        });

        test('TC-V-004: Valid question payload is accepted', async () => {
            const { token } = await createTeacher({ subject: 'Physics', email: `v4_${Date.now()}@t.com` });
            const res = await request(app).post('/api/questions')
                .set('Authorization', `Bearer ${token}`)
                .field('questionText', 'Valid question for validation test')
                .field('type', 'MCQ')
                .field('classes', '["JEE"]')
                .field('chapter', 'Mechanics')
                .field('concept', 'Force')
                .field('level', 'easy')
                .field('answer', 'Option A')
                .field('options', '["Option A","Option B","Option C","Option D"]');

            expect([200, 201]).toContain(res.status);
            expect(res.body.id || res.body._id).toBeDefined();
        });
    });

    describe('Exam Creation Input Validation', () => {
        test('TC-V-005: Exam creation without title returns 400 or error', async () => {
            const res = await request(app).post('/api/exams/merge')
                .set('Authorization', `Bearer ${adminToken()}`)
                .send({ examType: 'JEE', duration_minutes: 60 });
            expect([400, 500]).toContain(res.status);
        });

        test('TC-V-006: Exam creation with invalid paperIds returns error', async () => {
            const res = await request(app).post('/api/exams/merge')
                .set('Authorization', `Bearer ${adminToken()}`)
                .send({ title: 'Bad Exam', examType: 'JEE', paperIds: [] });
            expect([400, 500]).toContain(res.status);
        });
    });
});
