const express = require('express');
const router = express.Router();
const multer = require('multer');
const Question = require('../models/Question');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { sanitizeHtml, sanitizeArray } = require('../utils/sanitize');

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
// @desc    Add a question
// @access  Teacher / Admin
router.post('/', [auth, checkRole(['admin', 'teacher']), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'solutionImage', maxCount: 1 }])], async (req, res) => {
    try {
        // ── Mass-assignment whitelist — only allowed fields ──────────────────
        const allowedFields = [
            'questionText','type','subject','classes','chapter','concept',
            'subConcept','level','answer','options','solutionText','imageUrl',
            'solutionImageUrl','statements','matchPairs','sourceType','sourcePaperId',
            'sourceYear','sourceExam','academicYearLevel','tags'
        ];

        // Teacher's subject is always from their token — not from request body
        const subject = req.user.role === 'admin' ? (req.body.subject || 'Chemistry') : req.user.subject;

        // Build sanitized question data (explicit whitelist)
        const questionData = {
            subject,
            createdBy: req.user.id
        };
        allowedFields.forEach(f => {
            if (req.body[f] !== undefined) questionData[f] = req.body[f];
        });
        questionData.subject = subject; // Override subject for teachers

        // Sanitize HTML fields
        if (questionData.questionText) questionData.questionText = sanitizeHtml(questionData.questionText);
        if (questionData.solutionText) questionData.solutionText = sanitizeHtml(questionData.solutionText);
        if (questionData.options) {
            if (typeof questionData.options === 'string') {
                try { questionData.options = JSON.parse(questionData.options); } catch(e) {}
            }
            questionData.options = sanitizeArray(questionData.options);
        }

        // Handle other JSON fields
        if (req.body.statements && typeof req.body.statements === 'string') {
            try { questionData.statements = JSON.parse(req.body.statements); } catch(e) {}
        }
        if (req.body.matchPairs && typeof req.body.matchPairs === 'string') {
            try { questionData.matchPairs = JSON.parse(req.body.matchPairs); } catch(e) {}
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

        // Auto-generate Question ID
        const count = await Question.countDocuments();
        questionData.questionId = `Q-${subject.substring(0,3).toUpperCase()}-${Date.now()}-${count+1}`;

        if (req.files) {
            if (req.files.image && req.files.image[0]) {
                questionData.imageUrl = req.files.image[0].path;
            }
            if (req.files.solutionImage && req.files.solutionImage[0]) {
                questionData.solutionImageUrl = req.files.solutionImage[0].path;
            }
        }

        const question = new Question(questionData);
        await question.save();
        res.json(question);
    } catch (err) {
        console.error('Add question error:', err.message);
        res.status(500).json({ msg: 'Server error adding question.' });
    }
});

// @route   GET /api/questions
// @desc    Get questions filtered by subject
// @access  Teacher / Admin
router.get('/', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const { classes, chapter, concept, subConcept, level, type, sourceType, sourcePaperId, sourceYear, sourceExam, academicYearLevel } = req.query;
        let query = {};
        
        // Subject-level access control — teachers can ONLY access their own subject
        if (req.user.role === 'teacher') {
            query.subject = req.user.subject;
        } else if (req.query.subject) {
            query.subject = req.query.subject;
        }
        
        if (classes) query.classes = { $in: classes.split(',') };
        if (chapter) query.chapter = { $in: chapter.split(',') };
        if (concept) query.concept = { $in: concept.split(',') };
        if (subConcept) query.subConcept = { $in: subConcept.split(',') };
        if (level) query.level = { $in: level.split(',') };
        if (type) query.type = { $in: type.split(',') };
        if (sourceType) query.sourceType = sourceType;
        if (sourcePaperId) query.sourcePaperId = sourcePaperId;
        if (sourceYear) query.sourceYear = Number(sourceYear);
        if (sourceExam) query.sourceExam = sourceExam;
        if (academicYearLevel) query.academicYearLevel = academicYearLevel;

        // Pagination — default 100 per page, max 200
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(200, parseInt(req.query.limit) || 100);
        const skip = (page - 1) * limit;

        const [questions, total] = await Promise.all([
            Question.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Question.countDocuments(query)
        ]);

        res.json({
            questions,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error fetching questions.' });
    }
});

// @route   DELETE /api/questions/:id
// @desc    Delete a question
// @access  Teacher / Admin
router.delete('/:id', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);
        if (!question) return res.status(404).json({ msg: 'Question not found.' });
        
        if (req.user.role !== 'admin' && question.subject !== req.user.subject) {
             return res.status(403).json({ msg: 'Access denied: this question belongs to a different subject.' });
        }
        
        await Question.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Question removed.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error deleting question.' });
    }
});

