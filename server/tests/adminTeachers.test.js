const request = require('supertest');
const app = require('../index');
const User = require('../models/User');
const { adminToken } = require('./helpers');

describe('Admin Teachers API', () => {
    test('TC-A-TEACHER: Admin can create a teacher successfully', async () => {
        const email = `new_teacher_${Date.now()}@manchester.edu`;
        const res = await request(app)
            .post('/api/admin/teachers')
            .set('Authorization', `Bearer ${adminToken()}`)
            .send({
                name: 'Professor Snape',
                email: email,
                password: 'potionsclass123',
                subject: 'Chemistry'
            });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Professor Snape');
        expect(res.body.role).toBe('teacher');
        expect(res.body.subject).toBe('Chemistry');

        // Clean up
        await User.findOneAndDelete({ email });
    });

    test('TC-A-TEACHER-FAIL: Denies access without token', async () => {
        const res = await request(app)
            .post('/api/admin/teachers')
            .send({
                name: 'Professor Lupin',
                email: 'lupin@manchester.edu',
                password: 'defenseclass123',
                subject: 'Biology'
            });

        expect(res.status).toBe(401);
        expect(res.body.msg).toContain('No token, authorization denied.');
    });
});
