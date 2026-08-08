/**
 * server/tests/helpers.js
 * Shared test helpers: user creation, token generation, question creation
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Question = require('../models/Question');

// Ensure JWT_SECRET is set for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only';
process.env.ADMIN_PASSWORD = 'Test@Admin123!';

/**
 * Generate a JWT token for a given payload (for API testing)
 */
function makeToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Admin token (hardcoded admin account)
 */
function adminToken() {
    return makeToken({ id: '000000000000000000000000', role: 'admin' });
}

/**
 * Create a teacher user in the DB and return their token
 */
async function createTeacher(overrides = {}) {
    const defaults = {
        name: 'Test Teacher',
        email: `teacher_${Date.now()}@test.com`,
        password: await bcrypt.hash('password123', 10),
        role: 'teacher',
        subject: 'Physics',
    };
    const user = new User({ ...defaults, ...overrides });
    await user.save();
    const token = makeToken({ id: user.id, role: user.role, subject: user.subject });
    return { user, token };
}

/**
 * Create a Chemistry teacher
 */
async function createChemTeacher() {
    return createTeacher({ subject: 'Chemistry', email: `chem_${Date.now()}@test.com` });
}

/**
 * Create a test question in the DB
 */
async function createQuestion(overrides = {}) {
    const defaults = {
        questionId: `Q-TEST-${Date.now()}`,
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
    const q = new Question({ ...defaults, ...overrides });
    await q.save();
    return q;
}

/**
 * Create multiple questions
 */
async function createQuestions(count = 5, overrides = {}) {
    const questions = [];
    for (let i = 0; i < count; i++) {
        questions.push(await createQuestion({
            questionId: `Q-TEST-${Date.now()}-${i}`,
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