// @route   POST /api/questions/update/:id
// @desc    Update a question
// @access  Teacher / Admin
router.post('/update/:id', [auth, checkRole(['admin', 'teacher']), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'solutionImage', maxCount: 1 }])], async (req, res) => {
    try {
        let question = await Question.findById(req.params.id);
        if (!question) return res.status(404).json({ msg: 'Question not found' });
        
        if (req.user.role !== 'admin' && question.subject !== req.user.subject) {
             return res.status(401).json({ msg: 'Not authorized to edit this subject question' });
        }
        
        const questionData = { ...req.body };
        
        if (req.body.options && typeof req.body.options === 'string') {
            try { questionData.options = JSON.parse(req.body.options); } catch(e) {}
        }
        if (req.body.statements && typeof req.body.statements === 'string') {
            try { questionData.statements = JSON.parse(req.body.statements); } catch(e) {}
        }
        if (req.body.matchPairs && typeof req.body.matchPairs === 'string') {
            try { questionData.matchPairs = JSON.parse(req.body.matchPairs); } catch(e) {}
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

        question = await Question.findByIdAndUpdate(
            req.params.id,
            { $set: questionData },
            { new: true }
        );
        
        res.json(question);
    } catch (err) {
        console.error('Update question error:', err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// @route   POST /api/questions/:id/solve
// @desc    Solve a question using Gemini AI if no solution is saved, otherwise return saved solution
// @access  Public
router.post('/:id/solve', async (req, res) => {
    try {
        const Question = require('../models/Question');
        const question = await Question.findById(req.params.id);
        if (!question) return res.status(404).json({ msg: 'Question not found' });

        if (question.solutionText) {
            return res.json({
                solutionText: question.solutionText,
                solutionImageUrl: question.solutionImageUrl,
                source: 'database'
            });
        }

        // Call Gemini API
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ msg: 'Gemini API Key is not configured on the server.' });
        }

        const prompt = `Solve the following question step-by-step. Provide a clear, detailed explanation/hint for the correct answer.
        
Question: ${question.questionText}
Options:
${question.options && question.options.length > 0 ? question.options.map((opt, i) => `${String.fromCharCode(65+i)}. ${opt}`).join('\n') : 'No options provided'}
Correct Answer: ${question.answer || 'Not specified'}

Format the solution beautifully using markdown. Keep the tone helpful and academic. Provide step-by-step calculation or reasoning.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            console.error('Gemini API Error:', errData);
            return res.status(502).json({ msg: 'Failed to generate solution from Gemini AI', error: errData });
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            return res.status(502).json({ msg: 'Empty response from Gemini AI' });
        }

        // Save solution to database for future requests
        question.solutionText = generatedText;
        await question.save();

        res.json({
            solutionText: generatedText,
            solutionImageUrl: question.solutionImageUrl,
            source: 'gemini'
        });
    } catch (err) {
        console.error('Solve question error:', err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// @route   POST /api/questions/convert-numerical/:id
// @desc    Convert an existing question to numerical answer type using Gemini AI
// @access  Admin, Teacher
router.post('/convert-numerical/:id', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);
        if (!question) return res.status(404).json({ msg: 'Question not found' });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ msg: 'Gemini API Key is not configured.' });
        }

        const prompt = `You are a professional JEE/NEET question generator.
Convert the following Multiple Choice Question (MCQ) into a Numerical Answer Type question (where no options are provided and the answer is a single numeric value).

Original Question: ${question.questionText}
Options: ${question.options.join(', ')}
Original MCQ Option Answer: ${question.answer}

Task:
1. Rephrase the question so that it explicitly asks for a single numeric value (e.g. integer or decimal).
2. Calculate the correct numeric answer.
3. Provide a step-by-step calculation solution.

Output ONLY a valid JSON object with the following fields. Do not include markdown code block syntax (like \`\`\`json) or any preamble or explanation:
{
  "questionText": "rephrased numerical question text",
  "answer": "exact numeric answer string, e.g. 4 or 2.5",
  "solutionText": "step by step calculation explanation in markdown"
}`;

        const fetchResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!fetchResponse.ok) {
            const err = await fetchResponse.json();
            return res.status(502).json({ msg: 'Gemini conversion failed', error: err });
        }

        const data = await fetchResponse.json();
        let rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Clean up markdown wrappers
        rawJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            const converted = JSON.parse(rawJson);
            res.json({
                originalQuestion: question,
                convertedQuestion: {
                    questionText: converted.questionText,
                    answer: converted.answer,
                    solutionText: converted.solutionText
                }
            });
        } catch (parseErr) {
            res.status(500).json({ msg: 'Gemini returned invalid conversion JSON structure.', rawResponse: rawJson });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/questions/confirm-conversion/:id
// @desc    Save the AI-converted numerical question as a new derived question
// @access  Admin, Teacher
router.post('/confirm-conversion/:id', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const originalQuestion = await Question.findById(req.params.id);
        if (!originalQuestion) return res.status(404).json({ msg: 'Original question not found' });

        const { questionText, answer, solutionText } = req.body;

        const count = await Question.countDocuments();
        const subjectCode = originalQuestion.subject.substring(0,3).toUpperCase();
        const questionId = `Q-${subjectCode}-NUM-${Date.now()}-${count+1}`;

        const derivedQuestion = new Question({
            questionId,
            subject: originalQuestion.subject,
            classes: originalQuestion.classes,
            chapter: originalQuestion.chapter,
            concept: originalQuestion.concept,
            subConcept: originalQuestion.subConcept || '',
            level: originalQuestion.level,
            type: 'NUMERICAL',
            questionText,
            options: [],
            answer,
            solutionText,
            imageUrl: originalQuestion.imageUrl || '',
            
            // Conversion metadata
            convertedFromQuestionId: originalQuestion._id,
            conversionType: 'MCQ_TO_NUMERICAL_AI',
            conversionTimestamp: new Date(),
            
            createdBy: req.user.id
        });

        await derivedQuestion.save();
        res.json(derivedQuestion);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
