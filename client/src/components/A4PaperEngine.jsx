/**
 * A4PaperEngine.jsx
 *
 * True A4 Paginated Rendering Engine
 *
 * Splits question papers into discrete, authentic A4 pages (210mm × 297mm),
 * computing smart page breaks so questions never break awkwardly across pages.
 *
 * Provides:
 *  - Page-by-Page navigation (Page X of Y)
 *  - Zoom & Fit-to-screen controls
 *  - Running institutional headers & page numbered footers
 *  - Identical rendering between screen and @media print PDF
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import QuestionBlock from './QuestionBlock';
import { InstructionCoverPage, PaperHeader, formatMarks, calcTotal } from './PaperRenderer';

// Standard A4 physical dimensions in standard web print points / mm
// Standard A4 physical dimensions in standard web print points / mm
// Standard A4 printable height estimates (in px)
// A4 is 297mm tall (~1123px at 96 DPI).
// Usable content height after padding (12mm top/bottom) & footer: ~920px
const USABLE_PAGE_HEIGHT_1COL = 900;
const USABLE_PAGE_HEIGHT_2COL = 1750;
const HEADER_OFFSET_PAGE1 = 120; // Height consumed by primary PaperHeader on Page 1 when no cover page

/**
 * Estimate question height in pixels for smart pagination
 */
function estimateQuestionHeight(q, isTwoCol = false) {
    let h = 24; // Base question statement + numbering
    const textLen = (q.questionText || q.question || '').length;
    h += Math.ceil(textLen / (isTwoCol ? 45 : 90)) * 17;

    // Diagram height
    if (q.imageUrl || q.image_url) {
        h += 105;
    }

    // Options height
    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length > 0) {
        const maxOptLen = options.reduce((m, o) => Math.max(m, String(o || '').length), 0);
        if (isTwoCol) {
            if (maxOptLen <= 22) {
                h += Math.ceil(options.length / 2) * 18; // 2x2 grid
            } else {
                h += options.length * 18; // 1 column
            }
        } else {
            if (maxOptLen <= 22 && options.length <= 4) {
                h += 20; // 4 in a single horizontal row
            } else if (maxOptLen <= 50 && options.length <= 4) {
                h += 38; // 2x2 grid
            } else {
                h += options.length * 18; // 1 column per option
            }
        }
    }

    // Statements / match table
    if (q.matchPairs?.length) h += q.matchPairs.length * 20;
    if (q.statements?.length) h += q.statements.length * 16;

    return Math.max(42, h + 8); // + question margin
}

/**
 * Greedy Full-Capacity Question Paginator:
 * Fills each page up to its standard printable capacity without artificial early cuts,
 * preventing large blank spaces while ensuring questions don't overflow page boundaries.
 */
export function paginateQuestions(questions, { showCover = true, columns = 1, startQNo = 1 }) {
    if (!Array.isArray(questions) || questions.length === 0) return [];

    const isTwoCol = columns === 2;
    const standardMaxHeight = isTwoCol ? USABLE_PAGE_HEIGHT_2COL : USABLE_PAGE_HEIGHT_1COL;
    const page1MaxHeight = showCover ? standardMaxHeight : (standardMaxHeight - (isTwoCol ? HEADER_OFFSET_PAGE1 * 2 : HEADER_OFFSET_PAGE1));

    const pages = [];
    let currentPageQuestions = [];
    let currentHeight = 0;

    questions.forEach((q, idx) => {
        const qHeight = estimateQuestionHeight(q, isTwoCol);
        const effectiveQNum = startQNo + idx;
        const currentLimit = pages.length === 0 ? page1MaxHeight : standardMaxHeight;

        // Check if question exceeds the current page's usable printable capacity
        const isOverflow = currentPageQuestions.length > 0 && (currentHeight + qHeight > currentLimit);

        if (isOverflow) {
            pages.push({
                pageIndex: pages.length + (showCover ? 2 : 1),
                questions: currentPageQuestions,
            });
            currentPageQuestions = [{ question: q, displayNum: effectiveQNum }];
            currentHeight = qHeight;
        } else {
            currentPageQuestions.push({ question: q, displayNum: effectiveQNum });
            currentHeight += qHeight;
        }
    });

    if (currentPageQuestions.length > 0) {
        pages.push({
            pageIndex: pages.length + (showCover ? 2 : 1),
            questions: currentPageQuestions,
        });
    }

    return pages;
}

