const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Paper = require('../models/Paper');
const Question = require('../models/Question');
const User = require('../models/User');
const OnlineExam = require('../models/OnlineExam');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const supabaseQuestions = require('../services/supabaseQuestions');
const supabaseGtPyqQuestions = require('../services/supabaseGtPyqQuestions');
const { createNotification } = require('./notifications');

// Helper to record question usage and notify admin
async function handlePaperFinalization(paper, user, exam = null) {
    try {
        const qList = Array.isArray(paper.questions) ? paper.questions : [];
        if (qList.length > 0) {
            const examTitle = exam ? exam.title : (paper.title || 'Question Paper');
            const examDate = (exam && exam.examDate) ? new Date(exam.examDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            await supabaseQuestions.recordQuestionUsage(
                qList,
                paper._id.toString(),
                user.id,
                user.name || 'Faculty',
                examTitle,
                examDate
            );
        }

        if (user && user.role === 'teacher') {
            await createNotification({
                recipient_role: 'admin',
                sender_id: user.id,
                sender_name: user.name || 'Faculty',
                related_paper_id: paper._id.toString(),
                type: 'paper_submission',
                title: 'New Work Submitted for Review',
                message: `Teacher ${user.name || 'Faculty'} submitted ${paper.title || 'Question Paper'} for review.`,
                metadata: {
                    subject: paper.subject,
                    questionsCount: qList.length,
                    examTitle: exam ? exam.title : paper.title,
                    submittedAt: new Date().toISOString()
                }
            });
        }
    } catch (e) {
        console.error('Error in handlePaperFinalization:', e.message);
    }
}

// Helper to populate paper questions from Supabase & MongoDB if stored as IDs
async function populatePaperQuestions(paper) {
    const pObj = paper.toObject ? paper.toObject() : (paper ? JSON.parse(JSON.stringify(paper)) : {});
    if (Array.isArray(pObj.questions) && pObj.questions.length > 0) {
        // If questions are already full question objects with questionText or question
        if (typeof pObj.questions[0] === 'object' && pObj.questions[0] !== null && (pObj.questions[0].questionText || pObj.questions[0].question)) {
            return pObj;
        }

        const stringIds = pObj.questions.map(q => {
            if (!q) return null;
            if (typeof q === 'string') return q;
            if (q._id) return q._id.toString();
            if (q.id) return q.id.toString();
            if (typeof q.toString === 'function') return q.toString();
            return String(q);
        }).filter(Boolean);

        if (stringIds.length > 0) {
            try {
                const fetchedMap = new Map();
                
                // 1. Try Primary Supabase (Question Bank)
                try {
                    const fetchedSupa = await supabaseQuestions.getQuestionsByIds(stringIds);
                    (fetchedSupa || []).forEach(q => fetchedMap.set((q._id || q.id || q.questionId).toString(), q));
                } catch (e) {
                    console.error('Error fetching from Supabase primary:', e.message);
                }

                // 2. Try Secondary Supabase (GT & PYQ Question DB) for missing UUIDs
                const missingUuidIds = stringIds.filter(id => !fetchedMap.has(id.toString()));
                if (missingUuidIds.length > 0) {
                    try {
                        const fetchedGtPyq = await supabaseGtPyqQuestions.getQuestionsByIds(missingUuidIds);
                        (fetchedGtPyq || []).forEach(q => fetchedMap.set((q._id || q.id || q.questionId).toString(), q));
                    } catch (e) {
                        console.error('Error fetching from Supabase GT/PYQ:', e.message);
                    }
                }

                // 3. For any IDs still missing, try MongoDB Question model
                const missingIds = stringIds.filter(id => !fetchedMap.has(id.toString()) && mongoose.Types.ObjectId.isValid(id));
                if (missingIds.length > 0) {
                    try {
                        const mongoDocs = await Question.find({ _id: { $in: missingIds } }).lean();
                        (mongoDocs || []).forEach(mq => {
                            fetchedMap.set(mq._id.toString(), {
                                _id: mq._id.toString(),
                                id: mq._id.toString(),
                                questionId: mq.questionId || mq._id.toString(),
                                subject: mq.subject,
                                classes: Array.isArray(mq.classes) ? mq.classes : [mq.classes || '12'],
                                chapter: mq.chapter || 'General',
                                concept: mq.concept || mq.chapter || 'General',
                                subConcept: mq.subConcept || '',
                                level: mq.level || 'medium',
                                type: mq.type || 'MCQ',
                                questionText: mq.questionText || mq.question,
                                imageUrl: mq.imageUrl || null,
                                solutionImageUrl: mq.solutionImageUrl || null,
                                options: Array.isArray(mq.options) ? mq.options : [],
                                matchPairs: Array.isArray(mq.matchPairs) ? mq.matchPairs : [],
                                statements: Array.isArray(mq.statements) ? mq.statements : [],
                                assertion: mq.assertion || '',
                                reason: mq.reason || '',
                                answer: mq.answer || '',
                                solutionText: mq.solutionText || '',
                                sourceType: mq.sourceType || 'REGULAR',
                                sourceExam: mq.sourceExam || '',
                                sourceYear: mq.sourceYear || null,
                                sourcePaperName: mq.sourcePaperName || '',
                            });
                        });
                    } catch (e) {
                        console.error('Error fetching from MongoDB Question:', e.message);
                    }
                }

                if (fetchedMap.size > 0) {
                    const ordered = stringIds.map((id, idx) => {
                        const fetched = fetchedMap.get(id.toString());
                        const snap = (pObj.questionObjects && pObj.questionObjects[idx]) || {};
                        if (!fetched) {
                            if (snap && (snap.questionText || snap.question)) return snap;
                            return null;
                        }
                        return {
                            ...fetched,
                            sectionName: snap.sectionName || fetched.sectionName,
                            subject: snap.subject || fetched.subject
                        };
                    }).filter(Boolean);

                    if (ordered.length > 0) {
                        pObj.questions = ordered;
                    } else if (Array.isArray(pObj.questionObjects) && pObj.questionObjects.length > 0 && pObj.questionObjects[0]?.questionText) {
                        pObj.questions = pObj.questionObjects;
                    }
                } else if (Array.isArray(pObj.questionObjects) && pObj.questionObjects.length > 0 && pObj.questionObjects[0]?.questionText) {
                    pObj.questions = pObj.questionObjects;
                }
            } catch (fetchErr) {
                console.error('Error populating paper questions:', fetchErr.message);
                if (Array.isArray(pObj.questionObjects) && pObj.questionObjects.length > 0 && pObj.questionObjects[0]?.questionText) {
                    pObj.questions = pObj.questionObjects;
                }
            }
        }
    } else if (Array.isArray(pObj.questionObjects) && pObj.questionObjects.length > 0 && pObj.questionObjects[0]?.questionText) {
        pObj.questions = pObj.questionObjects;
    }
    return pObj;
}

// Helper to match subject assignment in exam
function findMatchingAssignment(exam, paper, user) {
    if (!exam || !Array.isArray(exam.subjectAssignments)) return null;
    const pSub = (paper.subject || '').toLowerCase().trim();
    const pTitle = (paper.title || '').toLowerCase().trim();
    const uId = user?.id ? user.id.toString() : '';
    const uEmail = (user?.email || '').toLowerCase().trim();

    // 1. Check if assignment explicitly matches this paper or teacher
    let match = exam.subjectAssignments.find(sa => 
        (sa.submittedPaperId && sa.submittedPaperId.toString() === paper._id.toString()) ||
        (sa.teacherId && uId && sa.teacherId.toString() === uId) ||
        (sa.teacherEmail && uEmail && sa.teacherEmail.toLowerCase().trim() === uEmail)
    );
    if (match) return match;

    // 2. Match by subject name (Exact or Botany/Zoology/Biology/Physics/Chemistry/Maths)
    match = exam.subjectAssignments.find(sa => {
        const saSub = (sa.subject || '').toLowerCase().trim();
        if (saSub === pSub) return true;
        if (saSub.includes('physic') && pSub.includes('physic')) return true;
        if (saSub.includes('chem') && pSub.includes('chem')) return true;
        if (saSub.includes('math') && pSub.includes('math')) return true;
        if (saSub.includes('botan') && (pSub.includes('botan') || pTitle.includes('botan'))) return true;
        if (saSub.includes('zool') && (pSub.includes('zool') || pTitle.includes('zool'))) return true;
        if (saSub.includes('bio') && pSub.includes('bio')) return true;
        return false;
    });
    if (match) return match;

    // 3. Fallback for NEET Botany / Zoology when paper subject is Biology
    if (pSub.includes('bio')) {
        match = exam.subjectAssignments.find(sa => {
            const saSub = (sa.subject || '').toLowerCase().trim();
            return (saSub.includes('botan') || saSub.includes('zool')) && !sa.submittedPaperId;
        });
    }
    return match;
}

// @route   POST /api/papers
// @desc    Save a paper (stores Supabase question IDs and paper pattern) with Trial Quota Enforcement
// @access  Teacher / Admin
router.post('/', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const { examId, title, subject: reqSubject, questions, questionObjects, examType, isAssignment, ...rest } = req.body;
        const paperSubject = reqSubject || (req.user.role === 'admin' ? 'Physics' : (req.user.subject || 'Physics'));
        const paperTitle = title || `${paperSubject} Assessment`;

        // ── Determine Quota Category & Caps ──
        let quotaKey = 'assessment';
        const normExamType = String(examType || '').toUpperCase().trim();
        if (normExamType.includes('JEE')) {
            quotaKey = 'jee';
        } else if (normExamType.includes('NEET')) {
            quotaKey = 'neet';
        } else if (normExamType.includes('CET')) {
            quotaKey = 'cet';
        } else if (isAssignment || normExamType.includes('ASSIGN') || normExamType.includes('ASSESS') || normExamType === 'BOARD') {
            quotaKey = 'assessment';
        }

        const resolvedQuestions = Array.isArray(questions) ? questions : (Array.isArray(questionObjects) ? questionObjects.map(q => q._id || q.id) : []);
        const totalQuestionCount = resolvedQuestions.length;

        // ── Teacher Quota & Trial Check & Enforcement ──
        let dbUser = null;
        if (req.user.role === 'teacher' && req.user.id) {
            dbUser = await User.findById(req.user.id);
            if (dbUser) {
                if (dbUser.status === 'disabled') {
                    return res.status(403).json({ msg: 'Your teacher account is disabled. Please contact the administrator.' });
                }

                const now = new Date();
                const isTrial = dbUser.isTrial !== false;
                const trialStatus = dbUser.trialStatus || (isTrial ? 'active' : 'none');

                // If teacher has no trial or trial is expired/revoked, block paper creation
                if (trialStatus === 'none') {
                    return res.status(403).json({
                        msg: 'Your account does not have trial access. Please contact administrator to activate trial access.',
                        trialRequired: true
                    });
                }

                if (trialStatus === 'revoked') {
                    return res.status(403).json({
                        msg: 'Your trial access has been revoked by administrator. Please contact administrator.',
                        trialRevoked: true
                    });
                }

                if (trialStatus === 'expired' || (dbUser.trialExpiryDate && new Date(dbUser.trialExpiryDate) < now)) {
                    dbUser.trialStatus = 'expired';
                    await dbUser.save();
                    return res.status(403).json({
                        msg: 'Your trial access has expired. Please contact administrator to renew your trial.',
                        trialExpired: true
                    });
                }

                if (isTrial) {
                    const currentQuota = dbUser.quotas?.[quotaKey] || { used: 0, max: 2, maxQuestions: quotaKey === 'assessment' ? 60 : 240 };
                    if (currentQuota.used >= currentQuota.max) {
                        return res.status(403).json({ 
                            msg: `Trial quota exceeded for ${quotaKey.toUpperCase()}. You have generated ${currentQuota.used}/${currentQuota.max} allowed papers.`,
                            quotaExceeded: true,
                            quotaKey
                        });
                    }

                    if (totalQuestionCount > currentQuota.maxQuestions) {
                        return res.status(400).json({ 
                            msg: `Maximum allowed questions for ${quotaKey.toUpperCase()} trial paper is ${currentQuota.maxQuestions} (requested ${totalQuestionCount}).`,
                            questionCapExceeded: true
                        });
                    }
                }
            }
        }

        const paperData = {
            ...rest,
            title: paperTitle,
            subject: paperSubject,
            examType: examType || (isAssignment ? 'ASSIGNMENT' : 'CET'),
            isAssignment: Boolean(isAssignment),
            institutionName: (dbUser?.institutionName || req.user.institutionName || 'Manchester College').trim(),
            teacherId: (req.user.id || req.user._id || 'admin').toString(),
            questions: resolvedQuestions,
            questionObjects: Array.isArray(questionObjects) ? questionObjects : (Array.isArray(questions) ? questions : [])
        };

        // Validate examId if provided
        const mongoose = require('mongoose');
        if (examId && mongoose.Types.ObjectId.isValid(examId)) {
            paperData.examId = new mongoose.Types.ObjectId(examId);
        }

        const paper = new Paper(paperData);
        await paper.save();

        // ── Increment Quota upon Successful Paper Generation ──
        if (dbUser && dbUser.isTrial !== false) {
            if (!dbUser.quotas) {
                dbUser.quotas = {
                    assessment: { used: 0, max: 2, maxQuestions: 60 },
                    jee: { used: 0, max: 2, maxQuestions: 240 },
                    neet: { used: 0, max: 2, maxQuestions: 240 },
                    cet: { used: 0, max: 2, maxQuestions: 240 }
                };
            }
            if (!dbUser.quotas[quotaKey]) {
                dbUser.quotas[quotaKey] = { used: 0, max: 2, maxQuestions: quotaKey === 'assessment' ? 60 : 240 };
            }
            dbUser.quotas[quotaKey].used += 1;
            dbUser.markModified('quotas');
            await dbUser.save();
        }

        // Background non-blocking sync: Link to exam and send notifications
        (async () => {
            try {
                const OnlineExam = require('../models/OnlineExam');
                let exam = null;
                if (paperData.examId) {
                    exam = await OnlineExam.findById(paperData.examId);
                } else if (paper.title) {
                    const exams = await OnlineExam.find({}).sort({ createdAt: -1 });
                    exam = exams.find(e => paper.title.toLowerCase().includes(e.title.toLowerCase()));
                }

                if (exam) {
                    const assignment = findMatchingAssignment(exam, paper, req.user);
                    if (assignment) {
                        assignment.submittedPaperId = paper._id;
                        assignment.teacherId = req.user.id;
                        assignment.teacherName = req.user.name || assignment.teacherName;
                        assignment.teacherEmail = req.user.email || assignment.teacherEmail;
                        const qCount = Array.isArray(paper.questions) ? paper.questions.length : 0;
                        assignment.status = qCount >= (assignment.targetQuestions || 60) ? 'Completed' : 'In Progress';
                        await exam.save();
                    }
                }

                await handlePaperFinalization(paper, req.user, exam);
            } catch (bgErr) {
                console.error('Background paper finalization error:', bgErr.message);
            }
        })();

        res.status(201).json(paper);
    } catch (err) {
        console.error('Save paper error:', err);
        res.status(500).json({ msg: 'Server error saving paper.', error: err.message });
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
            const uId = req.user.id?.toString();
            query = {
                $or: [
                    { teacherId: uId },
                    { teacherId: req.user.id },
                    { teacherId: { $in: [uId, req.user.id] } },
                    { subject: req.user.subject }
                ]
            };
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

        // Access check: teacher can access if admin, or own paper, or same subject, or assigned to exam
        if (req.user.role === 'teacher') {
            const tIdStr = paper.teacherId ? paper.teacherId.toString() : '';
            const uIdStr = req.user.id ? req.user.id.toString() : '';
            const matchesTeacher = tIdStr && uIdStr && tIdStr === uIdStr;
            const matchesSubject = paper.subject && req.user.subject && paper.subject.toLowerCase() === req.user.subject.toLowerCase();

            if (!matchesTeacher && !matchesSubject) {
                if (paper.examId) {
                    const OnlineExam = require('../models/OnlineExam');
                    const exam = await OnlineExam.findById(paper.examId);
                    const isAssigned = exam && exam.subjectAssignments.some(sa => sa.teacherId && sa.teacherId.toString() === uIdStr);
                    if (!isAssigned) {
                        return res.status(403).json({ msg: 'Access denied: not your paper.' });
                    }
                } else if (paper.teacherId) {
                    return res.status(403).json({ msg: 'Access denied: not your paper.' });
                }
            }
        }

        const populated = await populatePaperQuestions(paper);
        res.json(populated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   PUT /api/papers/:id
// @desc    Update an existing paper by ID
// @access  Teacher, Admin
router.put('/:id', [auth, checkRole(['teacher', 'admin'])], async (req, res) => {
    try {
        let paper = await Paper.findById(req.params.id);
        if (!paper) return res.status(404).json({ msg: 'Paper not found' });

        if (req.user.role === 'teacher') {
            const tIdStr = paper.teacherId ? paper.teacherId.toString() : '';
            const uIdStr = req.user.id ? req.user.id.toString() : '';
            const matchesTeacher = tIdStr && uIdStr && tIdStr === uIdStr;
            const matchesSubject = paper.subject && req.user.subject && paper.subject.toLowerCase() === req.user.subject.toLowerCase();

            if (!matchesTeacher && !matchesSubject && !paper.teacherId) {
                paper.teacherId = req.user.id;
            } else if (!matchesTeacher && !matchesSubject) {
                return res.status(403).json({ msg: 'Access denied: not your paper.' });
            }
        }

        const { title, questions, questionObjects, pattern, templateId, difficultyDistribution, status, classes, isAssignment, duration, startQNo, endQNo } = req.body;
        if (title) paper.title = title;
        if (questions) paper.questions = questions;
        if (questionObjects) paper.questionObjects = questionObjects;
        if (pattern) paper.pattern = pattern;
        if (templateId !== undefined) paper.templateId = templateId;
        if (difficultyDistribution) paper.difficultyDistribution = difficultyDistribution;
        if (status) paper.status = status;
        if (classes) paper.classes = classes;
        if (isAssignment !== undefined) paper.isAssignment = isAssignment;
        if (duration !== undefined) paper.duration = duration;
        if (startQNo !== undefined) paper.startQNo = startQNo;
        if (endQNo !== undefined) paper.endQNo = endQNo;
        paper.updatedAt = new Date();

        await paper.save();

        // Sync with parent OnlineExam if linked
        if (paper.examId) {
            const OnlineExam = require('../models/OnlineExam');
            const exam = await OnlineExam.findById(paper.examId);
            if (exam) {
                const assignment = findMatchingAssignment(exam, paper, req.user);
                if (assignment) {
                    assignment.submittedPaperId = paper._id;
                    const qCount = Array.isArray(paper.questions) ? paper.questions.length : 0;
                    assignment.status = qCount >= (assignment.targetQuestions || 60) ? 'Completed' : (qCount > 0 ? 'In Progress' : 'Not Started');
                    await exam.save();
                }
            }
        }

        // Record question usage & notify admin
        await handlePaperFinalization(paper, req.user);

        const populated = await populatePaperQuestions(paper);
        res.json(populated);
    } catch (err) {
        console.error('Update paper error:', err.message);
        res.status(500).json({ msg: 'Server error updating paper.' });
    }
});

// @route   GET /api/papers/:id/export-word
// @desc    Export paper to Word (.docx)
// @access  Teacher, Admin
router.get('/:id/export-word', [auth, checkRole(['teacher', 'admin'])], async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id);
        if (!paper) return res.status(404).json({ msg: 'Paper not found.' });

        if (req.user.role === 'teacher' && paper.teacherId && paper.teacherId.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Access denied: not your paper.' });
        }

        const populatedPaper = await populatePaperQuestions(paper);

        let template = null;
        if (paper.templateId) {
            const Template = require('../models/Template');
            template = await Template.findById(paper.templateId);
        }

        const { generatePaperDoc } = require('../services/wordExport');
        const buffer = await generatePaperDoc(populatedPaper, template);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${paper.title.replace(/\s+/g, '_')}.docx"`);
        res.send(buffer);
    } catch (err) {
        console.error('Word export error:', err.message);
        res.status(500).json({ msg: 'Server error exporting paper to Word.', error: err.message });
    }
});

