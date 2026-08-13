const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

const supabase = require('../config/supabase');

// @route   GET /api/admin
// @desc    Admin panel status / dashboard stats
// @access  Admin
router.get('/', [auth, checkRole(['admin'])], async (req, res) => {
    res.json({ msg: 'Admin portal accessible', role: req.user.role });
});

// @route   POST /api/admin/teachers
// @desc    Create a teacher in Supabase
// @access  Admin
router.post('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    const { name, email, password, subject } = req.body;
    try {
        const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
        if (existing) return res.status(400).json({ msg: 'Teacher already exists' });

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const { data: newUser, error } = await supabase.from('users').insert([{
            name,
            email,
            password_hash,
            role: 'viewer',
            subject: subject || 'Mixed',
            status: 'active',
            is_active: true
        }]).select().single();

        if (error) {
            // Try Mongo fallback
            try {
                let user = new User({ name, email, password, role: 'teacher', subject });
                user.password = password_hash;
                await user.save();
                return res.json(user);
            } catch(e) {}
            return res.status(500).json({ msg: error.message });
        }

        res.json(newUser);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/admin/teachers
// @desc    Get all teachers from Supabase
// @access  Admin
router.get('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { data: teachers, error } = await supabase.from('users').select('id, name, email, role, subject, status, created_at');
        if (error || !teachers) {
            const mongoTeachers = await User.find({ role: 'teacher' }).select('-password');
            return res.json(mongoTeachers);
        }
        res.json(teachers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/admin/teachers/:id
// @desc    Delete a teacher
// @access  Admin
router.delete('/teachers/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        await supabase.from('users').delete().eq('id', req.params.id);
        try { await User.findByIdAndDelete(req.params.id); } catch(e) {}
        res.json({ msg: 'Teacher deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
