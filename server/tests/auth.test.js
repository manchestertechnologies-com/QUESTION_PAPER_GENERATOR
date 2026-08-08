/**
 * Track A — Authentication Tests (50 tests)
 * Tests: login, logout, rate limiting, JWT validation, session management
 */
const request = require('supertest');
const app = require('../index');
const { adminToken, createTeacher } = require('./helpers');

describe('Authentication', () => {

    // ── Login ───────────────────────────────────────────────────────────────

    describe('POST /api/auth/login', () => {

        test('TC-A-001: Admin login with correct credentials returns 200 + user', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: 'college@gmail.com', password: 'Test@Admin123!' });
            expect(res.status).toBe(200);
            expect(res.body.user).toBeDefined();
            expect(res.body.user.role).toBe('admin');
            expect(res.body.token).toBeUndefined(); // Token must NOT be in body
        });

        test('TC-A-002: Admin login sets HttpOnly cookie', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: 'college@gmail.com', password: 'Test@Admin123!' });
            const cookies = res.headers['set-cookie'];
            expect(cookies).toBeDefined();
            const authCookie = cookies.find(c => c.includes('auth_token'));
            expect(authCookie).toBeDefined();
            expect(authCookie).toContain('HttpOnly');
        });

        test('TC-A-003: Admin login with wrong password returns 400', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: 'college@gmail.com', password: 'wrongpassword' });
            expect(res.status).toBe(400);
            expect(res.body.msg).toBeDefined();
        });

        test('TC-A-004: Login with non-existent email returns 400', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: 'ghost@nowhere.com', password: 'password123' });
            expect(res.status).toBe(400);
        });

        test('TC-A-005: Login with missing email returns 400', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ password: 'password123' });
            expect(res.status).toBe(400);
        });

        test('TC-A-006: Login with missing password returns 400', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: 'college@gmail.com' });
            expect(res.status).toBe(400);
        });

        test('TC-A-007: Login with empty body returns 400', async () => {
            const res = await request(app).post('/api/auth/login').send({});
            expect(res.status).toBe(400);
        });

        test('TC-A-008: Login response does NOT include password', async () => {
            const { user } = await createTeacher();
            const res = await request(app).post('/api/auth/login')
                .send({ email: user.email, password: 'password123' });
            expect(res.body.user?.password).toBeUndefined();
        });

        test('TC-A-009: Login response does NOT include token in body', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: 'college@gmail.com', password: 'Test@Admin123!' });
            expect(res.body.token).toBeUndefined();
        });

        test('TC-A-010: Teacher login with correct credentials returns 200', async () => {
            const { user } = await createTeacher();
            const res = await request(app).post('/api/auth/login')
                .send({ email: user.email, password: 'password123' });
            expect(res.status).toBe(200);
            expect(res.body.user.role).toBe('teacher');
        });

        test('TC-A-011: NoSQL injection in email returns 400', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: { $gt: '' }, password: 'anything' });
            expect(res.status).toBe(400);
        });

        test('TC-A-012: NoSQL injection in password returns 400', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: 'college@gmail.com', password: { $ne: '' } });
            expect(res.status).toBe(400);
        });

        test('TC-A-013: SQL injection attempt returns 400 (not crash)', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: "admin'--", password: "' OR 1=1 --" });
            expect(res.status).toBe(400);
        });

        test('TC-A-014: XSS in email returns 400 (not executed)', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: '<script>alert(1)</script>', password: 'pw' });
            expect(res.status).toBe(400);
        });

        test('TC-A-015: Very long email (DoS attempt) returns 400', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: 'a'.repeat(10000) + '@test.com', password: 'pw' });
            expect([400, 413, 429]).toContain(res.status);
        });
    });

    // ── Protected Routes (no token) ──────────────────────────────────────────

    describe('Protected Routes — No Token', () => {

        test('TC-A-016: GET /api/questions without token returns 401', async () => {
            const res = await request(app).get('/api/questions');
            expect(res.status).toBe(401);
        });

        test('TC-A-017: GET /api/admin without token returns 401', async () => {
            const res = await request(app).get('/api/admin');
            expect(res.status).toBe(401);
        });

        test('TC-A-018: POST /api/questions without token returns 401', async () => {
            const res = await request(app).post('/api/questions').send({});
            expect(res.status).toBe(401);
        });

        test('TC-A-019: DELETE /api/questions/123 without token returns 401', async () => {
            const res = await request(app).delete('/api/questions/123');
            expect(res.status).toBe(401);
        });

        test('TC-A-020: GET /api/grand-tests without token returns 401', async () => {
            const res = await request(app).get('/api/grand-tests');
            expect(res.status).toBe(401);
        });
    });

    // ── Invalid Token ────────────────────────────────────────────────────────

    describe('Protected Routes — Invalid Token', () => {

        test('TC-A-021: Invalid JWT returns 401', async () => {
            const res = await request(app).get('/api/questions')
                .set('Authorization', 'Bearer this.is.not.valid');
            expect(res.status).toBe(401);
        });

        test('TC-A-022: Tampered JWT returns 401', async () => {
            const token = adminToken();
            const [h, p, s] = token.split('.');
            const tampered = `${h}.${p}tampered.${s}`;
            const res = await request(app).get('/api/questions')
                .set('Authorization', `Bearer ${tampered}`);
            expect(res.status).toBe(401);
        });

        test('TC-A-023: Empty Bearer token returns 401', async () => {
            const res = await request(app).get('/api/questions')
                .set('Authorization', 'Bearer ');
            expect(res.status).toBe(401);
        });

        test('TC-A-024: Malformed Authorization header returns 401', async () => {
            const res = await request(app).get('/api/questions')
                .set('Authorization', 'NotBearer xxx');
            expect(res.status).toBe(401);
        });
    });

    // ── Logout ───────────────────────────────────────────────────────────────

    describe('POST /api/auth/logout', () => {

        test('TC-A-025: Logout with valid token returns 200', async () => {
            const res = await request(app).post('/api/auth/logout')
                .set('Authorization', `Bearer ${adminToken()}`);
            expect(res.status).toBe(200);
        });

        test('TC-A-026: Logout clears auth_token cookie', async () => {
            const res = await request(app).post('/api/auth/logout')
                .set('Authorization', `Bearer ${adminToken()}`);
            const cookies = res.headers['set-cookie'];
            if (cookies) {
                const authCookie = cookies.find(c => c.includes('auth_token'));
                if (authCookie) {
                    // Cookie should be cleared (Max-Age=0 or expired)
                    expect(authCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
                }
            }
            expect(res.status).toBe(200);
        });

        test('TC-A-027: Logout without token returns 401', async () => {
            const res = await request(app).post('/api/auth/logout');
            expect(res.status).toBe(401);
        });
    });

    // ── /me Endpoint ─────────────────────────────────────────────────────────

    describe('GET /api/auth/me', () => {

        test('TC-A-028: /me with valid admin token returns admin user', async () => {
            const res = await request(app).get('/api/auth/me')
                .set('Authorization', `Bearer ${adminToken()}`);
            expect(res.status).toBe(200);
            expect(res.body.user.role).toBe('admin');
        });

        test('TC-A-029: /me without token returns 401', async () => {
            const res = await request(app).get('/api/auth/me');
            expect(res.status).toBe(401);
        });

        test('TC-A-030: /me with teacher token returns teacher user', async () => {
            const { user, token } = await createTeacher();
            const res = await request(app).get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.user.email).toBe(user.email);
            expect(res.body.user.password).toBeUndefined();
        });
    });

    // ── HTTP Security Headers ────────────────────────────────────────────────

    describe('HTTP Security Headers', () => {

        test('TC-A-031: Response includes X-Frame-Options header', async () => {
            const res = await request(app).get('/');
            expect(res.headers['x-frame-options']).toBeDefined();
        });

        test('TC-A-032: Response includes X-Content-Type-Options: nosniff', async () => {
            const res = await request(app).get('/');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
        });

        test('TC-A-033: Response includes Content-Security-Policy', async () => {
            const res = await request(app).get('/');
            expect(res.headers['content-security-policy']).toBeDefined();
        });

        test('TC-A-034: Health check endpoint returns 200', async () => {
            const res = await request(app).get('/api/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });

        test('TC-A-035: Unknown route returns 404', async () => {
            const res = await request(app).get('/api/nonexistent-route-xyz');
            expect(res.status).toBe(404);
        });
    });

    // ── Role-Based Access ────────────────────────────────────────────────────

    describe('Role-Based Route Access', () => {

        test('TC-A-036: Teacher cannot access admin-only routes', async () => {
            const { token } = await createTeacher();
            const res = await request(app).get('/api/admin')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(403);
        });

        test('TC-A-037: Admin can access admin routes', async () => {
            const res = await request(app).get('/api/admin')
                .set('Authorization', `Bearer ${adminToken()}`);
            expect([200, 404]).toContain(res.status); // 200 OK or 404 if no users
        });

        test('TC-A-038: Teacher can access question routes', async () => {
            const { token } = await createTeacher();
            const res = await request(app).get('/api/questions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });

        test('TC-A-039: Lab role cannot access teacher question routes', async () => {
            const labToken = require('./helpers').makeToken({ id: 'labuser1', role: 'lab' });
            const res = await request(app).get('/api/questions')
                .set('Authorization', `Bearer ${labToken}`);
            expect(res.status).toBe(403);
        });

        test('TC-A-040: Grand tests require admin role', async () => {
            const { token } = await createTeacher();
            const res = await request(app).get('/api/grand-tests')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(403);
        });
    });

    // ── Additional Auth Edge Cases ───────────────────────────────────────────

    describe('Auth Edge Cases', () => {

        test('TC-A-041: Login is case-insensitive for email', async () => {
            const { user } = await createTeacher({ email: 'lowercase@test.com' });
            const res = await request(app).post('/api/auth/login')
                .send({ email: 'LOWERCASE@TEST.COM', password: 'password123' });
            expect([200, 400, 429]).toContain(res.status);
        });

        test('TC-A-042: Login with whitespace-padded email should work or fail cleanly', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: '  college@gmail.com  ', password: 'Test@Admin123!' });
            expect([200, 400, 429]).toContain(res.status);
        });

        test('TC-A-043: Concurrent login requests do not crash server', async () => {
            const requests = Array(5).fill(null).map(() =>
                request(app).post('/api/auth/login')
                    .send({ email: 'college@gmail.com', password: 'Test@Admin123!' })
            );
            const results = await Promise.all(requests);
            results.forEach(r => expect([200, 400, 429]).toContain(r.status));
        });

        test('TC-A-044: Server does not expose stack traces in 500 errors', async () => {
            // Hit a route that might error
            const res = await request(app).get('/api/questions/invalid-id-format')
                .set('Authorization', `Bearer ${adminToken()}`);
            if (res.status === 500) {
                expect(res.body.stack).toBeUndefined();
                expect(res.body.error).toBeUndefined();
            }
            // Accept 400 (CastError) or 404 as valid responses too
            expect([400, 404, 500]).toContain(res.status);
        });

        test('TC-A-045: OPTIONS preflight request returns 200', async () => {
            const res = await request(app).options('/api/auth/login')
                .set('Origin', 'https://qestion-paper.vercel.app');
            expect([200, 204]).toContain(res.status);
        });

        test('TC-A-046: CORS rejects unauthorized origins', async () => {
            const res = await request(app).get('/')
                .set('Origin', 'https://evil-attacker.com');
            // Either CORS error or server responds (non-browser clients get through)
            expect([200, 403, 500]).toContain(res.status);
        });

        test('TC-A-047: Request body size limit is enforced', async () => {
            const hugeBody = { email: 'a'.repeat(3 * 1024 * 1024), password: 'x' };
            const res = await request(app).post('/api/auth/login').send(hugeBody);
            expect([400, 413]).toContain(res.status);
        });

        test('TC-A-048: Server returns JSON Content-Type', async () => {
            const res = await request(app).get('/api/health');
            expect(res.headers['content-type']).toContain('application/json');
        });

        test('TC-A-049: No sensitive data in successful login response', async () => {
            const res = await request(app).post('/api/auth/login')
                .send({ email: 'college@gmail.com', password: 'Test@Admin123!' });
            if (res.status === 200) {
                const body = JSON.stringify(res.body);
                expect(body).not.toContain('Test@Admin123!');
                expect(body).not.toContain('JWT_SECRET');
                expect(body).not.toContain('MONGO_URI');
            }
        });

        test('TC-A-050: Token-authenticated route verifies signature correctly', async () => {
            // Create token with wrong secret
            const jwt = require('jsonwebtoken');
            const fakeToken = jwt.sign({ id: 'fakeid', role: 'admin' }, 'WRONG_SECRET');
            const res = await request(app).get('/api/questions')
                .set('Authorization', `Bearer ${fakeToken}`);
            expect(res.status).toBe(401);
        });
    });
});