// @route   DELETE /api/papers/:id
// @desc    Delete a paper
// @access  Teacher, Admin
router.delete('/:id', [auth, checkRole(['teacher', 'admin'])], async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id);
        if (!paper) return res.status(404).json({ msg: 'Paper not found' });

        if (req.user.role !== 'admin') {
            const tId = paper.teacherId ? paper.teacherId.toString() : '';
            const isOwner = tId && tId === req.user.id;
            const isSameSubject = paper.subject && req.user.subject && (
                paper.subject.toLowerCase() === req.user.subject.toLowerCase() ||
                (req.user.subject.toLowerCase() === 'biology' && ['botany', 'zoology', 'biology'].includes(paper.subject.toLowerCase()))
            );
            if (!isOwner && !isSameSubject) {
                return res.status(403).json({ msg: 'Access denied: not authorized to delete this paper' });
            }
        }

        await Paper.findByIdAndDelete(req.params.id);

        // Also clean up any references in OnlineExam subjectAssignments
        try {
            const OnlineExam = require('../models/OnlineExam');
            await OnlineExam.updateMany(
                { 'subjectAssignments.submittedPaperId': req.params.id },
                {
                    $set: {
                        'subjectAssignments.$.submittedPaperId': null,
                        'subjectAssignments.$.status': 'Pending',
                        'subjectAssignments.$.questionsCount': 0
                    }
                }
            );
        } catch (linkErr) {
            console.error('Error unlinking deleted paper from exams:', linkErr.message);
        }

        res.json({ msg: 'Paper removed successfully' });
    } catch (err) {
        console.error('Delete paper error:', err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// @route   POST /api/papers/merge
// @desc    Merge multiple subject papers (e.g. PCMB, NEET, JEE, CET) into a new independent Paper and OnlineExam
// @access  Teacher, Admin
router.post('/merge', [auth, checkRole(['teacher', 'admin'])], async (req, res) => {
    try {
        const {
            sourcePaperIds,
            sections,
            title,
            examType = 'PCMB',
            classes = ['12'],
            duration = '180 Minutes',
            instructions = '',
            customSections,
            customQuestions
        } = req.body;

        let paperIds = Array.isArray(sourcePaperIds) ? sourcePaperIds : [];
        if (paperIds.length === 0 && Array.isArray(sections)) {
            paperIds = sections.map(s => s.paperId || s.id || s._id).filter(Boolean);
        }

        if (paperIds.length === 0) {
            return res.status(400).json({ msg: 'Please provide an array of sourcePaperIds or sections to merge.' });
        }

        // 1. Fetch all source papers without mutating them
        const sourcePapers = await Paper.find({ _id: { $in: paperIds } });
        if (sourcePapers.length === 0) {
            return res.status(404).json({ msg: 'No valid source papers found for the provided IDs.' });
        }

        // Maintain order requested in paperIds
        const orderedPapers = paperIds
            .map(id => sourcePapers.find(p => p._id.toString() === id.toString()))
            .filter(Boolean);

        // Populate questions for each source paper
        const populatedPapers = await Promise.all(orderedPapers.map(populatePaperQuestions));

        // 2. Build merged questions list and section patterns
        let mergedQuestions = [];
        let mergedQuestionObjects = [];
        let mergedPattern = [];

        if (Array.isArray(customQuestions) && customQuestions.length > 0) {
            // User provided an explicit reordered/customized list
            mergedQuestionObjects = customQuestions;
            mergedQuestions = customQuestions.map(q => (typeof q === 'object' ? (q._id || q.id) : q)).filter(Boolean);
            if (Array.isArray(customSections) && customSections.length > 0) {
                mergedPattern = customSections;
            }
        } else {
            populatedPapers.forEach((paper, pIdx) => {
                const reqSection = Array.isArray(sections) ? sections.find(s => (s.paperId || s.id || s._id)?.toString() === paper._id.toString()) : null;
                const pSub = reqSection?.subject || paper.subject || `Subject ${pIdx + 1}`;
                const pQs = Array.isArray(paper.questions) ? paper.questions : (paper.questionObjects || []);
                
                const sectionLetter = String.fromCharCode(65 + pIdx);
                const sectionName = reqSection?.title || `Section ${sectionLetter}: ${pSub}`;
                mergedPattern.push({
                    sectionName,
                    numQuestions: pQs.length,
                    type: 'MCQ',
                    description: `${pSub} Section`,
                    marks: paper.pattern?.[0]?.marks || 4
                });

                pQs.forEach(q => {
                    const rawQ = (typeof q === 'object' && q !== null) ? q : { id: q };
                    const qObj = { ...rawQ, sectionName, subject: rawQ.subject || pSub };
                    mergedQuestionObjects.push(qObj);
                    mergedQuestions.push(rawQ._id || rawQ.id || q);
                });
            });
        }

        // 3. Create the new independent merged Paper record (100% leaving source papers untouched)
        const durationMinutesVal = parseInt(duration) || 180;
        const mergedPaper = new Paper({
            title: title || `${examType} Unified Grand Examination`,
            subject: examType || 'PCMB',
            classes: Array.isArray(classes) ? classes : [classes || '12'],
            teacherId: (req.user.id || req.user._id || 'admin').toString(),
            questions: mergedQuestions,
            questionObjects: mergedQuestionObjects,
            pattern: mergedPattern,
            sections: mergedPattern,
            isMerged: true,
            duration: duration || '180 Minutes',
            startQNo: 1,
            endQNo: mergedQuestions.length,
            status: 'Approved'
        });

        await mergedPaper.save();

        // 4. Create linked OnlineExam so the merged paper is immediately available for CBT Online Exam mode
        let onlineExamDoc = null;
        try {
            const examQuestions = mergedQuestionObjects.map(q => ({
                questionId: q._id || q.id,
                subject: q.subject || 'General',
                chapter: q.chapter || 'General',
                concept: q.concept || '',
                level: q.level || 'medium',
                questionText: q.questionText || q.question || '',
                options: q.options || [],
                answer: q.answer || q.correct_option || '',
                solutionText: q.solutionText || '',
                statements: q.statements || [],
                assertion: q.assertion || '',
                reason: q.reason || '',
                matchPairs: q.matchPairs || [],
                imageUrl: q.imageUrl || null,
                marks: q.marks || 4,
                negativeMarks: q.negativeMarks !== undefined ? q.negativeMarks : 1,
                type: q.type || 'MCQ',
                sectionName: q.sectionName || 'Section A'
            }));

            const examSections = mergedPattern.map(p => ({
                sectionName: p.sectionName,
                numQuestions: p.numQuestions,
                allowedToAnswer: p.numQuestions,
                markingRules: { correct: p.marks || 4, incorrect: -1, unattempted: 0 }
            }));

            onlineExamDoc = new OnlineExam({
                title: mergedPaper.title,
                examType: ['JEE', 'NEET', 'CET'].includes(examType) ? examType : 'CET',
                sourcePapers: paperIds,
                mergedPaperId: mergedPaper._id,
                questions: examQuestions,
                sections: examSections,
                instructions: instructions || 'Read questions carefully. Answer all sections within allotted time.',
                duration_minutes: durationMinutesVal,
                durationMinutes: durationMinutesVal,
                status: 'draft',
                classes: mergedPaper.classes,
                createdBy: req.user.id
            });

            await onlineExamDoc.save();
            mergedPaper.examId = onlineExamDoc._id;
            mergedPaper.onlineExamId = onlineExamDoc._id;
            await mergedPaper.save();
        } catch (onlineErr) {
            console.error('Error linking OnlineExam to merged paper:', onlineErr.message);
        }

        const populatedMerged = await populatePaperQuestions(mergedPaper);
        const resultPaper = {
            ...(populatedMerged.toObject ? populatedMerged.toObject() : populatedMerged),
            isMerged: true,
            sections: mergedPattern,
            onlineExamId: onlineExamDoc ? onlineExamDoc._id : mergedPaper.examId
        };

        res.status(201).json({
            success: true,
            msg: 'Papers merged successfully into a new independent Examination record.',
            paper: resultPaper
        });
    } catch (err) {
        console.error('Merge papers error:', err);
        res.status(500).json({ msg: 'Server error merging papers.', error: err.message });
    }
});


module.exports = router;

