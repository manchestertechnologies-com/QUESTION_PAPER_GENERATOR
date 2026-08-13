const express = require('express');
const router = express.Router();
const Paper = require('../models/Paper');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const supabaseQuestions = require('../services/supabaseQuestions');

// Helper to populate paper questions from Supabase if stored as IDs
async function populatePaperQuestions(paper) {
    const pObj = paper.toObject ? paper.toObject() : paper;
    if (Array.isArray(pObj.questions) && pObj.questions.length > 0) {
        // If items are string UUIDs, fetch from Supabase
        const isStringIds = typeof pObj.questions[0] === 'string';
        if (isStringIds) {
            const fetched = await supabaseQuestions.getQuestionsByIds(pObj.questions);
            pObj.questions = fetched;
        }
    }
    return pObj;
}

// @route   POST /api/papers
// @desc    Save a paper (stores Supabase question IDs and paper pattern)
// @access  Teacher
router.post('/', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const paperData = {
            ...req.body,
            subject: req.user.subject || 'Mixed',
            teacherId: req.user.id
        };

        const paper = new Paper(paperData);
        await paper.save();
        res.json(paper);
    } catch (err) {
        console.error('Save paper error:', err.message);
        res.status(500).json({ msg: 'Server error saving paper.' });
    }
});

// @route   GET /api/papers/admin/all
// @desc    Get all papers with resolved Supabase questions (Admin)
// @access  Admin
router.get('/admin/all', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const papers = await Paper.find().sort({ createdAt: -1 });
        const populated = await Promise.all(papers.map(populatePaperQuestions));
        res.json(populated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   PUT /api/papers/admin/:id/status
// @desc    Update paper status (Admin)
// @access  Admin
router.put('/admin/:id/status', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Pending Approval', 'Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ msg: 'Invalid status' });
        }

        const paper = await Paper.findByIdAndUpdate(
            req.params.id,
            { $set: { status } },
            { new: true }
        );

        if (!paper) return res.status(404).json({ msg: 'Paper not found' });

        res.json(paper);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   GET /api/papers
// @desc    Get all papers of a teacher (or all if admin) with resolved Supabase questions
// @access  Teacher, Admin
router.get('/', [auth, checkRole(['teacher', 'admin'])], async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'teacher') {
            query.teacherId = req.user.id;
        }
        const papers = await Paper.find(query).sort({ createdAt: -1 });
        const populated = await Promise.all(papers.map(populatePaperQuestions));
        res.json(populated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   GET /api/papers/:id
// @desc    Get a single paper with populated Supabase questions
// @access  Teacher, Admin
router.get('/:id', [auth, checkRole(['teacher', 'admin'])], async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id);
        if (!paper) return res.status(404).json({ msg: 'Paper not found' });

        // IDOR check: teacher can only access their own paper
        if (req.user.role === 'teacher' && paper.teacherId.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Access denied: not your paper.' });
        }

        const populated = await populatePaperQuestions(paper);
        res.json(populated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   DELETE /api/papers/:id
// @desc    Delete a paper
// @access  Teacher, Admin
router.delete('/:id', [auth, checkRole(['teacher', 'admin'])], async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id);
        if (!paper) return res.status(404).json({ msg: 'Paper not found' });

        if (req.user.role !== 'admin' && paper.teacherId.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Access denied' });
        }

        await Paper.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Paper removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
