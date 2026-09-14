const request = require('supertest');
const app = require('../index');
const User = require('../models/User');
const Paper = require('../models/Paper');
const OnlineExam = require('../models/OnlineExam');
const supabaseQuestions = require('../services/supabaseQuestions');
const { adminToken, makeToken, createTeacher, createQuestion } = require('./helpers');
const bcrypt = require('bcryptjs');

describe('Comprehensive Requirements Test Suite (14 Scenarios)', () => {

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 1: Default Registration No Trial Access
    // ─────────────────────────────────────────────────────────────
    test('TC-01: Default state for newly created user is NO trial access', async () => {
        const email = `new_reg_${Date.now()}@manchester.edu`;
        const user = new User({
            name: 'New Registered Teacher',
            email,
            password: await bcrypt.hash('password123', 10),
            role: 'teacher',
            subject: 'Physics'
        });
        await user.save();

        expect(user.isTrial).toBe(false);
        expect(user.trialStatus).toBe('none');
        expect(user.trialExpiryDate || null).toBeNull();
    });

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 2: Unauthorized User Paper Creation Blocked (403)
    // ─────────────────────────────────────────────────────────────
    test('TC-02: Paper creation is blocked for user without active trial', async () => {
        const { user, token } = await createTeacher({ isTrial: false, trialStatus: 'none', trialExpiryDate: null });
        const q1 = await createQuestion({ subject: 'Physics' });
        const res = await request(app)
            .post('/api/papers')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Unauthorized Test Paper',
                subject: 'Physics',
                targetCount: 1,
                examType: 'CET',
                questions: [q1.id || q1._id]
            });

        expect(res.status).toBe(403);
        expect(res.body.msg || res.body.message).toMatch(/trial access|trial required|trial expired/i);
    });

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 3: Admin Grants 7-Day Trial Access
    // ─────────────────────────────────────────────────────────────
    test('TC-03: Admin grants 7-day trial access to teacher', async () => {
        const { user } = await createTeacher({ isTrial: false, trialStatus: 'none' });
        const res = await request(app)
            .post(`/api/admin/teachers/${user._id}/trial`)
            .set('Authorization', `Bearer ${adminToken()}`)
            .send({ durationDays: 7, reason: '7-Day Evaluator Trial' });

        expect(res.status).toBe(200);
        expect(res.body.teacher.trialStatus).toBe('active');
        expect(res.body.teacher.isTrialActive).toBe(true);
        expect(res.body.teacher.trialDurationDays).toBe(7);
        expect(res.body.teacher.trialDaysRemaining).toBeGreaterThanOrEqual(6);
        expect(res.body.teacher.trialDaysRemaining).toBeLessThanOrEqual(7);
    });

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 4: Admin Grants 15-Day Trial Access
    // ─────────────────────────────────────────────────────────────
    test('TC-04: Admin grants 15-day trial access to teacher', async () => {
        const { user } = await createTeacher({ isTrial: false, trialStatus: 'none' });
        const res = await request(app)
            .post(`/api/admin/teachers/${user._id}/trial`)
            .set('Authorization', `Bearer ${adminToken()}`)
            .send({ durationDays: 15, reason: '15-Day Midterm Trial' });

        expect(res.status).toBe(200);
        expect(res.body.teacher.trialDurationDays).toBe(15);
        expect(res.body.teacher.trialDaysRemaining).toBeGreaterThanOrEqual(14);
        expect(res.body.teacher.trialDaysRemaining).toBeLessThanOrEqual(15);
    });

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 5: Admin Grants 30-Day Trial Access
    // ─────────────────────────────────────────────────────────────
    test('TC-05: Admin grants 30-day trial access to teacher', async () => {
        const { user } = await createTeacher({ isTrial: false, trialStatus: 'none' });
        const res = await request(app)
            .post(`/api/admin/teachers/${user._id}/trial`)
            .set('Authorization', `Bearer ${adminToken()}`)
            .send({ durationDays: 30, reason: 'Monthly Institutional Trial' });

        expect(res.status).toBe(200);
        expect(res.body.teacher.trialDurationDays).toBe(30);
        expect(res.body.teacher.trialDaysRemaining).toBeGreaterThanOrEqual(29);
        expect(res.body.teacher.trialDaysRemaining).toBeLessThanOrEqual(30);
    });

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 6: Admin Grants Custom Duration Trial Access (45 Days)
    // ─────────────────────────────────────────────────────────────
    test('TC-06: Admin grants custom duration trial access (45 days)', async () => {
        const { user } = await createTeacher({ isTrial: false, trialStatus: 'none' });
        const res = await request(app)
            .post(`/api/admin/teachers/${user._id}/trial`)
            .set('Authorization', `Bearer ${adminToken()}`)
            .send({ durationDays: 45, reason: 'Custom Semester Trial' });

        expect(res.status).toBe(200);
        expect(res.body.teacher.trialDurationDays).toBe(45);
        expect(res.body.teacher.trialDaysRemaining).toBeGreaterThanOrEqual(44);
        expect(res.body.teacher.trialDaysRemaining).toBeLessThanOrEqual(45);
    });

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 7: Admin Extends Active Trial
    // ─────────────────────────────────────────────────────────────
    test('TC-07: Admin extends trial access by additional days', async () => {
        const { user } = await createTeacher({
            isTrial: true,
            trialStatus: 'active',
            trialStartDate: new Date(),
            trialExpiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            trialDurationDays: 10
        });

        const res = await request(app)
            .patch(`/api/admin/teachers/${user._id}/trial/extend`)
            .set('Authorization', `Bearer ${adminToken()}`)
            .send({ additionalDays: 15, reason: 'Extended evaluation' });

        expect(res.status).toBe(200);
        expect(res.body.teacher.trialDaysRemaining).toBeGreaterThanOrEqual(24);
    });

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 8: Admin Revokes Trial Access
    // ─────────────────────────────────────────────────────────────
    test('TC-08: Admin revokes trial access immediately', async () => {
        const { user } = await createTeacher({
            isTrial: true,
            trialStatus: 'active',
            trialStartDate: new Date(),
            trialExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            trialDurationDays: 30
        });

        const res = await request(app)
            .patch(`/api/admin/teachers/${user._id}/trial/revoke`)
            .set('Authorization', `Bearer ${adminToken()}`)
            .send({ reason: 'Evaluation ended by administrator' });

        expect(res.status).toBe(200);
        expect(res.body.teacher.trialStatus).toBe('revoked');
        expect(res.body.teacher.isTrialActive).toBe(false);
    });

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 9: Revoked / Expired Trial Blocks Paper Creation
    // ─────────────────────────────────────────────────────────────
    test('TC-09: Revoked trial immediately blocks paper creation', async () => {
        const { token } = await createTeacher({
            isTrial: true,
            trialStatus: 'revoked',
            trialExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
        const q1 = await createQuestion({ subject: 'Physics' });
        const res = await request(app)
            .post('/api/papers')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Revoked Attempt Paper',
                subject: 'Physics',
                targetCount: 1,
                examType: 'CET',
                questions: [q1.id || q1._id]
            });

        expect(res.status).toBe(403);
        expect(res.body.msg || res.body.message).toMatch(/trial access|trial required|trial revoked|trial expired/i);
    });

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 10: Question Usage Count Tracking
    // ─────────────────────────────────────────────────────────────
    test('TC-10: System accurately tracks question usage counts and timestamps', async () => {
        const q = await createQuestion({
            subject: 'Physics',
            questionText: 'Usage Tracking Question Verification'
        });
        const qId = q.id || q._id;

        // Record usage twice
        await supabaseQuestions.recordQuestionUsage(
            [qId],
            'paper_midterm_1',
            'teacher_1',
            'Prof. Manchester',
            'Midterm Exam 2026',
            '2026-03-15'
        );

        await supabaseQuestions.recordQuestionUsage(
            [qId],
            'paper_final_1',
            'teacher_1',
            'Prof. Manchester',
            'Final Exam 2026',
            '2026-04-20'
        );

        const fetched = await supabaseQuestions.getQuestionById(qId);
        expect(fetched.usedCount).toBeGreaterThanOrEqual(2);
        expect(fetched.timesUsed).toBeGreaterThanOrEqual(2);
        expect(fetched.lastUsedExam).toBe('Final Exam 2026');
        expect(fetched.lastUsedTeacher).toBe('Prof. Manchester');
        expect(fetched.firstUsedAt).toBeTruthy();
        expect(fetched.lastUsedAt).toBeTruthy();
    });

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 11: Teacher Question Repeat Interval Status
    // ─────────────────────────────────────────────────────────────
    test('TC-11: Teacher question repeat interval correctly calculates IN REPEAT PERIOD vs AVAILABLE', () => {
        const now = new Date();
        const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
        const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();

        // 1. Question used 10 days ago with 30-day repeat interval -> IN REPEAT PERIOD
        const qRecent = supabaseQuestions.mapSupabaseToQuestion({
            id: '11111111-1111-1111-1111-111111111111',
            question_text: 'Recent Question',
            options: ['A', 'B', 'C', 'D'],
            correct_option: 'A',
            last_used_at: tenDaysAgo,
            repeat_days: 30,
            used_count: 1
        });

        expect(qRecent.repeatStatus).toBe('IN REPEAT PERIOD');
        expect(qRecent.nextEligibleDate).toBeTruthy();

        // 2. Question used 40 days ago with 30-day repeat interval -> AVAILABLE
        const qOld = supabaseQuestions.mapSupabaseToQuestion({
            id: '22222222-2222-2222-2222-222222222222',
            question_text: 'Old Question',
            options: ['A', 'B', 'C', 'D'],
            correct_option: 'B',
            last_used_at: fortyDaysAgo,
            repeat_days: 30,
            used_count: 1
        });

        expect(qOld.repeatStatus).toBe('AVAILABLE');
    });

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 12: Non-Destructive Multi-Paper Merge (PCMB / NEET / JEE)
    // ─────────────────────────────────────────────────────────────
    test('TC-12: Non-destructive merging creates sections and new paper without modifying source papers', async () => {
        const { user, token } = await createTeacher({
            isTrial: true,
            trialStatus: 'active',
            trialStartDate: new Date(),
            trialExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            trialDurationDays: 30
        });

        // Create individual subject papers
        const qPhysics = await createQuestion({ subject: 'Physics', questionText: 'Physics Q1' });
        const qChemistry = await createQuestion({ subject: 'Chemistry', questionText: 'Chemistry Q1' });
        const qMath = await createQuestion({ subject: 'Mathematics', questionText: 'Math Q1' });
        const qBio = await createQuestion({ subject: 'Biology', questionText: 'Biology Q1' });

        const physicsPaper = new Paper({
            title: 'Physics Test Paper',
            subject: 'Physics',
            examType: 'NEET',
            totalMarks: 4,
            duration: '45 mins',
            questions: [qPhysics],
            teacherId: user._id.toString()
        });
        await physicsPaper.save();

        const chemistryPaper = new Paper({
            title: 'Chemistry Test Paper',
            subject: 'Chemistry',
            examType: 'NEET',
            totalMarks: 4,
            duration: '45 mins',
            questions: [qChemistry],
            teacherId: user._id.toString()
        });
        await chemistryPaper.save();

        const mathPaper = new Paper({
            title: 'Mathematics Test Paper',
            subject: 'Mathematics',
            examType: 'JEE',
            totalMarks: 4,
            duration: '45 mins',
            questions: [qMath],
            teacherId: user._id.toString()
        });
        await mathPaper.save();

        const biologyPaper = new Paper({
            title: 'Biology Test Paper',
            subject: 'Biology',
            examType: 'NEET',
            totalMarks: 4,
            duration: '45 mins',
            questions: [qBio],
            teacherId: user._id.toString()
        });
        await biologyPaper.save();

        // Merge all 4 into a PCMB Grand Mock Paper
        const res = await request(app)
            .post('/api/papers/merge')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Comprehensive Test PCMB Grand Mock',
                duration: '180 Minutes',
                sections: [
                    { title: 'Section A: Physics', subject: 'Physics', paperId: physicsPaper._id.toString() },
                    { title: 'Section B: Chemistry', subject: 'Chemistry', paperId: chemistryPaper._id.toString() },
                    { title: 'Section C: Mathematics', subject: 'Mathematics', paperId: mathPaper._id.toString() },
                    { title: 'Section D: Biology', subject: 'Biology', paperId: biologyPaper._id.toString() }
                ]
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.paper).toBeTruthy();
        expect(res.body.paper.questions.length).toBe(4);
        expect(res.body.paper.isMerged).toBe(true);
        expect(res.body.paper.sections.length).toBe(4);

        // Verify NON-DESTRUCTIVE: All 4 source papers still exist completely intact!
        const checkPhys = await Paper.findById(physicsPaper._id);
        const checkChem = await Paper.findById(chemistryPaper._id);
        const checkMath = await Paper.findById(mathPaper._id);
        const checkBio = await Paper.findById(biologyPaper._id);

        expect(checkPhys).toBeTruthy();
        expect(checkPhys.title).toBe('Physics Test Paper');
        expect(checkChem).toBeTruthy();
        expect(checkChem.title).toBe('Chemistry Test Paper');
        expect(checkMath).toBeTruthy();
        expect(checkMath.title).toBe('Mathematics Test Paper');
        expect(checkBio).toBeTruthy();
        expect(checkBio.title).toBe('Biology Test Paper');
    });

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 13: Synchronized Answer Key & Solutions on Merged Paper
    // ─────────────────────────────────────────────────────────────
    test('TC-13: Merged paper preserves synchronized answer keys and solutions matching reordered sections', async () => {
        const { user, token } = await createTeacher({
            isTrial: true,
            trialStatus: 'active',
            trialStartDate: new Date(),
            trialExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            trialDurationDays: 30
        });

        const qPhysics = await createQuestion({ subject: 'Physics', questionText: 'Physics Q1', answer: '50 kg·m/s' });
        const qChemistry = await createQuestion({ subject: 'Chemistry', questionText: 'Chemistry Q1', answer: 'H2O' });

        const p1 = new Paper({
            title: 'Physics Source',
            subject: 'Physics',
            questions: [qPhysics],
            teacherId: user._id.toString()
        });
        await p1.save();

        const p2 = new Paper({
            title: 'Chemistry Source',
            subject: 'Chemistry',
            questions: [qChemistry],
            teacherId: user._id.toString()
        });
        await p2.save();

        const res = await request(app)
            .post('/api/papers/merge')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Synced Key Merged Paper',
                sections: [
                    { title: 'Section A: Physics', subject: 'Physics', paperId: p1._id.toString() },
                    { title: 'Section B: Chemistry', subject: 'Chemistry', paperId: p2._id.toString() }
                ]
            });

        expect(res.status).toBe(201);
        const merged = res.body.paper;
        expect(merged.questions[0].questionText).toBe('Physics Q1');
        expect(merged.questions[0].answer).toBe('50 kg·m/s');
        expect(merged.questions[0].sectionName).toBe('Section A: Physics');

        expect(merged.questions[1].questionText).toBe('Chemistry Q1');
        expect(merged.questions[1].answer).toBe('H2O');
        expect(merged.questions[1].sectionName).toBe('Section B: Chemistry');
    });

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 14: CBT Online Exam Created for Merged Paper
    // ─────────────────────────────────────────────────────────────
    test('TC-14: Merged paper automatically creates a linked CBT Online Exam', async () => {
        const { user, token } = await createTeacher({
            isTrial: true,
            trialStatus: 'active',
            trialStartDate: new Date(),
            trialExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            trialDurationDays: 30
        });

        const qBio = await createQuestion({ subject: 'Biology', questionText: 'Bio Q1' });
        const p = new Paper({
            title: 'Bio Source',
            subject: 'Biology',
            questions: [qBio],
            teacherId: user._id.toString()
        });
        await p.save();

        const res = await request(app)
            .post('/api/papers/merge')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Online CBT Merged Paper',
                duration: '180 Minutes',
                sections: [
                    { title: 'Section A: Biology', subject: 'Biology', paperId: p._id.toString() }
                ]
            });

        expect(res.status).toBe(201);
        expect(res.body.paper.onlineExamId).toBeTruthy();

        const exam = await OnlineExam.findById(res.body.paper.onlineExamId);
        expect(exam).toBeTruthy();
        expect(exam.title).toBe('Online CBT Merged Paper');
        expect(exam.accessCode).toBeTruthy();
        expect(exam.durationMinutes).toBe(180);
    });
});
