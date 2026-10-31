/**
 * Unified Client-Side PDF Generation Utility for Class Results and Individual Scorecards
 * Powered by jsPDF & jspdf-autotable
 * Ensures 100% offline-ready, instant downloads with zero server-side browser dependencies.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Robust instantiation of jsPDF across ESM environments
 */
function createPdfDoc(orientation = 'portrait') {
    const Ctr = typeof jsPDF === 'function' ? jsPDF : (jsPDF.jsPDF || jsPDF.default);
    return new Ctr({
        orientation,
        unit: 'pt',
        format: 'a4',
        compress: true
    });
}

/**
 * Robust invocation of autoTable across different bundling styles
 */
function runAutoTable(doc, options) {
    if (typeof autoTable === 'function') {
        autoTable(doc, options);
    } else if (typeof doc.autoTable === 'function') {
        doc.autoTable(options);
    } else if (autoTable && typeof autoTable.default === 'function') {
        autoTable.default(doc, options);
    } else if (autoTable && typeof autoTable.autoTable === 'function') {
        autoTable.autoTable(doc, options);
    } else {
        throw new Error('jspdf-autotable plugin could not be initialized');
    }
}

/**
 * Format date nicely
 */
function getFormattedDate(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    return isNaN(d.getTime()) ? new Date().toLocaleDateString('en-IN') : d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Calculate Grade & Performance Label
 */
function calculateGrade(percentage) {
    const pct = Math.max(0, Math.min(100, Math.round(percentage || 0)));
    if (pct >= 85) return { grade: 'A+', label: 'Outstanding', color: [16, 185, 129] };
    if (pct >= 70) return { grade: 'A', label: 'Excellent', color: [59, 130, 246] };
    if (pct >= 55) return { grade: 'B+', label: 'Very Good', color: [14, 165, 233] };
    if (pct >= 40) return { grade: 'B', label: 'Satisfactory', color: [245, 158, 11] };
    return { grade: 'C', label: 'Needs Remedial Focus', color: [239, 68, 68] };
}

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL SUBJECT & EXAM MAPPING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes subject string into canonical subject name
 */
export function normalizeSubjectName(sub) {
    if (!sub || typeof sub !== 'string') return 'Physics';
    const s = sub.trim().toLowerCase();
    if (s.includes('physic')) return 'Physics';
    if (s.includes('chem')) return 'Chemistry';
    if (s.includes('math')) return 'Mathematics';
    if (s.includes('botan')) return 'Botany';
    if (s.includes('zool')) return 'Zoology';
    if (s.includes('bio')) return 'Biology';
    return sub.trim();
}

/**
 * Returns standard canonical ordered subjects for an exam type:
 * - JEE: PCM (Physics, Chemistry, Mathematics)
 * - CET / KCET: PCMB (Physics, Chemistry, Mathematics, Biology)
 * - NEET: PCBZ (Physics, Chemistry, Botany, Zoology) or PCB (Physics, Chemistry, Biology)
 */
export function getOrderedSubjectsForExam(examType = '', examTitle = '', detectedSubjects = []) {
    const typeStr = (String(examType) + ' ' + String(examTitle)).toUpperCase();
    
    if (typeStr.includes('JEE')) {
        return ['Physics', 'Chemistry', 'Mathematics'];
    }
    if (typeStr.includes('CET') || typeStr.includes('KCET')) {
        return ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
    }
    if (typeStr.includes('NEET')) {
        const hasBotanyOrZoology = detectedSubjects.some(s => s === 'Botany' || s === 'Zoology');
        if (hasBotanyOrZoology) {
            return ['Physics', 'Chemistry', 'Botany', 'Zoology'];
        }
        return ['Physics', 'Chemistry', 'Biology'];
    }

    const priority = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Botany', 'Zoology'];
    const ordered = priority.filter(p => detectedSubjects.includes(p));
    detectedSubjects.forEach(s => {
        if (!ordered.includes(s)) ordered.push(s);
    });
    return ordered.length > 0 ? ordered : ['Physics', 'Chemistry', 'Mathematics'];
}

/**
 * Compute robust subject scores for any student record (works for current & historical exams)
 */
export function computeSubjectScores(student = {}, exam = {}) {
    const examType = exam.examType || student.examType || 'CET';
    const examTitle = exam.title || exam.examTitle || student.examTitle || '';
    const typeStr = (String(examType) + ' ' + String(examTitle)).toUpperCase();
    const isCET = typeStr.includes('CET') || typeStr.includes('KCET');
    const marksPerQ = isCET ? 1 : 4;
    const negMark = isCET ? 0 : 1;

    // Detect subjects present across all sources
    const questions = exam.questions || [];
    const responses = student.breakdown || student.questionResponses || student.answers || [];

    const detected = new Set();
    questions.forEach(q => { if (q.subject) detected.add(normalizeSubjectName(q.subject)); });
    responses.forEach(r => { if (r.subject) detected.add(normalizeSubjectName(r.subject)); });
    if (student.subjectScores) {
        Object.keys(student.subjectScores).forEach(k => detected.add(normalizeSubjectName(k)));
    }

    const orderedSubjects = getOrderedSubjectsForExam(examType, examTitle, Array.from(detected));

    const subStats = {};
    orderedSubjects.forEach(sub => {
        subStats[sub] = {
            subject: sub,
            correct: 0,
            wrong: 0,
            notAttempted: 0,
            totalQuestions: 0,
            score: 0,
            accuracy: 0
        };
    });

    // Check if student already has full subjectScores from server
    if (student.subjectScores && typeof student.subjectScores === 'object') {
        const keys = Object.keys(student.subjectScores);
        let hasData = false;
        keys.forEach(rawKey => {
            const normKey = normalizeSubjectName(rawKey);
            const val = student.subjectScores[rawKey] || {};
            if (val.correct !== undefined || val.wrong !== undefined || val.score !== undefined) {
                hasData = true;
                if (!subStats[normKey]) {
                    subStats[normKey] = {
                        subject: normKey,
                        correct: 0,
                        wrong: 0,
                        notAttempted: 0,
                        totalQuestions: 0,
                        score: 0,
                        accuracy: 0
                    };
                    if (!orderedSubjects.includes(normKey)) orderedSubjects.push(normKey);
                }
                subStats[normKey].correct = Number(val.correct || 0);
                subStats[normKey].wrong = Number(val.wrong || val.incorrect || 0);
                subStats[normKey].notAttempted = Number(val.notAttempted || val.unattempted || 0);
                subStats[normKey].totalQuestions = Number(val.totalQuestions || (subStats[normKey].correct + subStats[normKey].wrong + subStats[normKey].notAttempted) || 0);
                subStats[normKey].score = val.score !== undefined 
                    ? Number(val.score) 
                    : (subStats[normKey].correct * marksPerQ - subStats[normKey].wrong * negMark);
                const att = subStats[normKey].correct + subStats[normKey].wrong;
                subStats[normKey].accuracy = att > 0 ? Math.round((subStats[normKey].correct / att) * 100) : 0;
            }
        });
        if (hasData) {
            let totalMarks = 0;
            orderedSubjects.forEach(sub => {
                totalMarks += subStats[sub]?.score || 0;
            });
            return { orderedSubjects, subStats, totalScore: student.score !== undefined ? Number(student.score) : totalMarks, isCET, marksPerQ, negMark };
        }
    }

    // Otherwise calculate dynamically from questions & responses
    const itemsToProcess = (responses.length >= questions.length && responses.length > 0)
        ? responses
        : (questions.length > 0 ? questions : responses);

    itemsToProcess.forEach((item, idx) => {
        const sid = typeof item === 'string' ? item : String(item._id || item.id || item.questionId || idx);
        const resp = responses.find(r => String(r.questionId || r._id || r.id) === sid || String(r.questionNumber) === String(idx + 1)) || responses[idx] || {};
        const qObj = questions.find(q => String(q._id || q.id || q.questionId) === sid) || questions[idx] || {};

        let rawSub = item.subject || resp.subject || qObj.subject || '';
        let normSub = 'Physics';
        if (rawSub) {
            normSub = normalizeSubjectName(rawSub);
        } else {
            // Partition based on standard chunks if subject is omitted
            if (orderedSubjects.length === 3) {
                normSub = idx < 25 ? 'Physics' : (idx < 50 ? 'Chemistry' : 'Mathematics');
            } else if (orderedSubjects.length === 4) {
                const chunk = Math.max(1, Math.floor(itemsToProcess.length / 4));
                const cIdx = Math.min(3, Math.floor(idx / chunk));
                normSub = orderedSubjects[cIdx];
            } else {
                normSub = orderedSubjects[idx % orderedSubjects.length];
            }
        }

        if (!subStats[normSub]) {
            subStats[normSub] = { subject: normSub, correct: 0, wrong: 0, notAttempted: 0, totalQuestions: 0, score: 0, accuracy: 0 };
            if (!orderedSubjects.includes(normSub)) orderedSubjects.push(normSub);
        }

        subStats[normSub].totalQuestions++;

        const userAns = resp.selectedOption ?? resp.markedBubble ?? resp.userAnswer ?? null;
        const correctAns = resp.correctAnswer ?? resp.correctKey ?? qObj.answer ?? qObj.correctAnswer ?? null;
        const isAttempted = Boolean(userAns !== null && userAns !== undefined && String(userAns).trim() !== '' && String(userAns) !== '—');

        let isCorrect = false;
        if (resp.isCorrect !== undefined) {
            isCorrect = Boolean(resp.isCorrect);
        } else if (isAttempted && correctAns !== null && correctAns !== undefined) {
            isCorrect = String(userAns).trim().toUpperCase() === String(correctAns).trim().toUpperCase();
        }

        if (isAttempted) {
            if (isCorrect) {
                subStats[normSub].correct++;
                subStats[normSub].score += marksPerQ;
            } else {
                subStats[normSub].wrong++;
                subStats[normSub].score -= negMark;
            }
        } else {
            subStats[normSub].notAttempted++;
        }
    });

    let totalMarks = 0;
    orderedSubjects.forEach(sub => {
        const s = subStats[sub];
        const att = s.correct + s.wrong;
        s.accuracy = att > 0 ? Math.round((s.correct / att) * 100) : 0;
        totalMarks += s.score;
    });

    const finalScore = (student.score !== undefined && student.score !== null)
        ? Number(student.score)
        : totalMarks;

    return { orderedSubjects, subStats, totalScore: finalScore, isCET, marksPerQ, negMark };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLASS CONSOLIDATED RESULT SHEET & MERIT LIST PDF (PORTRAIT)
// ─────────────────────────────────────────────────────────────────────────────
export function downloadClassResultSheetPdf({
    title = 'Examination Results',
    examType = 'CBT / OMR Exam',
    institutionName = 'MANCHESTER TECHNOLOGIES',
    results = [],
    aggregate = null,
    exam = null
}) {
    if (!results || results.length === 0) {
        alert('No candidate results available to export.');
        return;
    }

    const doc = createPdfDoc('portrait');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ── Header Text & Branding (Portrait Layout) ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // Dark Navy #0f172a
    doc.text(institutionName.toUpperCase(), 32, 28);

    doc.setFontSize(9.5);
    doc.setTextColor(2, 132, 199); // Blue #0284c7
    doc.text(`CONSOLIDATED CLASS RESULT SHEET & MERIT LIST — ${title.toUpperCase()}`, 32, 40);

    // ── Summary Metrics ──
    const totalStudents = results.length;
    const scores = results.map(r => Number(r.score ?? r.scoreData?.totalScore ?? 0)).filter(n => !isNaN(n));
    const avgScore = aggregate?.avgScore ?? (scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0);
    const topScore = aggregate?.topScore ?? (scores.length ? Math.max(...scores) : 0);
    const totalCorrect = aggregate?.totalCorrect ?? results.reduce((a, r) => a + (Number(r.correct ?? r.scoreData?.correctCount ?? 0) || 0), 0);
    const totalWrong = aggregate?.totalWrong ?? results.reduce((a, r) => a + (Number(r.incorrect ?? r.scoreData?.wrongCount ?? 0) || 0), 0);
    const totalBlank = aggregate?.totalBlank ?? results.reduce((a, r) => a + (Number(r.unattempted ?? r.scoreData?.blankCount ?? 0) || 0), 0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);

    // Line 1: Test Format, Candidates, Generated Date
    doc.text('Test Format: ', 32, 51);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(`${examType}`, 76, 51);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Total Candidates: ', 170, 51);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(`${totalStudents}`, 235, 51);

    const genDateStr = `Generated: ${getFormattedDate()}`;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(genDateStr, pageWidth - 32 - doc.getTextWidth(genDateStr), 51);

    // Line 2: Class Highest, Average, Accuracy
    doc.text('Class Highest: ', 32, 60);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(`${topScore} Marks`, 84, 60);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Class Average: ', 170, 60);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(`${Number(avgScore).toFixed(1)} Marks`, 222, 60);

    const accMetricsStr = `Accuracy Metrics: ${Number(totalCorrect).toLocaleString()} C | ${Number(totalWrong).toLocaleString()} W | ${Number(totalBlank).toLocaleString()} NA`;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(accMetricsStr, pageWidth - 32 - doc.getTextWidth(accMetricsStr), 60);

    // Subtle horizontal divider line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(32, 65, pageWidth - 32, 65);

    // ── Scoring Guide Box ──
    const sampleExam = exam || { examType, title };
    const { orderedSubjects, isCET, marksPerQ, negMark } = computeSubjectScores(results[0] || {}, sampleExam);

    doc.setFillColor(248, 250, 252); // Slate-50
    doc.setDrawColor(186, 230, 253); // Sky-200
    doc.roundedRect(32, 70, pageWidth - 64, 40, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('SCORING GUIDE & SUBJECT MARKS BREAKDOWN', 40, 80);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    const typeUpper = (String(examType) + ' ' + String(title)).toUpperCase();
    const guideText = isCET
        ? `In standard CET marking, each correct question awards +1 mark, with 0 negative marks for incorrect answers. Subject Marks = Net Score.`
        : `In standard ${typeUpper.includes('NEET') ? 'NEET' : 'JEE'} marking, each correct question awards +4 marks, each incorrect question deducts -1 mark, and unattempted questions yield 0 marks. The formula used is: Marks = (Correct × 4) − Wrong.`;
    doc.text(guideText, 40, 89);

    // Pill Badges inside guide
    const pills = isCET ? [
        'C: Correct (+1)',
        'W: Incorrect (0)',
        'Subject Marks: Net Score',
        `Total: ${orderedSubjects.join(' + ')}`
    ] : [
        'C: Correct Answers (+4)',
        'W: Incorrect Answers (-1)',
        'Subject Marks: Net Score',
        `Total: ${orderedSubjects.join(' + ')}`
    ];

    let pillX = 40;
    pills.forEach(p => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        const pWidth = doc.getTextWidth(p) + 8;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(pillX, 93, pWidth, 11, 2, 2, 'FD');
        doc.setTextColor(71, 85, 105);
        doc.text(p, pillX + 4, 100.5);
        pillX += pWidth + 5;
    });

    const tableHead = [
        [
            'RANK',
            'ROLL NO',
            'STUDENT NAME',
            ...orderedSubjects.map(sub => sub.toUpperCase()),
            'TOTAL'
        ]
    ];

    const tableRows = results.map((r, i) => {
        const rank = r.rank ?? (i + 1);
        const roll = r.rollNumber ?? r.roll_number ?? '—';
        const name = (r.studentName ?? r.student_name ?? 'Candidate').toUpperCase();

        const { subStats, totalScore } = computeSubjectScores(r, sampleExam);

        const subjMarks = orderedSubjects.map(sub => {
            const s = subStats[sub];
            return String(s?.score ?? 0);
        });

        return [`#${rank}`, roll, name, ...subjMarks, `${totalScore}`];
    });

    // Class Average Footer Row
    const classAvgCols = orderedSubjects.map(sub => {
        let sumM = 0;
        results.forEach(resItem => {
            const { subStats } = computeSubjectScores(resItem, sampleExam);
            const s = subStats[sub] || { score: 0 };
            sumM += Number(s.score) || 0;
        });
        const avgM = (sumM / (totalStudents || 1)).toFixed(1);
        return `${avgM}`;
    });

    tableRows.push(['CLASS AVERAGE', '—', 'All Candidates', ...classAvgCols, `${Number(avgScore).toFixed(1)}`]);

    // Build column styles dynamically for portrait layout
    const colStyles = {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 38 },
        1: { halign: 'center', fontStyle: 'bold', cellWidth: 62 },
        2: { halign: 'left', fontStyle: 'bold' }
    };
    const subColWidth = orderedSubjects.length <= 3 ? 68 : 55;
    orderedSubjects.forEach((_, idx) => {
        colStyles[3 + idx] = { halign: 'center', fontStyle: 'bold', cellWidth: subColWidth };
    });
    const totalColIdx = 3 + orderedSubjects.length;
    colStyles[totalColIdx] = { halign: 'center', fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 50 };

    // ── Render AutoTable ──
    runAutoTable(doc, {
        head: tableHead,
        body: tableRows,
        startY: 118,
        margin: { left: 30, right: 30, bottom: 35 },
        styles: {
            font: 'helvetica',
            fontSize: 8.5,
            cellPadding: 4.5,
            valign: 'middle',
            halign: 'center'
        },
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8.5,
            lineWidth: 0.5,
            lineColor: [51, 65, 85]
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: colStyles,
        didParseCell: (data) => {
            if (data.row.index === tableRows.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [241, 245, 249];
                data.cell.styles.textColor = [15, 23, 42];
            }
        },
        didDrawPage: (data) => {
            const curPage = data.pageNumber;
            const totalPages = doc.internal.getNumberOfPages();
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(
                `Manchester Technologies • Examination Result Portal • Page ${curPage} of ${totalPages}`,
                pageWidth / 2,
                pageHeight - 15,
                { align: 'center' }
            );
        }
    });

    const safeTitle = (title || 'Class_Results').replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`${safeTitle}_Class_Result_Sheet.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. INDIVIDUAL STUDENT RESULT / SCORECARD PDF (PORTRAIT)
// ─────────────────────────────────────────────────────────────────────────────
export function downloadIndividualScorecardPdf(student = {}, exam = {}) {
    const doc = createPdfDoc('portrait');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const studentName = student.studentName || student.student_name || 'Candidate';
    const rollNumber = student.rollNumber || student.roll_number || 'N/A';
    const studentEmail = student.studentEmail || student.student_email || '';
    const examTitle = exam.title || exam.examTitle || student.examTitle || 'Examination Scorecard';
    const examType = exam.examType || student.examType || 'CBT Exam';
    const series = student.series || 'P';
    const rank = student.rank ? `#${student.rank}` : '—';

    // Numbers & Metrics
    const correctCount = Number(student.correct ?? student.correctAnswers ?? student.scoreData?.correctCount ?? 0);
    const incorrectCount = Number(student.incorrect ?? student.wrongAnswers ?? student.scoreData?.wrongCount ?? 0);
    const unattemptedCount = Number(student.unattempted ?? student.scoreData?.blankCount ?? 0);
    const totalQ = Number(student.totalQuestions ?? (exam.questions?.length || (correctCount + incorrectCount + unattemptedCount)) ?? 0);

    const isCET = (String(examType).toUpperCase().includes('CET'));
    const marksPerQ = isCET ? 1 : 4;
    const maxMarks = Number(student.maxScore || (totalQ * marksPerQ) || 100);
    const score = Number(student.score ?? student.scoreData?.totalScore ?? (correctCount * marksPerQ - (isCET ? 0 : incorrectCount)));
    const percentage = maxMarks > 0 ? Math.max(0, Math.round((score / maxMarks) * 100)) : 0;
    const gradeInfo = calculateGrade(percentage);

    // ── Header Banner ──
    doc.setFillColor(15, 23, 42); // Navy
    doc.rect(0, 0, pageWidth, 74, 'F');

    doc.setFillColor(212, 175, 55); // Gold Accent Bar
    doc.rect(0, 74, pageWidth, 4, 'F');

    // Crest / Institution
    doc.setTextColor(212, 175, 55);
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.text('MANCHESTER TECHNOLOGIES', 35, 30);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('OFFICIAL CANDIDATE SCORECARD & DIAGNOSTIC REPORT', 35, 48);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`EXAM: ${examTitle.toUpperCase()}  |  SERIES: ${series}`, 35, 63);

    const dateStr = `Date: ${getFormattedDate(student.endTime || student.submittedAt)}`;
    doc.text(dateStr, pageWidth - 35 - doc.getTextWidth(dateStr), 63);

    // ── Candidate Profile Card ──
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(35, 88, pageWidth - 70, 56, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);

    doc.text('CANDIDATE NAME:', 48, 106);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text(studentName.toUpperCase(), 155, 106);

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('ROLL NUMBER:', 48, 126);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text(rollNumber, 155, 126);

    // Right Column Profile Info
    const rightColX = pageWidth / 2 + 30;
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('EXAM TYPE:', rightColX, 106);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(examType, rightColX + 85, 106);

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('CLASS RANK:', rightColX, 126);
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(11);
    doc.text(rank, rightColX + 85, 126);

    // ── Metric Badges Grid ──
    const cardY = 152;
    const cardW = (pageWidth - 70 - 30) / 4;
    const cardH = 50;

    const cards = [
        { label: 'TOTAL SCORE', val: `${score} / ${maxMarks}`, sub: `${percentage}% Marks`, col: [15, 23, 42] },
        { label: 'PERFORMANCE', val: gradeInfo.grade, sub: gradeInfo.label, col: gradeInfo.color },
        { label: 'CORRECT ANSWERS', val: `${correctCount}`, sub: `Accuracy: ${totalQ ? Math.round((correctCount / totalQ) * 100) : 0}%`, col: [16, 185, 129] },
        { label: 'INCORRECT / SKIP', val: `${incorrectCount} / ${unattemptedCount}`, sub: `${incorrectCount} Wrong • ${unattemptedCount} Skipped`, col: [239, 68, 68] }
    ];

    cards.forEach((c, idx) => {
        const xPos = 35 + (idx * (cardW + 10));
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(xPos, cardY, cardW, cardH, 6, 6, 'FD');

        // Top accent line
        doc.setFillColor(...c.col);
        doc.rect(xPos, cardY, cardW, 3, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(c.label, xPos + cardW / 2, cardY + 16, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(...c.col);
        doc.text(c.val, xPos + cardW / 2, cardY + 32, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(c.sub, xPos + cardW / 2, cardY + 44, { align: 'center' });
    });

    let currentCursorY = 212;

    // ── Section 1: Subject-Wise Performance (PCM / PCMB / PCBZ) ──
    const { orderedSubjects, subStats } = computeSubjectScores(student, exam);
    if (orderedSubjects.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        const subjGroup = isCET ? 'PCMB' : (String(examType).toUpperCase().includes('NEET') ? 'PCBZ' : 'PCM');
        doc.text(`SUBJECT-WISE PERFORMANCE BREAKDOWN (${subjGroup})`, 35, currentCursorY);
        currentCursorY += 6;

        const subjRows = orderedSubjects.map(sub => {
            const s = subStats[sub] || { correct: 0, wrong: 0, notAttempted: 0, totalQuestions: 0, score: 0, accuracy: 0 };
            return [
                sub,
                `${s.correct} (+${s.correct * marksPerQ})`,
                `${s.wrong} (${s.wrong > 0 && !isCET ? `-${s.wrong * 1}` : '0'})`,
                `${s.notAttempted}`,
                `${s.totalQuestions}`,
                `${s.score > 0 ? '+' : ''}${s.score} Marks`,
                `${s.accuracy}%`
            ];
        });

        // Add Overall Total row at the end
        subjRows.push([
            'OVERALL TOTAL',
            `${correctCount} (+${correctCount * marksPerQ})`,
            `${incorrectCount} (${incorrectCount > 0 && !isCET ? `-${incorrectCount * 1}` : '0'})`,
            `${unattemptedCount}`,
            `${totalQ}`,
            `${score} / ${maxMarks} Marks`,
            `${percentage}%`
        ]);

        runAutoTable(doc, {
            head: [['Subject', 'Correct (+)', 'Incorrect (-)', 'Skipped', 'Total Qs', 'Subject Marks', 'Accuracy']],
            body: subjRows,
            startY: currentCursorY,
            margin: { left: 35, right: 35 },
            styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 3.5, halign: 'center' },
            headStyles: { fillColor: [15, 23, 42], textColor: [212, 175, 55], fontStyle: 'bold' },
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold', cellWidth: 80 },
                1: { textColor: [16, 185, 129], fontStyle: 'bold' },
                2: { textColor: [239, 68, 68], fontStyle: 'bold' },
                3: { textColor: [100, 116, 139] },
                4: { cellWidth: 50 },
                5: { fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 85 },
                6: { fontStyle: 'bold', cellWidth: 55 }
            },
            didParseCell: (data) => {
                if (data.row.index === subjRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [241, 245, 249];
                    if (data.column.index === 0 || data.column.index === 5) {
                        data.cell.styles.textColor = [15, 23, 42];
                    }
                }
            }
        });

        currentCursorY = doc.lastAutoTable.finalY + 18;
    }

    // ── Section 2: Concept Diagnostics / Weak Areas ──
    const weakList = student.conceptAnalysis || student.weakAreas || [];
    if (weakList.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text('CONCEPT MASTERY & REMEDIAL FOCUS AREAS', 35, currentCursorY);
        currentCursorY += 6;

        const conceptRows = weakList.slice(0, 10).map(c => {
            const name = c.concept || c.chapter || 'Topic';
            const wrong = c.wrong ?? c.incorrect ?? 0;
            const corr = c.correct ?? 0;
            const status = wrong >= 2 ? 'Needs Urgent Review' : (wrong === 1 ? 'Review' : 'Mastered');
            return [name, `${corr}`, `${wrong}`, status];
        });

        runAutoTable(doc, {
            head: [['Concept / Topic', 'Correct', 'Incorrect', 'Status / Recommendation']],
            body: conceptRows,
            startY: currentCursorY,
            margin: { left: 35, right: 35 },
            styles: { font: 'helvetica', fontSize: 8, cellPadding: 4 },
            headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold' },
                1: { halign: 'center', textColor: [16, 185, 129] },
                2: { halign: 'center', textColor: [239, 68, 68], fontStyle: 'bold' },
                3: { halign: 'center', fontStyle: 'bold' }
            }
        });

        currentCursorY = doc.lastAutoTable.finalY + 18;
    }

    // ── Section 3: Question Responses Matrix (If Available) ──
    const responses = student.breakdown || student.questionResponses || student.answers || [];
    if (responses.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text('QUESTION-BY-QUESTION RESPONSE SHEET', 35, currentCursorY);
        currentCursorY += 6;

        const qRows = responses.map((q, idx) => {
            const qNum = q.questionNumber || (idx + 1);
            const userAns = q.selectedOption ?? q.markedBubble ?? q.userAnswer ?? '—';
            const correctAns = q.correctAnswer ?? q.correctKey ?? q.answer ?? '—';
            const isCorrect = q.isCorrect !== undefined 
                ? q.isCorrect 
                : (String(userAns).trim() !== '' && String(userAns) === String(correctAns));
            const status = (!userAns || userAns === '—' || userAns === '')
                ? 'Skipped' 
                : (isCorrect ? `Correct (+${marksPerQ})` : (isCET ? 'Wrong (0)' : 'Wrong (-1)'));

            return [
                `Q${qNum}`,
                q.subject || '—',
                q.concept || '—',
                String(userAns).toUpperCase(),
                String(correctAns).toUpperCase(),
                status
            ];
        });

        runAutoTable(doc, {
            head: [['Q#', 'Subject', 'Concept', 'Marked', 'Key', 'Result']],
            body: qRows,
            startY: currentCursorY,
            margin: { left: 35, right: 35, bottom: 35 },
            styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 3.5, halign: 'center' },
            headStyles: { fillColor: [15, 23, 42], textColor: [212, 175, 55], fontStyle: 'bold' },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 35 },
                1: { halign: 'left', cellWidth: 80 },
                2: { halign: 'left' },
                3: { fontStyle: 'bold', cellWidth: 50 },
                4: { fontStyle: 'bold', cellWidth: 50 },
                5: { fontStyle: 'bold', cellWidth: 70 }
            },
            didDrawPage: (data) => {
                const curPage = data.pageNumber;
                const totalPages = doc.internal.getNumberOfPages();
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                doc.text(
                    `Candidate: ${studentName} (${rollNumber}) • Page ${curPage} of ${totalPages}`,
                    pageWidth / 2,
                    pageHeight - 15,
                    { align: 'center' }
                );
            }
        });
    }

    const safeName = (studentName || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeRoll = (rollNumber || 'Roll').replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`${safeName}_${safeRoll}_Scorecard.pdf`);
}
