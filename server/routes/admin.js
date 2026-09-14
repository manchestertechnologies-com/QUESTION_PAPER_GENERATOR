const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

/**
 * Helper to compute real-time trial information and active status for a user.
 */
function enrichUserTrial(userDoc) {
    const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
    delete user.password;

    const now = new Date();
    let status = user.trialStatus || (user.isTrial ? 'active' : 'none');
    let isTrialActive = false;
    let daysRemaining = 0;

    if (status === 'active' && user.trialExpiryDate) {
        const expiry = new Date(user.trialExpiryDate);
        if (expiry.getTime() < now.getTime()) {
            status = 'expired';
            daysRemaining = 0;
            isTrialActive = false;
        } else {
            daysRemaining = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            isTrialActive = true;
        }
    } else if (status === 'active' && !user.trialExpiryDate) {
        // Fallback for legacy users with isTrial: true
        isTrialActive = true;
        daysRemaining = 15;
    } else {
        isTrialActive = false;
        daysRemaining = 0;
    }

    return {
        ...user,
        trialStatus: status,
        isTrialActive,
        trialDaysRemaining: daysRemaining
    };
}

// @route   GET /api/admin
// @desc    Admin panel status / dashboard stats
// @access  Admin
router.get('/', [auth, checkRole(['admin'])], async (req, res) => {
    res.json({ msg: 'Admin portal accessible', role: req.user.role });
});

// @route   POST /api/admin/teachers
// @desc    Create a teacher under an institution (Default: NO TRIAL ACCESS unless Admin explicitly grants)
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
        grantTrial = false,
        trialDurationDays = 0,
        trialStartDate,
        trialExpiryDate
    } = req.body;

    try {
        if (!name || !email || !password || !subject) {
            return res.status(400).json({ msg: 'Name, email, password, and subject are required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        let user = await User.findOne({ email: normalizedEmail });
        if (user) return res.status(400).json({ msg: 'A teacher with this email already exists.' });

        const isTrialGranted = Boolean(grantTrial);
        let start = trialStartDate ? new Date(trialStartDate) : new Date();
        let expiry = null;
        let duration = Number(trialDurationDays) || 0;

        if (isTrialGranted) {
            if (trialExpiryDate) {
                expiry = new Date(trialExpiryDate);
                duration = Math.max(1, Math.ceil((expiry.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
            } else if (duration > 0) {
                expiry = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);
            } else {
                duration = 15;
                expiry = new Date(start.getTime() + 15 * 24 * 60 * 60 * 1000);
            }
        }

        user = new User({ 
            name: name.trim(), 
            email: normalizedEmail, 
            password, 
            role: 'teacher', 
            subject,
            institutionName: (institutionName || 'Manchester College').trim(),
            institutionEmail: (institutionEmail || '').trim().toLowerCase(),
            status: status === 'disabled' ? 'disabled' : 'active',
            isTrial: isTrialGranted,
            trialStatus: isTrialGranted ? 'active' : 'none',
            trialStartDate: isTrialGranted ? start : null,
            trialExpiryDate: isTrialGranted ? expiry : null,
            trialDurationDays: duration,
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

        res.status(200).json(enrichUserTrial(user));
    } catch (err) {
        console.error('Error creating teacher:', err.message);
        res.status(500).json({ msg: 'Server error creating teacher account.' });
    }
});

// @route   GET /api/admin/teachers
// @desc    Get all teachers with institution, quota, and trial info
// @access  Admin
router.get('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const teachers = await User.find({ role: 'teacher' }).select('-password').sort({ createdAt: -1 });
        const enriched = teachers.map(enrichUserTrial);
        res.json(enriched);
    } catch (err) {
        console.error('Error fetching teachers:', err.message);
        res.status(500).json({ msg: 'Server error retrieving faculty list.' });
    }
});

// @route   POST /api/admin/teachers/:id/trial
// @desc    Grant or configure trial access for teacher (Presets: 7, 15, 30 days or custom duration)
// @access  Admin
router.post('/teachers/:id/trial', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { durationDays = 15, startDate, expiryDate, resetQuotas = true, reason = '' } = req.body;
        const teacher = await User.findById(req.params.id);
        if (!teacher) return res.status(404).json({ msg: 'Teacher account not found.' });

        const start = startDate ? new Date(startDate) : new Date();
        let expiry = null;
        let duration = Number(durationDays) || 15;

        if (expiryDate) {
            expiry = new Date(expiryDate);
            duration = Math.max(1, Math.ceil((expiry.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        } else {
            expiry = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);
        }

        teacher.isTrial = true;
        teacher.trialStatus = 'active';
        teacher.trialStartDate = start;
        teacher.trialExpiryDate = expiry;
        teacher.trialDurationDays = duration;
        teacher.trialReason = reason || teacher.trialReason || '';

        if (resetQuotas) {
            teacher.quotas = {
                assessment: { used: 0, max: 2, maxQuestions: 60 },
                jee: { used: 0, max: 2, maxQuestions: 240 },
                neet: { used: 0, max: 2, maxQuestions: 240 },
                cet: { used: 0, max: 2, maxQuestions: 240 }
            };
        }

        await teacher.save();
        res.json({ 
            msg: `Trial access granted successfully for ${duration} days (valid until ${expiry.toLocaleDateString()}).`,
            teacher: enrichUserTrial(teacher)
        });
    } catch (err) {
        console.error('Error granting trial:', err.message);
        res.status(500).json({ msg: 'Server error granting trial access.' });
    }
});

// @route   PATCH /api/admin/teachers/:id/trial/extend
// @desc    Extend trial access for a teacher by X days or set new expiry date
// @access  Admin
router.patch('/teachers/:id/trial/extend', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const extendDays = req.body.extendDays || req.body.additionalDays || 7;
        const { newExpiryDate, resetQuotas = false } = req.body;
        const teacher = await User.findById(req.params.id);
        if (!teacher) return res.status(404).json({ msg: 'Teacher account not found.' });

        const now = new Date();
        const baseDate = (teacher.trialExpiryDate && new Date(teacher.trialExpiryDate) > now)
            ? new Date(teacher.trialExpiryDate)
            : now;

        let expiry = null;
        if (newExpiryDate) {
            expiry = new Date(newExpiryDate);
        } else {
            const addMs = Number(extendDays) * 24 * 60 * 60 * 1000;
            expiry = new Date(baseDate.getTime() + addMs);
        }

        teacher.isTrial = true;
        teacher.trialStatus = 'active';
        teacher.trialExpiryDate = expiry;
        teacher.trialDurationDays = Math.max(1, Math.ceil((expiry.getTime() - (teacher.trialStartDate ? new Date(teacher.trialStartDate).getTime() : now.getTime())) / (1000 * 60 * 60 * 24)));

        if (resetQuotas) {
            teacher.quotas = {
                assessment: { used: 0, max: 2, maxQuestions: 60 },
                jee: { used: 0, max: 2, maxQuestions: 240 },
                neet: { used: 0, max: 2, maxQuestions: 240 },
                cet: { used: 0, max: 2, maxQuestions: 240 }
            };
        }

        await teacher.save();
        res.json({
            msg: `Trial extended successfully until ${expiry.toLocaleDateString()}.`,
            teacher: enrichUserTrial(teacher)
        });
    } catch (err) {
        console.error('Error extending trial:', err.message);
        res.status(500).json({ msg: 'Server error extending trial access.' });
    }
});

// @route   PATCH /api/admin/teachers/:id/trial/revoke
// @desc    Revoke / Disable trial access for teacher immediately
// @access  Admin
router.patch('/teachers/:id/trial/revoke', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const teacher = await User.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    isTrial: false,
                    trialStatus: 'revoked'
                }
            },
            { new: true }
        ).select('-password');

        if (!teacher) return res.status(404).json({ msg: 'Teacher not found' });
        res.json({ msg: 'Trial access revoked successfully.', teacher: enrichUserTrial(teacher) });
    } catch (err) {
        console.error('Error revoking trial:', err.message);
        res.status(500).json({ msg: 'Server error revoking trial.' });
    }
});

