const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Paper = require('../models/Paper');
const Question = require('../models/Question');
const OnlineExam = require('../models/OnlineExam');
const ExamSession = require('../models/ExamSession');
const BridgeKey = require('../models/BridgeKey');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { detectLabIp } = require('../middleware/labIp');
const supabaseQuestions = require('../services/supabaseQuestions');
const {
    calculateAssessmentAnalytics,
    calculateServerTimerState,
    deriveQuestionStatus,
    isResponseValid,
    QUESTION_STATUS
} = require('../services/cbtAssessmentEngine');

// ─────────────────────────────────────────────────────────────────
const { createNotification } = require('./notifications');

// ADMIN: Commission a new Exam Assignment to Faculty
// POST /api/exams/commission
// ─────────────────────────────────────────────────────────────────
router.post('/commission', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { title, examType, classes, subjectAssignments, instructions, duration_minutes } = req.body;
        if (!title) return res.status(400).json({ msg: 'Exam title is required.' });

        const newExam = new OnlineExam({
            title,
            examType: ['JEE', 'NEET', 'CET'].includes(examType) ? examType : 'CET',
            classes: Array.isArray(classes) ? classes : [classes || '12'],
            subjectAssignments: subjectAssignments || [],
            instructions: instructions || '',
            duration_minutes: duration_minutes || 180,
            status: 'draft',
            createdBy: req.user.id
        });

        await newExam.save();

        // Dispatch notifications to assigned teachers
        if (Array.isArray(subjectAssignments)) {
            for (const sa of subjectAssignments) {
                if (sa.teacherId) {
                    try {
                        await createNotification({
                            recipient_role: 'teacher',
                            recipient_id: sa.teacherId.toString(),
                            sender_id: req.user.id,
                            sender_name: req.user.name || 'Admin Office',
                            type: 'exam_assignment',
                            title: `New Paper Assignment: ${title}`,
                            message: `Admin assigned you to compile ${sa.targetQuestions || 60} ${sa.subject} questions for ${title} (${examType || 'CET'}).`,
                            metadata: {
                                examId: newExam._id.toString(),
                                examTitle: title,
                                subject: sa.subject,
                                targetQuestions: sa.targetQuestions || 60,
                                examType: examType || 'CET',
                                classes: classes || ['12']
                            }
                        });
                    } catch (notifErr) {
                        console.error('Teacher notification error:', notifErr.message);
                    }
                }
            }
        }

        res.json({ msg: 'Exam successfully commissioned and dispatched to teachers', exam: newExam });
    } catch (err) {
        console.error('Commission Error:', err);
        res.status(500).json({ msg: 'Server error commissioning exam' });
    }
});

