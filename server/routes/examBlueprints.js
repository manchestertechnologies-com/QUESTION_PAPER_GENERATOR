const express = require('express');
const router = express.Router();
const ExamBlueprint = require('../models/ExamBlueprint');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

// Seed default blueprints if database is empty
async function seedDefaultBlueprints() {
    try {
        const count = await ExamBlueprint.countDocuments();
        if (count === 0) {
            console.log('🌱 Seeding default blueprints...');
            const blueprints = [
                {
                    name: 'NEET Default',
                    examType: 'NEET',
                    durationMinutes: 180,
                    subjects: [
                        {
                            subjectName: 'Botany',
                            totalQuestions: 45,
                            sections: [{
                                sectionName: 'Botany Section',
                                numQuestions: 45,
                                questionTypes: ['MCQ', 'ASSERTION_REASON', 'STATEMENT_BASED', 'TRUE_FALSE', 'MATCH_FOLLOWING', 'DIAGRAM_BASED'],
                                markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                            }]
                        },
                        {
                            subjectName: 'Zoology',
                            totalQuestions: 45,
                            sections: [{
                                sectionName: 'Zoology Section',
                                numQuestions: 45,
                                questionTypes: ['MCQ', 'ASSERTION_REASON', 'STATEMENT_BASED', 'TRUE_FALSE', 'MATCH_FOLLOWING', 'DIAGRAM_BASED'],
                                markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                            }]
                        },
                        {
                            subjectName: 'Physics',
                            totalQuestions: 45,
                            sections: [{
                                sectionName: 'Physics Section',
                                numQuestions: 45,
                                questionTypes: ['MCQ', 'ASSERTION_REASON', 'STATEMENT_BASED', 'TRUE_FALSE', 'MATCH_FOLLOWING', 'DIAGRAM_BASED'],
                                markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                            }]
                        },
                        {
                            subjectName: 'Chemistry',
                            totalQuestions: 45,
                            sections: [{
                                sectionName: 'Chemistry Section',
                                numQuestions: 45,
                                questionTypes: ['MCQ', 'ASSERTION_REASON', 'STATEMENT_BASED', 'TRUE_FALSE', 'MATCH_FOLLOWING', 'DIAGRAM_BASED'],
                                markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                            }]
                        }
                    ]
                },
                {
                    name: 'JEE Default',
                    examType: 'JEE',
                    durationMinutes: 180,
                    subjects: [
                        {
                            subjectName: 'Physics',
                            totalQuestions: 25,
                            sections: [
                                {
                                    sectionName: 'Physics Section A (MCQ)',
                                    numQuestions: 20,
                                    questionTypes: ['MCQ', 'ASSERTION_REASON', 'STATEMENT_BASED', 'TRUE_FALSE', 'MATCH_FOLLOWING'],
                                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                                },
                                {
                                    sectionName: 'Physics Section B (Numerical)',
                                    numQuestions: 5,
                                    questionTypes: ['NUMERICAL'],
                                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                                }
                            ]
                        },
                        {
                            subjectName: 'Chemistry',
                            totalQuestions: 25,
                            sections: [
                                {
                                    sectionName: 'Chemistry Section A (MCQ)',
                                    numQuestions: 20,
                                    questionTypes: ['MCQ', 'ASSERTION_REASON', 'STATEMENT_BASED', 'TRUE_FALSE', 'MATCH_FOLLOWING'],
                                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                                },
                                {
                                    sectionName: 'Chemistry Section B (Numerical)',
                                    numQuestions: 5,
                                    questionTypes: ['NUMERICAL'],
                                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                                }
                            ]
                        },
                        {
                            subjectName: 'Mathematics',
                            totalQuestions: 25,
                            sections: [
                                {
                                    sectionName: 'Mathematics Section A (MCQ)',
                                    numQuestions: 20,
                                    questionTypes: ['MCQ', 'ASSERTION_REASON', 'STATEMENT_BASED', 'TRUE_FALSE', 'MATCH_FOLLOWING'],
                                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                                },
                                {
                                    sectionName: 'Mathematics Section B (Numerical)',
                                    numQuestions: 5,
                                    questionTypes: ['NUMERICAL'],
                                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                                }
                            ]
                        }
                    ]
                },
                {
                    name: 'CET Default (KCET)',
                    examType: 'KCET',
                    durationMinutes: 180,
                    subjects: [
                        {
                            subjectName: 'Physics',
                            totalQuestions: 60,
                            sections: [{
                                sectionName: 'Physics Section',
                                numQuestions: 60,
                                questionTypes: ['MCQ'],
                                markingRules: { correct: 1, incorrect: 0, unattempted: 0 }
                            }]
                        },
                        {
                            subjectName: 'Chemistry',
                            totalQuestions: 60,
                            sections: [{
                                sectionName: 'Chemistry Section',
                                numQuestions: 60,
                                questionTypes: ['MCQ'],
                                markingRules: { correct: 1, incorrect: 0, unattempted: 0 }
                            }]
                        },
                        {
                            subjectName: 'Mathematics',
                            totalQuestions: 60,
                            sections: [{
                                sectionName: 'Mathematics Section',
                                numQuestions: 60,
                                questionTypes: ['MCQ'],
                                markingRules: { correct: 1, incorrect: 0, unattempted: 0 }
                            }]
                        },
                        {
                            subjectName: 'Biology',
                            totalQuestions: 60,
                            sections: [{
                                sectionName: 'Biology Section',
                                numQuestions: 60,
                                questionTypes: ['MCQ'],
                                markingRules: { correct: 1, incorrect: 0, unattempted: 0 }
                            }]
                        }
                    ]
                }
            ];
            await ExamBlueprint.insertMany(blueprints);
            console.log('✅ Seeding blueprints completed.');
        }
    } catch (err) {
        console.error('Failed to seed default blueprints:', err);
    }
}
seedDefaultBlueprints();

