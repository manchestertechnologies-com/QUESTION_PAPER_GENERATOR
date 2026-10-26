import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { sanitize } from '../../utils/sanitize';
import MathRenderer from '../../components/MathRenderer';
import ResizableDiagram from '../../components/ResizableDiagram';

function extractDiagramFromText(rawText, existingImageUrl) {
    if (!rawText) return { cleanText: '', diagramUrl: existingImageUrl || null };
    let cleanText = String(rawText);
    let extractedUrl = existingImageUrl || null;

    const imgMatch1 = cleanText.match(/\{\{IMG::(.*?)\}\}/i);
    if (imgMatch1) {
        if (!extractedUrl) extractedUrl = imgMatch1[1].trim();
        cleanText = cleanText.replace(/(\w+)\s*\{\{IMG::.*?\}\}\s*(\w+)/gi, (m, p1, p2) => p1 + p2);
        cleanText = cleanText.replace(/\{\{IMG::.*?\}\}/gi, ' ');
    }

    const imgMatch2 = cleanText.match(/!\[(.*?)\]\((.*?)\)/i);
    if (imgMatch2) {
        if (!extractedUrl) extractedUrl = imgMatch2[2].trim();
        cleanText = cleanText.replace(/(\w+)\s*!\[.*?\]\(.*?\)\s*(\w+)/gi, (m, p1, p2) => p1 + p2);
        cleanText = cleanText.replace(/!\[.*?\]\(.*?\)/gi, ' ');
    }

    const imgMatch3 = cleanText.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (imgMatch3) {
        if (!extractedUrl) extractedUrl = imgMatch3[1].trim();
        cleanText = cleanText.replace(/(\w+)\s*<img[^>]*>\s*(\w+)/gi, (m, p1, p2) => p1 + p2);
        cleanText = cleanText.replace(/<img[^>]*>/gi, ' ');
    }

    cleanText = cleanText.replace(/\s{2,}/g, ' ').trim();
    return { cleanText, diagramUrl: extractedUrl };
}

// ── Palette States ──────────────────────────────────────────────
// not_visited: #6b7280 (grey)
// not_answered: #ef4444 (red)
// answered: #10b981 (green)
// marked: #8b5cf6 (purple)
// answered_marked: #8b5cf6 with green dot

const STATE = {
    NOT_VISITED: 'not_visited',
    NOT_ANSWERED: 'not_answered',
    ANSWERED: 'answered',
    MARKED: 'marked',
    ANSWERED_MARKED: 'answered_marked'
};

const STATE_COLORS = {
    [STATE.NOT_VISITED]: '#6b7280',
    [STATE.NOT_ANSWERED]: '#ef4444',
    [STATE.ANSWERED]: '#10b981',
    [STATE.MARKED]: '#8b5cf6',
    [STATE.ANSWERED_MARKED]: '#8b5cf6'
};

function getState(q) {
    if (!q.visited) return STATE.NOT_VISITED;
    if (q.selectedOption && q.markedForReview) return STATE.ANSWERED_MARKED;
    if (q.markedForReview) return STATE.MARKED;
    if (q.selectedOption) return STATE.ANSWERED;
    return STATE.NOT_ANSWERED;
}

