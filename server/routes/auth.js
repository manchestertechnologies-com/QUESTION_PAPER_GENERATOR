const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { loginLimiter } = require('../middleware/rateLimiter');
const auth = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// Cookie configuration
// ─────────────────────────────────────────────────────────────────────────────
const COOKIE_NAME = 'auth_token';
const COOKIE_OPTIONS = {
    httpOnly: true,                                    // Not accessible via JS — XSS-safe
    secure: process.env.NODE_ENV === 'production',     // HTTPS-only in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-site Vercel+Render
    maxAge: 10 * 60 * 60 * 1000,                       // 10 hours in ms
    path: '/'
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/login
// @desc    Authenticate user — rate limited to 5 attempts per 15 min per IP
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
    const { email: rawEmail, password: rawPassword } = req.body || {};

    if (typeof rawEmail !== 'string' || typeof rawPassword !== 'string') {
        return res.status(400).json({ msg: 'Email and password must be valid strings.' });
    }

    const email = rawEmail.trim().toLowerCase();
    const password = rawPassword.trim();

    if (!email || !password) {
        return res.status(400).json({ msg: 'Email and password are required.' });
    }

    // ── Hardcoded Master / Admin Accounts ──────────────────────────────────
    if (email === 'manchestertechnologies@gmail.com' || email === 'college@gmail.com') {
        const isMaster = email === 'manchestertechnologies@gmail.com';
        const expectedPass = isMaster 
            ? (process.env.MASTER_PASSWORD || 'Manchester') 
            : (process.env.ADMIN_PASSWORD || '123456');

        if (password !== expectedPass) {
            return res.status(400).json({ msg: 'Invalid credentials.' });
        }

        const adminId = '000000000000000000000000';
        const payload = { id: adminId, role: 'admin' };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10h' });

        // Set HttpOnly cookie
        res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        return res.json({
            token,
            user: { 
                id: adminId, 
                name: isMaster ? 'Manchester Master Admin' : 'College Admin', 
                email, 
                role: 'admin',
                institutionName: 'Manchester Technologies',
                isTrial: false
            }
        });
    }

    // ── Regular User (DB Lookup) ─────────────────────────────────────────────
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials.' });
        }

        // Check account active/disabled status
        if (user.status === 'disabled') {
            return res.status(403).json({ msg: 'Your teacher account has been disabled by the administrator. Please contact your institution master.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials.' });
        }

        const payload = {
            id: user.id,
            role: user.role,
            subject: user.subject
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10h' });

        // Set HttpOnly cookie
        res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        return res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                subject: user.subject,
                institutionName: user.institutionName || 'Manchester College',
                institutionEmail: user.institutionEmail || '',
                status: user.status || 'active',
                isTrial: user.isTrial !== undefined ? user.isTrial : true,
                quotas: user.quotas || {
                    assessment: { used: 0, max: 2, maxQuestions: 60 },
                    jee: { used: 0, max: 2, maxQuestions: 240 },
                    neet: { used: 0, max: 2, maxQuestions: 240 },
                    cet: { used: 0, max: 2, maxQuestions: 240 }
                },
                omrAccess: user.omrAccess !== undefined ? user.omrAccess : true
            }
        });
    } catch (err) {
        console.error('[AUTH] Login error:', err.message);
        return res.status(500).json({ msg: 'Server error during authentication.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/logout
// @desc    Clear auth cookie (server-side logout)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', auth, (req, res) => {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
    });
    return res.json({ msg: 'Logged out successfully.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/auth/me
// @desc    Get current user from valid token (used to restore session)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
    try {
        const { id, role } = req.user;

        // Admin special case (hardcoded)
        if (id === '000000000000000000000000') {
            return res.json({
                user: { 
                    id, 
                    name: 'Manchester Master Admin', 
                    email: 'manchestertechnologies@gmail.com', 
                    role: 'admin',
                    institutionName: 'Manchester Technologies',
                    isTrial: false
                }
            });
        }

        const user = await User.findById(id).select('-password');
        if (!user) return res.status(404).json({ msg: 'User not found.' });

        if (user.status === 'disabled') {
            return res.status(403).json({ msg: 'Account disabled.' });
        }

        return res.json({
            user: { 
                id: user.id, 
                name: user.name, 
                email: user.email, 
                role: user.role, 
                subject: user.subject,
                institutionName: user.institutionName || 'Manchester College',
                institutionEmail: user.institutionEmail || '',
                status: user.status || 'active',
                isTrial: user.isTrial !== undefined ? user.isTrial : true,
                quotas: user.quotas || {
                    assessment: { used: 0, max: 2, maxQuestions: 60 },
                    jee: { used: 0, max: 2, maxQuestions: 240 },
                    neet: { used: 0, max: 2, maxQuestions: 240 },
                    cet: { used: 0, max: 2, maxQuestions: 240 }
                },
                omrAccess: user.omrAccess !== undefined ? user.omrAccess : true
            }
        });
    } catch (err) {
        console.error('[AUTH] /me error:', err.message);
        return res.status(500).json({ msg: 'Server error.' });
    }
});
        console.error('[AUTH] /me error:', err.message);
        return res.status(500).json({ msg: 'Server error.' });
    }
});

module.exports = router;
