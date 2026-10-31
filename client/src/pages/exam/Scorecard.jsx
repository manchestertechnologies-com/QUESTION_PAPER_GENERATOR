import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { sanitize } from '../../utils/sanitize';
import MathRenderer from '../../components/MathRenderer';
import { checkAnswerCorrect, resolveOptionIndex, stripLeadingLabel, normalizeText } from '../../utils/answerEvaluation';
import safeStorage from '../../utils/safeStorage';
import { downloadIndividualScorecardPdf } from '../../utils/resultPdfExport';

export default function Scorecard() {
    const { examId, sessionId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('summary');
    const [reviewFilter, setReviewFilter] = useState('all'); // 'all', 'correct', 'incorrect', 'unattempted'
    const [leaderboard, setLeaderboard] = useState([]);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
    const hasSyncedRef = useRef(false);

    useEffect(() => {
        if (activeTab === 'leaderboard') {
            setLoadingLeaderboard(true);
            api.get(`/api/exams/${examId}/leaderboard`)
                .then(r => { setLeaderboard(r.data || []); setLoadingLeaderboard(false); })
                .catch(() => setLoadingLeaderboard(false));
        }
    }, [activeTab, examId]);

    const evalData = useMemo(() => {
        if (!data) return null;
        const isCET = (data.examType === 'CET' || data.examType === 'KCET');
        const marksPerQ = isCET ? 1 : 4;
        const penaltyPerQ = isCET ? 0 : -1;

        let totalCorrect = 0;
        let totalIncorrect = 0;
        let totalUnattempted = 0;
        let computedScore = 0;

        const evaluatedBreakdown = (data.breakdown || []).map((q, idx) => {
            const attempted = q.selectedOption !== null && q.selectedOption !== undefined && String(q.selectedOption).trim() !== '';
            const correctAns = q.correctAnswer ?? q.answer ?? q.correct_option;
            const isCorrect = attempted ? checkAnswerCorrect(q.selectedOption, correctAns, q.options, q.numericalTolerance, q.type) : false;
            
            if (attempted) {
                if (isCorrect) {
                    totalCorrect++;
                    computedScore += marksPerQ;
                } else {
                    totalIncorrect++;
                    computedScore += penaltyPerQ;
                }
            } else {
                totalUnattempted++;
            }

            const userOptIdx = resolveOptionIndex(q.selectedOption, q.options);
            const correctOptIdx = resolveOptionIndex(correctAns, q.options);

            return {
                ...q,
                originalIdx: idx,
                isAttempted: attempted,
                isCorrect: isCorrect,
                userOptIdx,
                correctOptIdx
            };
        });

        const hasBreakdown = evaluatedBreakdown.length > 0;
        return {
            ...data,
            correct: hasBreakdown ? totalCorrect : (data.correct || 0),
            incorrect: hasBreakdown ? totalIncorrect : (data.incorrect || 0),
            unattempted: hasBreakdown ? totalUnattempted : (data.unattempted || 0),
            attempted: hasBreakdown ? (totalCorrect + totalIncorrect) : (data.attempted || 0),
            score: hasBreakdown ? computedScore : (data.score || 0),
            breakdown: evaluatedBreakdown
        };
    }, [data]);

    const displayLeaderboard = useMemo(() => {
        let list = Array.isArray(leaderboard) ? [...leaderboard] : [];

        // 1. Check localStorage for any exam submissions saved on this device
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith('cbt_scorecard_') || k.startsWith('exam_score_'))) {
                    const raw = localStorage.getItem(k);
                    if (raw) {
                        const item = JSON.parse(raw);
                        if (item && (String(item.examId) === String(examId) || String(item.examTitle) === String(evalData?.examTitle))) {
                            const itemRoll = String(item.rollNumber || '').trim();
                            const itemName = String(item.studentName || '').trim();
                            const itemSessionId = String(item.sessionId || '').trim();
                            const alreadyInList = list.some(s => 
                                (itemRoll && String(s.rollNumber || '').trim() === itemRoll) ||
                                (itemSessionId && String(s.sessionId || s._id || s.id || '').trim() === itemSessionId) ||
                                (itemName && String(s.studentName || '').trim().toLowerCase() === itemName.toLowerCase())
                            );
                            if (!alreadyInList) {
                                list.push({
                                    sessionId: itemSessionId || 'local_' + i,
                                    studentName: item.studentName || 'Student',
                                    rollNumber: item.rollNumber || '—',
                                    score: Number(item.score) || 0,
                                    correct: Number(item.correct) || 0,
                                    incorrect: Number(item.incorrect) || 0,
                                    unattempted: Number(item.unattempted) || 0,
                                    totalQuestions: Number(item.totalQuestions) || 0,
                                    isCurrentUser: Boolean(itemRoll && evalData?.rollNumber && itemRoll === String(evalData.rollNumber).trim())
                                });
                            }
                        }
                    }
                }
            }
        } catch (e) {}

        // 2. Ensure current student is present
        if (evalData && (evalData.score !== undefined || evalData.studentName)) {
            const currentRoll = String(evalData.rollNumber || '').trim();
            const currentName = String(evalData.studentName || '').trim();
            const currentSessionId = String(evalData.sessionId || '').trim();

            const exists = list.some(s => {
                const sRoll = String(s.rollNumber || '').trim();
                const sName = String(s.studentName || '').trim();
                const sId = String(s.sessionId || s._id || s.id || '').trim();
                if (currentRoll && sRoll && sRoll === currentRoll) return true;
                if (currentSessionId && sId && sId === currentSessionId) return true;
                if (currentName && sName && sName.toLowerCase() === currentName.toLowerCase()) return true;
                return false;
            });

            if (!exists) {
                list.push({
                    sessionId: currentSessionId || 'current',
                    studentName: evalData.studentName || 'You',
                    rollNumber: evalData.rollNumber || '—',
                    score: Number(evalData.score) || 0,
                    correct: Number(evalData.correct) || 0,
                    incorrect: Number(evalData.incorrect) || 0,
                    unattempted: Number(evalData.unattempted) || 0,
                    totalQuestions: Number(evalData.totalQuestions) || 0,
                    isCurrentUser: true
                });
            }
        }
        return list.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    }, [leaderboard, evalData, examId]);

    const formatSeconds = (totalSecs) => {
        const m = Math.floor(totalSecs / 60);
        const s = totalSecs % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };



    // Helper to extract question answer mapping from local paper storage if exam was adapted from a paper
    const getLocalPaperAnswers = () => {
        const map = new Map();
        try {
            const draftStr = localStorage.getItem('sapthagiri_pu_wizard_draft_v3');
            if (draftStr) {
                const draft = JSON.parse(draftStr);
                const qs = draft?.selectedQuestions || [];
                qs.forEach((q, idx) => {
                    const ans = q.answer || q.correct_option || q.correctAnswer;
                    if (ans) {
                        if (q._id) map.set(String(q._id), q);
                        if (q.id) map.set(String(q.id), q);
                        if (q.questionText) map.set(String(q.questionText).trim().substring(0, 70), q);
                        map.set(`idx_${idx}`, q);
                    }
                });
            }
        } catch (e) {}
        return map;
    };

    // Universal hydration helper to resolve authentic answer keys from all available sources
    const hydrateWithBestAvailable = async (baseScorecard) => {
        if (!baseScorecard || !Array.isArray(baseScorecard.breakdown)) return baseScorecard;
        const localMap = getLocalPaperAnswers();

        // 1. First Pass: Apply any local paper draft matches
        let updatedBreakdown = baseScorecard.breakdown.map((b, idx) => {
            if (b.correctAnswer || b.answer || b.correct_option) return b;
            const qMatch = localMap.get(String(b._id || b.questionId)) ||
                           localMap.get(String(b.questionText || '').trim().substring(0, 70)) ||
                           localMap.get(`idx_${idx}`);
            if (qMatch) {
                return {
                    ...b,
                    correctAnswer: qMatch.answer || qMatch.correct_option || qMatch.correctAnswer,
                    solutionText: b.solutionText || qMatch.solutionText || qMatch.solution || ''
                };
            }
            return b;
        });

        // 2. Second Pass: Fetch /api/exams/${examId}/answer-key if still missing answers
        const stillNeeds = updatedBreakdown.some(b => !b.correctAnswer && !b.answer && !b.correct_option);
        if (stillNeeds) {
            try {
                const akRes = await api.get(`/api/exams/${examId}/answer-key`);
                const keyList = akRes.data?.answerKey || [];
                const keyMap = new Map(keyList.map(k => [String(k.questionId), k]));
                updatedBreakdown = updatedBreakdown.map((b, idx) => {
                    const k = keyMap.get(String(b._id || b.questionId)) || keyList[idx];
                    return {
                        ...b,
                        correctAnswer: k?.correctAnswer || b.correctAnswer || b.answer || b.correct_option,
                        solutionText: b.solutionText || k?.solutionText || ''
                    };
                });
            } catch (e) {
                // If answer-key endpoint fails, try resolving questions directly by text & ID from Supabase
                try {
                    const resolveRes = await api.post('/api/exams/resolve-answers', {
                        questions: updatedBreakdown.map(b => ({
                            _id: b._id || b.questionId,
                            questionId: b.questionId || b._id,
                            questionText: b.questionText,
                            options: b.options
                        }))
                    });
                    const resKeys = resolveRes.data?.answerKey || [];
                    const resMap = new Map(resKeys.map(k => [String(k.questionId), k]));
                    updatedBreakdown = updatedBreakdown.map((b, idx) => {
                        const rk = resMap.get(String(b._id || b.questionId)) || resKeys[idx];
                        return {
                            ...b,
                            correctAnswer: rk?.correctAnswer || b.correctAnswer,
                            solutionText: b.solutionText || rk?.solutionText || ''
                        };
                    });
                } catch (resErr) {}
            }
        }

        return { ...baseScorecard, breakdown: updatedBreakdown };
    };

    useEffect(() => {
        const cachedRaw = safeStorage.getItem(`cbt_scorecard_${sessionId}`) || safeStorage.getItem('cbt_scorecard_latest');
        let cached = null;
        if (cachedRaw) {
            try { cached = JSON.parse(cachedRaw); } catch (e) {}
        }

        api.get(`/api/exams/${examId}/scorecard/${sessionId}`)
            .then(async r => {
                const s = r.data || {};

                // Merge breakdown: Always use the most comprehensive question list (never truncate 75 to 60!)
                const serverBreakdown = Array.isArray(s.breakdown) ? s.breakdown : [];
                const localBreakdown = Array.isArray(cached?.breakdown) ? cached.breakdown : [];
                const primaryBreakdown = serverBreakdown.length >= localBreakdown.length ? serverBreakdown : localBreakdown;
                const secondaryBreakdown = serverBreakdown.length >= localBreakdown.length ? localBreakdown : serverBreakdown;

                const secondaryMap = new Map();
                secondaryBreakdown.forEach((b, idx) => {
                    const sid = String(b.questionId || b._id || idx);
                    secondaryMap.set(sid, b);
                    secondaryMap.set(String(idx), b);
                });

                const mergedBreakdown = primaryBreakdown.map((pb, idx) => {
                    const sid = String(pb.questionId || pb._id || idx);
                    const sb = secondaryMap.get(sid) || secondaryBreakdown[idx] || {};
                    const selected = pb.selectedOption || sb.selectedOption || null;
                    const isAttempted = Boolean(selected !== null && selected !== undefined && String(selected).trim() !== '');
                    return {
                        ...sb,
                        ...pb,
                        selectedOption: selected,
                        isAttempted: isAttempted,
                        correctAnswer: pb.correctAnswer || pb.answer || pb.correct_option || sb.correctAnswer || sb.answer || sb.correct_option,
                        solutionText: pb.solutionText || pb.solution || sb.solutionText || sb.solution || ''
                    };
                });

                const studentAttempted = mergedBreakdown.filter(b => b.isAttempted).length;

                const merged = {
                    ...s,
                    ...cached,
                    totalQuestions: mergedBreakdown.length > 0 ? mergedBreakdown.length : (s.totalQuestions || cached?.totalQuestions || 75),
                    studentName: cached?.studentName || s.studentName || 'Student',
                    rollNumber: cached?.rollNumber || s.rollNumber || '',
                    examTitle: cached?.examTitle || s.examTitle || 'Online Examination',
                    examType: cached?.examType || s.examType || 'CET',
                    totalQuestions: cached?.totalQuestions || s.totalQuestions || mergedBreakdown.length,
                    attempted: Math.max(cached?.attempted || 0, s.attempted || 0, studentAttempted),
                    correct: Math.max(cached?.correct || 0, s.correct || 0),
                    score: (cached?.score !== undefined && cached.score !== null) ? cached.score : (s.score || 0),
                    weakAreas: (cached?.weakAreas && cached.weakAreas.length > 0) ? cached.weakAreas : (s.weakAreas || []),
                    breakdown: mergedBreakdown
                };

                const fullyHydrated = await hydrateWithBestAvailable(merged);
                setData(fullyHydrated);
                setLoading(false);
            })
            .catch(async () => {
                if (cached) {
                    const fullyHydrated = await hydrateWithBestAvailable(cached);
                    setData(fullyHydrated);
                }
                setLoading(false);
            });
    }, [examId, sessionId]);

    // Auto-sync scorecard to database once if answers are present and not registered
    useEffect(() => {
        if (!hasSyncedRef.current && data && examId && sessionId && data.score !== undefined) {
            const hasActualAnswers = (data.breakdown || []).some(b => b.selectedOption);
            if (hasActualAnswers) {
                hasSyncedRef.current = true;
                api.post(`/api/exams/${examId}/submit`, {
                    sessionId: sessionId,
                    studentName: data.studentName,
                    studentEmail: data.studentEmail,
                    rollNumber: data.rollNumber,
                    answers: (data.breakdown || []).map(b => ({
                        questionId: b._id || b.questionId,
                        selectedOption: b.selectedOption,
                        isCorrect: b.isCorrect,
                        timeTaken: b.timeTaken
                    }))
                }).catch(() => {});
            }
        }
    }, [data, examId, sessionId]);

    const downloadPDF = () => {
        if (!evalData) return;
        downloadIndividualScorecardPdf(evalData, {
            title: evalData.examTitle || 'Examination Scorecard',
            examType: evalData.examType || 'CBT Exam',
            questions: evalData.breakdown || []
        });
    };

    if (loading) return <div style={styles.center}>Loading scorecard...</div>;
    if (!evalData) return <div style={styles.center}>Scorecard not found.</div>;

    const isCET = (evalData.examType === 'CET' || evalData.examType === 'KCET');
    const marksPerQ = isCET ? 1 : 4;
    const maxMarks = (evalData.totalQuestions || 0) * marksPerQ;
    const percentage = maxMarks > 0
        ? Math.max(0, Math.round(((Number(evalData.score) || 0) / maxMarks) * 100))
        : 0;

    const getGrade = (pct) => {
        if (pct >= 80) return { grade: 'A+', color: '#10b981', label: 'Excellent' };
        if (pct >= 60) return { grade: 'A', color: '#3b82f6', label: 'Good' };
        if (pct >= 40) return { grade: 'B', color: '#f59e0b', label: 'Average' };
        return { grade: 'C', color: '#ef4444', label: 'Needs Improvement' };
    };
    const grade = getGrade(percentage);

    return (
        <div style={styles.page}>
            {/* Top Bar */}
            <div style={styles.topBar}>
                <span style={styles.topTitle}>📋 Examination Scorecard</span>
                <div style={styles.topRight}>
                    {evalData.isLabSession && (
                        <span style={styles.labBadge}>🏫 Lab Session — Answer Key Hidden</span>
                    )}
                    <button style={{ ...styles.homeBtn, backgroundColor: '#10b981', color: '#fff', border: 'none' }} onClick={downloadPDF}>Download PDF Result</button>
                    <button style={styles.homeBtn} onClick={() => {
                        localStorage.removeItem('student_info');
                        navigate('/lab');
                    }}>← Back to Portal</button>
                </div>
            </div>

            <div style={styles.body}>
                {/* Score Hero Card */}
                <div style={styles.heroCard}>
                    <div style={styles.heroLeft}>
                        <div style={styles.candidateInfo}>
                            <div style={styles.candidateName}>{evalData.studentName}</div>
                            <div style={styles.candidateMeta}>{evalData.rollNumber && `Roll No: ${evalData.rollNumber}`} {evalData.studentEmail && `| ${evalData.studentEmail}`}</div>
                            <div style={styles.examLabel}>{evalData.examTitle} — {evalData.examType}</div>
                        </div>
                    </div>
                    <div style={styles.scoreCircleWrap}>
                        <div style={{ ...styles.scoreCircle, borderColor: grade.color }}>
                            <div style={{ ...styles.scoreNum, color: grade.color }}>{evalData.score}</div>
                            <div style={styles.scoreMax}>/ {maxMarks}</div>
                        </div>
                        <div style={{ ...styles.gradeLabel, color: grade.color }}>{grade.grade} — {grade.label}</div>
                        <div style={styles.percentage}>{percentage}%</div>
                    </div>
                </div>

                {/* Stats Row */}
                <div style={styles.statsRow}>
                    {[
                        { label: 'Total Questions', value: evalData.totalQuestions, color: '#6b7280' },
                        { label: 'Attempted', value: evalData.attempted, color: '#3b82f6' },
                        { label: 'Correct', value: evalData.correct, color: '#10b981' },
                        { label: 'Incorrect', value: evalData.incorrect, color: '#ef4444' },
                        { label: 'Unattempted', value: evalData.unattempted, color: '#9ca3af' }
                    ].map(stat => (
                        <div key={stat.label} style={styles.statCard}>
                            <div style={{ ...styles.statNum, color: stat.color }}>{stat.value}</div>
                            <div style={styles.statLabel}>{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div style={styles.tabs}>
                    {['summary', 'weakareas', 'timeanalysis', 'review', 'leaderboard'].map(t => (
                        <button key={t} style={{ ...styles.tab, ...(activeTab === t ? styles.tabActive : {}) }}
                            onClick={() => setActiveTab(t)}>
                            {t === 'summary' ? '📊 Summary' : t === 'weakareas' ? '⚠️ Weak Areas' : t === 'timeanalysis' ? '⏱️ Time Analysis' : t === 'review' ? '📝 Question Review' : '🏆 Leaderboard'}
                        </button>
                    ))}
                </div>

                {/* Summary Tab */}
                {activeTab === 'summary' && (
                    <div style={styles.tabContent}>
                        <div style={styles.summaryGrid}>
                            <div style={styles.summarySection}>
                                <h3 style={styles.sectionTitle}>Score Breakdown</h3>
                                <div style={styles.breakdownBar}>
                                    <div style={{ ...styles.barSegment, background: '#10b981', width: `${((evalData.correct || 0) / (evalData.totalQuestions || 1)) * 100}%` }} title="Correct" />
                                    <div style={{ ...styles.barSegment, background: '#ef4444', width: `${((evalData.incorrect || 0) / (evalData.totalQuestions || 1)) * 100}%` }} title="Incorrect" />
                                    <div style={{ ...styles.barSegment, background: '#e5e7eb', width: `${((evalData.unattempted || 0) / (evalData.totalQuestions || 1)) * 100}%` }} title="Unattempted" />
                                </div>
                                <div style={styles.barLegend}>
                                    <span style={{ color: '#10b981' }}>■ Correct ({evalData.correct || 0})</span>
                                    <span style={{ color: '#ef4444' }}>■ Wrong ({evalData.incorrect || 0})</span>
                                    <span style={{ color: '#9ca3af' }}>■ Skipped ({evalData.unattempted || 0})</span>
                                </div>
                                <div style={styles.markCalc}>
                                    <div>Marks from Correct: <strong>+{(evalData.correct || 0) * marksPerQ}</strong></div>
                                    <div>Marks deducted: <strong>−{isCET ? 0 : (evalData.incorrect || 0)}</strong></div>
                                    <div style={{ color: '#64748b', fontSize: 13 }}>Unattempted: <strong>0 (No deduction)</strong></div>
                                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 8, fontWeight: 700 }}>
                                        Net Score: <span style={{ color: grade.color }}>{evalData.score}</span> / {maxMarks}
                                    </div>
                                </div>
                            </div>

                            {evalData.classStats && (
                                <div style={{ marginTop: 24, padding: 18, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                                    <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                                        🏫 Class Performance & Comparative Standing
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, textAlign: 'center' }}>
                                        <div style={{ background: '#fff', padding: '12px 8px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: '#4f46e5' }}>{evalData.classStats.classAverageScore}</div>
                                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Class Average</div>
                                        </div>
                                        <div style={{ background: '#fff', padding: '12px 8px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{evalData.classStats.classTopScore}</div>
                                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Class Highest</div>
                                        </div>
                                        <div style={{ background: '#fff', padding: '12px 8px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>#{data.classStats.rank} / {data.classStats.totalCandidates}</div>
                                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Class Rank</div>
                                        </div>
                                        <div style={{ background: '#fff', padding: '12px 8px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: '#06b6d4' }}>{data.classStats.percentile}%</div>
                                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Percentile</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Weak Areas Tab */}
                {activeTab === 'weakareas' && (
                    <div style={styles.tabContent}>
                        {evalData.weakAreas?.length > 0 ? (
                            <>
                                <p style={styles.weakNote}>These chapters had the most incorrect answers. Focus your revision here:</p>
                                <div style={styles.weakList}>
                                    {evalData.weakAreas.map((w, i) => (
                                        <div key={i} style={styles.weakCard}>
                                            <div style={styles.weakRank}>#{i + 1}</div>
                                            <div style={styles.weakInfo}>
                                                <div style={styles.weakChapter}>
                                                    {w.chapter} {w.concept && w.concept !== 'General' ? `• ${w.concept}` : ''}
                                                </div>
                                                <div style={styles.weakSubject}>{w.subject}</div>
                                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                                                    ❌ {w.incorrect || 0} wrong • ⏭️ {w.unattempted || 0} skipped {w.accuracy !== undefined ? `(${w.accuracy}% accuracy)` : ''}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={styles.weakCount}>{w.totalWeak || (w.incorrect + (w.unattempted || 0))} missed</div>
                                                {w.avgTimePerQuestion ? <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>⏱️ {w.avgTimePerQuestion}s avg</div> : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div style={styles.noWeak}>🎉 No weak areas detected! Excellent performance.</div>
                        )}
                    </div>
                )}

                {/* Review Tab */}
                {activeTab === 'review' && (
                    <div style={styles.tabContent}>
                        {evalData.answerKeyHidden && (
                            <div style={styles.hiddenNotice}>
                                🔒 You are on a college lab system. Correct answers are not shown per institutional policy.
                            </div>
                        )}

                        {/* Top Filter Bar with Dropdown and Pills */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 20,
                            padding: '14px 18px',
                            background: '#fff',
                            borderRadius: 12,
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            flexWrap: 'wrap',
                            gap: 12
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <label style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                                    🔍 Question Filter:
                                </label>
                                <select
                                    value={reviewFilter}
                                    onChange={(e) => setReviewFilter(e.target.value)}
                                    style={{
                                        padding: '8px 14px',
                                        borderRadius: 8,
                                        border: '1.5px solid #cbd5e1',
                                        background: '#f8fafc',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: '#1e293b',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="all">All Questions ({(evalData.breakdown || []).length})</option>
                                    <option value="correct">✅ Correct ({evalData.correct || 0})</option>
                                    <option value="incorrect">❌ Incorrect ({evalData.incorrect || 0})</option>
                                    <option value="unattempted">⏳ Unattempted / Skipped ({evalData.unattempted || 0})</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {[
                                    { key: 'all', label: 'All', count: (evalData.breakdown || []).length, color: '#4f46e5' },
                                    { key: 'correct', label: 'Correct', count: evalData.correct || 0, color: '#10b981' },
                                    { key: 'incorrect', label: 'Incorrect', count: evalData.incorrect || 0, color: '#ef4444' },
                                    { key: 'unattempted', label: 'Skipped', count: evalData.unattempted || 0, color: '#64748b' }
                                ].map(b => (
                                    <button
                                        key={b.key}
                                        onClick={() => setReviewFilter(b.key)}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: 8,
                                            border: reviewFilter === b.key ? `2px solid ${b.color}` : '1.5px solid #e2e8f0',
                                            background: reviewFilter === b.key ? `${b.color}15` : '#fff',
                                            color: reviewFilter === b.key ? b.color : '#64748b',
                                            fontWeight: reviewFilter === b.key ? 800 : 600,
                                            fontSize: 13,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {b.label} ({b.count})
                                    </button>
                                ))}
                            </div>
                        </div>

                        {(() => {
                            const filteredList = (evalData.breakdown || [])
                                .filter(q => {
                                    if (reviewFilter === 'correct') return q.isCorrect;
                                    if (reviewFilter === 'incorrect') return q.isAttempted && !q.isCorrect;
                                    if (reviewFilter === 'unattempted') return !q.isAttempted;
                                    return true;
                                });

                            if (filteredList.length === 0) {
                                return (
                                    <div style={{ padding: 40, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', color: '#64748b' }}>
                                        No {reviewFilter} questions in this examination.
                                    </div>
                                );
                            }

                            return (
                                <div style={styles.reviewList}>
                                    {filteredList.map((q) => {
                                        const i = q.originalIdx;
                                        const attempted = q.isAttempted;
                                        const isCorrect = q.isCorrect;
                                        const isWrong = attempted && !isCorrect;
                                        const selectedStr = String(q.selectedOption ?? '').trim();
                                        const correctStr = String(q.correctAnswer ?? q.answer ?? '').trim();

                                        return (
                                            <div key={q._id || q.questionId || q.id || i} style={{ ...styles.reviewCard, borderLeft: `5px solid ${!attempted ? '#9ca3af' : (evalData.answerKeyHidden ? '#6b7280' : isCorrect ? '#10b981' : '#ef4444')}` }}>
                                                <div style={styles.reviewQHeader}>
                                                    <span style={styles.reviewQNum}>Q{q.questionNumber || i + 1}</span>
                                                    <span style={styles.reviewSubject}>{q.subject} | {q.chapter}{q.concept && q.concept !== 'General' ? ` • ${q.concept}` : ''}</span>
                                                    <span style={styles.timeBadge}>⏱️ {formatSeconds(q.timeTaken || 0)}</span>
                                                    {!attempted && <span style={styles.badge('#9ca3af')}>Skipped</span>}
                                                    {attempted && !evalData.answerKeyHidden && isCorrect && <span style={styles.badgeGreen}>✅ Correct</span>}
                                                    {attempted && !evalData.answerKeyHidden && isWrong && <span style={styles.badgeRed}>❌ Wrong</span>}
                                                    {attempted && evalData.answerKeyHidden && <span style={styles.badgeGrey}>Attempted</span>}
                                                </div>
                                                <MathRenderer style={styles.reviewQText} text={q.questionText} />
                                                
                                                {q.type === 'numerical' || !Array.isArray(q.options) || q.options.length === 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 500, marginTop: 12 }}>
                                                        <div style={{
                                                            ...styles.reviewOption,
                                                            background: attempted ? (isCorrect ? '#dcfce7' : '#fee2e2') : '#f9fafb',
                                                            border: attempted ? (isCorrect ? '2px solid #10b981' : '2px solid #ef4444') : '1.5px solid #e5e7eb'
                                                        }}>
                                                            <span style={styles.reviewOptLabel}>Your Answer:</span> <MathRenderer inline={true} text={attempted ? selectedStr : 'Skipped'} />
                                                            {attempted && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: isCorrect ? '#10b981' : '#ef4444' }}>{isCorrect ? '✓ Correct' : '✕ Wrong'}</span>}
                                                        </div>
                                                        {!evalData.answerKeyHidden && (
                                                            <div style={{
                                                                ...styles.reviewOption,
                                                                background: '#dcfce7',
                                                                border: '2px solid #10b981'
                                                            }}>
                                                                <span style={styles.reviewOptLabel}>Correct Answer:</span> <MathRenderer inline={true} text={correctStr} />
                                                                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#10b981' }}>✓ Correct</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={styles.reviewOptions}>
                                                        {q.options?.map((opt, oi) => {
                                                            const label = (oi + 1).toString();
                                                            const optStr = typeof opt === 'object' && opt !== null ? (opt.text || JSON.stringify(opt)) : String(opt);
                                                            const displayOptText = stripLeadingLabel(optStr) || optStr;

                                                            // Check whether this option was selected by student
                                                            const isSelected = attempted && (
                                                                oi === q.userOptIdx ||
                                                                checkAnswerCorrect(optStr, q.selectedOption, q.options) ||
                                                                checkAnswerCorrect(String(oi + 1), q.selectedOption, q.options)
                                                            );

                                                            // Check whether this option is the correct answer
                                                            const isCorrectOpt = !evalData.answerKeyHidden && (
                                                                oi === q.correctOptIdx ||
                                                                checkAnswerCorrect(optStr, correctStr, q.options) ||
                                                                checkAnswerCorrect(String(oi + 1), correctStr, q.options)
                                                            );

                                                            return (
                                                                <div key={oi} style={{
                                                                    ...styles.reviewOption,
                                                                    background: isCorrectOpt ? '#dcfce7' : isSelected && isWrong ? '#fee2e2' : '#f9fafb',
                                                                    border: isCorrectOpt ? '2px solid #10b981' : isSelected ? '2px solid #ef4444' : '1.5px solid #e5e7eb'
                                                                }}>
                                                                    <span style={{ ...styles.reviewOptLabel, fontWeight: isCorrectOpt || isSelected ? 800 : 600 }}>{label}.</span> <MathRenderer inline={true} text={displayOptText} />
                                                                    {isSelected && (
                                                                        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: isCorrectOpt ? '#10b981' : '#ef4444' }}>
                                                                            ← Your Answer {isCorrectOpt ? '(Correct)' : ''}
                                                                        </span>
                                                                    )}
                                                                    {isCorrectOpt && (
                                                                        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 800, color: '#10b981', background: '#dcfce7', padding: '2px 8px', borderRadius: 6, border: '1px solid #86efac' }}>
                                                                            ✓ Correct Answer
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}

                                                        {/* Prominent Correct Answer Banner below options */}
                                                        {!evalData.answerKeyHidden && (
                                                            <div style={{
                                                                marginTop: 12,
                                                                padding: '10px 14px',
                                                                background: '#ecfdf5',
                                                                border: '1.5px solid #10b981',
                                                                borderRadius: 8,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: 8,
                                                                fontSize: 13,
                                                                fontWeight: 700,
                                                                color: '#065f46'
                                                            }}>
                                                                <span>✅ Correct Answer:</span>
                                                                <span>
                                                                    {(() => {
                                                                        const cIdx = q.correctOptIdx;
                                                                        if (cIdx >= 0 && cIdx < (q.options?.length || 0)) {
                                                                            const optVal = q.options[cIdx];
                                                                            const optText = typeof optVal === 'object' && optVal !== null ? (optVal.text || JSON.stringify(optVal)) : String(optVal);
                                                                            return `Option ${cIdx + 1} — ${stripLeadingLabel(optText) || optText}`;
                                                                        }
                                                                        if (correctStr) {
                                                                            const idx = resolveOptionIndex(correctStr, q.options);
                                                                            if (idx >= 0 && idx < (q.options?.length || 0)) {
                                                                                const optVal = q.options[idx];
                                                                                const optText = typeof optVal === 'object' && optVal !== null ? (optVal.text || JSON.stringify(optVal)) : String(optVal);
                                                                                return `Option ${idx + 1} — ${stripLeadingLabel(optText) || optText}`;
                                                                            }
                                                                            return correctStr;
                                                                        }
                                                                        // Check solution text if it states the correct option
                                                                        const sol = q.solutionText || q.solution || '';
                                                                        const solMatch = sol.match(/option\s*\(?([1-4A-Da-d])\)?/i) || sol.match(/choice\s*\(?([1-4A-Da-d])\)?/i);
                                                                        if (solMatch && solMatch[1]) {
                                                                            const idx = resolveOptionIndex(solMatch[1], q.options);
                                                                            if (idx >= 0 && idx < (q.options?.length || 0)) {
                                                                                const optVal = q.options[idx];
                                                                                const optText = typeof optVal === 'object' && optVal !== null ? (optVal.text || JSON.stringify(optVal)) : String(optVal);
                                                                                return `Option ${idx + 1} — ${stripLeadingLabel(optText) || optText}`;
                                                                            }
                                                                        }
                                                                        return 'Option not specified in key';
                                                                    })()}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {q.markedForReview && <div style={styles.markedTag}>🔖 Marked for Review</div>}

                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* Time Analysis Tab */}
                {activeTab === 'timeanalysis' && (
                    <div style={styles.tabContent}>
                        <h3 style={styles.sectionTitle}>⏱️ Time Spent Analysis</h3>
                        <div style={styles.timeSummaryRow}>
                            <div style={styles.timeSummaryCard}>
                                <div style={styles.timeSummaryNum}>{formatSeconds(evalData.breakdown?.reduce((acc, q) => acc + (q.timeTaken || 0), 0) || 0)}</div>
                                <div style={styles.timeSummaryLabel}>Total Time Taken</div>
                            </div>
                            <div style={styles.timeSummaryCard}>
                                <div style={styles.timeSummaryNum}>
                                    {evalData.totalQuestions > 0 ? formatSeconds(Math.round((evalData.breakdown?.reduce((acc, q) => acc + (q.timeTaken || 0), 0) || 0) / evalData.totalQuestions)) : '0s'}
                                </div>
                                <div style={styles.timeSummaryLabel}>Average Time Per Question</div>
                            </div>
                        </div>

                        <h4 style={{ ...styles.sectionTitle, marginTop: 24 }}>Questions Taking the Most Time</h4>
                        {(() => {
                            const sorted = evalData.breakdown ? [...evalData.breakdown]
                                .map((q, idx) => ({ ...q, qNumber: idx + 1 }))
                                .filter(q => (q.timeTaken || 0) > 0)
                                .sort((a, b) => b.timeTaken - a.timeTaken) : [];
                            return sorted.length > 0 ? (
                                <div style={styles.timeList}>
                                    {sorted.slice(0, 10).map((q, i) => (
                                        <div key={i} style={styles.timeRow}>
                                            <span style={styles.timeRowIndex}>#{i + 1}</span>
                                            <span style={styles.timeRowQNum}>Question {q.qNumber} ({q.subject})</span>
                                            <span style={styles.timeRowTopic}>{q.chapter}</span>
                                            <span style={styles.timeRowVal}>{formatSeconds(q.timeTaken)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ color: '#6b7280' }}>No time records found.</p>
                            );
                        })()}

                        <h4 style={{ ...styles.sectionTitle, marginTop: 28 }}>Time Grid (All Questions)</h4>
                        <div style={styles.timeGrid}>
                            {evalData.breakdown?.map((q, idx) => (
                                <div key={idx} style={styles.timeGridCell}>
                                    <div style={styles.timeGridQ}>Q{idx + 1}</div>
                                    <div style={styles.timeGridVal}>{formatSeconds(q.timeTaken || 0)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Leaderboard Tab */}
                {activeTab === 'leaderboard' && (
                    <div style={styles.tabContent}>
                        <h3 style={styles.sectionTitle}>🏆 Leaderboard / Results Sheet</h3>
                        {loadingLeaderboard && displayLeaderboard.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 20 }}>Loading results...</div>
                        ) : displayLeaderboard.length > 0 ? (
                            <div style={styles.leaderboardWrap}>
                                <table style={styles.leaderboardTable}>
                                    <thead>
                                        <tr style={styles.leaderboardThead}>
                                            <th style={styles.leaderboardTh}>Rank</th>
                                            <th style={styles.leaderboardTh}>Name</th>
                                            <th style={styles.leaderboardTh}>Roll Number</th>
                                            <th style={styles.leaderboardTh}>Score</th>
                                            <th style={styles.leaderboardTh}>Accuracy</th>
                                            <th style={styles.leaderboardTh}>Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayLeaderboard.map((student, rankIdx) => {
                                            const isCurrentUser = Boolean(student.isCurrentUser) || 
                                                (student.rollNumber && data.rollNumber && String(student.rollNumber).trim() === String(data.rollNumber).trim()) ||
                                                (student.studentName && data.studentName && student.studentName === data.studentName);
                                            const totalAttempted = (Number(student.correct) || 0) + (Number(student.incorrect) || 0);
                                            const accuracy = totalAttempted > 0 
                                                ? Math.round(((Number(student.correct) || 0) / totalAttempted) * 100)
                                                : 0;

                                            return (
                                                <tr key={rankIdx} style={{ 
                                                    background: isCurrentUser ? '#e2e8f0' : rankIdx % 2 === 0 ? '#fff' : '#f9fafb',
                                                    fontWeight: isCurrentUser ? 'bold' : 'normal'
                                                }}>
                                                    <td style={styles.leaderboardTd}>
                                                        {rankIdx === 0 ? '🥇' : rankIdx === 1 ? '🥈' : rankIdx === 2 ? '🥉' : rankIdx + 1}
                                                    </td>
                                                    <td style={styles.leaderboardTd}>
                                                        {student.studentName} {isCurrentUser && <span style={{ color: '#4f46e5', fontSize: 11 }}>(You)</span>}
                                                    </td>
                                                    <td style={styles.leaderboardTd}>{student.rollNumber || '—'}</td>
                                                    <td style={{ ...styles.leaderboardTd, color: '#4f46e5', fontWeight: 'bold' }}>{student.score}</td>
                                                    <td style={styles.leaderboardTd}>{accuracy}% accuracy</td>
                                                    <td style={{ ...styles.leaderboardTd, fontSize: 12, color: '#6b7280' }}>
                                                        ✅ {student.correct || 0} | ❌ {student.incorrect || 0} | ⏳ {student.unattempted || 0} skipped
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p style={{ color: '#6b7280' }}>No submissions found for this exam yet.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    badge: (color) => ({
        background: `${color}1a`,
        color: color,
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 700
    }),
    page: { minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Inter, sans-serif' },
    topBar: { background: '#1e3a5f', color: '#fff', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    topTitle: { fontSize: 16, fontWeight: 700 },
    topRight: { display: 'flex', gap: 12, alignItems: 'center' },
    labBadge: { background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600 },
    homeBtn: { background: '#fff', color: '#1e3a5f', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 700 },
    body: { maxWidth: 1000, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 },
    heroCard: { background: 'linear-gradient(135deg, #1e3a5f, #1e1b4b)', color: '#fff', borderRadius: 16, padding: '28px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    heroLeft: {},
    candidateName: { fontSize: 22, fontWeight: 800 },
    candidateMeta: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
    examLabel: { color: '#f59e0b', fontSize: 14, fontWeight: 600, marginTop: 8 },
    candidateInfo: {},
    scoreCircleWrap: { textAlign: 'center' },
    scoreCircle: { width: 100, height: 100, borderRadius: '50%', border: '5px solid', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', background: 'rgba(255,255,255,0.1)' },
    scoreNum: { fontSize: 28, fontWeight: 900, lineHeight: 1 },
    scoreMax: { fontSize: 12, color: '#94a3b8' },
    gradeLabel: { fontSize: 14, fontWeight: 700 },
    percentage: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 },
    statCard: { background: '#fff', borderRadius: 12, padding: '16px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
    statNum: { fontSize: 28, fontWeight: 800 },
    statLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
    tabs: { display: 'flex', gap: 4, borderBottom: '2px solid #e5e7eb' },
    tab: { padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#6b7280', borderBottom: '2px solid transparent', marginBottom: -2 },
    tabActive: { color: '#4f46e5', borderBottom: '2px solid #4f46e5' },
    tabContent: { background: '#fff', borderRadius: 12, padding: '24px', border: '1px solid #e5e7eb' },
    summaryGrid: {},
    summarySection: {},
    sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' },
    breakdownBar: { display: 'flex', height: 24, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
    barSegment: { transition: 'width 0.5s' },
    barLegend: { display: 'flex', gap: 20, fontSize: 14, marginBottom: 16 },
    markCalc: { background: '#f8fafc', borderRadius: 10, padding: '16px', fontSize: 15, lineHeight: 2 },
    weakNote: { color: '#6b7280', marginBottom: 16 },
    weakList: { display: 'flex', flexDirection: 'column', gap: 12 },
    weakCard: { display: 'flex', alignItems: 'center', gap: 16, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '14px 18px' },
    weakRank: { width: 32, height: 32, background: '#ef4444', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 },
    weakInfo: { flex: 1 },
    weakChapter: { fontWeight: 700, color: '#1e293b' },
    weakSubject: { fontSize: 13, color: '#6b7280' },
    weakCount: { fontWeight: 700, color: '#ef4444', fontSize: 15 },
    noWeak: { textAlign: 'center', color: '#10b981', fontSize: 18, padding: 40 },
    hiddenNotice: { background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 14 },
    reviewList: { display: 'flex', flexDirection: 'column', gap: 16 },
    reviewCard: { border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px', background: '#fafafa' },
    reviewQHeader: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
    reviewQNum: { fontWeight: 700, color: '#1e293b' },
    reviewSubject: { fontSize: 12, color: '#6b7280' },
    badgeGreen: { background: '#dcfce7', color: '#166534', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 },
    badgeRed: { background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 },
    badgeGrey: { background: '#f3f4f6', color: '#6b7280', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 },
    reviewQText: { fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 12 },
    reviewOptions: { display: 'flex', flexDirection: 'column', gap: 8 },
    reviewOption: { borderRadius: 8, padding: '9px 14px', fontSize: 14, display: 'flex', alignItems: 'center' },
    reviewOptLabel: { fontWeight: 700, marginRight: 8 },
    markedTag: { fontSize: 12, color: '#8b5cf6', marginTop: 10 },
    center: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: '#6b7280' },
    solutionBtn: {
        background: '#e0e7ff',
        color: '#4338ca',
        border: 'none',
        borderRadius: 8,
        padding: '8px 14px',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        marginTop: 10,
        transition: 'all 0.2s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6
    },
    solutionBox: {
        background: '#f5f7ff',
        border: '1px solid #c7d2fe',
        borderRadius: 10,
        padding: '14px 16px',
        marginTop: 10,
        animation: 'fadeIn 0.3s ease-out'
    },
    solutionBoxTitle: {
        margin: '0 0 8px 0',
        fontSize: 13,
        fontWeight: 800,
        color: '#312e81',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
    },
    solutionContent: {
        fontSize: 13,
        color: '#1e1b4b',
        lineHeight: 1.6
    },
    timeBadge: {
        background: '#eff6ff',
        color: '#1d4ed8',
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 700
    },
    timeSummaryRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginBottom: 20
    },
    timeSummaryCard: {
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '20px',
        textAlign: 'center'
    },
    timeSummaryNum: {
        fontSize: 28,
        fontWeight: 800,
        color: '#1d4ed8'
    },
    timeSummaryLabel: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 4
    },
    timeList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: '#f8fafc',
        borderRadius: 12,
        padding: '16px',
        border: '1px solid #e2e8f0'
    },
    timeRow: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid #e2e8f0',
        fontSize: 14
    },
    timeRowIndex: {
        fontWeight: 700,
        color: '#94a3b8',
        width: 32
    },
    timeRowQNum: {
        fontWeight: 600,
        color: '#1e293b',
        width: 180
    },
    timeRowTopic: {
        color: '#64748b',
        flex: 1
    },
    timeRowVal: {
        fontWeight: 700,
        color: '#1d4ed8'
    },
    timeGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
        gap: 8,
        marginTop: 12
    },
    timeGridCell: {
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '8px',
        textAlign: 'center'
    },
    timeGridQ: {
        fontSize: 12,
        fontWeight: 700,
        color: '#64748b'
    },
    timeGridVal: {
        fontSize: 13,
        fontWeight: 600,
        color: '#1d4ed8',
        marginTop: 2
    },
    leaderboardWrap: {
        overflowX: 'auto',
        borderRadius: 12,
        border: '1px solid #e5e7eb'
    },
    leaderboardTable: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 14
    },
    leaderboardThead: {
        background: '#f8fafc'
    },
    leaderboardTh: {
        padding: '12px 14px',
        textAlign: 'left',
        fontWeight: 700,
        color: '#374151',
        borderBottom: '1px solid #e5e7eb'
    },
    leaderboardTd: {
        padding: '12px 14px',
        borderBottom: '1px solid #f1f5f9'
    }
};
