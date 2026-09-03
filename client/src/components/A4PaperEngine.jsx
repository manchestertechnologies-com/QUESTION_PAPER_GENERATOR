/**
 * A4PaperEngine.jsx
 *
 * Professional High-Fidelity A4 Assessment & Assignment Engine
 *
 * Provides:
 *  - 100% Continuous Flow-Based Layout with Zero Space Wastage
 *  - Native @media print pagination with break-inside: avoid on questions
 *  - Single-Column & Double-Column (NEET/CET/JEE Exam standard) layouts
 *  - True Non-Flow Background Watermark Layer (position: absolute/fixed, z-index: 0)
 *  - Zoom & View controls
 */
import React, { useMemo } from 'react';
import QuestionBlock from './QuestionBlock';
import { InstructionCoverPage, PaperHeader, formatMarks, calcTotal } from './PaperRenderer';

export default function A4PaperEngine({
    paper,
    activeTemplate,
    isAssignment = false,
    settings,
    currentPage = 1,
    onPageChange,
    zoom = 100,
    fitMode = 'actual',
    singlePageMode = false,
}) {
    const questions = useMemo(() => paper?.questions || [], [paper]);
    const classes = useMemo(() => paper?.classes || [], [paper]);
    const totalMarks = useMemo(() => {
        if (paper?.pattern?.length) return paper.pattern.reduce((s, sec) => s + (sec.marks || 0), 0);
        return calcTotal(questions, classes);
    }, [paper, questions, classes]);

    const isAssignmentPaper = isAssignment || paper?.category === 'assignment' || (paper?.title && /assignment/i.test(paper.title));
    const startQNo = settings.startQNo || 1;
    const endQNo = settings.endQNo ?? (startQNo + questions.length - 1);
    const visibleCount = Math.max(0, endQNo - startQNo + 1);
    const visibleQuestions = useMemo(() => questions.slice(0, visibleCount), [questions, visibleCount]);

    const zoomScale = (zoom || 100) / 100;
    const isTwoCol = settings.columns === 2;
    const watermarkText = activeTemplate?.watermarkText || settings?.watermarkText || paper?.watermarkText || '';

    return (
        <div className="a4-engine-wrapper" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* ── Document Container ── */}
            <div
                className="a4-print-document"
                style={{
                    transform: zoomScale !== 1 ? `scale(${zoomScale})` : 'none',
                    transformOrigin: 'top center',
                    transition: 'transform 0.2s ease',
                    marginBottom: zoomScale !== 1 ? `${(zoomScale - 1) * 900}px` : '0px',
                    width: '794px',
                    maxWidth: '100%',
                }}
            >
                {/* ── Unified Flow Question Paper Sheet ── */}
                <div className="a4-sheet-page a4-questions-page">
                    
                    {/* True Background Watermark Layer (Independent of Document Flow) */}
                    {watermarkText && (
                        <div className="a4-watermark-layer">
                            <div className="a4-watermark-text">
                                {watermarkText}
                            </div>
                        </div>
                    )}

                    <div
                        className="a4-page-content"
                        style={{
                            fontFamily: settings.fontFamily,
                            fontSize: settings.fontSize,
                            lineHeight: settings.lineHeight,
                            position: 'relative',
                            zIndex: 1,
                        }}
                    >
                        {/* Primary Header at top of Page 1 */}
                        <div className="a4-primary-header-wrap">
                            <PaperHeader
                                title={paper?.title}
                                subject={paper?.subject}
                                classes={classes}
                                duration={paper?.duration}
                                totalMarks={totalMarks}
                                templateUrl={activeTemplate?.fileUrl}
                                isAssignment={isAssignment}
                            />
                        </div>

                        {/* ── Questions Flow (1 Column or 2 Columns) ── */}
                        <div
                            className="a4-questions-flow"
                            style={isTwoCol ? {
                                columnCount: 2,
                                columnGap: settings.columnGap || '18px',
                                columnRule: '1px solid #e5e7eb',
                                columnFill: 'balance',
                            } : {}}
                        >
                            {visibleQuestions.map((q, idx) => {
                                const displayNum = startQNo + idx;
                                return (
                                    <div
                                        key={q._id || displayNum}
                                        className="question-print-item"
                                        style={{
                                            marginBottom: settings.questionSpacing || '8px',
                                        }}
                                    >
                                        <QuestionBlock
                                            q={q}
                                            displayNum={displayNum}
                                            classes={classes}
                                            showMarks={settings.showMarks}
                                            singleColMode={isTwoCol}
                                            fontSize={settings.fontSize}
                                            lineHeight={settings.lineHeight}
                                            formatMarks={formatMarks}
                                            extraStyle={{ marginBottom: '0px' }}
                                            diagramMaxHeight={settings.diagramMaxHeight}
                                            settings={settings}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* End of Paper Marker */}
                        <div className="a4-end-paper-marker">
                            *** End of {paper?.title || (isAssignment ? 'Assignment' : 'Question Paper')} ***
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CSS STYLES FOR ON-SCREEN AND PRINT ── */}
            <style>{`
                .a4-sheet-page {
                    width: 794px;
                    min-height: 1123px;
                    background: #ffffff;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
                    border: 1px solid #e2e8f0;
                    margin: 0 auto 28px auto;
                    box-sizing: border-box;
                    position: relative;
                    overflow: hidden;
                }
                .a4-watermark-layer,
                .pdf-watermark-layer {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                    user-select: none;
                    z-index: 0;
                    overflow: hidden;
                    opacity: 0.045;
                    filter: grayscale(100%);
                    transform: rotate(-30deg) scale(0.85);
                }
                .a4-watermark-text {
                    font-size: 5rem;
                    font-weight: 900;
                    color: rgba(0, 0, 0, 0.9);
                    text-transform: uppercase;
                    letter-spacing: 0.18em;
                    white-space: nowrap;
                    text-align: center;
                    line-height: 1;
                }
                .a4-cover-page {
                    page-break-after: always;
                    break-after: page;
                    margin-bottom: 32px;
                }
                .a4-page-content {
                    padding: ${settings.marginTop || '8mm'} ${settings.marginRight || '10mm'} ${settings.marginBottom || '8mm'} ${settings.marginLeft || '10mm'};
                    box-sizing: border-box;
                    color: #000000;
                    position: relative;
                    z-index: 1;
                }
                .a4-end-paper-marker {
                    text-align: center;
                    font-weight: 700;
                    font-size: 11px;
                    padding: 5px 0;
                    border-top: 1px solid #cbd5e1;
                    margin-top: 8px;
                    break-inside: avoid;
                    page-break-inside: avoid;
                    color: #475569;
                }
                /* Dynamic fluid flow for questions */
                .question-print-item {
                    display: block !important;
                    width: 100% !important;
                    break-inside: auto !important;
                    page-break-inside: auto !important;
                    -webkit-column-break-inside: auto !important;
                    orphans: 2;
                    widows: 2;
                    vertical-align: top;
                    box-sizing: border-box;
                    position: relative;
                    z-index: 1;
                }
                /* Atomic sub-elements protection against page slicing */
                .optRow,
                .option-item,
                [data-option-row],
                .assert-row,
                [data-assert-block],
                .match-table,
                tr,
                thead,
                tbody,
                .diagram-container,
                .resizable-diagram-wrap,
                .katex-display {
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                    -webkit-column-break-inside: avoid !important;
                }
                .diagram-container,
                .resizable-diagram-wrap,
                .match-table {
                    background: #ffffff !important;
                    position: relative !important;
                    z-index: 2 !important;
                }
                .math-renderer {
                    display: inline !important;
                }
                .katex-display {
                    display: inline-block !important;
                    overflow-x: auto !important;
                    overflow-y: hidden !important;
                    max-width: 100% !important;
                    margin: 1px 4px !important;
                    text-align: left !important;
                    vertical-align: middle !important;
                }
                .katex-display > .katex {
                    text-align: left !important;
                }
                .katex {
                    text-rendering: auto !important;
                    font-size: 1.0em !important;
                }

                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 8mm 10mm 8mm 10mm;
                    }
                    html, body {
                        background: #fff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                    }

                    .no-print,
                    .no-print * {
                        display: none !important;
                    }

                    body * {
                        visibility: hidden;
                    }

                    .a4-print-document,
                    .a4-print-document * {
                        visibility: visible !important;
                    }

                    .a4-print-document {
                        position: static !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        transform: none !important;
                    }

                    .a4-sheet-page {
                        box-shadow: none !important;
                        border: none !important;
                        margin: 0 auto !important;
                        width: 100% !important;
                        min-height: auto !important;
                        background: transparent !important;
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }

                    .a4-watermark-layer,
                    .pdf-watermark-layer {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100vw !important;
                        height: 100vh !important;
                        z-index: 0 !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        opacity: 0.045 !important;
                        filter: grayscale(100%) !important;
                        transform: rotate(-30deg) scale(0.85) !important;
                        pointer-events: none !important;
                    }

                    .a4-page-content {
                        padding: 0 !important;
                    }
                    .question-print-item {
                        display: block !important;
                        width: 100% !important;
                        break-inside: auto !important;
                        page-break-inside: auto !important;
                        -webkit-column-break-inside: auto !important;
                        orphans: 2 !important;
                        widows: 2 !important;
                    }
                    .optRow,
                    .option-item,
                    [data-option-row],
                    .assert-row,
                    [data-assert-block],
                    .match-table,
                    tr,
                    thead,
                    tbody,
                    .diagram-container,
                    .resizable-diagram-wrap,
                    .katex-display {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        -webkit-column-break-inside: avoid !important;
                    }
                }
            `}</style>
        </div>
    );
}
