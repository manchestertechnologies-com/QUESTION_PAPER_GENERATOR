import React, { useMemo } from 'react';
import MathRenderer from './MathRenderer';
import { getQuestionCorrectAnswerLabel } from '../utils/sanitize';

/**
 * Triggers native window.print() safely.
 */
export function triggerPrintMode(mode = 'paper') {
    if (typeof window !== 'undefined') {
        window.print();
    }
}

/**
 * Helper to chunk questions into discrete A4 pages for the Answer Key.
 * Standard Answer Key: ~100 questions fit compactly on Page 1 with full header & verification box.
 * Subsequent pages fit ~140 questions.
 */
export function chunkAnswerKeyPages(questions = [], startQNo = 1) {
    if (!questions || questions.length === 0) return [];

    const pages = [];
    let currentIdx = 0;
    let pageNum = 1;

    while (currentIdx < questions.length) {
        const pageSize = pageNum === 1 ? 100 : 140;
        const slice = questions.slice(currentIdx, currentIdx + pageSize);
        pages.push({
            pageNum,
            items: slice.map((q, sIdx) => ({
                q,
                qNo: startQNo + currentIdx + sIdx,
            })),
        });
        currentIdx += pageSize;
        pageNum++;
    }

    return pages;
}

/**
 * ─── A4 ANSWER KEY ENGINE ──────────────────────────────────────────────────
 * Renders the Official Answer Key formatted as compact, authentic A4 sheets.
 */