// @route   GET /api/exam-blueprints
// @desc    Get all exam blueprints
// @access  Admin, Teacher
router.get('/', auth, async (req, res) => {
    try {
        const blueprints = await ExamBlueprint.find();
        res.json(blueprints);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/exam-blueprints/:id
// @desc    Get blueprint by ID
// @access  Admin, Teacher
router.get('/:id', auth, async (req, res) => {
    try {
        const blueprint = await ExamBlueprint.findById(req.params.id);
        if (!blueprint) return res.status(404).json({ msg: 'Blueprint not found' });
        res.json(blueprint);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/exam-blueprints
// @desc    Create exam blueprint
// @access  Admin
router.post('/', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { name, examType, subjects, durationMinutes, active } = req.body;
        
        let blueprint = await ExamBlueprint.findOne({ name });
        if (blueprint) return res.status(400).json({ msg: 'Blueprint name already exists' });

        blueprint = new ExamBlueprint({
            name,
            examType,
            subjects,
            durationMinutes,
            active
        });

        await blueprint.save();
        res.json(blueprint);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/exam-blueprints/:id
// @desc    Update exam blueprint
// @access  Admin
router.put('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { name, examType, subjects, durationMinutes, active } = req.body;
        const blueprint = await ExamBlueprint.findById(req.params.id);
        if (!blueprint) return res.status(404).json({ msg: 'Blueprint not found' });

        if (name) blueprint.name = name;
        if (examType) blueprint.examType = examType;
        if (subjects) blueprint.subjects = subjects;
        if (durationMinutes) blueprint.durationMinutes = durationMinutes;
        if (active !== undefined) blueprint.active = active;

        await blueprint.save();
        res.json(blueprint);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/exam-blueprints/:id
// @desc    Delete exam blueprint
// @access  Admin
router.delete('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const blueprint = await ExamBlueprint.findById(req.params.id);
        if (!blueprint) return res.status(404).json({ msg: 'Blueprint not found' });

        await ExamBlueprint.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Blueprint removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
