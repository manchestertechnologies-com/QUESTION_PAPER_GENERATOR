const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const OnlineExam = require('../models/OnlineExam');
const Paper = require('../models/Paper');
const { adminToken, createTeacher } = require('./helpers');

const app = express();
app.use(express.json());
app.use('/api/exams', require('../routes/exams'));

describe('Online Exam Visibility Toggle & Batch Generation Suite', () => {
    let adminAuthToken;

    beforeAll(() => {
        adminAuthToken = adminToken();
    });

    afterEach(async () => {
        await OnlineExam.deleteMany({});
        await Paper.deleteMany({});
    });

    test('1. PUT /api/exams/:id/toggle-online-visibility toggles between live/visible and draft/hidden', async () => {
        // Create an exam in draft state
        const exam = new OnlineExam({
            title: 'Test Visibility Exam',
            examType: 'NEET',
            status: 'draft',
            isOnlineVisible: true,
            duration_minutes: 180,
            questions: [
                {
                    questionText: 'What is force?',
                    options: ['F=ma', 'F=mv', 'F=m/a', 'F=0'],
                    answer: 'F=ma',
                    subject: 'Physics'
                }
            ]
        });
        await exam.save();

        // 1st toggle: exam was draft -> should become live & visible
        const enableRes = await request(app)
            .put(`/api/exams/${exam._id}/toggle-online-visibility`)
            .set('Authorization', `Bearer ${adminAuthToken}`);

        expect(enableRes.status).toBe(200);
        expect(enableRes.body.isOnlineVisible).toBe(true);
        expect(enableRes.body.status).toBe('live');
        expect(enableRes.body.exam.start_time).toBeTruthy();

        // 2nd toggle: exam was live -> should become draft & hidden
        const hideRes = await request(app)
            .put(`/api/exams/${exam._id}/toggle-online-visibility`)
            .set('Authorization', `Bearer ${adminAuthToken}`);

        expect(hideRes.status).toBe(200);
        expect(hideRes.body.isOnlineVisible).toBe(false);
        expect(hideRes.body.status).toBe('draft');
    });

    test('2. GET /api/exams/lab-active returns only visible and non-draft exams', async () => {
        const liveExam = new OnlineExam({
            title: 'Live Lab Exam',
            examType: 'CET',
            status: 'live',
            isOnlineVisible: true,
            duration_minutes: 180
        });
        const hiddenExam = new OnlineExam({
            title: 'Hidden Lab Exam',
            examType: 'JEE',
            status: 'draft',
            isOnlineVisible: false,
            duration_minutes: 180
        });
        await liveExam.save();
        await hiddenExam.save();

        const res = await request(app).get('/api/exams/lab-active');
        expect(res.status).toBe(200);
        expect(res.body.exams).toBeDefined();
        const titles = res.body.exams.map(e => e.title);
        expect(titles).toContain('Live Lab Exam');
        expect(titles).not.toContain('Hidden Lab Exam');
    });

    test('3. POST /api/exams/batch-generate-all-four generates NEET, JEE, CET, and Assessment exams & papers', async () => {
        const res = await request(app)
            .post('/api/exams/batch-generate-all-four')
            .set('Authorization', `Bearer ${adminAuthToken}`)
            .send({
                baseTitle: 'Institution All India Test 2026',
                classes: '12',
                duration_minutes: 180,
                selectedExams: ['NEET', 'JEE', 'CET', 'Assessment']
            });

        expect(res.status).toBe(201);
        expect(res.body.examsCount).toBe(4);
        expect(res.body.papersCount).toBe(4);

        const examTypes = res.body.exams.map(e => e.examType);
        expect(examTypes).toContain('NEET');
        expect(examTypes).toContain('JEE');
        expect(examTypes).toContain('CET');

        // Check that papers and exams were actually saved in MongoDB
        const dbExams = await OnlineExam.find({});
        const dbPapers = await Paper.find({});
        expect(dbExams.length).toBe(4);
        expect(dbPapers.length).toBe(4);

        // All generated exams should default to live and isOnlineVisible = true
        dbExams.forEach(e => {
            expect(e.status).toBe('live');
            expect(e.isOnlineVisible).toBe(true);
        });
    });
});
