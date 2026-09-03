const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

// @route   GET /api/admin
// @desc    Admin panel status / dashboard stats
// @access  Admin
router.get('/', [auth, checkRole(['admin'])], async (req, res) => {
    res.json({ msg: 'Admin portal accessible', role: req.user.role });
});

// @route   POST /api/admin/teachers
// @desc    Create a teacher
// @access  Admin
router.post('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    const { name, email, password, subject } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'Teacher already exists' });

        user = new User({ name, email, password, role: 'teacher', subject });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/admin/teachers
// @desc    Get all teachers
// @access  Admin
router.get('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const teachers = await User.find({ role: 'teacher' }).select('-password');
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
        await User.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Teacher deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/admin/teachers/:id/omr-access
// @desc    Toggle teacher OMR evaluation access permission
// @access  Admin
router.put('/teachers/:id/omr-access', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { omrAccess } = req.body;
        const teacher = await User.findByIdAndUpdate(
            req.params.id,
            { $set: { omrAccess: Boolean(omrAccess) } },
            { new: true }
        ).select('-password');
        if (!teacher) return res.status(404).json({ msg: 'Teacher not found' });
        res.json({ msg: 'OMR permission updated successfully', teacher });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
