/**
 * Track C + E — Security Tests: XSS, NoSQL Injection, Rate Limiting, Headers
 */
const request = require('supertest');
const app = require('../index');
const { adminToken, createTeacher, createQuestion } = require('./helpers');

describe('Security — XSS, Injection, Headers', () => {

    // ── HTTP Security Headers ─────────────────────────────────────────────────

    describe('HTTP Security Headers (helmet)', () => {

        test('TC-S-001: X-Frame-Options header is present', async () => {
            const res = await request(app).get('/');
            expect(res.headers['x-frame-options']).toBeDefined();
        });

        test('TC-S-002: X-Content-Type-Options: nosniff is present', async () => {
            const res = await request(app).get('/');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
        });

        test('TC-S-003: Content-Security-Policy header is present', async () => {
            const res = await request(app).get('/');
            expect(res.headers['content-security-policy']).toBeDefined();
        });

        test('TC-S-004: X-Powered-By header is suppressed', async () => {
            const res = await request(app).get('/');
            // helmet suppresses X-Powered-By by default
            expect(res.headers['x-powered-by']).toBeUndefined();
        });

        test('TC-S-005: Server header does not expose technology details', async () => {
            const res = await request(app).get('/');
            // Should not say 'Express'
            const server = res.headers['server'];
            if (server) {
                expect(server.toLowerCase()).not.toContain('express');
            }
        });
    });

    // ── NoSQL Injection Protection ────────────────────────────────────────────

    describe('NoSQL Injection Protection', () => {

        test('TC-S-006: NoSQL injection in login email is sanitized', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: { $gt: '' }, password: 'anything' });
            expect(res.status).toBe(400);
        });

        test('TC-S-007: NoSQL $where operator is stripped from query', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: 'college@gmail.com', password: { $where: 'this.password.length > 0' } });
            expect(res.status).toBe(400);
        });

        test('TC-S-008: NoSQL $regex injection in login is blocked', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: { $regex: '.*' }, password: { $regex: '.*' } });
            expect(res.status).toBe(400);
        });

        test('TC-S-009: NoSQL injection in question query parameter is sanitized', async () => {
            const { token } = await createTeacher({ subject: 'Physics', email: `nosql_${Date.now()}@t.com` });
            const res = await request(app)
                .get('/api/questions?chapter[$gt]=')
                .set('Authorization', `Bearer ${token}`);
            // Should not crash, should return 200 or 400
            expect([200, 400]).toContain(res.status);
        });

        test('TC-S-010: Object injection in request body does not crash server', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: { constructor: { name: 'String' } }, password: 'pw' });
            expect([400, 500]).toContain(res.status);
            // Must not return 200
            expect(res.status).not.toBe(200);
        });
    });

    // ── XSS Protection ───────────────────────────────────────────────────────

    describe('XSS Protection', () => {

        test('TC-S-011: Script tag in question text is not stored as-is (sanitized)', async () => {
            const { token } = await createTeacher({ subject: 'Physics', email: `xss1_${Date.now()}@t.com` });

            const xssPayload = '<script>alert("xss")</script>What is momentum?';
            const res = await request(app).post('/api/questions')
                .set('Authorization', `Bearer ${token}`)
                .field('questionText', xssPayload)
                .field('type', 'MCQ')
                .field('classes', '["JEE"]')
                .field('chapter', 'Mechanics')
                .field('concept', 'Momentum')
                .field('level', 'easy')
                .field('answer', 'Option A')
                .field('options', '["Option A","B","C","D"]');

            if (res.status === 200 || res.status === 201) {
                // Sanitized — script tag should not appear
                expect(res.body.questionText).not.toContain('<script>');
                expect(res.body.questionText).not.toContain('alert("xss")');
            }
        });

        test('TC-S-012: onerror attribute XSS in question text is removed', async () => {
            const { token } = await createTeacher({ subject: 'Physics', email: `xss2_${Date.now()}@t.com` });

            const xssPayload = '<img src="x" onerror="alert(1)">What is velocity?';
            const res = await request(app).post('/api/questions')
                .set('Authorization', `Bearer ${token}`)
                .field('questionText', xssPayload)
                .field('type', 'MCQ')
                .field('classes', '["JEE"]')
                .field('chapter', 'Mechanics')
                .field('concept', 'Velocity')
                .field('level', 'medium')
                .field('answer', 'Option A')
                .field('options', '["Option A","B","C","D"]');

            if (res.status === 200 || res.status === 201) {
                expect(res.body.questionText).not.toContain('onerror');
                expect(res.body.questionText).not.toContain('alert(1)');
            }
        });

        test('TC-S-013: javascript: URI in question is stripped', async () => {
            const { token } = await createTeacher({ subject: 'Physics', email: `xss3_${Date.now()}@t.com` });

            const xssPayload = '<a href="javascript:alert(1)">Click</a>What is force?';
            const res = await request(app).post('/api/questions')
                .set('Authorization', `Bearer ${token}`)
                .field('questionText', xssPayload)
                .field('type', 'MCQ')
                .field('classes', '["JEE"]')
                .field('chapter', 'Mechanics')
                .field('concept', 'Force')
                .field('level', 'easy')
                .field('answer', 'Option A')
                .field('options', '["Option A","B","C","D"]');

            if (res.status === 200 || res.status === 201) {
                expect(res.body.questionText).not.toContain('javascript:');
            }
        });

        test('TC-S-014: XSS in option text is sanitized', async () => {
            const { token } = await createTeacher({ subject: 'Physics', email: `xss4_${Date.now()}@t.com` });

            const res = await request(app).post('/api/questions')
                .set('Authorization', `Bearer ${token}`)
                .field('questionText', 'Normal question text')
                .field('type', 'MCQ')
                .field('classes', '["JEE"]')
                .field('chapter', 'Mechanics')
                .field('concept', 'XSS')
                .field('level', 'easy')
                .field('answer', 'Option A')
                .field('options', JSON.stringify([
                    'Option A',
                    '<script>evil()</script>Option B',
                    'Option C',
                    'Option D'
                ]));

            if (res.status === 200 || res.status === 201) {
                const opts = res.body.options || [];
                opts.forEach(o => {
                    expect(o).not.toContain('<script>');
                });
            }
        });

        test('TC-S-015: Stored XSS in solution text is sanitized', async () => {
            const { token } = await createTeacher({ subject: 'Physics', email: `xss5_${Date.now()}@t.com` });

            const xssPayload = 'Solution step 1 <iframe src="//evil.com"></iframe>';
            const res = await request(app).post('/api/questions')
                .set('Authorization', `Bearer ${token}`)
                .field('questionText', 'What is KE?')
                .field('type', 'MCQ')
                .field('classes', '["JEE"]')
                .field('chapter', 'Mechanics')
                .field('concept', 'Energy')
                .field('level', 'easy')
                .field('answer', 'Option A')
                .field('options', '["Option A","B","C","D"]')
                .field('solutionText', xssPayload);

            if (res.status === 200 || res.status === 201) {
                expect(res.body.solutionText).not.toContain('<iframe');
                expect(res.body.solutionText).not.toContain('evil.com');
            }
        });
    });

    // ── Information Disclosure ────────────────────────────────────────────────

    describe('Information Disclosure Prevention', () => {

        test('TC-S-016: 500 errors do not expose stack traces', async () => {
            const res = await request(app).get('/api/questions/invalid!!id!!')
                .set('Authorization', `Bearer ${adminToken()}`);
            if (res.status >= 400) {
                expect(res.body.stack).toBeUndefined();
                expect(res.body.at).toBeUndefined();
            }
        });

        test('TC-S-017: Error responses do not expose MONGO_URI', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: 'bad@bad.com', password: 'bad' });
            const bodyStr = JSON.stringify(res.body);
            expect(bodyStr).not.toContain('mongodb');
            expect(bodyStr).not.toContain('MONGO_URI');
        });

        test('TC-S-018: Error responses do not expose JWT_SECRET', async () => {
            const res = await request(app).get('/api/questions/000000000000000000000000')
                .set('Authorization', `Bearer invalid.token.here`);
            const bodyStr = JSON.stringify(res.body);
            expect(bodyStr).not.toContain('JWT_SECRET');
            expect(bodyStr).not.toContain('test-jwt-secret');
        });

        test('TC-S-019: 404 does not expose route details', async () => {
            const res = await request(app).get('/api/does-not-exist-route');
            expect(res.status).toBe(404);
            expect(res.body.stack).toBeUndefined();
        });

        test('TC-S-020: Admin password not leaked in any response', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: 'college@gmail.com', password: 'Test@Admin123!' });
            const bodyStr = JSON.stringify(res.body);
            expect(bodyStr).not.toContain('Test@Admin123!');
        });
    });
});