export default function A4PaperEngine({
    paper,
    activeTemplate,
    isAssignment = false,
    settings,
    currentPage = 1,
    onPageChange,
    zoom = 100,
    fitMode = 'actual',
    singlePageMode = false, // If true, displays only currentPage in preview; if false, renders all pages vertically
}) {
    const questions = useMemo(() => paper?.questions || [], [paper]);
    const classes = useMemo(() => paper?.classes || [], [paper]);
    const totalMarks = useMemo(() => {
        if (paper?.pattern?.length) return paper.pattern.reduce((s, sec) => s + (sec.marks || 0), 0);
        return calcTotal(questions, classes);
    }, [paper, questions, classes]);

    const showCover = !isAssignment && settings.showCoverPage !== false;
    const startQNo = settings.startQNo || 1;
    const endQNo = settings.endQNo ?? (startQNo + questions.length - 1);
    const visibleCount = Math.max(0, endQNo - startQNo + 1);
    const visibleQuestions = useMemo(() => questions.slice(0, visibleCount), [questions, visibleCount]);

    // Paginate questions
    const questionPages = useMemo(() => {
        return paginateQuestions(visibleQuestions, {
            showCover,
            columns: settings.columns || 1,
            startQNo,
        });
    }, [visibleQuestions, showCover, settings.columns, startQNo]);

    const totalPages = (showCover ? 1 : 0) + (questionPages.length || 1);

    // Zoom transform styling
    const zoomScale = zoom / 100;

    return (
        <div className="a4-engine-wrapper" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* Render Pages */}
            <div
                className="a4-pages-container"
                style={{
                    transform: zoomScale !== 1 ? `scale(${zoomScale})` : 'none',
                    transformOrigin: 'top center',
                    transition: 'transform 0.2s ease',
                    marginBottom: zoomScale !== 1 ? `${(zoomScale - 1) * 800}px` : '0px',
                }}
            >
                {/* ── Page 1: Instructions Cover Page (if enabled) ── */}
                {showCover && (!singlePageMode || currentPage === 1) && (
                    <div className="a4-page-sheet" data-page="1">
                        <div className="a4-page-inner" style={{ fontFamily: settings.fontFamily, fontSize: settings.fontSize }}>
                            {/* Page 1 Header */}
                            <PaperHeader
                                title={paper?.title}
                                subject={paper?.subject}
                                classes={classes}
                                duration={paper?.duration}
                                totalMarks={totalMarks}
                                templateUrl={activeTemplate?.fileUrl}
                                isAssignment={isAssignment}
                            />

                            <InstructionCoverPage
                                paper={paper}
                                questions={visibleQuestions}
                                duration={paper?.duration}
                                totalMarks={totalMarks}
                                classes={classes}
                            />

                            {/* Page Footer */}
                            <div className="a4-page-footer">
                                <span>{paper?.title || 'Question Paper'}</span>
                                <span className="font-bold">Page 1 of {totalPages}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Question Pages ── */}
                {questionPages.map((pageObj, pIdx) => {
                    const actualPageNumber = showCover ? pIdx + 2 : pIdx + 1;
                    if (singlePageMode && currentPage !== actualPageNumber) {
                        return null;
                    }

                    const isLastPage = pIdx === questionPages.length - 1;
                    const isFirstQuestionPage = pIdx === 0;

                    return (
                        <div key={pIdx} className="a4-page-sheet" data-page={actualPageNumber}>
                            <div
                                className="a4-page-inner"
                                style={{
                                    fontFamily: settings.fontFamily,
                                    fontSize: settings.fontSize,
                                    lineHeight: settings.lineHeight,
                                }}
                            >
                                {/* If no cover page, render full header on Page 1 */}
                                {!showCover && isFirstQuestionPage && (
                                    <PaperHeader
                                        title={paper?.title}
                                        subject={paper?.subject}
                                        classes={classes}
                                        duration={paper?.duration}
                                        totalMarks={totalMarks}
                                        templateUrl={activeTemplate?.fileUrl}
                                        isAssignment={isAssignment}
                                    />
                                )}

                                {/* Running Header for subsequent pages */}
                                {(showCover || !isFirstQuestionPage) && (
                                    <div className="a4-running-header">
                                        <span className="font-bold text-xs uppercase text-gray-800 tracking-wider">
                                            {paper?.title || paper?.subject || 'Question Paper'}
                                        </span>
                                        {paper?.setName && (
                                            <span className="font-bold text-[11px] bg-black text-white px-2 py-0.5 rounded">
                                                SET {paper.setName}
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-600 font-semibold">
                                            Max. Marks: {totalMarks}
                                        </span>
                                    </div>
                                )}

                                {/* Questions Content */}
                                <div
                                    className="a4-questions-body"
                                    style={{
                                        display: settings.columns === 2 ? 'flex' : 'block',
                                        gap: settings.columnGap || '20px',
                                    }}
                                >
                                    {settings.columns === 2 ? (
                                        <>
                                            {/* Column 1 */}
                                            <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid #e0e0e0', paddingRight: '12px' }}>
                                                {pageObj.questions.slice(0, Math.ceil(pageObj.questions.length / 2)).map(({ question, displayNum }) => (
                                                    <QuestionBlock
                                                        key={question._id || displayNum}
                                                        q={question}
                                                        displayNum={displayNum}
                                                        classes={classes}
                                                        showMarks={settings.showMarks}
                                                        singleColMode={true}
                                                        fontSize={settings.fontSize}
                                                        lineHeight={settings.lineHeight}
                                                        formatMarks={formatMarks}
                                                        extraStyle={{ marginBottom: settings.questionSpacing }}
                                                        diagramMaxHeight={settings.diagramMaxHeight}
                                                    />
                                                ))}
                                            </div>
                                            {/* Column 2 */}
                                            <div style={{ flex: 1, minWidth: 0, paddingLeft: '4px' }}>
                                                {pageObj.questions.slice(Math.ceil(pageObj.questions.length / 2)).map(({ question, displayNum }) => (
                                                    <QuestionBlock
                                                        key={question._id || displayNum}
                                                        q={question}
                                                        displayNum={displayNum}
                                                        classes={classes}
                                                        showMarks={settings.showMarks}
                                                        singleColMode={true}
                                                        fontSize={settings.fontSize}
                                                        lineHeight={settings.lineHeight}
                                                        formatMarks={formatMarks}
                                                        extraStyle={{ marginBottom: settings.questionSpacing }}
                                                        diagramMaxHeight={settings.diagramMaxHeight}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        pageObj.questions.map(({ question, displayNum }) => (
                                            <QuestionBlock
                                                key={question._id || displayNum}
                                                q={question}
                                                displayNum={displayNum}
                                                classes={classes}
                                                showMarks={settings.showMarks}
                                                singleColMode={false}
                                                fontSize={settings.fontSize}
                                                lineHeight={settings.lineHeight}
                                                formatMarks={formatMarks}
                                                extraStyle={{ marginBottom: settings.questionSpacing }}
                                                diagramMaxHeight={settings.diagramMaxHeight}
                                            />
                                        ))
                                    )}
                                </div>

                                {/* End of Paper Marker */}
                                {isLastPage && (
                                    <div className="a4-end-paper-marker">
                                        *** End of Question Paper ***
                                    </div>
                                )}

                                {/* Running Footer with Page Numbers */}
                                <div className="a4-page-footer">
                                    <span>{paper?.subject || paper?.title || 'Question Paper'}</span>
                                    <span className="font-bold">Page {actualPageNumber} of {totalPages}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* A4 Sheet CSS styling */}
            <style>{`
                .a4-page-sheet {
                    width: 794px;
                    min-height: 1123px;
                    height: 1123px;
                    background: #ffffff;
                    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
                    border: 1px solid #e2e8f0;
                    margin: 0 auto 32px auto;
                    box-sizing: border-box;
                    position: relative;
                    page-break-after: always;
                    break-after: page;
                    overflow: hidden;
                }
                .a4-page-inner {
                    padding: ${settings.marginTop || '12mm'} ${settings.marginRight || '14mm'} ${settings.marginBottom || '12mm'} ${settings.marginLeft || '14mm'};
                    height: 100%;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    justifyContent: flex-start;
                }
                .a4-questions-body {
                    flex: 1;
                    min-height: 0;
                    overflow: hidden;
                }
                .a4-running-header {
                    display: flex;
                    justifyContent: space-between;
                    align-items: center;
                    border-bottom: 1.5px solid #000;
                    padding-bottom: 4px;
                    margin-bottom: 10px;
                }
                .a4-page-footer {
                    margin-top: auto;
                    display: flex;
                    justifyContent: space-between;
                    align-items: center;
                    border-top: 1.5px solid #000;
                    padding-top: 5px;
                    font-size: 11px;
                    color: #222;
                }
                .a4-end-paper-marker {
                    text-align: center;
                    font-weight: 700;
                    font-size: 12px;
                    padding: 6px 0;
                    border-top: 1px solid #ccc;
                    margin-top: 8px;
                }

                @media print {
                    body * { visibility: hidden !important; }
                    .a4-engine-wrapper, .a4-engine-wrapper * { visibility: visible !important; }
                    .a4-engine-wrapper {
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .a4-pages-container {
                        transform: none !important;
                        margin-bottom: 0 !important;
                    }
                    .a4-page-sheet {
                        box-shadow: none !important;
                        border: none !important;
                        margin: 0 !important;
                        width: 100% !important;
                        height: 296mm !important;
                        min-height: 296mm !important;
                        max-height: 296mm !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .no-print { display: none !important; }
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                }
            `}</style>
        </div>
    );
}
