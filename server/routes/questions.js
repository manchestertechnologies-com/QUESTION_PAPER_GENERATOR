const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { sanitizeHtml, sanitizeArray } = require('../utils/sanitize');
const supabaseQuestions = require('../services/supabaseQuestions');

const { storage } = require('../config/cloudinary');

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
    }
});

// @route   POST /api/questions
// @desc    Add a question to Supabase Question Bank
// @access  Teacher / Admin
router.post('/', [auth, checkRole(['admin', 'teacher']), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'solutionImage', maxCount: 1 }])], async (req, res) => {
    try {
        const allowedFields = [
            'questionText','type','subject','classes','chapter','concept',
            'subConcept','level','answer','options','solutionText','imageUrl',
            'solutionImageUrl','assertion','reason','sourceType','sourceExam'
        ];

        // Teacher's subject is always from their token — not from request body
        const subject = req.user.role === 'admin' ? (req.body.subject || 'Chemistry') : req.user.subject;

        const questionData = {
            subject,
            createdBy: req.user.id
        };
        allowedFields.forEach(f => {
            if (req.body[f] !== undefined) questionData[f] = req.body[f];
        });
        questionData.subject = subject;

        // Sanitize HTML fields
        if (questionData.questionText) questionData.questionText = sanitizeHtml(questionData.questionText);
        if (questionData.solutionText) questionData.solutionText = sanitizeHtml(questionData.solutionText);
        if (questionData.options) {
            if (typeof questionData.options === 'string') {
                try { questionData.options = JSON.parse(questionData.options); } catch(e) {}
            }
            questionData.options = sanitizeArray(questionData.options);
        }

        if (req.body.classes) {
            if (typeof req.body.classes === 'string') {
                if (req.body.classes.startsWith('[')) {
                    try { questionData.classes = JSON.parse(req.body.classes); } catch(e) { questionData.classes = [req.body.classes]; }
                } else {
                    questionData.classes = req.body.classes.split(',').map(c => c.trim()).filter(Boolean);
                }
            }
        }

        if (req.files) {
            if (req.files.image && req.files.image[0]) {
                questionData.imageUrl = req.files.image[0].path;
            }
            if (req.files.solutionImage && req.files.solutionImage[0]) {
                questionData.solutionImageUrl = req.files.solutionImage[0].path;
            }
        }

        const question = await supabaseQuestions.createQuestion(questionData, req.user.id, req.user.name || 'User');
        res.json(question);
    } catch (err) {
        console.error('Add question error:', err.message);
        res.status(500).json({ msg: 'Server error adding question to Supabase.' });
    }
});

// @route   GET /api/questions
// @desc    Get questions filtered by subject, chapter, type, class from Supabase
// @access  Teacher / Admin
router.get('/', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const { classes, chapter, concept, type, subject, search } = req.query;
        let filters = {};

        // Subject-level access control — teachers can ONLY access their own subject
        if (req.user.role === 'teacher') {
            filters.subject = req.user.subject;
        } else if (subject) {
            filters.subject = subject;
        }

        if (classes) filters.classes = classes;
        if (chapter) filters.chapter = chapter;
        if (concept) filters.concept = concept;
        if (type) filters.type = type;
        if (search) filters.search = search;

        // Pagination
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50000, parseInt(req.query.limit) || 1000);

        const result = await supabaseQuestions.getQuestions(filters, page, limit);

        res.setHeader('X-Total-Count', result.pagination.total);
        res.setHeader('X-Total-Pages', result.pagination.pages);

        if (req.query.paginated === 'true') {
            return res.json(result);
        }

        // Return array by default for backward compatibility with frontend components expecting res.data array
        return res.json(result.questions);
    } catch (err) {
        console.error('[QUESTIONS GET] error:', err.message);
        res.status(500).json({ msg: 'Server error fetching questions from Supabase.' });
    }
});

// @route   GET /api/questions/:id
// @desc    Get a single question by ID from Supabase
// @access  Teacher / Admin
router.get('/:id', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const question = await supabaseQuestions.getQuestionById(req.params.id);
        if (!question) return res.status(404).json({ msg: 'Question not found.' });

        if (req.user.role !== 'admin' && question.subject !== req.user.subject) {
            return res.status(403).json({ msg: 'Access denied: this question belongs to a different subject.' });
        }

        res.json(question);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error fetching question.' });
    }
});

// @route   DELETE /api/questions/:id
// @desc    Delete a question from Supabase
// @access  Teacher / Admin
router.delete('/:id', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const question = await supabaseQuestions.getQuestionById(req.params.id);
        if (!question) return res.status(404).json({ msg: 'Question not found.' });

        if (req.user.role !== 'admin' && question.subject !== req.user.subject) {
            return res.status(403).json({ msg: 'Access denied: this question belongs to a different subject.' });
        }

        await supabaseQuestions.deleteQuestion(req.params.id);
        res.json({ msg: 'Question removed from Supabase.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error deleting question.' });
    }
});

// @route   POST /api/questions/update/:id
// @desc    Update a question in Supabase
// @access  Teacher / Admin
router.post('/update/:id', [auth, checkRole(['admin', 'teacher']), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'solutionImage', maxCount: 1 }])], async (req, res) => {
    try {
        let question = await supabaseQuestions.getQuestionById(req.params.id);
        if (!question) return res.status(404).json({ msg: 'Question not found.' });

        if (req.user.role !== 'admin' && question.subject !== req.user.subject) {
            return res.status(403).json({ msg: 'Access denied: not authorized to edit this subject question.' });
        }

        const questionData = { ...req.body };

        if (req.body.options && typeof req.body.options === 'string') {
            try { questionData.options = JSON.parse(req.body.options); } catch(e) {}
        }

        const updated = await supabaseQuestions.updateQuestion(req.params.id, questionData, req.user.id, req.user.name || 'User');
        res.json(updated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error updating question.' });
    }
});

module.exports = router;