// @route   PUT /api/admin/teachers/:id
// @desc    Update teacher identity, subject, or institution
// @access  Admin
router.put('/teachers/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { name, email, subject, institutionName, institutionEmail, status, isTrial, trialStatus } = req.body;
        const updateData = {};
        if (name) updateData.name = name.trim();
        if (email) updateData.email = email.trim().toLowerCase();
        if (subject) updateData.subject = subject;
        if (institutionName !== undefined) updateData.institutionName = institutionName.trim();
        if (institutionEmail !== undefined) updateData.institutionEmail = institutionEmail.trim().toLowerCase();
        if (status !== undefined) updateData.status = status;
        if (isTrial !== undefined) updateData.isTrial = Boolean(isTrial);
        if (trialStatus !== undefined) updateData.trialStatus = trialStatus;

        const teacher = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        ).select('-password');

        if (!teacher) return res.status(404).json({ msg: 'Teacher not found' });
        res.json(enrichUserTrial(teacher));
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
        res.json({ msg: 'Password reset successfully', teacher: enrichUserTrial(teacher) });
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
        res.json({ msg: `Teacher status updated to ${status}`, teacher: enrichUserTrial(teacher) });
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
        res.json({ msg: 'Trial quotas reset successfully', teacher: enrichUserTrial(teacher) });
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
        res.json({ msg: 'OMR permission updated successfully', teacher: enrichUserTrial(teacher) });
    } catch (err) {
        console.error('Error updating OMR access:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
module.exports.enrichUserTrial = enrichUserTrial;
