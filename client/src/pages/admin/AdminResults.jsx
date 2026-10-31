import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import * as XLSX from 'xlsx';
import { checkAnswerCorrect } from '../../utils/answerEvaluation';
import { downloadClassResultSheetPdf, downloadIndividualScorecardPdf, computeSubjectScores } from '../../utils/resultPdfExport';

export default function AdminResults() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const examIdParam = searchParams.get('examId');
    const [exams, setExams] = useState([]);
    const [selectedExam, setSelectedExam] = useState(examIdParam || '');
    const [results, setResults] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [bridgeKey, setBridgeKey] = useState('');
    const [msg, setMsg] = useState('');

    useEffect(() => {
        api.get('/api/exams').then(r => setExams(r.data || [])).catch(() => {});
        if (examIdParam) {
            setSelectedExam(examIdParam);
            fetchResults(examIdParam);
        }
    }, [examIdParam]);

    const displayResults = useMemo(() => {
        let list = Array.isArray(results) ? [...results] : [];
        if (list.length === 0 && selectedExam) {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith('cbt_scorecard_') || k.startsWith('exam_score_'))) {
                        const raw = localStorage.getItem(k);
                        if (raw) {
                            const item = JSON.parse(raw);
                            if (item && (String(item.examId) === String(selectedExam) || String(item.examTitle || '').toLowerCase().includes(String(selectedExam).toLowerCase()))) {
                                list.push({
                                    _id: item.sessionId || 'local_' + i,
                                    id: item.sessionId || 'local_' + i,
                                    studentName: item.studentName || 'Student',
                                    rollNumber: item.rollNumber || '—',
                                    studentEmail: item.studentEmail || '',
                                    score: Number(item.score) || 0,
                                    correct: Number(item.correct) || 0,
                                    incorrect: Number(item.incorrect) || 0,
                                    unattempted: Number(item.unattempted) || 0,
                                    totalQuestions: Number(item.totalQuestions) || 0,
                                    fromLabIp: false,
                                    weakAreas: item.weakAreas || [],
                                    endTime: item.submittedAt || new Date().toISOString(),
                                    answers: item.breakdown || [],
                                    submitted: true
                                });
                            }
                        }
                    }
                }
            } catch (e) {}
        }

        // Deduplicate true duplicate attempts by the same student on the same exam,
        // but NEVER collapse distinct students sharing common names or empty roll numbers!
        const studentMap = new Map();
        list.forEach(item => {
            const cleanRoll = String(item.rollNumber || '').trim().toUpperCase();
            const isGenericRoll = !cleanRoll || ['—', '-', 'N/A', 'NA', 'STUDENT', 'CANDIDATE', 'PACE', '11', '12', '0'].includes(cleanRoll);
            const cleanEmail = String(item.studentEmail || '').trim().toLowerCase();
            const isGenericEmail = !cleanEmail || cleanEmail.startsWith('anonymous') || cleanEmail.startsWith('student@') || cleanEmail.includes('pace');

            // Unique key: only genuine roll number or distinct email, otherwise individual session ID
            const key = (!isGenericRoll && cleanRoll.length >= 2)
                ? `roll:${cleanRoll}`
                : (!isGenericEmail && cleanEmail.includes('@') && cleanEmail.length >= 6)
                    ? `email:${cleanEmail}`
                    : `session:${item._id || item.id || item.sessionId || Math.random()}`;

            if (!studentMap.has(key)) {
                studentMap.set(key, item);
            } else {
                const existing = studentMap.get(key);
                const itemHasTime = Boolean(item.endTime && item.endTime !== '—');
                const existHasTime = Boolean(existing.endTime && existing.endTime !== '—');

                if (itemHasTime && !existHasTime) {
                    studentMap.set(key, item);
                } else if (itemHasTime === existHasTime) {
                    const itemScore = Number(item.score) || 0;
                    const existScore = Number(existing.score) || 0;
                    const itemAnsCount = Array.isArray(item.answers) ? item.answers.length : 0;
                    const existAnsCount = Array.isArray(existing.answers) ? existing.answers.length : 0;
                    if (itemScore > existScore || itemAnsCount > existAnsCount) {
                        studentMap.set(key, item);
                    }
                }
            }
        });

        return Array.from(studentMap.values()).sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    }, [results, selectedExam]);

    // Auto-sync any local results to backend if backend returned empty
    useEffect(() => {
        if (displayResults.length > 0 && results.length === 0 && selectedExam) {
            displayResults.forEach(item => {
                if (item.studentName) {
                    api.post(`/api/exams/${selectedExam}/submit`, {
                        sessionId: item.sessionId || item._id,
                        studentName: item.studentName,
                        studentEmail: item.studentEmail,
                        rollNumber: item.rollNumber,
                        answers: item.answers || []
                    }).catch(() => {});
                }
            });
        }
    }, [displayResults, results, selectedExam]);

    const fetchResults = async (eid, silent = false) => {
        if (!eid) return;
        if (!silent) setLoading(true);
        try {
            const [res, analyticsRes] = await Promise.all([
                api.get(`/api/exams/${eid}/results`),
                api.get(`/api/exams/${eid}/analytics`).catch(() => ({ data: null }))
            ]);
            setResults(res.data || []);
            if (analyticsRes.data) setAnalytics(analyticsRes.data);
        } catch (e) {
            if (!silent) setMsg('Failed to load results');
        }
        if (!silent) setLoading(false);
    };

    // Auto-poll every 12 seconds to keep live student list fresh as candidates write and submit
    useEffect(() => {
        if (!selectedExam) return;
        const timer = setInterval(() => {
            fetchResults(selectedExam, true);
        }, 12000);
        return () => clearInterval(timer);
    }, [selectedExam]);

    const handleExamSelect = (e) => {
        const val = e.target.value;
        setSelectedExam(val);
        setResults([]);
        setAnalytics(null);
        setBridgeKey('');
        if (val) {
            navigate(`/admin/dashboard/results?examId=${val}`, { replace: true });
            fetchResults(val);
        } else {
            navigate(`/admin/dashboard/results`, { replace: true });
        }
    };

    const generateBridgeKey = async () => {
        if (!selectedExam) return setMsg('Select an exam first');
        try {
            const res = await api.post(`/api/exams/${selectedExam}/bridge-key`);
            setBridgeKey(res.data.key);
            setMsg(`✅ Bridge key generated! Expires: ${res.data.expiresAt ? new Date(res.data.expiresAt).toLocaleDateString() : 'N/A'}`);
        } catch (e) { setMsg('Failed to generate key'); }
    };

    const copyKey = () => {
        navigator.clipboard.writeText(bridgeKey);
        setMsg('✅ Bridge key copied to clipboard!');
    };

    const downloadIndividualPDF = (student) => {
        const exam = exams.find(e => String(e._id || e.id) === String(selectedExam)) || {};
        downloadIndividualScorecardPdf(student, exam);
    };

    const downloadAllScorecardsZip = () => {
        if (!selectedExam) return;
        const token = localStorage.getItem('token');
        const downloadUrl = `${api.defaults.baseURL || ''}/api/exams/${selectedExam}/download-all-reports?token=${token}`;
        window.open(downloadUrl, '_blank');
    };

    const handleDeleteIndividualAttempt = async (student) => {
        const studentLabel = student.studentName || student.rollNumber || 'this student';
        const roll = student.rollNumber || '';
        if (!window.confirm(`Delete trial attempt for ${studentLabel} (Roll: ${roll || 'N/A'})?\n\nThis will reset their record so they can attend the test fresh tomorrow.`)) {
            return;
        }

        try {
            // 1. Backend delete call
            if (selectedExam) {
                const sid = student._id || student.id || student.sessionId || 'none';
                await api.delete(`/api/exams/${selectedExam}/results/${sid}?rollNumber=${encodeURIComponent(roll)}`).catch(() => {});
            }

            // 2. LocalStorage purge
            try {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (!k) continue;
                    if (k.startsWith('cbt_scorecard_') || k.startsWith('exam_answers_') || k.startsWith('exam_score_')) {
                        const raw = localStorage.getItem(k);
                        if (
                            (roll && raw && raw.includes(roll)) ||
                            (student._id && k.includes(String(student._id))) ||
                            (student.id && k.includes(String(student.id))) ||
                            (student.sessionId && k.includes(String(student.sessionId)))
                        ) {
                            keysToRemove.push(k);
                        }
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
            } catch (_) {}

            // 3. Update React state immediately
            setResults(prev => prev.filter(r => (r._id || r.id) !== (student._id || student.id) && r.rollNumber !== student.rollNumber));
            setMsg(`✅ Trial attempt for ${studentLabel} deleted. They are now unlocked to attend tomorrow!`);
        } catch (err) {
            setMsg('❌ Failed to delete attempt: ' + err.message);
        }
    };

    const handleClearAllExamAttempts = async () => {
        if (!window.confirm(`Are you sure you want to delete ALL trial attempts for this exam?\n\nThis will completely reset and unlock all students so everyone can attend the test fresh tomorrow.`)) {
            return;
        }

        try {
            if (selectedExam) {
                await api.delete(`/api/exams/${selectedExam}/results`).catch(() => {});
            }

            // Purge all related local scorecards
            try {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith('cbt_scorecard_') || k.startsWith('exam_answers_') || k.startsWith('exam_score_'))) {
                        keysToRemove.push(k);
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
            } catch (_) {}

            setResults([]);
            setMsg('✅ All trial attempts have been cleared. All students are now unlocked and ready for tomorrow!');
        } catch (err) {
            setMsg('❌ Failed to clear attempts: ' + err.message);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 300) return '#10b981';
        if (score >= 150) return '#f59e0b';
        return '#ef4444';
    };

    const exportExcel = () => {
        if (!displayResults || displayResults.length === 0) return;
        const exam = exams.find(e => String(e._id || e.id) === String(selectedExam));
        const data = displayResults.map((r, i) => {
            const attempted = [];
            const unattempted = [];
            const correct = [];
            const wrong = [];
            if (exam && exam.questions) {
                exam.questions.forEach((q, idx) => {
                    const qNum = idx + 1;
                    const ans = r.answers?.find(a => String(a.questionId) === String(q._id || q.id));
                    if (ans && ans.selectedOption !== null && ans.selectedOption !== undefined && ans.selectedOption !== '') {
                        attempted.push(qNum);
                        const isCorrect = checkAnswerCorrect(ans.selectedOption, q.answer ?? q.correctAnswer, q.options || [], q.numericalTolerance || 0, q.type || 'MCQ');
                        if (isCorrect) {
                            correct.push(qNum);
                        } else {
                            wrong.push(qNum);
                        }
                    } else {
                        unattempted.push(qNum);
                    }
                });
            }

            return {
                'S.No': i + 1,
                'Student Name': r.studentName,
                'Roll No': r.rollNumber || 'N/A',
                'Score': r.score,
                'Correct Count': r.correct,
                'Incorrect Count': r.incorrect,
                'Unattempted Count': r.unattempted,
                'Attempted Qs': attempted.join(', '),
                'Correct Qs': correct.join(', '),
                'Wrong Qs': wrong.join(', '),
                'Unattempted Qs': unattempted.join(', '),
                'Submitted At': new Date(r.createdAt || r.endTime || Date.now()).toLocaleString()
            };
        });
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
        const examName = exam?.title || 'Exam';
        XLSX.writeFile(workbook, `${examName}_Results.xlsx`);
    };

    const exportPDF = () => {
        if (!displayResults || displayResults.length === 0) {
            alert('No results available to export.');
            return;
        }
        const exam = exams.find(e => String(e._id || e.id) === String(selectedExam)) || {};
        downloadClassResultSheetPdf({
            title: exam.title || 'Exam Results',
            examType: exam.examType || 'CBT Exam',
            institutionName: 'MANCHESTER TECHNOLOGIES',
            results: displayResults,
            exam: exam,
            aggregate: {
                totalStudents: displayResults.length,
                topScore: displayResults.length > 0 ? Math.max(...displayResults.map(r => r.score || 0)) : 0,
                avgScore: displayResults.length > 0 ? Math.round(displayResults.reduce((acc, r) => acc + (r.score || 0), 0) / displayResults.length) : 0,
                totalCorrect: displayResults.reduce((acc, r) => acc + (r.correct || 0), 0),
                totalWrong: displayResults.reduce((acc, r) => acc + (r.incorrect || 0), 0),
                totalBlank: displayResults.reduce((acc, r) => acc + (r.unattempted || 0), 0)
            }
        });
    };

    return (
        <div style={styles.container}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <h2 style={{ ...styles.title, margin: 0 }}>📊 Student Exam Results & Analytics</h2>
                <button
                    onClick={() => navigate('/admin/dashboard')}
                    style={{
                        padding: '10px 20px',
                        background: '#f1f5f9',
                        color: '#334155',
                        border: '2px solid #e2e8f0',
                        borderRadius: '12px',
                        fontWeight: 900,
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        cursor: 'pointer'
                    }}
                >
                    ← Back to Dashboard
                </button>
            </div>

            {msg && <div style={styles.msg}>{msg} <button onClick={() => setMsg('')} style={styles.closeMsg}>✕</button></div>}

            <div style={styles.toolbar}>
                <select style={styles.select} value={String(selectedExam || '')} onChange={handleExamSelect}>
                    <option value="">— Select an Exam —</option>
                    {exams.map(e => {
                        const eId = String(e._id || e.id);
                        return <option key={eId} value={eId}>{e.title} ({e.examType})</option>;
                    })}
                </select>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selectedExam && (
                        <button style={{ ...styles.keyBtn, background: '#2563eb' }} onClick={() => fetchResults(selectedExam)} title="Refresh latest candidates and live scores">
                            🔄 Refresh Live List
                        </button>
                    )}
                    <button style={styles.keyBtn} onClick={generateBridgeKey}>🔑 Generate Bridge Key</button>
                    {displayResults && displayResults.length > 0 && (
                        <>
                            <button style={{...styles.keyBtn, background: '#10b981'}} onClick={exportExcel}>📊 Excel</button>
                            <button style={{...styles.keyBtn, background: '#ef4444'}} onClick={exportPDF}>📄 PDF</button>
                            <button style={{...styles.keyBtn, background: '#7c3aed'}} onClick={downloadAllScorecardsZip}>⬇️ Download All (ZIP)</button>
                            <button style={{...styles.keyBtn, background: '#dc2626'}} onClick={handleClearAllExamAttempts} title="Delete all trial test attempts for this exam">🗑️ Clear All Attempts</button>
                        </>
                    )}
                </div>
            </div>

            {bridgeKey && (
                <div style={styles.keyBox}>
                    <span style={styles.keyText}>🔑 {bridgeKey}</span>
                    <button style={styles.copyBtn} onClick={copyKey}>📋 Copy</button>
                </div>
            )}

            {loading && <div style={styles.loading}>Loading results...</div>}

            {displayResults.length > 0 && (
                <>
                    <div style={styles.summary}>
                        <div style={styles.summaryCard}>
                            <div style={styles.summaryNum}>{displayResults.length}</div>
                            <div style={styles.summaryLabel}>Total Students</div>
                        </div>
                        <div style={styles.summaryCard}>
                            <div style={styles.summaryNum}>
                                {displayResults.length > 0 ? Math.max(...displayResults.map(r => r.score)) : 0}
                            </div>
                            <div style={styles.summaryLabel}>Highest Score</div>
                        </div>
                        <div style={styles.summaryCard}>
                            <div style={styles.summaryNum}>
                                {displayResults.length > 0 ? Math.round(displayResults.reduce((acc, r) => acc + r.score, 0) / displayResults.length) : 0}
                            </div>
                            <div style={styles.summaryLabel}>Average Score</div>
                        </div>
                        <div style={styles.summaryCard}>
                            <div style={styles.summaryNum}>{displayResults.filter(r => r.fromLabIp).length}</div>
                            <div style={styles.summaryLabel}>Lab Students</div>
                        </div>
                    </div>

                    {analytics && analytics.length > 0 && (
                        <div style={styles.analyticsSection}>
                            <h3 style={styles.analyticsTitle}>Global Question Analytics</h3>
                            <div style={styles.chartLegend}>
                                <span style={styles.legendItem}><span style={{...styles.legendDot, background: '#10b981'}}></span> Correct</span>
                                <span style={styles.legendItem}><span style={{...styles.legendDot, background: '#ef4444'}}></span> Incorrect</span>
                                <span style={styles.legendItem}><span style={{...styles.legendDot, background: '#e5e7eb'}}></span> Unattempted</span>
                            </div>
                            <div style={styles.chartScroll}>
                                <div style={styles.chartContainer}>
                                    {analytics.map((a, i) => {
                                        const total = a.total || 1; // prevent divide by zero
                                        const cPct = (a.correct / total) * 100;
                                        const iPct = (a.incorrect / total) * 100;
                                        const uPct = (a.unattempted / total) * 100;

                                        return (
                                            <div key={i} style={styles.barColumn} title={`Q${a.questionNumber}\nCorrect: ${a.correct}\nIncorrect: ${a.incorrect}\nUnattempted: ${a.unattempted}`}>
                                                <div style={styles.barVertical}>
                                                    {uPct > 0 && <div style={{ height: `${uPct}%`, background: '#e5e7eb', width: '100%' }} />}
                                                    {iPct > 0 && <div style={{ height: `${iPct}%`, background: '#ef4444', width: '100%' }} />}
                                                    {cPct > 0 && <div style={{ height: `${cPct}%`, background: '#10b981', width: '100%', borderRadius: (uPct === 0 && iPct === 0) ? '4px 4px 0 0' : '0' }} />}
                                                </div>
                                                <div style={styles.barLabel}>{a.questionNumber}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Hardest Questions & Item Analysis (Cohort Analytics WOW Feature) */}
                    {analytics && analytics.length > 0 && (
                        <div style={styles.analyticsSection}>
                            <h3 style={styles.analyticsTitle}>🔥 Cohort Item Analysis: Hardest Questions</h3>
                            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                                Identifying questions where the class correct rate is below 40% to pinpoint curriculum weak points.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                                {(() => {
                                    const hardest = analytics
                                        .map(a => ({
                                            ...a,
                                            correctRate: Math.round((a.correct / (a.total || 1)) * 100)
                                        }))
                                        .filter(a => a.correctRate < 40)
                                        .sort((a, b) => a.correctRate - b.correctRate)
                                        .slice(0, 4);

                                    if (hardest.length === 0) {
                                        return (
                                            <div style={{ gridColumn: '1 / -1', padding: 16, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, textAlign: 'center', color: '#166534', fontWeight: 700, fontSize: 13 }}>
                                                🎉 Excellent! No questions fell below the 40% correct rate threshold for this cohort.
                                            </div>
                                        );
                                    }

                                    return hardest.map((a, i) => (
                                        <div key={i} style={{ padding: 16, border: '1px solid #f87171', background: '#fef2f2', borderRadius: 12 }}>
                                            <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12 }}>
                                                <span style={{ fontWeight: 800, fontSize: 13, color: '#991b1b' }}>Question #{a.questionNumber} ({a.subject})</span>
                                                <span style={{ background: '#fca5a5', color: '#7f1d1d', fontWeight: 900, fontSize: 11, padding: '2px 8px', borderRadius: 6 }}>
                                                    {a.correctRate}% Correct
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.4 }}>
                                                <strong>Incorrect:</strong> {a.incorrect} students failed this.<br />
                                                <strong>Unattempted:</strong> {a.unattempted} students skipped.
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}

                    {displayResults && displayResults.length > 0 && (
                        <div style={styles.analyticsSection}>
                            <h3 style={styles.analyticsTitle}>Student Performance Analytics</h3>
                            <div style={styles.chartLegend}>
                                <span style={styles.legendItem}><span style={{...styles.legendDot, background: '#10b981'}}></span> Correct</span>
                                <span style={styles.legendItem}><span style={{...styles.legendDot, background: '#ef4444'}}></span> Incorrect</span>
                                <span style={styles.legendItem}><span style={{...styles.legendDot, background: '#e5e7eb'}}></span> Unattempted</span>
                            </div>
                            <div style={styles.chartScroll}>
                                <div style={styles.chartContainer}>
                                    {displayResults.map((r, i) => {
                                        const total = r.totalQuestions || 1; // prevent divide by zero
                                        const cPct = (r.correct / total) * 100;
                                        const iPct = (r.incorrect / total) * 100;
                                        const uPct = (r.unattempted / total) * 100;

                                        return (
                                            <div key={i} style={styles.barColumn} title={`Student: ${r.studentName} (${r.rollNumber || 'N/A'})\nScore: ${r.score}\nCorrect: ${r.correct}\nIncorrect: ${r.incorrect}\nUnattempted: ${r.unattempted}`}>
                                                <div style={styles.barVertical}>
                                                    {uPct > 0 && <div style={{ height: `${uPct}%`, background: '#e5e7eb', width: '100%' }} />}
                                                    {iPct > 0 && <div style={{ height: `${iPct}%`, background: '#ef4444', width: '100%' }} />}
                                                    {cPct > 0 && <div style={{ height: `${cPct}%`, background: '#10b981', width: '100%', borderRadius: (uPct === 0 && iPct === 0) ? '4px 4px 0 0' : '0' }} />}
                                                </div>
                                                <div style={styles.barLabel}>{i + 1}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {(() => {
                        const currentExamObj = exams.find(e => String(e._id || e.id) === String(selectedExam)) || {};
                        const { orderedSubjects } = computeSubjectScores(displayResults[0] || {}, currentExamObj);

                        return (
                            <div style={styles.tableWrap}>
                                <table style={styles.table}>
                                    <thead>
                                        <tr style={styles.thead}>
                                            <th style={styles.th}>#</th>
                                            <th style={styles.th}>Student</th>
                                            <th style={styles.th}>Roll No</th>
                                            {orderedSubjects.map(sub => (
                                                <th key={sub} style={{ ...styles.th, textAlign: 'center', minWidth: 80 }}>
                                                    {sub.toUpperCase()}
                                                </th>
                                            ))}
                                            <th style={{ ...styles.th, textAlign: 'center', minWidth: 80 }}>Total Marks</th>
                                            <th style={styles.th}>Correct</th>
                                            <th style={styles.th}>Incorrect</th>
                                            <th style={styles.th}>Unattempted</th>
                                            <th style={styles.th}>Source</th>
                                            <th style={styles.th}>Weak Areas</th>
                                            <th style={styles.th}>Submitted</th>
                                            <th style={styles.th}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayResults.map((r, i) => {
                                            const { subStats, totalScore } = computeSubjectScores(r, currentExamObj);
                                            return (
                                                <tr key={r._id || r.id || i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                                    <td style={styles.td}>{i + 1}</td>
                                                    <td style={styles.td}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ fontWeight: 600 }}>{r.studentName}</span>
                                                            {r.malpracticeFlag && (
                                                                <span style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                                                                    ⚠️ Malpractice Detected
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: 12, color: '#6b7280' }}>{r.studentEmail}</div>
                                                        {r.malpracticeFlag && (
                                                            <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginTop: 4 }}>
                                                                Reason: {r.malpracticeReason || 'Tab switched or window blurred'}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={styles.td}>{r.rollNumber || '—'}</td>
                                                    {orderedSubjects.map(sub => {
                                                        const s = subStats[sub] || { score: 0 };
                                                        return (
                                                            <td key={sub} style={{ ...styles.td, textAlign: 'center', fontWeight: 700, fontSize: 13, color: s.score >= 0 ? '#1e293b' : '#ef4444' }}>
                                                                {s.score ?? 0}
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{ ...styles.td, textAlign: 'center', fontWeight: 800, color: getScoreColor(totalScore), fontSize: 14 }}>
                                                        {totalScore}
                                                    </td>
                                                    <td style={{ ...styles.td, color: '#10b981' }}>✅ {r.correct}</td>
                                                    <td style={{ ...styles.td, color: '#ef4444' }}>❌ {r.incorrect}</td>
                                                    <td style={{ ...styles.td, color: '#9ca3af' }}>— {r.unattempted}</td>
                                                    <td style={styles.td}>
                                                        <span style={{ ...styles.sourceBadge, background: r.fromLabIp ? '#dbeafe' : '#fef3c7', color: r.fromLabIp ? '#1e40af' : '#92400e' }}>
                                                            {r.fromLabIp ? '🏫 Lab' : '🌐 Remote'}
                                                        </span>
                                                    </td>
                                                    <td style={styles.td}>
                                                        <div style={{ fontSize: 12 }}>
                                                            {r.weakAreas?.slice(0, 2).map((w, j) => (
                                                                <div key={j} style={{ color: '#ef4444' }}>• {w.chapter} ({w.incorrect}✕)</div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td style={{ ...styles.td, fontSize: 12, color: '#6b7280' }}>
                                                        {r.endTime ? new Date(r.endTime).toLocaleString() : (
                                                            <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, display: 'inline-block' }}>
                                                                ✍️ Writing Now
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={styles.td}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            <a 
                                                                href={`/exam/${selectedExam}/scorecard/${r._id || r.id}`} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                style={{
                                                                    display: 'inline-block',
                                                                    padding: '4px 8px',
                                                                    backgroundColor: '#8b5cf6',
                                                                    color: 'white',
                                                                    textDecoration: 'none',
                                                                    borderRadius: '4px',
                                                                    fontSize: '12px',
                                                                    fontWeight: '600',
                                                                    textAlign: 'center'
                                                                }}
                                                            >
                                                                View Scorecard
                                                            </a>
                                                            <button
                                                                onClick={() => downloadIndividualPDF(r)}
                                                                style={{
                                                                    display: 'inline-block',
                                                                    padding: '4px 8px',
                                                                    backgroundColor: '#10b981',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '4px',
                                                                    fontSize: '12px',
                                                                    fontWeight: '600',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                Download PDF
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteIndividualAttempt(r)}
                                                                style={{
                                                                    display: 'inline-block',
                                                                    padding: '4px 8px',
                                                                    backgroundColor: '#fee2e2',
                                                                    color: '#dc2626',
                                                                    border: '1px solid #fca5a5',
                                                                    borderRadius: '4px',
                                                                    fontSize: '12px',
                                                                    fontWeight: '700',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                                title="Delete this trial attempt so the student can attend fresh tomorrow"
                                                            >
                                                                🗑️ Delete Attempt
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}
                </>
            )}

            {!loading && displayResults.length === 0 && selectedExam && (
                <div style={styles.empty}>No submissions yet for this exam.</div>
            )}
        </div>
    );
}

const styles = {
    container: { padding: '24px', fontFamily: 'Inter, sans-serif', maxWidth: 1200, margin: '0 auto' },
    title: { fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 20 },
    msg: { background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46', padding: '10px 16px', borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between' },
    closeMsg: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 },
    toolbar: { display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' },
    select: { flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, maxWidth: 400 },
    keyBtn: { background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 },
    keyBox: { background: '#1e1b4b', color: '#a5b4fc', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, fontFamily: 'monospace', fontSize: 13 },
    keyText: { wordBreak: 'break-all' },
    copyBtn: { background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', marginLeft: 12, flexShrink: 0 },
    loading: { textAlign: 'center', color: '#9ca3af', padding: 40 },
    empty: { textAlign: 'center', color: '#9ca3af', padding: 60 },
    summary: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
    summaryCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    summaryNum: { fontSize: 32, fontWeight: 800, color: '#4f46e5' },
    summaryLabel: { fontSize: 13, color: '#6b7280', marginTop: 4 },
    tableWrap: { overflowX: 'auto', borderRadius: 12, border: '1px solid #e5e7eb' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
    thead: { background: '#f8fafc' },
    th: { padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' },
    td: { padding: '12px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' },
    sourceBadge: { borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 },
    analyticsSection: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    analyticsTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 16, marginTop: 0 },
    chartLegend: { display: 'flex', gap: 16, marginBottom: 16, fontSize: 13, color: '#6b7280' },
    legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: '50%' },
    chartScroll: { overflowX: 'auto', paddingBottom: 12 },
    chartContainer: { display: 'flex', gap: 8, height: 200, alignItems: 'flex-end', minWidth: 'min-content' },
    barColumn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 24, cursor: 'pointer', transition: 'opacity 0.2s' },
    barVertical: { width: 16, height: 160, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: '#f8fafc', borderRadius: '4px 4px 0 0', overflow: 'hidden' },
    barLabel: { fontSize: 11, color: '#6b7280', fontWeight: 600 }
};