// ─────────────────────────────────────────────────────────────────
// TEACHER / ADMIN: Get active exam assignments delegated to current user
// GET /api/exams/my-assignments
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// TEACHER / ADMIN: Get active exam assignments delegated to current user
// GET /api/exams/my-assignments
// ─────────────────────────────────────────────────────────────────
router.get('/my-assignments', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const userSubject = req.user.subject;

        let query = {};
        if (userRole === 'admin') {
            query = {};
        } else {
            query = {
                $or: [
                    { 'subjectAssignments.teacherId': userId },
                    { 'subjectAssignments.subject': new RegExp(`^${userSubject}$`, 'i') },
                    { 'subjectAssignments.subject': new RegExp(userSubject || 'Physics', 'i') }
                ]
            };
        }

        const exams = await OnlineExam.find(query)
            .sort({ createdAt: -1 })
            .populate('subjectAssignments.submittedPaperId')
            .populate('createdBy', 'name email');

        res.json(exams);
    } catch (err) {
        console.error('Fetch Assignments Error:', err);
        res.status(500).json({ msg: 'Server error fetching assignments' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Get all commissioned exams with real-time per-subject status & full question hydration
// GET /api/exams/commissioned
// ─────────────────────────────────────────────────────────────────
router.get('/commissioned', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exams = await OnlineExam.find({})
            .sort({ createdAt: -1 })
            .populate('subjectAssignments.submittedPaperId')
            .populate('createdBy', 'name email');

        // Also resolve all questions for submitted papers to provide genuine real-time data
        const allPapers = await Paper.find({}).sort({ createdAt: -1 });

        const enrichedExams = await Promise.all(exams.map(async (exam) => {
            const exObj = exam.toObject();
            let allExamQuestions = [];

            if (Array.isArray(exObj.subjectAssignments)) {
                for (const sa of exObj.subjectAssignments) {
                    let paper = sa.submittedPaperId;

                    // Fallback: if not explicitly linked, match by examId, exam title, teacher, or subject
                    if (!paper) {
                        const saSub = (sa.subject || '').toLowerCase().trim();
                        const saTeacherId = sa.teacherId ? sa.teacherId.toString() : '';

                        const matchedPaper = allPapers.find(p => {
                            const pSub = (p.subject || '').toLowerCase().trim();
                            const pTitle = (p.title || '').toLowerCase().trim();
                            const pTeacherId = p.teacherId ? p.teacherId.toString() : '';

                            // 1. Paper explicitly tagged with this examId
                            if (p.examId && p.examId.toString() === exObj._id.toString()) {
                                if (pSub === saSub) return true;
                                if (pTitle.includes(saSub)) return true;
                                if (saTeacherId && pTeacherId === saTeacherId) return true;
                                if (pSub.includes('bio') && (saSub.includes('botan') || saSub.includes('zool'))) return true;
                            }

                            // 2. Paper title matches exam title
                            if (pTitle && exObj.title && pTitle.includes(exObj.title.toLowerCase())) {
                                if (pSub === saSub) return true;
                                if (pTitle.includes(saSub)) return true;
                                if (saTeacherId && pTeacherId === saTeacherId) return true;
                                if (pSub.includes('bio') && (saSub.includes('botan') || saSub.includes('zool'))) return true;
                            }

                            // 3. Teacher assigned to this subject created paper for this subject or biology
                            if (saTeacherId && pTeacherId === saTeacherId) {
                                if (pSub === saSub || pTitle.includes(saSub) || (pSub.includes('bio') && (saSub.includes('botan') || saSub.includes('zool')))) {
                                    return true;
                                }
                            }

                            return false;
                        });

                        if (matchedPaper) {
                            paper = matchedPaper;
                            // Auto link in background
                            try {
                                const dbExam = await OnlineExam.findById(exObj._id);
                                if (dbExam) {
                                    const dbSa = dbExam.subjectAssignments.id(sa._id);
                                    if (dbSa) {
                                        dbSa.submittedPaperId = matchedPaper._id;
                                        await dbExam.save();
                                    }
                                }
                            } catch (e) {
                                console.error('Auto link error:', e);
                            }
                        }
                    }

                    if (paper && Array.isArray(paper.questions) && paper.questions.length > 0) {
                        // If questions are string IDs, fetch from Supabase
                        let resolvedQuestions = [];
                        if (typeof paper.questions[0] === 'string') {
                            resolvedQuestions = await supabaseQuestions.getQuestionsByIds(paper.questions);
                        } else {
                            resolvedQuestions = paper.questions;
                        }

                        // Attach resolved questions to paper
                        paper.questions = resolvedQuestions;
                        sa.submittedPaperId = paper;
                        sa.questionsCount = resolvedQuestions.length;
                        sa.status = resolvedQuestions.length >= (sa.targetQuestions || 60) ? 'Completed' : 'In Progress';

                        // Ensure each question has subject assigned
                        resolvedQuestions.forEach(q => {
                            if (!q.subject) q.subject = sa.subject;
                            allExamQuestions.push(q);
                        });
                    } else {
                        sa.questionsCount = 0;
                    }
                }
            }

            // Include any questions directly in the exam
            if (Array.isArray(exObj.questions) && exObj.questions.length > 0) {
                exObj.questions.forEach(q => allExamQuestions.push(q));
            }

            exObj.allQuestions = allExamQuestions;
            exObj.totalQuestionsAdded = allExamQuestions.length;
            return exObj;
        }));

        res.json(enrichedExams);
    } catch (err) {
        console.error('Fetch Commissioned Error:', err);
        res.status(500).json({ msg: 'Server error fetching commissioned exams' });
    }
});

// Helper to sort papers in standard exam subject order
const getSubjectOrderWeight = (subject, examType) => {
    const s = (subject || '').toLowerCase().trim();
    if (examType === 'NEET') {
        if (s.includes('physic')) return 1;
        if (s.includes('chem')) return 2;
        if (s.includes('botan')) return 3;
        if (s.includes('zool')) return 4;
        if (s.includes('bio')) return 5;
    } else if (examType === 'JEE') {
        if (s.includes('physic')) return 1;
        if (s.includes('chem')) return 2;
        if (s.includes('math')) return 3;
    } else { // CET
        if (s.includes('physic')) return 1;
        if (s.includes('chem')) return 2;
        if (s.includes('math')) return 3;
        if (s.includes('bio') || s.includes('botan') || s.includes('zool')) return 4;
    }
    return 10;
};

// ─────────────────────────────────────────────────────────────────
// ADMIN: Merge Subject Papers into one Unified Assessment Paper & OnlineExam
// POST /api/exams/merge
// ─────────────────────────────────────────────────────────────────
router.post('/merge', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { examId, title, examType: reqExamType, paperIds: reqPaperIds, instructions, start_time, end_time, duration_minutes, allowedStudents } = req.body;

        let exam = null;
        let paperIds = reqPaperIds || [];
        let examType = reqExamType || 'CET';

        if (examId) {
            exam = await OnlineExam.findById(examId).populate('subjectAssignments.submittedPaperId');
            if (!exam) return res.status(404).json({ msg: 'Commissioned exam not found.' });
            examType = exam.examType || examType;

            // 1. Collect all submitted papers from exam assignments
            if (Array.isArray(exam.subjectAssignments)) {
                for (const sa of exam.subjectAssignments) {
                    if (sa.submittedPaperId) {
                        const pid = sa.submittedPaperId._id ? sa.submittedPaperId._id.toString() : sa.submittedPaperId.toString();
                        if (!paperIds.includes(pid)) paperIds.push(pid);
                    }
                }
            }

            // 2. Also find papers created with examId matching this exam
            const linkedPapers = await Paper.find({ examId: exam._id });
            for (const lp of linkedPapers) {
                const lpid = lp._id.toString();
                if (!paperIds.includes(lpid)) paperIds.push(lpid);
            }

            // 3. Fallback: match by teacher and subject in Paper collection
            if (paperIds.length === 0) {
                const allPapers = await Paper.find({}).sort({ createdAt: -1 });
                for (const sa of (exam.subjectAssignments || [])) {
                    const saSub = (sa.subject || '').toLowerCase().trim();
                    const saTid = sa.teacherId ? sa.teacherId.toString() : null;

                    const matchedPaper = allPapers.find(p => {
                        const pSub = (p.subject || '').toLowerCase().trim();
                        const pTid = p.teacherId ? p.teacherId.toString() : null;
                        const pTitle = (p.title || '').toLowerCase().trim();
                        const exTitle = (exam.title || '').toLowerCase().trim();

                        if (saTid && pTid === saTid && (pSub === saSub || pSub.includes(saSub) || saSub.includes(pSub))) return true;
                        if (exTitle && pTitle.includes(exTitle) && (pSub === saSub || pSub.includes(saSub))) return true;
                        if (pSub === saSub && p.questions && p.questions.length > 0) return true;
                        return false;
                    });

                    if (matchedPaper) {
                        const mpid = matchedPaper._id.toString();
                        if (!paperIds.includes(mpid)) paperIds.push(mpid);
                        sa.submittedPaperId = matchedPaper._id;
                    }
                }
            }
        }

        const { Types: { ObjectId } } = require('mongoose');
        const objectIds = paperIds.map(id => typeof id === 'string' ? new ObjectId(id) : id);
        let papers = objectIds.length > 0 ? await Paper.find({ _id: { $in: objectIds } }) : [];

        if (papers.length === 0 && (!exam || !Array.isArray(exam.questions) || exam.questions.length === 0)) {
            return res.status(400).json({ msg: 'No subject papers found to merge. Please ensure faculty have submitted questions or select papers from the list.' });
        }

        // Sort papers into standard subject order (Physics -> Chemistry -> Mathematics -> Biology/Botany/Zoology)
        papers.sort((a, b) => getSubjectOrderWeight(a.subject, examType) - getSubjectOrderWeight(b.subject, examType));

        // Hydrate questions for each paper from Supabase / MongoDB
        const hydratedPapers = await Promise.all(papers.map(async (p) => {
            const pObj = p.toObject();
            if (Array.isArray(pObj.questions) && pObj.questions.length > 0) {
                if (typeof pObj.questions[0] === 'object' && (pObj.questions[0].questionText || pObj.questions[0].question)) {
                    return pObj;
                }
                const stringIds = pObj.questions.map(q => typeof q === 'string' ? q : (q._id || q.id)).filter(Boolean);
                if (stringIds.length > 0 && typeof pObj.questions[0] === 'string') {
                    try {
                        const fetched = await supabaseQuestions.getQuestionsByIds(stringIds);
                        if (fetched && fetched.length > 0) {
                            const map = new Map(fetched.map(q => [(q._id || q.id).toString(), q]));
                            const ordered = stringIds.map(id => map.get(id.toString())).filter(Boolean);
                            pObj.questions = ordered.length > 0 ? ordered : fetched;
                        } else if (Array.isArray(pObj.questionObjects) && pObj.questionObjects.length > 0) {
                            pObj.questions = pObj.questionObjects;
                        }
                    } catch (e) {
                        if (Array.isArray(pObj.questionObjects) && pObj.questionObjects.length > 0) {
                            pObj.questions = pObj.questionObjects;
                        }
                    }
                }
            } else if (Array.isArray(pObj.questionObjects) && pObj.questionObjects.length > 0) {
                pObj.questions = pObj.questionObjects;
            }
            return pObj;
        }));

        // Merge questions preserving all fields, solutions (SOE), answer keys, statements, and sections
        const seen = new Set();
        const mergedQuestions = [];
        const sectionsMap = {};

        for (const paper of hydratedPapers) {
            const sub = paper.subject || 'General';
            const questionsList = Array.isArray(paper.questions) ? paper.questions : [];

            const defSecName = `${sub} - Section A`;
            if (!sectionsMap[defSecName]) {
                sectionsMap[defSecName] = {
                    sectionName: defSecName,
                    numQuestions: questionsList.length,
                    allowedToAnswer: 0,
                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                };
            }

            for (const q of questionsList) {
                const qIdStr = (q._id || q.id || q.questionId || Math.random().toString()).toString();
                if (!seen.has(qIdStr)) {
                    seen.add(qIdStr);

                    // Ensure options is an array of strings or formatted option objects
                    const formattedOptions = Array.isArray(q.options)
                        ? q.options.map(opt => typeof opt === 'object' ? (opt.text || opt.optionText || '') : String(opt || ''))
                        : [q.opt_a || '', q.opt_b || '', q.opt_c || '', q.opt_d || ''];

                    const formattedQ = {
                        _id: q._id || q.id,
                        questionId: q._id || q.id || q.questionId,
                        subject: q.subject || sub,
                        chapter: q.chapter || '',
                        concept: q.concept || '',
                        subConcept: q.subConcept || '',
                        level: q.level || 'medium',
                        questionText: q.questionText || q.question || '',
                        options: formattedOptions,
                        answer: q.answer || q.correct_option || 'A',
                        solutionText: q.solutionText || q.solution_text || '',
                        statements: Array.isArray(q.statements) ? q.statements : [],
                        assertion: q.assertion || '',
                        reason: q.reason || '',
                        matchPairs: Array.isArray(q.matchPairs) ? q.matchPairs : [],
                        imageUrl: q.imageUrl || q.image_url || null,
                        marks: q.marks || 4,
                        negativeMarks: q.negativeMarks || 1,
                        type: q.type || 'MCQ',
                        sectionName: defSecName,
                        questionTextTranslation: q.questionTextTranslation || '',
                        optionsTranslation: q.optionsTranslation || []
                    };

                    mergedQuestions.push(formattedQ);
                }
            }
        }

        // Fallback: If no papers hydrated but exam already has questions directly attached
        if (mergedQuestions.length === 0 && exam && Array.isArray(exam.questions) && exam.questions.length > 0) {
            for (const q of exam.questions) {
                const sub = q.subject || 'General';
                const defSecName = q.sectionName || `${sub} - Section A`;
                if (!sectionsMap[defSecName]) {
                    sectionsMap[defSecName] = {
                        sectionName: defSecName,
                        numQuestions: 1,
                        allowedToAnswer: 0,
                        markingRules: { correct: q.marks || 4, incorrect: -(q.negativeMarks || 1), unattempted: 0 }
                    };
                } else {
                    sectionsMap[defSecName].numQuestions += 1;
                }
                mergedQuestions.push(q);
            }
        }

        if (mergedQuestions.length === 0) {
            return res.status(400).json({ msg: 'No questions found across subject assignments to merge. Please ensure faculty have generated papers for this exam.' });
        }

        const mergedExamTitle = title || (exam ? exam.title : `Merged ${examType} Comprehensive Exam`);
        const finalDuration = duration_minutes || (exam ? exam.duration_minutes : 180) || 180;

        // 1. Create or Update the unified Paper document for A4 Preview, Analysis, SOE, Answer Key, PQRS
        let mergedPaper = null;
        if (exam && exam.mergedPaperId) {
            mergedPaper = await Paper.findById(exam.mergedPaperId);
        }

        const paperPayload = {
            title: `${mergedExamTitle} (Complete Assessment)`,
            subject: examType === 'CET' ? 'PCMB (Merged)' : examType === 'NEET' ? 'PCB (Merged)' : 'PCM (Merged)',
            classes: exam ? exam.classes : ['12'],
            teacherId: req.user.id,
            examId: exam ? exam._id : undefined,
            questions: mergedQuestions,
            questionObjects: mergedQuestions,
            duration: `${finalDuration} Minutes`,
            status: 'Approved',
            pattern: Object.values(sectionsMap)
        };

        if (mergedPaper) {
            Object.assign(mergedPaper, paperPayload);
            await mergedPaper.save();
        } else {
            mergedPaper = new Paper(paperPayload);
            await mergedPaper.save();
        }

        // 2. Save / Update OnlineExam
        if (!exam) {
            exam = new OnlineExam({
                title: mergedExamTitle,
                examType,
                sourcePapers: paperIds,
                mergedPaperId: mergedPaper._id,
                questions: mergedQuestions,
                sections: Object.values(sectionsMap),
                instructions: instructions || getDefaultInstructions(examType),
                start_time: start_time || null,
                end_time: end_time || null,
                duration_minutes: finalDuration,
                status: start_time ? 'scheduled' : 'draft',
                shuffleQuestions: req.body.shuffleQuestions || false,
                examMode: req.body.examMode || 'ONLINE',
                allowedStudents: Array.isArray(allowedStudents) ? allowedStudents : [],
                createdBy: req.user.id
            });
        } else {
            exam.sourcePapers = paperIds;
            exam.mergedPaperId = mergedPaper._id;
            exam.questions = mergedQuestions;
            exam.sections = Object.values(sectionsMap);
            exam.duration_minutes = finalDuration;
            if (instructions) exam.instructions = instructions;
            if (start_time) exam.start_time = start_time;
            if (end_time) exam.end_time = end_time;
        }

        await exam.save();

        res.status(200).json({
            msg: `Successfully merged ${papers.length} subject papers (${mergedQuestions.length} total questions) for ${mergedExamTitle}!`,
            exam,
            paper: mergedPaper,
            totalQuestions: mergedQuestions.length
        });
    } catch (err) {
        console.error('Merge error:', err);
        res.status(500).json({ msg: 'Server error merging exam papers', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: 1-Click Launch / Publish Online Exam
// POST /api/exams/:id/quick-launch
// ─────────────────────────────────────────────────────────────────
router.post('/:id/quick-launch', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const { duration_minutes, action } = req.body; // action: 'launch_now' | 'stop_now' | 'schedule'
        const duration = duration_minutes || exam.duration_minutes || 180;

        if (action === 'stop_now') {
            exam.status = 'ended';
            exam.end_time = new Date();
        } else {
            // Instant Launch
            const now = new Date();
            exam.status = 'live';
            exam.start_time = now;
            exam.end_time = new Date(now.getTime() + duration * 60 * 1000);
            exam.duration_minutes = duration;
        }

        await exam.save();

        res.json({
            msg: exam.status === 'live' ? `Exam is now LIVE for students!` : `Exam has been stopped.`,
            exam,
            studentUrl: `/exam/${exam._id}/instructions`,
            examCode: exam._id.toString().slice(-6).toUpperCase()
        });
    } catch (err) {
        console.error('Quick launch error:', err);
        res.status(500).json({ msg: 'Server error launching exam' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Create exam from a Grand Test paper
// POST /api/exams/from-grand-test
// ─────────────────────────────────────────────────────────────────
router.post('/from-grand-test', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { grandTestId, title, instructions, start_time, end_time, duration_minutes, allowedStudents } = req.body;

        const GrandTestPaper = require('../models/GrandTestPaper');
        const Question = require('../models/Question');

        const gt = await GrandTestPaper.findById(grandTestId).populate('questions');
        if (!gt) return res.status(404).json({ msg: 'Grand Test not found' });

        const mergedQuestions = gt.questions.map(q => ({
            questionId: q._id,
            subject: q.subject,
            chapter: q.chapter,
            concept: q.concept,
            questionText: q.questionText,
            options: q.options || [],
            answer: q.answer,
            imageUrl: q.imageUrl || null,
            marks: q.type === 'NUMERICAL' ? 4 : 4,
            negativeMarks: q.type === 'NUMERICAL' ? 0 : 1,
            type: q.type || 'MCQ'
        }));

        const getDefaultInstructions = (examType) => `This is a ${examType} Grand Test. Read all questions carefully.`;

        const exam = new OnlineExam({
            title: title || gt.title,
            examType: gt.examType,
            sourcePapers: [],
            sourceGrandTest: grandTestId,
            questions: mergedQuestions,
            instructions: instructions || getDefaultInstructions(gt.examType),
            start_time: start_time || null,
            end_time: end_time || null,
            duration_minutes: duration_minutes || 180,
            status: start_time ? 'scheduled' : 'draft',
            examMode: req.body.examMode || 'ONLINE',
            allowedStudents: Array.isArray(allowedStudents) ? allowedStudents : [],
            createdBy: req.user.id
        });

        await exam.save();
        res.status(201).json({ msg: 'Grand Test Exam created successfully', exam });
    } catch (err) {
        console.error('Grand Test exam creation error:', err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Create & Launch Online CBT Exam from an existing Faculty Paper
// POST /api/exams/from-single-paper
// ─────────────────────────────────────────────────────────────────
router.post('/from-single-paper', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { paperId, title, examType, duration_minutes, action } = req.body;
        if (!paperId) return res.status(400).json({ msg: 'Paper ID is required' });

        const paper = await Paper.findById(paperId);
        if (!paper) return res.status(404).json({ msg: 'Paper not found' });

        let resolvedQuestions = [];
        if (Array.isArray(paper.questions) && paper.questions.length > 0) {
            if (typeof paper.questions[0] === 'object' && (paper.questions[0].questionText || paper.questions[0].question)) {
                resolvedQuestions = paper.questions;
            } else {
                const stringIds = paper.questions.map(q => (typeof q === 'string' ? q : (q._id || q.id))).filter(Boolean);
                resolvedQuestions = await supabaseQuestions.getQuestionsByIds(stringIds);
            }
        }

        const formattedQuestions = resolvedQuestions.map(q => ({
            questionId: q._id || q.id,
            subject: q.subject || paper.subject,
            chapter: q.chapter || '',
            concept: q.concept || '',
            questionText: q.questionText || q.question || '',
            options: q.options || [],
            answer: q.answer || 'A',
            imageUrl: q.imageUrl || q.image_url || null,
            solutionText: q.solutionText || q.solution_text || '',
            marks: q.type === 'NUMERICAL' ? 4 : 4,
            negativeMarks: q.type === 'NUMERICAL' ? 0 : 1,
            type: q.type || 'MCQ'
        }));

        const isLive = action === 'launch' || action === 'live';
        const newExam = new OnlineExam({
            title: title || paper.title || 'Online Assessment',
            examType: examType || paper.examType || 'CET',
            classes: Array.isArray(paper.classes) ? paper.classes : [paper.classes || '12'],
            sourcePapers: [paperId],
            questions: formattedQuestions,
            instructions: `Online Examination for ${paper.title || 'Assessment'}. Read all questions carefully.`,
            duration_minutes: duration_minutes || paper.duration || 180,
            status: isLive ? 'live' : 'scheduled',
            start_time: isLive ? new Date() : (req.body.start_time || new Date()),
            end_time: req.body.end_time || null,
            examMode: 'ONLINE',
            createdBy: req.user.id
        });

        await newExam.save();
        res.status(201).json({ msg: `Exam successfully ${isLive ? 'launched live' : 'created'} for Online CBT Exam Portal`, exam: newExam });
    } catch (err) {
        console.error('Error creating exam from paper:', err.message);
        res.status(500).json({ msg: 'Server error creating exam from paper', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// PUBLIC: Get all active / live / scheduled online exams for static exam portal
// GET /api/exams/public/live
// ─────────────────────────────────────────────────────────────────
router.get('/public/live', async (req, res) => {
    try {
        const now = new Date();

        // 1. Auto-transition scheduled -> live
        await OnlineExam.updateMany(
            { status: 'scheduled', start_time: { $lte: now } },
            { $set: { status: 'live' } }
        );

        // 2. Auto-transition live -> ended
        await OnlineExam.updateMany(
            { status: 'live', end_time: { $lte: now } },
            { $set: { status: 'ended' } }
        );

        const { rollNumber, search } = req.query;

        const query = {
            status: { $in: ['live', 'scheduled', 'ended'] }
        };

        const exams = await OnlineExam.find(query)
            .select('title examType duration_minutes start_time end_time instructions status questions classes is_ip_restricted')
            .sort({ status: 1, start_time: 1, createdAt: -1 });

        const result = exams.map(e => ({
            _id: e._id,
            title: e.title,
            examType: e.examType,
            duration_minutes: e.duration_minutes || 180,
            start_time: e.start_time,
            end_time: e.end_time,
            instructions: e.instructions,
            status: e.status,
            questionsCount: Array.isArray(e.questions) ? e.questions.length : 0,
            classes: e.classes || [],
            is_ip_restricted: !!e.is_ip_restricted
        }));

        res.json(result);
    } catch (err) {
        console.error('Error fetching public live exams:', err.message);
        res.status(500).json({ msg: 'Server error fetching live exams' });
    }
});

// ─────────────────────────────────────────────────────────────────
// PUBLIC / STUDENT: Get all active / live / scheduled exams for student lab portal
// GET /api/exams/lab-active
// ─────────────────────────────────────────────────────────────────
router.get('/lab-active', async (req, res) => {
    try {
        const now = new Date();

        // 1. Transition scheduled -> live
        await OnlineExam.updateMany(
            { status: 'scheduled', start_time: { $lte: now } },
            { $set: { status: 'live' } }
        );

        // 2. Transition live -> ended
        await OnlineExam.updateMany(
            { status: 'live', end_time: { $lte: now } },
            { $set: { status: 'ended' } }
        );

        const query = {
            isOnlineVisible: { $ne: false },
            status: { $in: ['live', 'scheduled', 'ended'] }
        };

        const exams = await OnlineExam.find(query)
            .select('title examType duration_minutes start_time end_time instructions status questions classes isOnlineVisible is_ip_restricted allowedStudents')
            .sort({ status: 1, start_time: 1, createdAt: -1 });

        const result = exams.map(e => ({
            _id: e._id,
            id: e._id,
            title: e.title,
            examType: e.examType,
            duration_minutes: e.duration_minutes || 180,
            durationMinutes: e.duration_minutes || 180,
            start_time: e.start_time,
            end_time: e.end_time,
            instructions: e.instructions,
            status: e.status,
            questionsCount: Array.isArray(e.questions) ? e.questions.length : 0,
            classes: e.classes || [],
            isOnlineVisible: e.isOnlineVisible !== false,
            allowedStudents: e.allowedStudents || []
        }));

        res.json({ exams: result });
    } catch (err) {
        console.error('Error fetching lab active exams:', err);
        res.status(500).json({ msg: 'Server error fetching lab active exams' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Quick Toggle Online Exam Visibility (Enable / Hide)
// PUT /api/exams/:id/toggle-online-visibility
// ─────────────────────────────────────────────────────────────────
router.put('/:id/toggle-online-visibility', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const currentlyActive = exam.isOnlineVisible !== false && exam.status !== 'draft' && exam.status !== 'archived';

        if (currentlyActive) {
            // Toggle to Hidden
            exam.isOnlineVisible = false;
            exam.status = 'draft';
        } else {
            // Toggle to Enabled / Live
            exam.isOnlineVisible = true;
            const now = new Date();
            const duration = exam.duration_minutes || 180;

            if (exam.start_time && new Date(exam.start_time) > now) {
                exam.status = 'scheduled';
                if (!exam.end_time) {
                    exam.end_time = new Date(new Date(exam.start_time).getTime() + duration * 60 * 1000);
                }
            } else {
                exam.status = 'live';
                if (!exam.start_time || exam.status === 'ended') {
                    exam.start_time = now;
                    exam.end_time = new Date(now.getTime() + duration * 60 * 1000);
                }
            }
        }

        exam.updatedAt = new Date();
        await exam.save();

        res.json({
            msg: exam.isOnlineVisible && exam.status !== 'draft'
                ? `🟢 Exam "${exam.title}" is now LIVE & visible to students!`
                : `⚪ Exam "${exam.title}" is now hidden from students.`,
            isOnlineVisible: exam.isOnlineVisible,
            status: exam.status,
            exam
        });
    } catch (err) {
        console.error('Error toggling online visibility:', err);
        res.status(500).json({ msg: 'Server error toggling visibility', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: 1-Click Generate Question Papers & Online Exams for All 4 Formats (NEET, JEE, CET, Assessment)
// POST /api/exams/batch-generate-all-four
// ─────────────────────────────────────────────────────────────────
router.post('/batch-generate-all-four', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const {
            baseTitle,
            classes,
            duration_minutes = 180,
            start_time,
            end_time,
            isLive = true,
            selectedExams = ['NEET', 'JEE', 'CET', 'Assessment']
        } = req.body;

        const titlePrefix = (baseTitle || 'Grand Mock Examination 2026').trim();
        const selectedClass = Array.isArray(classes) && classes.length > 0 ? classes[0] : (classes || '12');
        const defaultClasses = Array.isArray(classes) ? classes : [selectedClass];

        const defaultInstructions = (type) =>
            `Institutional ${type} Examination. Total duration: ${duration_minutes} minutes. Please read all questions carefully.`;

        // Helper to query question pool for given subject & count
        const fetchSubjectQuestions = async (subject, targetCount) => {
            try {
                // 1. Try Supabase question bank
                const filters = {
                    subject,
                    classes: selectedClass,
                    limit: Math.max(targetCount, 50)
                };
                const resSupa = await supabaseQuestions.getQuestions(filters, 1, Math.max(targetCount * 2, 70));
                let qs = resSupa.questions || [];

                // Fallback without class constraint if needed
                if (qs.length < targetCount) {
                    const fallbackRes = await supabaseQuestions.getQuestions({ subject }, 1, 100);
                    const extra = (fallbackRes.questions || []).filter(q => !qs.some(existing => (existing._id || existing.id) === (q._id || q.id)));
                    qs = [...qs, ...extra];
                }

                // If Botany/Zoology requested and few questions, query Biology
                if (qs.length < targetCount && (subject.toLowerCase() === 'botany' || subject.toLowerCase() === 'zoology')) {
                    const bioRes = await supabaseQuestions.getQuestions({ subject: 'Biology' }, 1, 100);
                    const extraBio = (bioRes.questions || []).filter(q => !qs.some(existing => (existing._id || existing.id) === (q._id || q.id)));
                    qs = [...qs, ...extraBio];
                }

                // Check MongoDB Question model fallback
                if (qs.length < targetCount) {
                    const mongoQs = await Question.find({ subject: new RegExp(subject, 'i') }).limit(targetCount * 2).lean();
                    const extraMongo = (mongoQs || []).filter(q => !qs.some(existing => (existing._id || existing.id).toString() === q._id.toString()));
                    qs = [...qs, ...extraMongo];
                }

                return qs.slice(0, targetCount).map((q, idx) => ({
                    _id: q._id || q.id,
                    questionId: q._id || q.id || q.questionId,
                    subject: q.subject || subject,
                    chapter: q.chapter || 'General',
                    concept: q.concept || q.topic || 'General',
                    subConcept: q.subConcept || '',
                    level: q.level || 'medium',
                    questionText: q.questionText || q.question || '',
                    options: Array.isArray(q.options) ? q.options : [q.opt_a, q.opt_b, q.opt_c, q.opt_d].filter(Boolean),
                    answer: q.answer || q.correct_option || 'A',
                    solutionText: q.solutionText || q.solution_text || '',
                    statements: Array.isArray(q.statements) ? q.statements : [],
                    assertion: q.assertion || '',
                    reason: q.reason || '',
                    imageUrl: q.imageUrl || q.image_url || null,
                    marks: q.type === 'NUMERICAL' ? 4 : (subject === 'CET' ? 1 : 4),
                    negativeMarks: q.type === 'NUMERICAL' ? 0 : (subject === 'CET' ? 0 : 1),
                    type: q.type || 'MCQ'
                }));
            } catch (err) {
                console.error(`Batch fetch error for ${subject}:`, err.message);
                return [];
            }
        };

        // Cache subject question pools for efficiency
        const [physicsPool, chemistryPool, mathPool, botanyPool, zoologyPool, biologyPool] = await Promise.all([
            fetchSubjectQuestions('Physics', 65),
            fetchSubjectQuestions('Chemistry', 65),
            fetchSubjectQuestions('Mathematics', 65),
            fetchSubjectQuestions('Botany', 50),
            fetchSubjectQuestions('Zoology', 50),
            fetchSubjectQuestions('Biology', 65)
        ]);

        const bioCombined = botanyPool.length >= 40 && zoologyPool.length >= 40
            ? [...botanyPool, ...zoologyPool]
            : (biologyPool.length > 0 ? biologyPool : [...botanyPool, ...zoologyPool]);

        const createdExams = [];
        const createdPapers = [];

        const now = new Date();
        const effectiveStart = start_time ? new Date(start_time) : now;
        const effectiveEnd = end_time ? new Date(end_time) : new Date(effectiveStart.getTime() + duration_minutes * 60 * 1000);
        const examStatus = isLive ? 'live' : (start_time && new Date(start_time) > now ? 'scheduled' : 'live');

        // ── 1. NEET ──
        if (selectedExams.includes('NEET')) {
            const neetPhysics = physicsPool.slice(0, 45).map(q => ({ ...q, sectionName: 'Physics - Section A' }));
            const neetChemistry = chemistryPool.slice(0, 45).map(q => ({ ...q, sectionName: 'Chemistry - Section A' }));
            const neetBotany = (botanyPool.length >= 45 ? botanyPool.slice(0, 45) : bioCombined.slice(0, 45)).map(q => ({ ...q, subject: 'Botany', sectionName: 'Botany - Section A' }));
            const neetZoology = (zoologyPool.length >= 45 ? zoologyPool.slice(0, 45) : bioCombined.slice(45, 90)).map(q => ({ ...q, subject: 'Zoology', sectionName: 'Zoology - Section A' }));
            const neetQuestions = [...neetPhysics, ...neetChemistry, ...neetBotany, ...neetZoology];

            const neetPaper = new Paper({
                title: `${titlePrefix} (NEET Full Assessment)`,
                subject: 'PCB (NEET Pattern)',
                classes: defaultClasses,
                teacherId: req.user.id,
                questions: neetQuestions,
                questionObjects: neetQuestions,
                duration: `${duration_minutes} Minutes`,
                status: 'Approved',
                pattern: [
                    { sectionName: 'Physics - Section A', numQuestions: neetPhysics.length, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } },
                    { sectionName: 'Chemistry - Section A', numQuestions: neetChemistry.length, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } },
                    { sectionName: 'Botany - Section A', numQuestions: neetBotany.length, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } },
                    { sectionName: 'Zoology - Section A', numQuestions: neetZoology.length, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } }
                ]
            });
            await neetPaper.save();
            createdPapers.push(neetPaper);

            const neetExam = new OnlineExam({
                title: `${titlePrefix} - NEET Grand Mock`,
                examType: 'NEET',
                classes: defaultClasses,
                mergedPaperId: neetPaper._id,
                sourcePapers: [neetPaper._id],
                questions: neetQuestions,
                sections: neetPaper.pattern,
                instructions: defaultInstructions('NEET'),
                duration_minutes,
                start_time: effectiveStart,
                end_time: effectiveEnd,
                status: examStatus,
                isOnlineVisible: true,
                examMode: 'ONLINE',
                createdBy: req.user.id
            });
            await neetExam.save();
            createdExams.push(neetExam);
        }

        // ── 2. JEE ──
        if (selectedExams.includes('JEE')) {
            const jeePhysics = physicsPool.slice(0, 25).map(q => ({ ...q, sectionName: 'Physics - Section A' }));
            const jeeChemistry = chemistryPool.slice(0, 25).map(q => ({ ...q, sectionName: 'Chemistry - Section A' }));
            const jeeMath = mathPool.slice(0, 25).map(q => ({ ...q, sectionName: 'Mathematics - Section A' }));
            const jeeQuestions = [...jeePhysics, ...jeeChemistry, ...jeeMath];

            const jeePaper = new Paper({
                title: `${titlePrefix} (JEE Main Assessment)`,
                subject: 'PCM (JEE Pattern)',
                classes: defaultClasses,
                teacherId: req.user.id,
                questions: jeeQuestions,
                questionObjects: jeeQuestions,
                duration: `${duration_minutes} Minutes`,
                status: 'Approved',
                pattern: [
                    { sectionName: 'Physics - Section A', numQuestions: jeePhysics.length, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } },
                    { sectionName: 'Chemistry - Section A', numQuestions: jeeChemistry.length, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } },
                    { sectionName: 'Mathematics - Section A', numQuestions: jeeMath.length, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } }
                ]
            });
            await jeePaper.save();
            createdPapers.push(jeePaper);

            const jeeExam = new OnlineExam({
                title: `${titlePrefix} - JEE Main Mock`,
                examType: 'JEE',
                classes: defaultClasses,
                mergedPaperId: jeePaper._id,
                sourcePapers: [jeePaper._id],
                questions: jeeQuestions,
                sections: jeePaper.pattern,
                instructions: defaultInstructions('JEE Main'),
                duration_minutes,
                start_time: effectiveStart,
                end_time: effectiveEnd,
                status: examStatus,
                isOnlineVisible: true,
                examMode: 'ONLINE',
                createdBy: req.user.id
            });
            await jeeExam.save();
            createdExams.push(jeeExam);
        }

        // ── 3. CET / KCET ──
        if (selectedExams.includes('CET')) {
            const cetPhysics = physicsPool.slice(0, 60).map(q => ({ ...q, marks: 1, negativeMarks: 0, sectionName: 'Physics - Section A' }));
            const cetChemistry = chemistryPool.slice(0, 60).map(q => ({ ...q, marks: 1, negativeMarks: 0, sectionName: 'Chemistry - Section A' }));
            const cetMath = mathPool.slice(0, 60).map(q => ({ ...q, marks: 1, negativeMarks: 0, sectionName: 'Mathematics - Section A' }));
            const cetBio = (biologyPool.length >= 60 ? biologyPool.slice(0, 60) : bioCombined.slice(0, 60)).map(q => ({ ...q, marks: 1, negativeMarks: 0, sectionName: 'Biology - Section A' }));
            const cetQuestions = [...cetPhysics, ...cetChemistry, ...cetMath, ...cetBio];

            const cetPaper = new Paper({
                title: `${titlePrefix} (CET Unified PCMB Assessment)`,
                subject: 'PCMB (CET Pattern)',
                classes: defaultClasses,
                teacherId: req.user.id,
                questions: cetQuestions,
                questionObjects: cetQuestions,
                duration: `${duration_minutes} Minutes`,
                status: 'Approved',
                pattern: [
                    { sectionName: 'Physics - Section A', numQuestions: cetPhysics.length, markingRules: { correct: 1, incorrect: 0, unattempted: 0 } },
                    { sectionName: 'Chemistry - Section A', numQuestions: cetChemistry.length, markingRules: { correct: 1, incorrect: 0, unattempted: 0 } },
                    { sectionName: 'Mathematics - Section A', numQuestions: cetMath.length, markingRules: { correct: 1, incorrect: 0, unattempted: 0 } },
                    { sectionName: 'Biology - Section A', numQuestions: cetBio.length, markingRules: { correct: 1, incorrect: 0, unattempted: 0 } }
                ]
            });
            await cetPaper.save();
            createdPapers.push(cetPaper);

            const cetExam = new OnlineExam({
                title: `${titlePrefix} - CET Grand Assessment`,
                examType: 'CET',
                classes: defaultClasses,
                mergedPaperId: cetPaper._id,
                sourcePapers: [cetPaper._id],
                questions: cetQuestions,
                sections: cetPaper.pattern,
                instructions: defaultInstructions('CET'),
                duration_minutes,
                start_time: effectiveStart,
                end_time: effectiveEnd,
                status: examStatus,
                isOnlineVisible: true,
                examMode: 'ONLINE',
                createdBy: req.user.id
            });
            await cetExam.save();
            createdExams.push(cetExam);
        }

        // ── 4. Assessment / Board ──
        if (selectedExams.includes('Assessment')) {
            const assessPhysics = physicsPool.slice(0, 25).map(q => ({ ...q, sectionName: 'Physics Section' }));
            const assessChem = chemistryPool.slice(0, 25).map(q => ({ ...q, sectionName: 'Chemistry Section' }));
            const assessMath = mathPool.slice(0, 25).map(q => ({ ...q, sectionName: 'Mathematics Section' }));
            const assessBio = (biologyPool.length >= 25 ? biologyPool.slice(0, 25) : bioCombined.slice(0, 25)).map(q => ({ ...q, sectionName: 'Biology Section' }));
            const assessQuestions = [...assessPhysics, ...assessChem, ...assessMath, ...assessBio];

            const assessPaper = new Paper({
                title: `${titlePrefix} (Institutional Board Assessment)`,
                subject: 'PCMB (Board Assessment)',
                classes: defaultClasses,
                teacherId: req.user.id,
                questions: assessQuestions,
                questionObjects: assessQuestions,
                duration: `${duration_minutes} Minutes`,
                status: 'Approved',
                pattern: [
                    { sectionName: 'Physics Section', numQuestions: assessPhysics.length, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } },
                    { sectionName: 'Chemistry Section', numQuestions: assessChem.length, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } },
                    { sectionName: 'Mathematics Section', numQuestions: assessMath.length, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } },
                    { sectionName: 'Biology Section', numQuestions: assessBio.length, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } }
                ]
            });
            await assessPaper.save();
            createdPapers.push(assessPaper);

            const assessExam = new OnlineExam({
                title: `${titlePrefix} - Institutional Assessment`,
                examType: 'CET',
                classes: defaultClasses,
                mergedPaperId: assessPaper._id,
                sourcePapers: [assessPaper._id],
                questions: assessQuestions,
                sections: assessPaper.pattern,
                instructions: defaultInstructions('Institutional Assessment'),
                duration_minutes,
                start_time: effectiveStart,
                end_time: effectiveEnd,
                status: examStatus,
                isOnlineVisible: true,
                examMode: 'ONLINE',
                createdBy: req.user.id
            });
            await assessExam.save();
            createdExams.push(assessExam);
        }

        res.status(201).json({
            msg: `🎉 Successfully created ${createdPapers.length} Question Papers & ${createdExams.length} Online Exams across all selected formats!`,
            papersCount: createdPapers.length,
            examsCount: createdExams.length,
            exams: createdExams,
            papers: createdPapers
        });
    } catch (err) {
        console.error('Batch generation error:', err);
        res.status(500).json({ msg: 'Server error generating batch exam papers', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: List all online exams
// GET /api/exams
// ─────────────────────────────────────────────────────────────────
router.get('/', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const now = new Date();
        
        // 1. Transition scheduled -> live
        await OnlineExam.updateMany(
            { status: 'scheduled', start_time: { $lte: now } },
            { $set: { status: 'live' } }
        );
        
        // 2. Transition live -> ended
        await OnlineExam.updateMany(
            { status: 'live', end_time: { $lte: now } },
            { $set: { status: 'ended' } }
        );

        const exams = await OnlineExam.find()
            .select('-questions.answer') // Don't leak answers in list view
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name email');
        res.json(exams);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Get single exam (full, with answers for admin)
// GET /api/exams/admin/:id
// ─────────────────────────────────────────────────────────────────
router.get('/admin/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });
        res.json(exam);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Update exam config (timing, instructions, status)
// PUT /api/exams/:id/config
// ─────────────────────────────────────────────────────────────────
router.put('/:id/config', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { start_time, end_time, duration_minutes, instructions, status, allowedStudents, examMode } = req.body;
        const update = {};
        if (start_time !== undefined) update.start_time = start_time;
        if (end_time !== undefined) update.end_time = end_time;
        if (duration_minutes !== undefined) update.duration_minutes = duration_minutes;
        if (instructions !== undefined) update.instructions = instructions;
        if (status !== undefined) update.status = status;
        if (examMode !== undefined) update.examMode = examMode;
        if (allowedStudents !== undefined) update.allowedStudents = Array.isArray(allowedStudents) ? allowedStudents : [];
        update.updatedAt = new Date();

        const exam = await OnlineExam.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });
        res.json({ msg: 'Exam updated', exam });
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});



// Seeded shuffle helper for deterministic question order
const seededShuffle = (arr, seed) => {
    let m = arr.length, t, i;
    let seedNum = 0;
    for (let charIdx = 0; charIdx < seed.length; charIdx++) {
        seedNum += seed.charCodeAt(charIdx);
    }
    const random = () => {
        let x = Math.sin(seedNum++) * 10000;
        return x - Math.floor(x);
    };
    const shuffled = [...arr];
    while (m) {
        i = Math.floor(random() * m--);
        t = shuffled[m];
        shuffled[m] = shuffled[i];
        shuffled[i] = t;
    }
    return shuffled;
};

// ─────────────────────────────────────────────────────────────────
// STUDENT: Get exam for taking (NO answers)
// GET /api/exams/:id/take
// ─────────────────────────────────────────────────────────────────
router.get('/:id/take', detectLabIp, async (req, res) => {
    try {
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });
        
        const isPreview = req.query.preview === 'true';
        if (!isPreview && (!['live', 'scheduled'].includes(exam.status) || exam.isOnlineVisible === false)) {
            return res.status(403).json({ msg: 'Exam is not currently available.' });
        }

        const { email, rollNumber } = req.query;
        const studentId = rollNumber || email || 'anonymous';
        let examQuestions = exam.questions;
        if (exam.shuffleQuestions) {
            examQuestions = seededShuffle(exam.questions, `${studentId}-${exam._id}`);
        }

        // Strip answers before sending to student
        const safeExam = {
            _id: exam._id,
            title: exam.title,
            examType: exam.examType,
            instructions: exam.instructions,
            duration_minutes: exam.duration_minutes,
            start_time: exam.start_time,
            end_time: exam.end_time,
            status: exam.status,
            questions: examQuestions.map(q => ({
                _id: q._id,
                questionId: q.questionId,
                subject: q.subject,
                chapter: q.chapter,
                concept: q.concept,
                questionText: q.questionText,
                options: q.options,
                statements: q.statements || [],
                assertion: q.assertion || '',
                reason: q.reason || '',
                matchPairs: q.matchPairs || [],
                imageUrl: q.imageUrl,
                marks: q.marks,
                type: q.type || 'MCQ'
            }))
        };
        res.json(safeExam);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Start session
// POST /api/exams/:id/start
// ─────────────────────────────────────────────────────────────────
router.post('/:id/start', detectLabIp, async (req, res) => {
    try {
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const { studentName, studentEmail, rollNumber } = req.body;

        if (exam.allowedStudents && exam.allowedStudents.length > 0) {
            if (!exam.allowedStudents.includes(rollNumber)) {
                return res.status(403).json({ msg: 'You are not authorized to take this exam.' });
            }
        }

        const durationMinutes = exam.duration_minutes || exam.durationMinutes || 180;

        // Check for existing active session (Reconnection / Resumption)
        const existing = await ExamSession.findOne({
            examId: req.params.id,
            $or: [
                { studentEmail: studentEmail || '___nonexistent___' },
                { rollNumber: rollNumber || '___nonexistent___' }
            ],
            submitted: false
        });

        if (existing) {
            const timerState = calculateServerTimerState(existing.startTime, durationMinutes);

            // If timer expired while disconnected, auto-submit session (Module 1)
            if (timerState.is_expired) {
                const ExamBlueprint = require('../models/ExamBlueprint.js');
                let bp = null;
                if (exam.blueprintId) {
                    try { bp = await ExamBlueprint.findById(exam.blueprintId); } catch (_) {}
                }

                const analytics = calculateAssessmentAnalytics({
                    exam,
                    submittedAnswers: existing.attempts && existing.attempts.length > 0 ? existing.attempts : (existing.answers || []),
                    blueprint: bp
                });

                existing.attempts = analytics.attempts;
                existing.answers = analytics.attempts.map(a => ({
                    questionId: a.questionId,
                    selectedOption: a.user_response,
                    markedForReview: a.markedForReview,
                    visited: a.visited,
                    timeTaken: a.time_spent_seconds
                }));
                existing.summary = analytics.summary;
                existing.topic_diagnostics = analytics.topic_diagnostics;
                existing.panic_questions = analytics.panic_questions;
                existing.score = analytics.summary.total_score;
                existing.totalQuestions = analytics.summary.total_questions;
                existing.attempted = analytics.summary.total_attempted;
                existing.correct = analytics.summary.total_correct;
                existing.incorrect = analytics.summary.total_incorrect;
                existing.unattempted = analytics.summary.total_unattempted;
                existing.weakAreas = analytics.weak_areas_legacy;
                existing.submitted = true;
                existing.endTime = new Date();
                await existing.save();

                return res.json({
                    msg: 'Exam session timer expired. Exam auto-submitted.',
                    session: existing,
                    server_timer: timerState,
                    is_auto_submitted: true
                });
            }

            return res.json({
                msg: 'Session resumed',
                session: existing,
                server_timer: timerState
            });
        }

        const studentId = rollNumber || studentEmail || 'anonymous';
        let examQuestions = exam.questions;
        if (exam.shuffleQuestions) {
            examQuestions = seededShuffle(exam.questions, `${studentId}-${exam._id}`);
        }

        const now = new Date();
        const initialTimerState = calculateServerTimerState(now, durationMinutes, now);

        const initialAttempts = examQuestions.map(q => ({
            question_id: (q._id || q.questionId || '').toString(),
            subject_id: (q.subject || 'General').trim(),
            topic_id: (q.chapter || q.topic || 'General').trim(),
            subtopic_id: (q.concept || q.subConcept || 'General').trim(),
            difficulty_level: (q.level || 'medium').toLowerCase().trim(),
            user_response: null,
            correct_response: q.answer !== undefined ? q.answer : '',
            is_attempted: false,
            is_correct: false,
            time_spent_seconds: 0,
            status: QUESTION_STATUS.UNVISITED,
            // Auxiliary fields for backward compatibility
            questionId: q._id,
            selectedOption: null,
            markedForReview: false,
            visited: false,
            timeTaken: 0
        }));

        const session = new ExamSession({
            examId: req.params.id,
            studentId,
            studentName: studentName || 'Student',
            studentEmail: studentEmail || '',
            rollNumber: rollNumber || '',
            fromLabIp: req.isLabIp,
            clientIp: req.clientIp,
            startTime: now,
            attempts: initialAttempts,
            answers: initialAttempts.map(a => ({
                questionId: a.questionId,
                selectedOption: null,
                markedForReview: false,
                visited: false,
                timeTaken: 0
            })),
            totalQuestions: examQuestions.length
        });

        await session.save();
        res.status(201).json({
            msg: 'Session started',
            session,
            server_timer: initialTimerState
        });
    } catch (err) {
        console.error('Session start error:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Server Clock Synchronization
// GET /api/exams/:id/time-sync
// ─────────────────────────────────────────────────────────────────
router.get('/:id/time-sync', async (req, res) => {
    try {
        const { sessionId } = req.query;
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        let startTime = new Date();
        if (sessionId) {
            const session = await ExamSession.findById(sessionId);
            if (session && session.startTime) {
                startTime = session.startTime;
            }
        }

        const durationMinutes = exam.duration_minutes || exam.durationMinutes || 180;
        const timerState = calculateServerTimerState(startTime, durationMinutes);

        res.json({
            server_time: timerState.server_now,
            server_timer: timerState
        });
    } catch (err) {
        console.error('Time sync error:', err);
        res.status(500).json({ msg: 'Server Error syncing clock' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Submit exam (Idempotent & Comprehensive Scoring Engine)
// POST /api/exams/:id/submit
// ─────────────────────────────────────────────────────────────────
router.post('/:id/submit', detectLabIp, async (req, res) => {
    try {
        const { sessionId, answers, idempotencyKey } = req.body;
        if (!sessionId) return res.status(400).json({ msg: 'Session ID is required' });

        const session = await ExamSession.findById(sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });

        // Module 4: Idempotency protection against duplicate/concurrent submissions
        if (session.submitted) {
            return res.status(200).json({
                msg: 'Already submitted',
                session,
                sessionId: session._id,
                summary: session.summary,
                topic_diagnostics: session.topic_diagnostics,
                panic_questions: session.panic_questions
            });
        }

        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const ExamBlueprint = require('../models/ExamBlueprint.js');
        let blueprint = null;
        try {
            if (exam.blueprintId) {
                blueprint = await ExamBlueprint.findById(exam.blueprintId);
            }
        } catch (e) {
            console.error('Failed to load blueprint for grading:', e);
        }

        // Execute Comprehensive Analytics Engine (Modules 1, 2, 3, 4)
        const analytics = calculateAssessmentAnalytics({
            exam,
            submittedAnswers: Array.isArray(answers) && answers.length > 0 ? answers : (session.attempts || session.answers || []),
            blueprint
        });

        session.attempts = analytics.attempts;
        session.answers = analytics.attempts.map(a => ({
            questionId: a.questionId,
            selectedOption: a.user_response,
            markedForReview: a.markedForReview,
            visited: a.visited,
            timeTaken: a.time_spent_seconds
        }));
        session.summary = analytics.summary;
        session.topic_diagnostics = analytics.topic_diagnostics;
        session.panic_questions = analytics.panic_questions;

        // Populate legacy attributes for backward compatibility with existing views
        session.score = analytics.summary.total_score;
        session.totalQuestions = analytics.summary.total_questions;
        session.attempted = analytics.summary.total_attempted;
        session.correct = analytics.summary.total_correct;
        session.incorrect = analytics.summary.total_incorrect;
        session.unattempted = analytics.summary.total_unattempted;
        session.weakAreas = analytics.weak_areas_legacy;

        session.endTime = new Date();
        session.submitted = true;
        session.fromLabIp = req.isLabIp;
        session.clientIp = req.clientIp;
        if (idempotencyKey) session.submissionIdempotencyKey = idempotencyKey;

        await session.save();

        res.json({
            msg: 'Exam submitted successfully',
            sessionId: session._id,
            score: session.score,
            summary: session.summary,
            topic_diagnostics: session.topic_diagnostics,
            panic_questions: session.panic_questions,
            attempts: session.attempts
        });
    } catch (err) {
        console.error('Submit evaluation error:', err);
        res.status(500).json({ msg: 'Server Error evaluating submission' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Get scorecard (with Comprehensive Topic Diagnostics)
// GET /api/exams/:id/scorecard/:sessionId
// ─────────────────────────────────────────────────────────────────
router.get('/:id/scorecard/:sessionId', detectLabIp, async (req, res) => {
    try {
        const session = await ExamSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });

        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        if (exam.examMode === 'OFFLINE') {
            return res.status(403).json({ msg: 'Access denied: Scorecard is not available for offline exams.' });
        }

        const isLab = (session.fromLabIp || req.isLabIp) && process.env.LAB_IP !== '*';

        // Build question-level breakdown
        const originalQuestionIds = exam.questions.map(q => q.questionId).filter(Boolean);
        const originalQuestions = await supabaseQuestions.getQuestionsByIds(originalQuestionIds);
        const originalQuestionsMap = {};
        originalQuestions.forEach(oq => {
            const qId = (oq.id || oq._id || oq.questionId).toString();
            originalQuestionsMap[qId] = oq;
        });

        const breakdown = exam.questions.map(q => {
            const qIdStr = q._id ? q._id.toString() : '';
            const att = session.attempts?.find(a => (a.question_id || a.questionId)?.toString() === qIdStr)
                || session.answers?.find(a => a.questionId?.toString() === qIdStr);
            const origQ = q.questionId ? originalQuestionsMap[q.questionId.toString()] : null;

            const selectedResp = att?.user_response !== undefined ? att.user_response : (att?.selectedOption || null);
            const isAttempted = isResponseValid(selectedResp);

            const entry = {
                _id: q._id,
                questionId: q.questionId,
                questionText: q.questionText,
                subject: q.subject,
                chapter: q.chapter,
                concept: q.concept,
                options: q.options,
                selectedOption: selectedResp,
                user_response: selectedResp,
                markedForReview: Boolean(att?.markedForReview),
                visited: Boolean(att?.visited),
                timeTaken: att?.time_spent_seconds !== undefined ? att.time_spent_seconds : (att?.timeTaken || 0),
                time_spent_seconds: att?.time_spent_seconds !== undefined ? att.time_spent_seconds : (att?.timeTaken || 0),
                is_attempted: isAttempted,
                is_correct: Boolean(att?.is_correct),
                status: att?.status || (isAttempted ? QUESTION_STATUS.ANSWERED : QUESTION_STATUS.UNVISITED),
                solutionText: origQ?.solutionText || q.solutionText || '',
                solutionImageUrl: origQ?.solutionImageUrl || '',
                type: q.type || 'MCQ',
                correctAnswer: q.answer
            };

            return entry;
        });

        res.json({
            sessionId: session._id,
            studentName: session.studentName,
            studentEmail: session.studentEmail,
            rollNumber: session.rollNumber,
            examTitle: exam.title,
            examType: exam.examType,
            score: session.score,
            totalQuestions: session.totalQuestions,
            attempted: session.attempted,
            correct: session.correct,
            incorrect: session.incorrect,
            unattempted: session.unattempted,
            weakAreas: session.weakAreas,
            summary: session.summary,
            topic_diagnostics: session.topic_diagnostics,
            panic_questions: session.panic_questions,
            attempts: session.attempts,
            isLabSession: isLab,
            answerKeyHidden: false,
            breakdown
        });
    } catch (err) {
        console.error('Scorecard retrieval error:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Get all results for an exam
// GET /api/exams/:id/results
// ─────────────────────────────────────────────────────────────────
router.get('/:id/results', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const sessions = await ExamSession.find({ examId: req.params.id, submitted: true })
            .sort({ score: -1 });
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Get Question Analytics
// GET /api/exams/:id/analytics
// ─────────────────────────────────────────────────────────────────
router.get('/:id/analytics', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const sessions = await ExamSession.find({ examId: req.params.id, submitted: true });
        
        const analytics = exam.questions.map((q, i) => {
            let correct = 0, incorrect = 0, unattempted = 0;

            sessions.forEach(session => {
                const ans = session.answers.find(a => a.questionId?.toString() === q._id?.toString());
                const selected = ans?.selectedOption || null;
                
                if (selected !== null && selected !== '') {
                    const parsedSelected = parseFloat(selected);
                    const parsedAnswer = parseFloat(q.answer);
                    const isNumericMatch = !isNaN(parsedSelected) && !isNaN(parsedAnswer) && Math.abs(parsedSelected - parsedAnswer) < 1e-9;
                    const isExactMatch = selected.toString().trim().toLowerCase() === q.answer?.toString().trim().toLowerCase();

                    if (isNumericMatch || isExactMatch) {
                        correct++;
                    } else {
                        incorrect++;
                    }
                } else {
                    unattempted++;
                }
            });

            return {
                questionNumber: i + 1,
                subject: q.subject,
                correct,
                incorrect,
                unattempted,
                total: sessions.length
            };
        });

        res.json(analytics);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Generate Bridge Key
// POST /api/exams/:id/bridge-key
// ─────────────────────────────────────────────────────────────────
router.post('/:id/bridge-key', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        // Generate only once: check if a bridge key already exists for this exam
        let bridgeKey = await BridgeKey.findOne({ examId: exam._id });
        if (bridgeKey) {
            return res.json({ msg: 'Bridge key retrieved', key: bridgeKey.key, expiresAt: bridgeKey.expiresAt });
        }

        const key = crypto.randomBytes(24).toString('hex');
        bridgeKey = new BridgeKey({
            key,
            examId: exam._id,
            examTitle: exam.title,
            generatedBy: req.user.id,
            expiresAt: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000) // 10 years (static)
        });
        await bridgeKey.save();
        res.json({ msg: 'Bridge key generated', key, expiresAt: bridgeKey.expiresAt });
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// BRIDGE APP: Fetch results by key
// GET /api/exams/bridge/:key
// ─────────────────────────────────────────────────────────────────
router.get('/bridge/:key', async (req, res) => {
    try {
        const bridgeKey = await BridgeKey.findOne({ key: req.params.key });
        if (!bridgeKey) return res.status(404).json({ msg: 'Invalid bridge key.' });

        const sessions = await ExamSession.find({ examId: bridgeKey.examId, submitted: true })
            .sort({ score: -1 });

        // Retrieve full exam data including questions and answers
        const exam = await OnlineExam.findById(bridgeKey.examId);

        res.json({
            examTitle: bridgeKey.examTitle,
            exam,
            results: sessions.map(s => ({
                studentId: s.studentId,
                studentName: s.studentName,
                rollNumber: s.rollNumber,
                studentEmail: s.studentEmail,
                score: s.score,
                totalQuestions: s.totalQuestions,
                attempted: s.attempted,
                correct: s.correct,
                incorrect: s.incorrect,
                unattempted: s.unattempted,
                weakAreas: s.weakAreas,
                fromLabIp: s.fromLabIp,
                clientIp: s.clientIp,
                submittedAt: s.endTime,
                malpracticeFlag: s.malpracticeFlag || false,
                malpracticeReason: s.malpracticeReason || '',
                answers: s.answers
            }))
        });
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Report malpractice
// POST /api/exams/:id/malpractice
// ─────────────────────────────────────────────────────────────────
router.post('/:id/malpractice', detectLabIp, async (req, res) => {
    try {
        const { sessionId, reason } = req.body;
        const session = await ExamSession.findById(sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });

        session.submitted = true;
        session.endTime = new Date();
        session.malpracticeFlag = true;
        session.malpracticeReason = reason || 'Window blurred or switched tab';

        await session.save();
        res.json({ msg: 'Malpractice reported and session locked', session });
    } catch (err) {
        console.error('Error reporting malpractice:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Delete online exam
// DELETE /api/exams/:id
// ─────────────────────────────────────────────────────────────────
router.delete('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const examId = req.params.id;
        
        // 1. Delete the exam
        const exam = await OnlineExam.findByIdAndDelete(examId);
        if (!exam) {
            return res.status(404).json({ msg: 'Exam not found' });
        }

        // 2. Delete all exam sessions associated with it
        await ExamSession.deleteMany({ examId });

        // 3. Delete any bridge keys associated with it
        await BridgeKey.deleteMany({ examId });

        res.json({ msg: 'Exam deleted successfully' });
    } catch (err) {
        console.error('Error deleting exam:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// STUDENT & ADMIN: Get leaderboard / results list for an exam
// GET /api/exams/:id/leaderboard
// ─────────────────────────────────────────────────────────────────
router.get('/:id/leaderboard', async (req, res) => {
    try {
        const sessions = await ExamSession.find({ examId: req.params.id, submitted: true })
            .select('studentName rollNumber score correct incorrect unattempted weakAreas endTime')
            .sort({ score: -1 });
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Helpers
// ─────────────────────────────────────────────────────────────────
function getDefaultInstructions(examType) {
    return `General Instructions for ${examType} Exam:
1. The clock will be set at the server. The countdown timer at the top right corner of the screen will display the remaining time for you to complete the examination.
2. When the timer reaches zero, the examination will end by itself. You need not terminate the examination.
3. To answer a question, click on one of the option buttons.
4. To deselect a chosen answer, click on the chosen option again or click the CLEAR RESPONSE button.
5. To save your answer, you MUST click the SAVE & NEXT button.
6. To mark a question for review, click the MARK FOR REVIEW & NEXT button.
7. Marking Scheme: +4 for Correct, -1 for Incorrect, 0 for Unattempted.
8. The Question Palette on the right shows the status of each question.`;
}

// ─────────────────────────────────────────────────────────────────
// STUDENT: Save intermediate progress (Autosave / Recover)
// POST /api/exams/:id/session/save-progress
// ─────────────────────────────────────────────────────────────────
router.post('/:id/session/save-progress', async (req, res) => {
    try {
        const { sessionId, answers } = req.body;
        if (!sessionId) return res.status(400).json({ msg: 'Session ID is required' });

        const session = await ExamSession.findById(sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });
        if (session.submitted) return res.status(400).json({ msg: 'Cannot save progress for submitted exam' });

        const serverTimer = calculateServerTimerState(session.startTime, session.durationMinutes);

        if (answers && Array.isArray(answers)) {
            session.answers = answers.map(a => ({
                questionId: a.questionId || a.question_id,
                selectedOption: a.selectedOption !== undefined ? a.selectedOption : a.user_response,
                markedForReview: Boolean(a.markedForReview || a.marked_for_review),
                visited: Boolean(a.visited),
                timeTaken: Math.max(0, parseFloat(a.timeTaken !== undefined ? a.timeTaken : a.time_spent_seconds) || 0)
            }));

            session.attempts = answers.map(a => {
                const userResponse = a.user_response !== undefined ? a.user_response : a.selectedOption;
                const visited = Boolean(a.visited);
                const markedForReview = Boolean(a.markedForReview || a.marked_for_review);
                const timeSpent = Math.max(0, parseFloat(a.time_spent_seconds !== undefined ? a.time_spent_seconds : a.timeTaken) || 0);
                const status = a.status || deriveQuestionStatus(visited, userResponse, markedForReview);

                return {
                    question_id: (a.question_id || a.questionId || '').toString(),
                    subject_id: (a.subject_id || a.subject || '').trim(),
                    topic_id: (a.topic_id || a.topic || a.chapter || '').trim(),
                    subtopic_id: (a.subtopic_id || a.subtopic || a.concept || '').trim(),
                    difficulty_level: (a.difficulty_level || a.level || 'medium').toLowerCase().trim(),
                    user_response: userResponse,
                    correct_response: a.correct_response || '',
                    is_attempted: isResponseValid(userResponse),
                    is_correct: Boolean(a.is_correct),
                    time_spent_seconds: timeSpent,
                    status: status,
                    questionId: a.questionId || a.question_id,
                    selectedOption: userResponse,
                    markedForReview: markedForReview,
                    visited: visited,
                    timeTaken: timeSpent
                };
            });
        }

        await session.save();
        res.json({
            msg: 'Progress autosaved successfully',
            server_timer: serverTimer,
            savedAttemptsCount: session.attempts.length,
            session
        });
    } catch (err) {
        console.error('Autosave error:', err);
        res.status(500).json({ msg: 'Server Error during autosave' });
    }
});

// @route   GET /api/exams/:id/export-word
// @desc    Export online exam to Word (.docx)
// @access  Admin
router.get('/:id/export-word', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const OnlineExam = require('../models/OnlineExam');
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found.' });

        const paperAdapter = {
            title: exam.title,
            subject: exam.questions?.[0]?.subject || 'Mixed',
            classes: [exam.examType],
            questions: exam.questions,
            pattern: exam.sections
        };

        let template = null;
        if (exam.templateId) {
            const Template = require('../models/Template');
            template = await Template.findById(exam.templateId);
        }

        const { generatePaperDoc } = require('../services/wordExport');
        const buffer = await generatePaperDoc(paperAdapter, template);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${exam.title.replace(/\s+/g, '_')}.docx"`);
        res.send(buffer);
    } catch (err) {
        console.error('Exam Word export error:', err.message);
        res.status(500).json({ msg: 'Server error exporting exam to Word.', error: err.message });
    }
});

// @route   GET /api/exams/:id/pdf-report/:sessionId
// @desc    Download PDF scorecard for an exam session
// @access  Student (own), Teacher, Admin
router.get('/:id/pdf-report/:sessionId', auth, async (req, res) => {
    try {
        const session = await ExamSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });

        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        if (req.user.role === 'student' && session.studentEmail !== req.user.email) {
            return res.status(403).json({ msg: 'Access denied: You can only download your own scorecard.' });
        }

        const { generateReportPdf } = require('../services/pdfReport');
        const buffer = await generateReportPdf(session, exam);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${session.studentName?.replace(/\s+/g, '_') || 'Result'}.pdf"`);
        res.send(buffer);
    } catch (err) {
        console.error('PDF report error:', err.message);
        res.status(500).json({ msg: 'Server error generating PDF report.', error: err.message });
    }
});

// @route   GET /api/exams/:id/download-all-reports
// @desc    Download zip of all scorecards for an exam
// @access  Admin
router.get('/:id/download-all-reports', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const sessions = await ExamSession.find({ examId: req.params.id, submitted: true });
        if (sessions.length === 0) {
            return res.status(400).json({ msg: 'No completed exam sessions found for this exam.' });
        }

        const archiver = require('archiver');
        const archive = archiver('zip', { zlib: { level: 9 } });

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${exam.title.replace(/\s+/g, '_')}_Reports.zip"`);

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(res);

        const { generateReportPdf } = require('../services/pdfReport');

        for (const session of sessions) {
            const pdfBuffer = await generateReportPdf(session, exam);
            const filename = `${session.studentName?.replace(/\s+/g, '_') || session.studentEmail}_Result.pdf`;
            archive.append(pdfBuffer, { name: filename });
        }

        await archive.finalize();
    } catch (err) {
        console.error('Zip reports error:', err.message);
        res.status(500).json({ msg: 'Server error generating zip reports.', error: err.message });
    }
});

module.exports = router;
