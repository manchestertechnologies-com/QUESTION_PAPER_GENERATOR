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
// 1. CLASS CONSOLIDATED RESULT SHEET & MERIT LIST PDF (LANDSCAPE)
// ─────────────────────────────────────────────────────────────────────────────
export function downloadClassResultSheetPdf({
    title = 'Examination Results',
    examType = 'CBT / OMR Exam',
    institutionName = 'MANCHESTER TECHNOLOGIES',
    results = [],
    aggregate = null
}) {
    if (!results || results.length === 0) {
        alert('No candidate results available to export.');
        return;
    }

    const doc = createPdfDoc('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ── Header Banner ──
    doc.setFillColor(15, 23, 42); // Navy (#0f172a)
    doc.rect(0, 0, pageWidth, 68, 'F');

    // Gold accent bar
    doc.setFillColor(212, 175, 55); // Gold (#d4af37)
    doc.rect(0, 68, pageWidth, 4, 'F');

    // Title Text
    doc.setTextColor(212, 175, 55);
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.text(institutionName.toUpperCase(), 30, 28);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`CONSOLIDATED CLASS RESULT SHEET & MERIT LIST — ${title.toUpperCase()}`, 30, 48);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    const dateStr = `Generated: ${getFormattedDate()}`;
    doc.text(dateStr, pageWidth - 30 - doc.getTextWidth(dateStr), 28);
    const examMeta = `Type: ${examType} | Total Candidates: ${results.length}`;
    doc.text(examMeta, pageWidth - 30 - doc.getTextWidth(examMeta), 48);

    // ── Summary Metrics Bar ──
    const totalStudents = results.length;
    const scores = results.map(r => Number(r.score ?? r.scoreData?.totalScore ?? 0)).filter(n => !isNaN(n));
    const avgScore = aggregate?.avgScore ?? (scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0);
    const topScore = aggregate?.topScore ?? (scores.length ? Math.max(...scores) : 0);
    const totalCorrect = aggregate?.totalCorrect ?? results.reduce((a, r) => a + (Number(r.correct ?? r.scoreData?.correctCount ?? 0) || 0), 0);
    const totalWrong = aggregate?.totalWrong ?? results.reduce((a, r) => a + (Number(r.incorrect ?? r.scoreData?.wrongCount ?? 0) || 0), 0);
    const totalBlank = aggregate?.totalBlank ?? results.reduce((a, r) => a + (Number(r.unattempted ?? r.scoreData?.blankCount ?? 0) || 0), 0);

    doc.setFillColor(248, 250, 252); // Slate-50
    doc.roundedRect(30, 82, pageWidth - 60, 42, 6, 6, 'FD');
    doc.setDrawColor(226, 232, 240);

    const statColWidth = (pageWidth - 60) / 4;
    const stats = [
        { label: 'TOTAL CANDIDATES', val: `${totalStudents}`, color: [15, 23, 42] },
        { label: 'CLASS AVERAGE SCORE', val: `${avgScore}`, color: [59, 130, 246] },
        { label: 'HIGHEST SCORE', val: `${topScore}`, color: [16, 185, 129] },
        { label: 'ACCURACY METRICS', val: `${totalCorrect} C  |  ${totalWrong} W  |  ${totalBlank} NA`, color: [71, 85, 105] }
    ];

    stats.forEach((st, idx) => {
        const xPos = 30 + (idx * statColWidth) + (statColWidth / 2);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(st.label, xPos, 98, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(...st.color);
        doc.text(st.val, xPos, 114, { align: 'center' });
    });

    // ── Table Data Formatting ──
    const firstSubjKeys = Object.keys(results[0]?.subjectScores || {});
    const hasSubjectBreakdown = firstSubjKeys.length > 0;

    let tableHead = [];
    if (hasSubjectBreakdown) {
        tableHead = [
            ['Rank', 'Roll No', 'Student Name', 'Set', ...firstSubjKeys.map(k => `${k}\n(C/W/NA)`), 'Score', 'Status']
        ];
    } else {
        tableHead = [
            ['Rank', 'Roll No', 'Student Name', 'Total Qs', 'Correct', 'Incorrect', 'Skipped', 'Score', 'Status']
        ];
    }

    const tableRows = results.map((r, i) => {
        const rank = r.rank ?? (i + 1);
        const roll = r.rollNumber ?? r.roll_number ?? '—';
        const name = r.studentName ?? r.student_name ?? 'Candidate';
        const score = Number(r.score ?? r.scoreData?.totalScore ?? 0);
        const correct = Number(r.correct ?? r.scoreData?.correctCount ?? 0);
        const wrong = Number(r.incorrect ?? r.scoreData?.wrongCount ?? 0);
        const blank = Number(r.unattempted ?? r.scoreData?.blankCount ?? 0);
        const totalQ = Number(r.totalQuestions ?? (correct + wrong + blank) ?? 0);
        const series = r.series || 'P';

        let statusText = 'Completed';
        if (r.malpracticeFlag) statusText = 'Malpractice';

        if (hasSubjectBreakdown) {
            const subjCols = firstSubjKeys.map(k => {
                const s = r.subjectScores?.[k] || { correct: 0, wrong: 0, notAttempted: 0, score: 0 };
                return `${s.correct}/${s.wrong}/${s.notAttempted} (${s.score})`;
            });
            return [`#${rank}`, roll, name, series, ...subjCols, score, statusText];
        } else {
            return [`#${rank}`, roll, name, totalQ, correct, wrong, blank, score, statusText];
        }
    });

    // ── Render AutoTable ──
    runAutoTable(doc, {
        head: tableHead,
        body: tableRows,
        startY: 134,
        margin: { left: 30, right: 30, bottom: 35 },
        styles: {
            font: 'helvetica',
            fontSize: 8.5,
            cellPadding: 5,
            valign: 'middle'
        },
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: [212, 175, 55],
            fontStyle: 'bold',
            halign: 'center',
            lineWidth: 0.5,
            lineColor: [212, 175, 55]
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            0: { halign: 'center', fontStyle: 'bold', cellWidth: 40 },
            1: { halign: 'center', fontStyle: 'bold', cellWidth: 60 },
            2: { halign: 'left', fontStyle: 'bold' },
            ...(hasSubjectBreakdown
                ? {
                    3: { halign: 'center', cellWidth: 35 },
                    [tableHead[0].length - 2]: { halign: 'center', fontStyle: 'bold', textColor: [15, 23, 42] },
                    [tableHead[0].length - 1]: { halign: 'center', fontStyle: 'bold' }
                }
                : {
                    3: { halign: 'center' },
                    4: { halign: 'center', textColor: [16, 185, 129], fontStyle: 'bold' },
                    5: { halign: 'center', textColor: [239, 68, 68], fontStyle: 'bold' },
                    6: { halign: 'center', textColor: [148, 163, 184] },
                    7: { halign: 'center', fontStyle: 'bold', textColor: [15, 23, 42] },
                    8: { halign: 'center', fontStyle: 'bold' }
                })
        },
        didDrawPage: (data) => {
            // Footer on each page
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

    // ── Section 1: Subject-Wise Performance (If Available) ──
    const subjKeys = Object.keys(student.subjectScores || {});
    if (subjKeys.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text('SUBJECT-WISE PERFORMANCE BREAKDOWN', 35, currentCursorY);
        currentCursorY += 6;

        const subjRows = subjKeys.map(k => {
            const s = student.subjectScores[k] || {};
            const subScore = s.score ?? 0;
            const subCorr = s.correct ?? 0;
            const subWrong = s.wrong ?? 0;
            const subBlank = s.notAttempted ?? 0;
            const subTot = subCorr + subWrong + subBlank;
            const subPct = subTot > 0 ? Math.round((subCorr / subTot) * 100) : 0;
            return [k, `${subScore}`, `${subCorr}`, `${subWrong}`, `${subBlank}`, `${subTot}`, `${subPct}%`];
        });

        runAutoTable(doc, {
            head: [['Subject', 'Score', 'Correct', 'Wrong', 'Skipped', 'Total Qs', 'Accuracy']],
            body: subjRows,
            startY: currentCursorY,
            margin: { left: 35, right: 35 },
            styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, halign: 'center' },
            headStyles: { fillColor: [15, 23, 42], textColor: [212, 175, 55], fontStyle: 'bold' },
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold' },
                1: { fontStyle: 'bold' },
                2: { textColor: [16, 185, 129], fontStyle: 'bold' },
                3: { textColor: [239, 68, 68], fontStyle: 'bold' }
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
