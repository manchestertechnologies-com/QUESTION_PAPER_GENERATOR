/**
 * server/tests/helpers.js
 * Shared test helpers for Supabase question bank and JWT tokens
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const supabaseQuestions = require('../services/supabaseQuestions');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only';
process.env.ADMIN_PASSWORD = 'Test@Admin123!';

function makeToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function adminToken() {
    return makeToken({ id: '000000000000000000000000', role: 'admin' });
}

async function createTeacher(overrides = {}) {
    const defaults = {
        name: 'Test Teacher',
        email: `teacher_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
        password: await bcrypt.hash('password123', 10),
        role: 'teacher',
        subject: 'Physics',
    };
    const user = new User({ ...defaults, ...overrides });
    await user.save();
    const token = makeToken({ id: user.id, role: user.role, subject: user.subject });
    return { user, token };
}

async function createChemTeacher() {
    return createTeacher({ subject: 'Chemistry', email: `chem_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com` });
}

async function createQuestion(overrides = {}) {
    const defaults = {
        subject: 'Physics',
        classes: ['JEE'],
        chapter: 'Mechanics',
        concept: 'Newton Laws',
        level: 'medium',
        type: 'MCQ',
        questionText: 'A body of mass 10 kg is moving with velocity 5 m/s. What is its momentum?',
        options: ['10 kg·m/s', '50 kg·m/s', '5 kg·m/s', '0 kg·m/s'],
        answer: '50 kg·m/s',
        solutionText: 'p = mv = 10 × 5 = 50 kg·m/s',
    };

    const questionData = { ...defaults, ...overrides };
    const q = await supabaseQuestions.createQuestion(questionData, '000000000000000000000000', 'Test Admin');
    return q;
}

async function createQuestions(count = 5, overrides = {}) {
    const questions = [];
    for (let i = 0; i < count; i++) {
        questions.push(await createQuestion({
            questionText: `Test question ${i + 1}`,
            ...overrides
        }));
    }
    return questions;
}

module.exports = {
    makeToken,
    adminToken,
    createTeacher,
    createChemTeacher,
    createQuestion,
    createQuestions,
};