export function A4AnswerKeySheet({
    paper,
    questions = [],
    startQNo = 1,
    settings = null,
    institutionName = 'INSTITUTION EXAMINATION CELL',
}) {
    const title = paper?.title || 'Question Paper';
    const subject = paper?.subject || 'All Subjects';
    const classes = Array.isArray(paper?.classes) ? paper.classes.join(', ') : (paper?.classes || 'All Classes');
    const totalMarks = paper?.totalMarks || questions.length * 4;
    const watermarkText = paper?.watermarkText || settings?.watermarkText || '';

    const pages = useMemo(() => chunkAnswerKeyPages(questions, startQNo), [questions, startQNo]);
    const totalPages = pages.length || 1;

    return (
        <div className="a4-answer-key-wrapper w-full flex flex-col items-center">
            {pages.map((page) => (
                <div
                    key={page.pageNum}
                    className="a4-sheet-page a4-answer-sheet"
                    style={{
                        width: '794px',
                        minHeight: '1123px',
                        background: '#ffffff',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                        border: '1px solid #e2e8f0',
                        margin: '0 auto 28px auto',
                        padding: '14mm 16mm 12mm 16mm',
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        position: 'relative',
                        overflow: 'hidden',
                        fontFamily: settings?.fontFamily || "'Inter', system-ui, sans-serif",
                    }}
                >
                    {/* True Background Watermark Layer */}
                    {watermarkText && (
                        <div className="a4-watermark-layer">
                            <div className="a4-watermark-text">
                                {watermarkText}
                            </div>
                        </div>
                    )}

                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
                        {/* ── TOP SECTION (Header + Metadata) ── */}
                        <div>
                            {page.pageNum === 1 ? (
                                /* Primary Official Header on Page 1 */
                                <div className="border-b-2 border-slate-900 pb-2.5 mb-3 text-center">
                                    <h1 className="text-base font-extrabold uppercase tracking-wider text-slate-900 m-0">
                                        {institutionName}
                                    </h1>
                                    <h2 className="text-sm font-bold text-slate-800 mt-1 mb-1.5">
                                        {title}
                                    </h2>
                                    <div className="flex justify-center items-center gap-3 text-[11px] text-slate-600 font-medium flex-wrap">
                                        <span><strong>Subject:</strong> {subject}</span>
                                        <span>•</span>
                                        <span><strong>Class:</strong> {classes}</span>
                                        <span>•</span>
                                        <span><strong>Total Questions:</strong> {questions.length}</span>
                                        <span>•</span>
                                        <span><strong>Max Marks:</strong> {totalMarks}</span>
                                        <span>•</span>
                                        <span><strong>Date:</strong> {new Date().toLocaleDateString('en-GB')}</span>
                                    </div>
                                    <div className="mt-2">
                                        <span className="inline-block bg-slate-900 text-amber-300 font-extrabold text-[11px] px-3.5 py-0.5 rounded-full uppercase tracking-widest">
                                            OFFICIAL ANSWER KEY
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                /* Compact Running Header on Subsequent Pages */
                                <div className="border-b border-slate-300 pb-1.5 mb-3 flex justify-between items-center text-xs text-slate-600">
                                    <span className="font-bold text-slate-800">{title} — Official Answer Key</span>
                                    <span>Sheet {page.pageNum} of {totalPages}</span>
                                </div>
                            )}

                            {/* ── ANSWER GRID (5 Columns per row) ── */}
                            <div className="grid grid-cols-5 gap-1.5 my-2">
                                {page.items.map(({ q, qNo }) => {
                                    const ansLabel = getQuestionCorrectAnswerLabel(q, settings);
                                    return (
                                        <div
                                            key={q._id || qNo}
                                            className="flex items-center justify-between px-2 py-1 rounded border border-slate-300 bg-slate-50/80 text-[11px]"
                                        >
                                            <span className="font-bold text-slate-600">Q.{qNo}</span>
                                            <span className="font-extrabold text-slate-900 bg-white border border-slate-300 px-1.5 py-0.2 rounded shadow-2xs text-[11.5px]">
                                                {ansLabel}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── BOTTOM SECTION (Scoring & Verification) ── */}
                        {page.pageNum === totalPages && (
                            <div className="mt-4 pt-2.5 border-t border-slate-200 grid grid-cols-2 gap-4 text-xs text-slate-700">
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-0.5 text-[11px]">
                                    <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Marking Scheme</div>
                                    <div>Correct Answer: <strong className="text-emerald-700">+4 Marks</strong></div>
                                    <div>Incorrect Answer: <strong className="text-rose-700">-1 Mark</strong></div>
                                    <div>Unattempted: <strong className="text-slate-500">0 Marks</strong></div>
                                </div>
                                <div className="flex flex-col justify-end text-right text-[11px] pr-2">
                                    <div className="font-bold text-slate-800">Verified & Approved</div>
                                    <div className="text-slate-500 text-[10px]">Head of Examination Cell</div>
                                </div>
                            </div>
                        )}

                        {/* Page Footer */}
                        <div className="mt-auto pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
                            <span>*** Official Key — Verified for Automated Evaluation ***</span>
                            <span>Sheet {page.pageNum} of {totalPages}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * ─── A4 SOLUTION KEY ENGINE ────────────────────────────────────────────────
 * Renders Detailed Step-by-Step Solutions with continuous flow and zero space wastage.
 */
export function A4SolutionKeySheet({
    paper,
    questions = [],
    startQNo = 1,
    settings = null,
    institutionName = 'INSTITUTION EXAMINATION CELL',
}) {
    const title = paper?.title || 'Question Paper';
    const subject = paper?.subject || 'All Subjects';
    const classes = Array.isArray(paper?.classes) ? paper.classes.join(', ') : (paper?.classes || 'All Classes');
    const watermarkText = paper?.watermarkText || settings?.watermarkText || '';

    return (
        <div className="a4-solution-key-wrapper w-full flex flex-col items-center">
            <div
                className="a4-sheet-page a4-solution-page"
                style={{
                    width: '794px',
                    minHeight: '1123px',
                    background: '#ffffff',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                    border: '1px solid #e2e8f0',
                    margin: '0 auto 28px auto',
                    padding: '14mm 16mm 12mm 16mm',
                    boxSizing: 'border-box',
                    position: 'relative',
                    overflow: 'hidden',
                    fontFamily: settings?.fontFamily || "'Inter', system-ui, sans-serif",
                }}
            >
                {/* True Background Watermark Layer */}
                {watermarkText && (
                    <div className="a4-watermark-layer">
                        <div className="a4-watermark-text">
                            {watermarkText}
                        </div>
                    </div>
                )}

                <div style={{ position: 'relative', zIndex: 1 }}>
                    {/* Primary Official Header on Page 1 */}
                    <div className="border-b-2 border-slate-900 pb-2.5 mb-3.5 text-center">
                        <h1 className="text-base font-extrabold uppercase tracking-wider text-slate-900 m-0">
                            {institutionName}
                        </h1>
                        <h2 className="text-sm font-bold text-slate-800 mt-1 mb-1.5">
                            {title}
                        </h2>
                        <div className="flex justify-center items-center gap-3 text-[11px] text-slate-600 font-medium flex-wrap">
                            <span><strong>Subject:</strong> {subject}</span>
                            <span>•</span>
                            <span><strong>Class:</strong> {classes}</span>
                            <span>•</span>
                            <span><strong>Total Questions:</strong> {questions.length}</span>
                            <span>•</span>
                            <span><strong>Date:</strong> {new Date().toLocaleDateString('en-GB')}</span>
                        </div>
                        <div className="mt-2">
                            <span className="inline-block bg-emerald-800 text-emerald-100 font-extrabold text-[11px] px-3.5 py-0.5 rounded-full uppercase tracking-widest">
                                DETAILED SOLUTIONS & EXPLANATIONS GUIDE
                            </span>
                        </div>
                    </div>

                    {/* ── SOLUTIONS LIST (Flows continuously without artificial gaps) ── */}
                    <div className="space-y-2.5">
                        {questions.map((q, idx) => {
                            const qNo = startQNo + idx;
                            const ansLabel = getQuestionCorrectAnswerLabel(q, settings);
                            const qText = q.questionText || q.question || '';
                            const solText = q.solutionText || q.solution_text || 'Detailed step-by-step solution available upon evaluation.';
                            const qImg = q.imageUrl || q.image_url;

                            return (
                                <div
                                    key={q._id || qNo}
                                    className="border border-slate-200 rounded-lg p-2.5 bg-white text-xs space-y-1"
                                    style={{
                                        breakInside: 'avoid',
                                        pageBreakInside: 'avoid',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                                    }}
                                >
                                    <div className="flex justify-between items-center border-b border-slate-100 pb-1 flex-wrap gap-2">
                                        <span className="font-bold text-xs text-slate-900">Question {qNo}</span>
                                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded">
                                            Correct Answer: Option ({ansLabel})
                                        </span>
                                    </div>

                                    {/* Question stem */}
                                    <div className="text-slate-800 font-normal leading-relaxed text-[11.5px]">
                                        <MathRenderer inline text={qText} />
                                    </div>

                                    {/* Diagram if present */}
                                    {qImg && (
                                        <div className="my-1 text-center">
                                            <img
                                                src={qImg}
                                                alt={`Q${qNo} diagram`}
                                                className="max-h-28 object-contain mx-auto rounded border border-slate-200"
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        </div>
                                    )}

                                    {/* Match Table in Solution Guide if present */}
                                    {(() => {
                                        const pairs = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0)
                                            ? q.matchPairs
                                            : (Array.isArray(q.column_a) && q.column_a.length > 0)
                                                ? q.column_a.map((left, pIdx) => ({ left, right: (q.column_b && q.column_b[pIdx]) || '' }))
                                                : (Array.isArray(q.columnA) && q.columnA.length > 0)
                                                    ? q.columnA.map((left, pIdx) => ({ left, right: (q.columnB && q.columnB[pIdx]) || '' }))
                                                    : null;

                                        if (!pairs || pairs.length === 0) return null;

                                        return (
                                            <div className="my-1.5 border border-slate-300 rounded-lg overflow-hidden bg-slate-50/50">
                                                <table className="w-full text-[10px] text-left border-collapse">
                                                    <thead className="bg-slate-200/80 font-bold text-slate-800 border-b border-slate-300">
                                                        <tr>
                                                            <th className="p-1 w-1/2">Column A</th>
                                                            <th className="p-1 w-1/2 border-l border-slate-300">Column B</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200 text-slate-700">
                                                        {pairs.map((pair, pIdx) => {
                                                            const leftText = pair.left || '';
                                                            const rightText = pair.right || '';
                                                            const roman = ['(i)', '(ii)', '(iii)', '(iv)', '(v)', '(vi)'][pIdx] || `(${pIdx + 1})`;
                                                            const letter = `(${String.fromCharCode(97 + pIdx)})`;
                                                            const hasLeftLabel = /^\s*(\([a-zA-Z0-9]+\)|[a-zA-Z0-9]+[\.\)])/.test(leftText);
                                                            const hasRightLabel = /^\s*(\([a-zA-Z0-9ivxLCDM]+\)|[a-zA-Z0-9ivxLCDM]+[\.\)])/i.test(rightText);

                                                            return (
                                                                <tr key={pIdx}>
                                                                    <td className="p-1 align-top">
                                                                        {!hasLeftLabel && <span className="font-bold text-slate-800 mr-1">{letter}</span>}
                                                                        <MathRenderer inline text={leftText} />
                                                                    </td>
                                                                    <td className="p-1 align-top border-l border-slate-300">
                                                                        {!hasRightLabel && <span className="font-bold text-slate-800 mr-1">{roman}</span>}
                                                                        <MathRenderer inline text={rightText} />
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    })()}

                                    {/* Explanation box */}
                                    <div className="bg-slate-50/80 border-l-3 border-navy p-1.5 rounded-r-lg text-slate-700 text-[11px] leading-relaxed">
                                        <span className="font-bold text-navy block text-[10px] uppercase tracking-wider mb-0.5">
                                            Explanation / Working:
                                        </span>
                                        <MathRenderer inline text={solText} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* End of Solution Guide Marker */}
                    <div className="mt-4 pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
                        <span>*** Complete Step-by-Step Solutions Guide ***</span>
                        <span>Official Solution Booklet</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Backward compatibility aliases
export const PrintableAnswerKey = A4AnswerKeySheet;
export const PrintableSolutionKey = A4SolutionKeySheet;