export default function ExamEngine() {
    const { examId } = useParams();
    const navigate = useNavigate();
    const studentInfo = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('student_info') || '{}');
        } catch (e) {
            return {};
        }
    }, []);
    const initRan = useRef(false);

    const [exam, setExam] = useState(null);
    const [session, setSession] = useState(null);
    const [answers, setAnswers] = useState([]); // per-question local state
    const [current, setCurrent] = useState(0);
    const [timeLeft, setTimeLeft] = useState(null); // seconds
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const timerRef = useRef(null);
    const questionDwellTimeRef = useRef({});
    const autoSubmitted = useRef(false);
    const isSubmittingOrFinished = useRef(false);

    const triggerMalpractice = useCallback(async (reason) => {
        if (isSubmittingOrFinished.current) return;
        isSubmittingOrFinished.current = true;
        
        try {
            await api.post(`/api/exams/${examId}/malpractice`, {
                sessionId: session?._id || session?.id,
                reason
            }, { skipLoader: true });
        } catch (e) {
            console.error('Failed to report malpractice:', e);
        }

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }

        localStorage.removeItem('active_exam_session_id');
        navigate(`/exam/disqualified?reason=${encodeURIComponent(reason)}`);
    }, [session, examId, navigate]);

    // ── Load exam and start session ─────────────────────────────
    useEffect(() => {
        if (initRan.current) return;
        initRan.current = true;
        const init = async () => {
            if (!studentInfo || !studentInfo.rollNumber) {
                navigate('/lab-exam');
                return;
            }
            try {
                let e = null;
                const emailParam = encodeURIComponent(studentInfo.studentEmail || '');
                const rollParam = encodeURIComponent(studentInfo.rollNumber || '');

                try {
                    const examRes = await api.get(`/api/exams/${examId}/take?email=${emailParam}&rollNumber=${rollParam}`);
                    e = examRes.data;
                } catch (takeErr) {
                    try {
                        const fallbackRes = await api.get(`/api/exams/${examId}/take`);
                        e = fallbackRes.data;
                    } catch (fallbackErr) {
                        const directRes = await api.get(`/api/exams/${examId}`);
                        e = directRes.data;
                    }
                }

                if (!e) throw new Error('Exam payload empty');

                // 1. Enforce scheduled start time: if student tries to enter early, redirect to instructions
                if (e.start_time) {
                    const start = new Date(e.start_time).getTime();
                    const now = new Date().getTime();
                    if (now < start) {
                        navigate(`/exam/${examId}/instructions`);
                        return;
                    }
                }

                setExam(e);

                let sessionData = null;
                try {
                    const sessionRes = await api.post(`/api/exams/${examId}/start`, {
                        studentName: studentInfo.studentName || 'Student',
                        studentEmail: studentInfo.studentEmail || '',
                        rollNumber: studentInfo.rollNumber || ''
                    });
                    sessionData = sessionRes.data?.session;
                } catch (startErr) {
                    console.warn('Backend start session fallback:', startErr.message);
                }

                if (!sessionData) {
                    sessionData = {
                        _id: `sess_cand_${studentInfo.rollNumber || 'test'}_${Date.now()}`,
                        id: `sess_cand_${studentInfo.rollNumber || 'test'}_${Date.now()}`,
                        examId: examId,
                        studentName: studentInfo.studentName || 'Student',
                        studentEmail: studentInfo.studentEmail || '',
                        rollNumber: studentInfo.rollNumber || '',
                        startTime: new Date().toISOString(),
                        answers: []
                    };
                }
                setSession(sessionData);

                // Calculate remaining time relative to student's actual session start time
                const startTimeMs = sessionData.startTime ? new Date(sessionData.startTime).getTime() : new Date().getTime();
                const elapsedSeconds = Math.max(0, Math.floor((new Date().getTime() - startTimeMs) / 1000));
                let durationSeconds = (e.duration_minutes || 180) * 60 - elapsedSeconds;
                if (durationSeconds < 0) durationSeconds = 0;

                // Late Entry Check: Capped remaining time based on end_time if it exists
                if (e.end_time) {
                    const end = new Date(e.end_time).getTime();
                    const now = new Date().getTime();
                    const scheduledRemaining = Math.floor((end - now) / 1000);
                    if (scheduledRemaining >= 0 && scheduledRemaining < durationSeconds) {
                        durationSeconds = scheduledRemaining;
                    }
                }
                setTimeLeft(durationSeconds);

                // Initialize local answers state (restore saved state if session resumed)
                const storageKey = `exam_answers_${examId}_${sessionData._id || sessionData.id}`;
                const cachedAnswersStr = localStorage.getItem(storageKey);
                let cachedAnswers = null;
                if (cachedAnswersStr) {
                    try { cachedAnswers = JSON.parse(cachedAnswersStr); } catch(e) {}
                }

                const questionList = e.questions || [];
                setAnswers(questionList.map((q, i) => {
                    const qIdentifier = (q._id || q.id || q.questionId || i).toString();
                    const savedAns = sessionData.answers?.find(sa => (sa.questionId || sa._id)?.toString() === qIdentifier);
                    const cachedAns = cachedAnswers?.find(ca => (ca.questionId || ca._id)?.toString() === qIdentifier);
                    return {
                        questionId: qIdentifier,
                        selectedOption: cachedAns ? cachedAns.selectedOption : (savedAns ? savedAns.selectedOption : null),
                        markedForReview: cachedAns ? cachedAns.markedForReview : (savedAns ? savedAns.markedForReview : false),
                        visited: cachedAns ? cachedAns.visited : (savedAns ? savedAns.visited : (i === 0)),
                        timeTaken: cachedAns ? (cachedAns.timeTaken || 0) : (savedAns ? (savedAns.timeTaken || 0) : 0)
                    };
                }));
            } catch (err) {
                console.error('Exam initialization error:', err);
                alert(err.response?.data?.msg || 'Unable to connect to examination engine. Please contact administrator.');
                navigate('/lab-exam');
            }
            setLoading(false);
        };
        init();
        return () => clearInterval(timerRef.current);
    }, [examId, navigate]);

    // ── Malpractice and Security Controls ─────────────────────────
    useEffect(() => {
        if (!session || !exam) return;

        // Enter fullscreen mode and keep it fullscreen
        const enterFullscreen = () => {
            if (!document.fullscreenElement && !isSubmittingOrFinished.current) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        };
        enterFullscreen();

        const preventDefault = (e) => e.preventDefault();

        // Disable mouse-based copy-pasting & right click
        document.addEventListener('contextmenu', preventDefault);
        document.addEventListener('selectstart', preventDefault);
        document.addEventListener('dragstart', preventDefault);
        document.addEventListener('copy', preventDefault);
        document.addEventListener('cut', preventDefault);
        document.addEventListener('paste', preventDefault);

        // Block secure/developer shortcuts
        const handleKeyDown = (e) => {
            if (isSubmittingOrFinished.current) return;
            if (
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
                (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V' || e.key === 'x' || e.key === 'X' || e.key === 's' || e.key === 'S'))
            ) {
                e.preventDefault();
                triggerMalpractice(`Unauthorized keyboard shortcut: ${e.key}`);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        // Detect switching tabs or minimizing window
        const handleVisibilityChange = () => {
            if (isSubmittingOrFinished.current) return;
            if (document.visibilityState === 'hidden') {
                triggerMalpractice('Switched tabs or minimized window');
            }
        };

        // Detect loss of window focus (e.g. system alerts, clicking outside browser, secondary monitors/overlays)
        const handleBlur = () => {
            setTimeout(() => {
                if (isSubmittingOrFinished.current) return;
                if (!document.hasFocus()) {
                    triggerMalpractice('Window focus lost (possible overlay or secondary application opened)');
                }
            }, 400);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        // Detect exit from fullscreen
        const handleFullscreenChange = () => {
            if (isSubmittingOrFinished.current) return;
            if (!document.fullscreenElement) {
                triggerMalpractice('Exited secure full-screen mode');
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('contextmenu', preventDefault);
            document.removeEventListener('selectstart', preventDefault);
            document.removeEventListener('dragstart', preventDefault);
            document.removeEventListener('copy', preventDefault);
            document.removeEventListener('cut', preventDefault);
            document.removeEventListener('paste', preventDefault);
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [session, exam, triggerMalpractice]);

    // ── Countdown Timer ─────────────────────────────────────────
    useEffect(() => {
        if (timeLeft === null) return;
        timerRef.current = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) {
                    clearInterval(timerRef.current);
                    if (!autoSubmitted.current) { autoSubmitted.current = true; handleSubmit(true); }
                    return 0;
                }
                return t - 1;
            });
            questionDwellTimeRef.current[current] = (questionDwellTimeRef.current[current] || 0) + 1;
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [timeLeft !== null, current]);

    // ── Local Storage & Autosave Progress sync ──────────────────
    useEffect(() => {
        const sid = session?._id || session?.id;
        if (!sid || answers.length === 0) return;
        
        // 1. Sync immediately to localStorage
        const storageKey = `exam_answers_${examId}_${sid}`;
        localStorage.setItem(storageKey, JSON.stringify(answers));

        // 2. Debounced sync to database
        const timer = setTimeout(async () => {
            try {
                await api.post(`/api/exams/${examId}/session/save-progress`, {
                    sessionId: sid,
                    answers
                }, { skipLoader: true });
            } catch (err) {
                console.error('Failed to autosave progress to server:', err);
            }
        }, 3000); // debounce 3 seconds

        return () => clearTimeout(timer);
    }, [answers, session?._id, session?.id, examId]);

    const formatTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const isTimeCritical = timeLeft !== null && timeLeft < 300;

    // ── Palette helpers ─────────────────────────────────────────
    const updateAnswer = (idx, patch) => {
        const dwell = questionDwellTimeRef.current[idx] || 0;
        questionDwellTimeRef.current[idx] = 0;
        setAnswers(prev => {
            const updated = prev.map((a, i) => i === idx ? { ...a, ...patch, timeTaken: (a.timeTaken || 0) + dwell } : a);
            try {
                const sid = session?._id || session?.id;
                if (sid) {
                    const storageKey = `exam_answers_${examId}_${sid}`;
                    localStorage.setItem(storageKey, JSON.stringify(updated));
                }
            } catch (e) {}
            return updated;
        });
    };

    const goTo = (idx) => {
        if (idx < 0 || !exam || idx >= exam.questions.length) return;
        // Mark current as visited
        updateAnswer(idx, { visited: true });
        setCurrent(idx);
    };

    // ── Actions ─────────────────────────────────────────────────
    const handleOptionSelect = (opt) => {
        updateAnswer(current, { selectedOption: opt, visited: true });
    };

    const handleSaveNext = () => {
        updateAnswer(current, { visited: true });
        if (current < exam.questions.length - 1) goTo(current + 1);
    };

    const handleClear = () => {
        updateAnswer(current, { selectedOption: null, markedForReview: false });
    };

    const handleMarkForReview = () => {
        updateAnswer(current, { markedForReview: true, visited: true });
        if (current < exam.questions.length - 1) goTo(current + 1);
    };

    const handleSaveAndMarkForReview = () => {
        updateAnswer(current, { markedForReview: true, visited: true });
        if (current < exam.questions.length - 1) goTo(current + 1);
    };

    const handleSubmit = useCallback(async (auto = false) => {
        if (submitting) return;
        isSubmittingOrFinished.current = true;
        setSubmitting(true);
        clearInterval(timerRef.current);
        try {
            const finalAnswers = answers.map((a, i) => ({
                ...a,
                timeTaken: (a.timeTaken || 0) + (questionDwellTimeRef.current[i] || 0)
            }));

            // ── Comprehensive Client CBT Assessment & Analytics Calculation Engine ──
            const isCET = (exam?.examType === 'CET' || exam?.examType === 'KCET');
            const correctMarks = isCET ? 1 : 4;
            const incorrectMarks = isCET ? 0 : -1;

            let score = 0, correct = 0, incorrect = 0, unattempted = 0;
            let totalTimeSpent = 0;
            const weakMap = {};
            const breakdown = [];

            (exam?.questions || []).forEach((q, idx) => {
                const qIdentifier = (q._id || q.id || q.questionId || idx).toString();
                const userAns = finalAnswers[idx] || finalAnswers.find(fa => String(fa.questionId) === qIdentifier) || {};
                const selected = userAns.selectedOption;
                const timeTaken = Math.max(0, parseFloat(userAns.timeTaken) || 0);
                totalTimeSpent += timeTaken;

                const isAttempted = selected !== null && selected !== undefined && selected !== '';
                let isCorrect = false;

                const chapterName = q.chapter || 'General';
                const conceptName = q.concept || q.subConcept || 'General';
                const topicKey = `${q.subject || 'Subject'}::${chapterName}::${conceptName}`;

                if (!weakMap[topicKey]) {
                    weakMap[topicKey] = {
                        subject: q.subject || 'Subject',
                        chapter: chapterName,
                        concept: conceptName,
                        totalQuestions: 0,
                        correct: 0,
                        incorrect: 0,
                        unattempted: 0,
                        timeSpent: 0
                    };
                }
                weakMap[topicKey].totalQuestions++;
                weakMap[topicKey].timeSpent += timeTaken;

                if (isAttempted) {
                    const parsedSelected = parseFloat(selected);
                    const parsedAnswer = parseFloat(q.answer || q.correctAnswer);
                    if (!isNaN(parsedSelected) && !isNaN(parsedAnswer)) {
                        if (Math.abs(parsedSelected - parsedAnswer) <= 1e-9) isCorrect = true;
                    }
                    if (!isCorrect && String(selected).trim().toLowerCase() === String(q.answer || q.correctAnswer || '').trim().toLowerCase()) {
                        isCorrect = true;
                    }
                    if (!isCorrect && q.options && q.options.length > 0) {
                        const letters = ['A', 'B', 'C', 'D'];
                        const selLetterIdx = letters.indexOf(String(selected).trim().toUpperCase());
                        const ansLetterIdx = letters.indexOf(String(q.answer || q.correctAnswer || '').trim().toUpperCase());
                        if (selLetterIdx !== -1 && q.options[selLetterIdx]) {
                            if (String(q.options[selLetterIdx]).trim().toLowerCase() === String(q.answer || q.correctAnswer || '').trim().toLowerCase()) isCorrect = true;
                        }
                        if (ansLetterIdx !== -1 && q.options[ansLetterIdx]) {
                            if (String(selected).trim().toLowerCase() === String(q.options[ansLetterIdx]).trim().toLowerCase()) isCorrect = true;
                        }
                        if (selLetterIdx !== -1 && selLetterIdx === ansLetterIdx) isCorrect = true;
                    }

                    if (isCorrect) {
                        score += correctMarks;
                        correct++;
                        weakMap[topicKey].correct++;
                    } else {
                        score += incorrectMarks;
                        incorrect++;
                        weakMap[topicKey].incorrect++;
                    }
                } else {
                    unattempted++;
                    weakMap[topicKey].unattempted++;
                }

                breakdown.push({
                    _id: qIdentifier,
                    subject: q.subject || 'Subject',
                    chapter: chapterName,
                    concept: conceptName,
                    questionText: q.questionText,
                    options: q.options || [],
                    selectedOption: selected,
                    correctAnswer: q.answer || q.correctAnswer,
                    timeTaken: timeTaken,
                    isCorrect: isCorrect,
                    isAttempted: isAttempted
                });
            });

            const weakAreas = Object.values(weakMap)
                .map(w => {
                    const attemptedInTopic = w.correct + w.incorrect;
                    const accuracy = attemptedInTopic > 0 ? Math.round((w.correct / attemptedInTopic) * 100) : 0;
                    const attemptRate = w.totalQuestions > 0 ? Math.round((attemptedInTopic / w.totalQuestions) * 100) : 0;
                    const avgTimePerQuestion = w.totalQuestions > 0 ? Math.round(w.timeSpent / w.totalQuestions) : 0;
                    let classification = 'STRENGTH';
                    if (accuracy < 40 || (attemptRate < 50 && w.totalQuestions >= 3)) {
                        classification = 'CRITICAL_WEAKNESS';
                    } else if (accuracy >= 40 && accuracy < 60) {
                        classification = 'MODERATE_WEAKNESS';
                    }
                    return {
                        ...w,
                        accuracy,
                        attemptRate,
                        avgTimePerQuestion,
                        classification,
                        totalWeak: w.incorrect + w.unattempted
                    };
                })
                .filter(w => w.totalWeak > 0)
                .sort((a, b) => b.totalWeak - a.totalWeak);

            const activeSessionId = session?._id || session?.id || `sess_cbt_${Date.now()}`;
            const localScorecard = {
                sessionId: String(activeSessionId),
                examId: examId,
                examTitle: exam?.title || 'Online Examination',
                examType: exam?.examType || 'CET',
                studentName: studentInfo.studentName || 'Student',
                rollNumber: studentInfo.rollNumber || '',
                studentEmail: studentInfo.studentEmail || '',
                totalQuestions: (exam?.questions || []).length,
                attempted: correct + incorrect,
                correct: correct,
                incorrect: incorrect,
                unattempted: unattempted,
                score: score,
                totalTimeSpent: totalTimeSpent,
                weakAreas: weakAreas,
                breakdown: breakdown,
                submittedAt: new Date().toISOString()
            };

            // Store full calculated metrics into persistent local storage
            localStorage.setItem(`cbt_scorecard_${activeSessionId}`, JSON.stringify(localScorecard));
            localStorage.setItem('cbt_scorecard_latest', JSON.stringify(localScorecard));

            let redirectSessionId = activeSessionId;
            try {
                const res = await api.post(`/api/exams/${examId}/submit`, {
                    sessionId: session?._id || session?.id,
                    answers: finalAnswers
                });
                if (res.data?.sessionId) {
                    redirectSessionId = res.data.sessionId;
                    localStorage.setItem(`cbt_scorecard_${redirectSessionId}`, JSON.stringify(localScorecard));
                }
            } catch (submitErr) {
                console.warn('Backend submit notice:', submitErr.message);
            }

            try {
                const storageKey = `exam_answers_${examId}_${activeSessionId}`;
                localStorage.removeItem(storageKey);
            } catch (e) {}

            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
            navigate(`/exam/${examId}/scorecard/${redirectSessionId}`);
        } catch (err) {
            console.error('Submit failed', err);
            isSubmittingOrFinished.current = false;
            setSubmitting(false);
        }
    }, [submitting, session, answers, exam, examId, studentInfo, navigate]);

    // ── Computed palette counts ─────────────────────────────────
    const counts = answers.reduce((acc, a) => {
        const s = getState(a);
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    const subjectSections = useMemo(() => {
        if (!exam || !Array.isArray(exam.questions)) return [];
        const map = new Map();
        exam.questions.forEach((q, idx) => {
            const sub = q.subject || 'General';
            if (!map.has(sub)) {
                map.set(sub, { name: sub, firstIndex: idx, count: 0 });
            }
            map.get(sub).count += 1;
        });
        return Array.from(map.values());
    }, [exam]);

    if (loading) return <div style={styles.center}>Loading exam...</div>;
    if (!exam) return <div style={styles.center}>Exam not available.</div>;

    const currentQ = exam.questions[current];
    const currentA = answers[current] || {};

    return (
        <div style={styles.page}>
            {/* Top Bar */}
            <div style={styles.topBar}>
                <div style={styles.topLeft}>
                    <span style={styles.examTitleTop}>{exam.title}</span>
                    <span style={styles.examTypeTag}>{exam.examType}</span>
                </div>
                <div style={styles.timerBox}>
                    <span style={styles.timerLabel}>Time Left</span>
                    <span style={{ ...styles.timer, color: isTimeCritical ? '#ef4444' : '#10b981' }}>
                        {timeLeft !== null ? formatTime(timeLeft) : '--:--:--'}
                    </span>
                </div>
                <div style={styles.topRight}>
                    <span style={styles.candidateName}>👤 {studentInfo.studentName || 'Candidate'}</span>
                </div>
            </div>

            {/* Subject / Section Tabs */}
            {subjectSections.length > 1 && (
                <div style={styles.subjectNavBar}>
                    <div style={styles.subjectNavLabel}>SECTIONS:</div>
                    <div style={styles.subjectNavTabs}>
                        {subjectSections.map(sec => {
                            const isCurrentSubject = currentQ?.subject === sec.name;
                            return (
                                <button
                                    key={sec.name}
                                    type="button"
                                    onClick={() => goTo(sec.firstIndex)}
                                    style={{
                                        ...styles.subjectNavTab,
                                        ...(isCurrentSubject ? styles.subjectNavTabActive : {})
                                    }}
                                >
                                    <span>{sec.name}</span>
                                    <span style={{
                                        fontSize: '11px',
                                        padding: '1px 6px',
                                        borderRadius: '999px',
                                        background: isCurrentSubject ? '#001f6d' : '#e2e8f0',
                                        color: isCurrentSubject ? '#fde047' : '#475569',
                                        marginLeft: '6px',
                                        fontWeight: 800
                                    }}>
                                        {sec.count} Qs
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div style={styles.body}>
                {/* ── Left: Question Panel ── */}
                <div style={styles.questionPanel}>
                    {/* Question Header */}
                    <div style={styles.qHeader}>
                        <span style={styles.qNum}>Question {current + 1} of {exam.questions.length}</span>
                        <span style={styles.qSubject}>{currentQ.subject} | {currentQ.chapter}</span>
                    </div>

                    {/* Question Text */}
                    <div style={styles.qBody}>
                        {currentQ.type === 'ASSERTION_REASON' && (
                            <div style={{ marginBottom: '1.5rem', fontSize: '1.1rem', lineHeight: '1.6', color: '#1f2937' }}>
                                <p style={{ marginBottom: '0.5rem' }}><strong>Assertion (A):</strong> {currentQ.assertion}</p>
                                <p style={{ marginBottom: '0.5rem' }}><strong>Reason (R):</strong> {currentQ.reason}</p>
                            </div>
                        )}

                        {currentQ.type === 'STATEMENT_BASED' && (
                            <div style={{ marginBottom: '1.5rem', fontSize: '1.1rem', lineHeight: '1.6', color: '#1f2937' }}>
                                <MathRenderer style={{ marginBottom: '0.75rem', fontWeight: 'bold' }} text={currentQ.questionText} />
                                {currentQ.statements?.map((stmt, idx) => (
                                    <p key={idx} style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}><strong>Statement {idx + 1}:</strong> {stmt}</p>
                                ))}
                            </div>
                        )}

                        {currentQ.type === 'MATCH_FOLLOWING' && (
                            <div style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: '#1f2937' }}>
                                <MathRenderer style={{ marginBottom: '0.75rem', fontWeight: 'bold' }} text={currentQ.questionText} />
                                <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem', background: '#f9fafb', maxWidth: '500px', marginBottom: '1rem' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', fontWeight: 'bold', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Column A</th>
                                                <th style={{ textAlign: 'left', fontWeight: 'bold', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Column B</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentQ.matchPairs?.map((pair, idx) => (
                                                <tr key={idx}>
                                                    <td style={{ padding: '0.5rem 0' }}>{String.fromCharCode(65 + idx)}. {pair.left}</td>
                                                    <td style={{ padding: '0.5rem 0' }}>{idx + 1}. {pair.right}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {(() => {
                            const { cleanText, diagramUrl } = extractDiagramFromText(
                                currentQ.questionText || currentQ.question,
                                currentQ.imageUrl || currentQ.image_url
                            );
                            return (
                                <>
                                    {currentQ.type !== 'ASSERTION_REASON' && currentQ.type !== 'STATEMENT_BASED' && currentQ.type !== 'MATCH_FOLLOWING' && (
                                        <MathRenderer style={styles.qText} text={cleanText} />
                                    )}
                                    {diagramUrl && (
                                        <div style={{ margin: '12px auto', textAlign: 'center' }}>
                                            <ResizableDiagram
                                                src={diagramUrl}
                                                alt="Question Diagram"
                                                questionId={currentQ._id || currentQ.id || currentIdx}
                                                maxWidth="450px"
                                            />
                                        </div>
                                    )}
                                </>
                            );
                        })()}

                        {/* Options or Numerical Input */}
                        {currentQ.type === 'NUMERICAL' || currentQ.type === 'numerical' || !currentQ.options || currentQ.options.length === 0 ? (
                            <div style={styles.numericalContainer}>
                                <div style={styles.numericalRow}>
                                    <div style={styles.inputWrapper}>
                                        <label style={styles.inputLabel}>Enter your answer (Numerical Value):</label>
                                        <input
                                            type="text"
                                            value={currentA.selectedOption || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (/^-?\d*\.?\d*$/.test(val)) {
                                                    handleOptionSelect(val);
                                                }
                                            }}
                                            placeholder="Type your answer here..."
                                            style={styles.numericalInput}
                                            autoFocus
                                        />
                                    </div>
                                    
                                    {/* Virtual Keypad */}
                                    <div style={styles.keypadWrapper}>
                                        <div style={styles.keypadTitle}>Virtual Keypad</div>
                                        <div style={styles.keypadGrid}>
                                            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', '.'].map((key) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => {
                                                        const currentVal = (currentA.selectedOption || '').toString();
                                                        let newVal = currentVal;
                                                        if (key === '-') {
                                                            if (currentVal.startsWith('-')) {
                                                                newVal = currentVal.substring(1);
                                                            } else {
                                                                newVal = '-' + currentVal;
                                                            }
                                                        } else if (key === '.') {
                                                            if (!currentVal.includes('.')) {
                                                                newVal = currentVal + '.';
                                                            }
                                                        } else {
                                                            if (currentVal === '0') {
                                                                newVal = key;
                                                            } else {
                                                                newVal = currentVal + key;
                                                            }
                                                        }
                                                        if (/^-?\d*\.?\d*$/.test(newVal)) {
                                                            handleOptionSelect(newVal);
                                                        }
                                                    }}
                                                    style={styles.keypadBtn}
                                                >
                                                    {key}
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const currentVal = (currentA.selectedOption || '').toString();
                                                    if (currentVal.length > 0) {
                                                        handleOptionSelect(currentVal.substring(0, currentVal.length - 1));
                                                    }
                                                }}
                                                style={{ ...styles.keypadBtn, gridColumn: 'span 2', background: '#f3f4f6', color: '#374151' }}
                                            >
                                                ⌫ Backspace
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleOptionSelect('')}
                                                style={{ ...styles.keypadBtn, background: '#fef2f2', color: '#b91c1c' }}
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : currentQ.type === 'TRUE_FALSE' ? (
                            <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                                {['True', 'False'].map(opt => {
                                    const selected = currentA.selectedOption === opt;
                                    return (
                                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', color: '#1e3a8a' }}>
                                            <input
                                                type="radio"
                                                name="tf_option"
                                                checked={selected}
                                                onChange={() => handleOptionSelect(opt)}
                                                style={{ width: '1.25rem', height: '1.25rem' }}
                                            />
                                            {opt}
                                        </label>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ marginTop: '1.25rem', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {currentQ.options?.map((opt, i) => {
                                        const label = String.fromCharCode(65 + i); // Standard A, B, C, D
                                        const isSelected = 
                                            currentA.selectedOption === label || 
                                            currentA.selectedOption === opt ||
                                            currentA.selectedOption === String(i) ||
                                            currentA.selectedOption === String(i + 1) ||
                                            String(currentA.selectedOption || '').trim().toUpperCase() === label;

                                        return (
                                            <div 
                                                key={i} 
                                                onClick={() => handleOptionSelect(label)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOptionSelect(label); }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '14px',
                                                    padding: '12px 18px',
                                                    borderRadius: '10px',
                                                    border: isSelected ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
                                                    background: isSelected ? '#eff6ff' : '#ffffff',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease-in-out',
                                                    boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none',
                                                    userSelect: 'none'
                                                }}
                                            >
                                                {/* Option Letter Circle Badge */}
                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: '700',
                                                    fontSize: '15px',
                                                    background: isSelected ? '#2563eb' : '#f1f5f9',
                                                    color: isSelected ? '#ffffff' : '#334155',
                                                    border: isSelected ? 'none' : '1px solid #cbd5e1',
                                                    flexShrink: 0
                                                }}>
                                                    {label}
                                                </div>

                                                {/* Option Content rendered with MathRenderer */}
                                                <div style={{ flex: 1, fontSize: '15.5px', color: '#1e293b', lineHeight: '1.5' }}>
                                                    <MathRenderer inline={true} text={opt} />
                                                </div>

                                                {/* Selected Radio Indicator */}
                                                <div style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: '50%',
                                                    border: isSelected ? '6px solid #2563eb' : '2px solid #cbd5e1',
                                                    background: '#ffffff',
                                                    flexShrink: 0,
                                                    transition: 'all 0.15s ease-in-out'
                                                }} />
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Synchronized Bottom Radio Bar */}
                                <div style={{ display: 'flex', gap: '20px', marginTop: '16px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Select Option:</span>
                                    {currentQ.options?.map((opt, i) => {
                                        const label = String.fromCharCode(65 + i);
                                        const isSelected = 
                                            currentA.selectedOption === label || 
                                            currentA.selectedOption === opt ||
                                            String(currentA.selectedOption || '').trim().toUpperCase() === label;

                                        return (
                                            <label 
                                                key={`radio-${i}`} 
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: isSelected ? '700' : '500', color: isSelected ? '#2563eb' : '#334155', fontSize: '14px' }}
                                            >
                                                <input 
                                                    type="radio" 
                                                    name={`jee_opt_${current}`} 
                                                    checked={isSelected} 
                                                    onChange={() => handleOptionSelect(label)} 
                                                    style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
                                                />
                                                {label}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons - placed below the options */}
                        <div style={styles.actionBarContainer}>
                            <hr style={styles.dividerBlue} />
                            <div style={styles.actionBarRow1}>
                                <button style={styles.btnSaveNextJEE} onClick={handleSaveNext}>SAVE & NEXT</button>
                                <button style={styles.btnClearJEE} onClick={handleClear}>CLEAR</button>
                                <button style={styles.btnSaveMarkReviewJEE} onClick={handleSaveAndMarkForReview}>SAVE & MARK FOR REVIEW</button>
                                <button style={styles.btnMarkReviewJEE} onClick={handleMarkForReview}>MARK FOR REVIEW & NEXT</button>
                            </div>
                            <div style={styles.actionBarRow2}>
                                <div style={styles.navBtns}>
                                    <button style={styles.btnNavJEE} onClick={() => goTo(current - 1)} disabled={current === 0}>&lt;&lt; BACK</button>
                                    <button style={styles.btnNavJEE} onClick={() => goTo(current + 1)} disabled={current === exam.questions?.length - 1}>NEXT &gt;&gt;</button>
                                </div>
                                <button style={styles.btnSubmitJEE} onClick={() => setShowSubmitConfirm(true)}>SUBMIT</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Right: Question Palette ── */}
                <div style={styles.palettePanel}>
                    {/* Candidate Info */}
                    <div style={styles.candidateBlock}>
                        <div style={styles.candidateAvatar}>👤</div>
                        <div>
                            <div style={styles.candidateNameRight}>{studentInfo.studentName || 'Student'}</div>
                            <div style={styles.candidateRoll}>{studentInfo.rollNumber || ''}</div>
                        </div>
                    </div>

                    {/* Status Counts */}
                    <div style={styles.statusRowJEE}>
                        <div style={styles.statusItemJEE}>
                            <div style={styles.paletteShapeWrap}>
                                <span style={{ ...styles.statusSquare, background: '#f5f5f5', border: '1px solid #ccc', color: '#000' }}>{counts[STATE.NOT_VISITED] || 0}</span>
                            </div>
                            <span style={styles.statusLabelJEE}>Not Visited</span>
                        </div>
                        <div style={styles.statusItemJEE}>
                            <div style={styles.paletteShapeWrap}>
                                <span style={{ ...styles.statusPolyRed }}>{counts[STATE.NOT_ANSWERED] || 0}</span>
                            </div>
                            <span style={styles.statusLabelJEE}>Not Answered</span>
                        </div>
                        <div style={styles.statusItemJEE}>
                            <div style={styles.paletteShapeWrap}>
                                <span style={{ ...styles.statusPolyGreen }}>{counts[STATE.ANSWERED] || 0}</span>
                            </div>
                            <span style={styles.statusLabelJEE}>Answered</span>
                        </div>
                        <div style={styles.statusItemJEE}>
                            <div style={styles.paletteShapeWrap}>
                                <span style={{ ...styles.statusCirclePurple }}>{counts[STATE.MARKED] || 0}</span>
                            </div>
                            <span style={styles.statusLabelJEE}>Marked for Review</span>
                        </div>
                        <div style={{...styles.statusItemJEE, gridColumn: 'span 2', marginTop: 5}}>
                            <div style={styles.paletteShapeWrap}>
                                <span style={{ ...styles.statusCirclePurple, position: 'relative' }}>
                                    {(counts[STATE.ANSWERED_MARKED] || 0)}
                                    <span style={styles.statusDotGreenSmall} />
                                </span>
                            </div>
                            <span style={styles.statusLabelJEE}>Answered & Marked for Review<br/>(will be considered for evaluation)</span>
                        </div>
                    </div>

                    {/* Palette Title */}
                    <div style={styles.paletteTitle}>Question Palette</div>

                    {/* Palette Grid */}
                    <div style={styles.paletteGrid}>
                        {answers.map((a, i) => {
                            const state = getState(a);
                            const isCurrent = i === current;
                            
                            let shapeStyle = {};
                            let textStyle = { color: '#fff' };
                            
                            if (state === STATE.NOT_VISITED) {
                                shapeStyle = { ...styles.statusSquare, background: '#f5f5f5', border: '1px solid #ccc', color: '#000' };
                                textStyle = { color: '#000' };
                            } else if (state === STATE.NOT_ANSWERED) {
                                shapeStyle = styles.statusPolyRed;
                            } else if (state === STATE.ANSWERED) {
                                shapeStyle = styles.statusPolyGreen;
                            } else if (state === STATE.MARKED || state === STATE.ANSWERED_MARKED) {
                                shapeStyle = styles.statusCirclePurple;
                            }

                            return (
                                <div key={i} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div 
                                        style={{ ...shapeStyle, cursor: 'pointer', opacity: isCurrent ? 0.7 : 1 }}
                                        onClick={() => goTo(i)}
                                    >
                                        <span style={textStyle}>{String(i + 1).padStart(2, '0')}</span>
                                    </div>
                                    {state === STATE.ANSWERED_MARKED && (
                                        <span style={styles.statusDotGreenSmall} />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Submit Button */}
                    <button style={styles.submitBtn} onClick={() => setShowSubmitConfirm(true)}>
                        🏁 Submit Exam
                    </button>
                </div>
            </div>

            {/* Submit Confirmation Modal */}
            {showSubmitConfirm && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <h3 style={styles.modalTitle}>⚠️ Submit Examination?</h3>
                        <div style={styles.modalStats}>
                            <div style={styles.modalStat}><span style={{ color: '#10b981', fontWeight: 700 }}>{counts[STATE.ANSWERED] || 0}</span> Answered</div>
                            <div style={styles.modalStat}><span style={{ color: '#ef4444', fontWeight: 700 }}>{counts[STATE.NOT_ANSWERED] || 0}</span> Not Answered</div>
                            <div style={styles.modalStat}><span style={{ color: '#6b7280', fontWeight: 700 }}>{counts[STATE.NOT_VISITED] || 0}</span> Not Visited</div>
                            <div style={styles.modalStat}><span style={{ color: '#8b5cf6', fontWeight: 700 }}>{(counts[STATE.MARKED] || 0) + (counts[STATE.ANSWERED_MARKED] || 0)}</span> Marked</div>
                        </div>
                        <p style={styles.modalNote}>Once submitted, you cannot return to the exam. Are you sure?</p>
                        <div style={styles.modalBtns}>
                            <button style={styles.cancelBtn} onClick={() => setShowSubmitConfirm(false)}>◀ Return to Exam</button>
                            <button style={styles.confirmBtn} onClick={() => handleSubmit(false)} disabled={submitting}>
                                {submitting ? 'Submitting...' : '✅ Confirm Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    page: { minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' },
    topBar: { background: '#1e3a5f', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
    topLeft: { display: 'flex', alignItems: 'center', gap: 12 },
    examTitleTop: { fontSize: 14, fontWeight: 600 },
    examTypeTag: { background: '#f59e0b', color: '#000', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700 },
    timerBox: { textAlign: 'center' },
    timerLabel: { display: 'block', fontSize: 11, color: '#94a3b8', letterSpacing: 1 },
    timer: { fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
    topRight: { fontSize: 13, color: '#cbd5e1' },
    candidateName: { fontWeight: 600 },
    body: { display: 'flex', flex: 1, gap: 0 },
    subjectNavBar: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 20px',
        background: '#f8fafc',
        borderBottom: '2px solid #e2e8f0',
        flexWrap: 'wrap'
    },
    subjectNavLabel: {
        fontSize: '11px',
        fontWeight: 900,
        color: '#475569',
        letterSpacing: '0.05em'
    },
    subjectNavTabs: {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap'
    },
    subjectNavTab: {
        display: 'flex',
        alignItems: 'center',
        padding: '6px 14px',
        borderRadius: '8px',
        border: '1.5px solid #cbd5e1',
        background: '#ffffff',
        color: '#1e293b',
        fontSize: '12px',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.15s ease'
    },
    subjectNavTabActive: {
        background: '#001f6d',
        color: '#ffffff',
        borderColor: '#001f6d',
        boxShadow: '0 2px 6px rgba(0, 31, 109, 0.25)'
    },
    // Question Panel
    questionPanel: { flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', margin: 16, borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' },
    qHeader: { background: '#1e3a5f', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', fontSize: 13 },
    qNum: { fontWeight: 700 },
    qSubject: { color: '#94a3b8', fontSize: 12 },
    qBody: { flex: 1, padding: '24px 28px', overflowY: 'auto' },
    qText: { fontSize: 15, color: '#1e293b', lineHeight: 1.7, marginBottom: 20, fontWeight: 500 },
    qImage: { maxWidth: '100%', borderRadius: 8, marginBottom: 16, border: '1px solid #e5e7eb' },
    optionsTextContainer: { display: 'flex', flexDirection: 'column', gap: '20px', margin: '20px 0' },
    optionTextLine: { display: 'flex', gap: '10px', fontSize: '15px' },
    optionTextLabel: { fontWeight: 'bold' },
    optionTextContent: { flex: 1 },
    divider: { border: '0', borderTop: '1px solid #ccc', margin: '20px 0' },
    dividerBlue: { border: '0', borderTop: '1px solid #4f46e5', margin: '10px 0', opacity: 0.3 },
    radioContainer: { display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' },
    radioLabel: { display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '16px', color: '#555' },
    radioInput: { marginRight: '8px', width: '16px', height: '16px', accentColor: '#4f46e5' },
    
    actionBarContainer: { display: 'flex', flexDirection: 'column' },
    actionBarRow1: { display: 'flex', gap: '5px', padding: '10px 0', flexWrap: 'wrap', borderBottom: '1px solid #eee' },
    actionBarRow2: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', background: '#f9f9f9' },
    navBtns: { display: 'flex', gap: '5px' },
    
    btnSaveNextJEE: { background: '#5cb85c', color: '#fff', border: 'none', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
    btnClearJEE: { background: '#fff', color: '#333', border: '1px solid #ccc', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
    btnSaveMarkReviewJEE: { background: '#f0ad4e', color: '#fff', border: 'none', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
    btnMarkReviewJEE: { background: '#337ab7', color: '#fff', border: 'none', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
    btnNavJEE: { background: '#fff', color: '#666', border: '1px solid #ccc', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
    btnSubmitJEE: { background: '#5cb85c', color: '#fff', border: 'none', padding: '8px 20px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
    
    // Palette Panel
    palettePanel: { width: 320, flexShrink: 0, background: '#fff', borderLeft: '1px solid #ccc', display: 'flex', flexDirection: 'column' },
    candidateBlock: { display: 'flex', gap: 10, alignItems: 'center', background: '#f5f5f5', borderBottom: '1px solid #ccc', padding: '10px', color: '#333' },
    candidateAvatar: { fontSize: 32 },
    candidateNameRight: { fontSize: 13, fontWeight: 'bold' },
    candidateRoll: { fontSize: 11, color: '#666' },
    
    statusRowJEE: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', borderBottom: '1px dashed #ccc', border: '1px solid #ccc', margin: '10px', borderRadius: '4px' },
    statusItemJEE: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' },
    paletteShapeWrap: { width: '30px', display: 'flex', justifyContent: 'center' },
    statusLabelJEE: { color: '#333', lineHeight: '1.2' },
    
    statusSquare: { width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', borderRadius: '3px', fontWeight: 'bold' },
    statusPolyRed: { width: '30px', height: '30px', background: '#eb3b3b', border: '1px solid #c92a2a', clipPath: 'polygon(0 15%, 100% 0, 100% 85%, 0% 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', borderRadius: '2px', color: '#fff', fontWeight: 'bold' },
    statusPolyGreen: { width: '30px', height: '30px', background: '#22c55e', border: '1px solid #16a34a', clipPath: 'polygon(0 0, 100% 15%, 100% 100%, 0 85%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', borderRadius: '2px', color: '#fff', fontWeight: 'bold' },
    statusCirclePurple: { width: '30px', height: '30px', background: '#6366f1', border: '1px solid #4f46e5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#fff', fontWeight: 'bold' },
    statusDotGreenSmall: { width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', position: 'absolute', bottom: '0px', right: '0px', border: '1px solid #fff' },
    
    paletteTitle: { fontSize: 13, fontWeight: 700, color: '#1e293b', padding: '10px', background: '#e0e7ff', borderTop: '1px solid #c7d2fe', borderBottom: '1px solid #c7d2fe' },
    paletteGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', padding: '15px 10px', overflowY: 'auto' },
    
    submitBtn: { display: 'none' }, // Submit button is now in the actionBarRow2
    // Modal
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modal: { background: '#fff', borderRadius: 16, padding: '32px 36px', width: '90%', maxWidth: 460 },
    modalTitle: { fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 20px', textAlign: 'center' },
    modalStats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 },
    modalStat: { background: '#f8fafc', borderRadius: 8, padding: '12px', textAlign: 'center', fontSize: 14 },
    modalNote: { color: '#6b7280', fontSize: 14, textAlign: 'center', marginBottom: 24 },
    modalBtns: { display: 'flex', gap: 12 },
    cancelBtn: { flex: 1, background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
    confirmBtn: { flex: 1, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
    center: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: '#6b7280', fontSize: 16 },
    numericalContainer: {
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '24px',
        margin: '12px 0',
        width: '100%'
    },
    numericalRow: {
        display: 'flex',
        gap: 32,
        alignItems: 'flex-start',
        flexWrap: 'wrap'
    },
    inputWrapper: {
        flex: 1,
        minWidth: 260,
        display: 'flex',
        flexDirection: 'column',
        gap: 8
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: 600,
        color: '#475569'
    },
    numericalInput: {
        padding: '14px 18px',
        fontSize: 20,
        fontWeight: 700,
        fontFamily: 'Courier New, monospace',
        border: '2.5px solid #cbd5e1',
        borderRadius: 10,
        outline: 'none',
        transition: 'all 0.15s',
        color: '#1e293b',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
        textAlign: 'center',
        background: '#fff'
    },
    keypadWrapper: {
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '16px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
        width: '100%',
        maxWidth: 240
    },
    keypadTitle: {
        fontSize: 12,
        fontWeight: 700,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 12,
        textAlign: 'center'
    },
    keypadGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8
    },
    keypadBtn: {
        padding: '10px 0',
        fontSize: 16,
        fontWeight: 700,
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        background: '#fff',
        cursor: 'pointer',
        transition: 'all 0.1s',
        color: '#1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    }
};
