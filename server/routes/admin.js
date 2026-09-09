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
// @desc    Create a teacher under an institution
// @access  Admin
router.post('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    const { 
        name, 
        email, 
        password, 
        subject, 
        institutionName, 
        institutionEmail, 
        status = 'active',
        isTrial = true
    } = req.body;

    try {
        if (!name || !email || !password || !subject) {
            return res.status(400).json({ msg: 'Name, email, password, and subject are required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        let user = await User.findOne({ email: normalizedEmail });
        if (user) return res.status(400).json({ msg: 'A teacher with this email already exists.' });

        user = new User({ 
            name: name.trim(), 
            email: normalizedEmail, 
            password, 
            role: 'teacher', 
            subject,
            institutionName: (institutionName || 'Manchester College').trim(),
            institutionEmail: (institutionEmail || '').trim().toLowerCase(),
            status: status === 'disabled' ? 'disabled' : 'active',
            isTrial: Boolean(isTrial),
            quotas: {
                assessment: { used: 0, max: 2, maxQuestions: 60 },
                jee: { used: 0, max: 2, maxQuestions: 240 },
                neet: { used: 0, max: 2, maxQuestions: 240 },
                cet: { used: 0, max: 2, maxQuestions: 240 }
            }
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password.trim(), salt);

        await user.save();

        const createdUser = user.toObject();
        delete createdUser.password;
        res.status(201).json(createdUser);
    } catch (err) {
        console.error('Error creating teacher:', err.message);
        res.status(500).json({ msg: 'Server error creating teacher account.' });
    }
});

// @route   GET /api/admin/teachers
// @desc    Get all teachers with their institution and quota info
// @access  Admin
router.get('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const teachers = await User.find({ role: 'teacher' }).select('-password').sort({ createdAt: -1 });
        res.json(teachers);
    } catch (err) {
        console.error('Error fetching teachers:', err.message);
        res.status(500).json({ msg: 'Server error retrieving faculty list.' });
    }
});

// @route   PUT /api/admin/teachers/:id
// @desc    Update teacher identity, subject, or institution
// @access  Admin
router.put('/teachers/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { name, email, subject, institutionName, institutionEmail, status, isTrial } = req.body;
        const updateData = {};
        if (name) updateData.name = name.trim();
        if (email) updateData.email = email.trim().toLowerCase();
        if (subject) updateData.subject = subject;
        if (institutionName !== undefined) updateData.institutionName = institutionName.trim();
        if (institutionEmail !== undefined) updateData.institutionEmail = institutionEmail.trim().toLowerCase();
        if (status !== undefined) updateData.status = status;
        if (isTrial !== undefined) updateData.isTrial = Boolean(isTrial);

        const teacher = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        ).select('-password');

        if (!teacher) return res.status(404).json({ msg: 'Teacher not found' });
        res.json(teacher);
    } catch (err) {
        console.error('Error updating teacher:', err.message);
        res.status(500).json({ msg: 'Server error updating teacher.' });
    }
});

// @route   PUT /api/admin/teachers/:id/password
// @desc    Reset teacher password
// @access  Admin
router.put('/teachers/:id/password', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.trim().length < 4) {
            return res.status(400).json({ msg: 'New password must be at least 4 characters long.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword.trim(), salt);

        const teacher = await User.findByIdAndUpdate(
            req.params.id,
            { $set: { password: hashedPassword } },
            { new: true }
        ).select('-password');

        if (!teacher) return res.status(404).json({ msg: 'Teacher not found' });
        res.json({ msg: 'Password reset successfully', teacher });
    } catch (err) {
        console.error('Error resetting password:', err.message);
        res.status(500).json({ msg: 'Server error resetting password.' });
    }
});

// @route   PATCH /api/admin/teachers/:id/status
// @desc    Toggle teacher active / disabled status
// @access  Admin
router.patch('/teachers/:id/status', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { status } = req.body;
        if (!['active', 'disabled'].includes(status)) {
            return res.status(400).json({ msg: 'Status must be active or disabled.' });
        }

        const teacher = await User.findByIdAndUpdate(
            req.params.id,
            { $set: { status } },
            { new: true }
        ).select('-password');

        if (!teacher) return res.status(404).json({ msg: 'Teacher not found' });
        res.json({ msg: `Teacher status updated to ${status}`, teacher });
    } catch (err) {
        console.error('Error toggling status:', err.message);
        res.status(500).json({ msg: 'Server error updating status.' });
    }
});

// @route   PATCH /api/admin/teachers/:id/quotas/reset
// @desc    Reset trial quotas for teacher
// @access  Admin
router.patch('/teachers/:id/quotas/reset', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const teacher = await User.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    'quotas.assessment.used': 0,
                    'quotas.jee.used': 0,
                    'quotas.neet.used': 0,
                    'quotas.cet.used': 0
                }
            },
            { new: true }
        ).select('-password');

        if (!teacher) return res.status(404).json({ msg: 'Teacher not found' });
        res.json({ msg: 'Trial quotas reset successfully', teacher });
    } catch (err) {
        console.error('Error resetting quotas:', err.message);
        res.status(500).json({ msg: 'Server error resetting quotas.' });
    }
});

// @route   DELETE /api/admin/teachers/:id
// @desc    Delete a teacher
// @access  Admin
router.delete('/teachers/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Teacher deleted successfully' });
    } catch (err) {
        console.error('Error deleting teacher:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   PATCH /api/admin/teachers/:id/omr-access
// @desc    Toggle teacher OMR evaluation access permission
// @access  Admin
router.patch('/teachers/:id/omr-access', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { enabled } = req.body;
        const teacher = await User.findByIdAndUpdate(
            req.params.id,
            { $set: { omrAccess: Boolean(enabled) } },
            { new: true }
        ).select('-password');
        if (!teacher) return res.status(404).json({ msg: 'Teacher not found' });
        res.json({ msg: 'OMR permission updated successfully', teacher });
    } catch (err) {
        console.error('Error updating OMR access:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
