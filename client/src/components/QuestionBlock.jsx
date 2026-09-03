/**
 * QuestionBlock.jsx
 *
 * Professional question block renderer adhering to standard A4 assessment typography:
 * - Bold question text ONLY.
 * - Options are normal font-weight (never bold unless explicitly part of LaTeX/text).
 * - Intelligent Diagram Placement:
 *     1. Side-by-Side (Left: Question + Options, Right: Diagram) when appropriate
 *     2. Inline (between statement and options)
 *     3. Full-width (for wide graphs / circuits)
 * - Zero overlap, no clipping, proper line spacing, KaTeX math/chem preservation.
 */
import React from 'react';
import MathRenderer from './MathRenderer';
import { parseMTFFromText } from './MatchTable';
import { optionLabel } from '../utils/sanitize';

// Dynamic option grid calculator based on length:
// - Very Short (<= 20 chars): all 4 in one line
// - Medium (<= 52 chars): 2 on left, 2 on right (2x2 grid)
// - Long (> 52 chars): 1 below one (vertical stack)
function getDynamicOptGrid(options = [], singleColMode = false) {
    if (!options || options.length === 0) return { display: 'none' };

    const maxLen = Math.max(...options.map(opt => {
        if (!opt) return 0;
        const plain = String(opt)
            .replace(/<[^>]+>/g, '')
            .replace(/\$\$[\s\S]*?\$\$/g, 'formula')
            .replace(/\$[^$]*\$/g, 'm')
            .replace(/\\\[[\s\S]*?\\\]/g, 'formula')
            .replace(/\\\([\s\S]*?\\\)/g, 'm')
            .trim();
        return plain.length;
    }));

    const hasComplexFormula = options.some(opt => {
        const str = String(opt || '');
        return str.includes('\\frac') || str.includes('\\sqrt') || str.includes('\\begin') || str.includes('\\sum') || str.includes('$$') || str.length > 80;
    });

    if (singleColMode) {
        // Two-column paper mode
        if (maxLen <= 12 && options.length <= 4 && !hasComplexFormula) {
            return {
                display: 'grid',
                gridTemplateColumns: `repeat(${options.length}, 1fr)`,
                gap: '2px 8px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }
        return {
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '2px 6px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    // In Single Column Paper Mode (~720px wide)
    if (options.length === 4 && maxLen <= 18 && !hasComplexFormula) {
        return {
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '2px 10px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }
    if (options.length === 4 && maxLen <= 45 && !hasComplexFormula) {
        return {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '2px 12px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }
    return {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '2px 6px',
        marginTop: '3px',
        alignItems: 'start',
    };
}

const Q = {
    wrap: {
        display: 'block',
        width: '100%',
        marginBottom: '0px',
        color: '#111',
        fontSize: 'inherit',
        lineHeight: '1.38',
        boxSizing: 'border-box',
        verticalAlign: 'top',
        fontWeight: 'normal',
        position: 'relative',
        zIndex: 1,
    },
    row: {
        display: 'flex',
        alignItems: 'flex-start',
        width: '100%',
    },
    num: {
        fontWeight: 700,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        minWidth: '22px',
        fontSize: '1em',
        lineHeight: '1.38',
        color: '#000',
    },
    body: {
        flex: 1,
        minWidth: 0,
        fontWeight: 'inherit',
        fontStyle: 'inherit',
        fontFamily: 'inherit',
    },
    qTextBold: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        color: '#000',
        display: 'inline',
        lineHeight: '1.38',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
    },
    marks: {
        fontWeight: 500,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        fontSize: '0.85em',
        alignSelf: 'flex-start',
        marginLeft: '6px',
        color: '#444',
    },
    optRow: {
        display: 'flex',
        alignItems: 'baseline',
        gap: '5px',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        minWidth: 0,
        fontSize: '1em',
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        color: '#111',
    },
    optLbl: {
        fontWeight: 700,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        minWidth: '22px',
        lineHeight: '1.45',
        color: '#111',
    },
    // Standardized diagram image wrapper with isolated per-question dimensions & adaptive ML scaling
    diagramImg: (q = {}, defaultMaxH = '200px', isTwoCol = false) => {
        const zoom = (typeof q === 'object' && q.diagramZoom) ? Number(q.diagramZoom) : 1;
        const baseH = (typeof q === 'object' && (q.diagramMaxHeight || q.diagramHeight))
            ? parseInt(q.diagramMaxHeight || q.diagramHeight, 10)
            : (typeof q === 'string' ? parseInt(q, 10) : (isTwoCol ? 190 : 220));
        
        const computedH = `${Math.round(baseH * zoom)}px`;
        const maxW = (typeof q === 'object' && q.diagramWidth) ? q.diagramWidth : '100%';
        const align = (typeof q === 'object' && q.diagramAlignment) ? q.diagramAlignment : 'center';
        const margin = align === 'left' ? '4px auto 4px 0' : align === 'right' ? '4px 0 4px auto' : '4px auto';

        return {
            display: 'block',
            maxWidth: maxW || '100%',
            minHeight: '80px',
            maxHeight: computedH,
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: '4px',
            backgroundColor: '#ffffff',
            boxSizing: 'border-box',
            margin: margin,
            position: 'relative',
            zIndex: 2,
        };
    },
    matchTable: {
        width: '100%',
        borderCollapse: 'collapse',
        margin: '4px 0 6px',
        fontSize: 'inherit',
        tableLayout: 'fixed',
        backgroundColor: '#ffffff',
        position: 'relative',
        zIndex: 2,
    },
    matchTh: {
        border: '1px solid #999',
        padding: '3px 6px',
        background: '#f5f5f5',
        fontWeight: 500,
        fontFamily: 'inherit',
        textAlign: 'left',
        width: '50%',
        color: '#111',
        fontSize: 'inherit',
    },
    matchTd: {
        border: '1px solid #999',
        padding: '3px 6px',
        verticalAlign: 'top',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        width: '50%',
        fontWeight: 400,
        fontFamily: 'inherit',
        color: '#111',
        fontSize: 'inherit',
    },
    assertRow: {
        display: 'flex',
        gap: '6px',
        marginBottom: '3px',
        alignItems: 'flex-start',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        fontFamily: 'inherit',
        fontSize: 'inherit',
    },
    assertLabel: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        color: '#000',
        fontSize: 'inherit',
    },
    assertText: {
        flex: 1,
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        color: '#111',
        fontSize: 'inherit',
    },
};

/** Standard 4 assertion-reason options (NEET/CET format) */
const AR_OPTIONS = [
    'Both Assertion and Reason are correct and Reason is the correct explanation of Assertion.',
    'Both Assertion and Reason are correct but Reason is not the correct explanation of Assertion.',
    'Assertion is correct but Reason is incorrect.',
    'Assertion is incorrect but Reason is correct.',
];

/** Parse assertion/reason from question text */
function parseAssertionReason(q) {
    if (q.assertion) return { assertion: q.assertion, reason: q.reason || '' };
    const txt = q.questionText || q.question || '';
    const aMatch = txt.match(/Assertion\s*(?:\(A\))?\s*[:\-]?\s*([\s\S]*?)(?=Reason\s*(?:\(R\))?|$)/i);
    const rMatch = txt.match(/Reason\s*(?:\(R\))?\s*[:\-]?\s*([\s\S]*)$/i);
    return {
        assertion: aMatch ? aMatch[1].trim() : txt,
        reason: rMatch ? rMatch[1].trim() : '',
    };
}

function cleanQuestionText(text) {
    if (!text) return '';
    // Strip redundant leading question numbers like "6. ", "Q6: ", "6) " that might be in raw database text
    return String(text).replace(/^(\s*(?:Q\.?\s*)?\d+[\.\)\-:]\s*)+/i, '').trim();
}

/**
 * Interactive & Print-Perfect Diagram Viewer with Zoom Controls (+ / -)
 */
function DiagramViewer({ q, imageUrl, diagramMaxHeight = '200px', isTwoCol = false }) {
    const [localZoom, setLocalZoom] = useState(q?.diagramZoom ? Number(q.diagramZoom) : 1);

    if (!imageUrl) return null;

    const handleZoomIn = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = Math.min(2.5, +(localZoom + 0.15).toFixed(2));
        setLocalZoom(next);
        if (q) q.diagramZoom = next;
    };

    const handleZoomOut = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = Math.max(0.5, +(localZoom - 0.15).toFixed(2));
        setLocalZoom(next);
        if (q) q.diagramZoom = next;
    };

    const handleReset = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setLocalZoom(1);
        if (q) q.diagramZoom = 1;
    };

    return (
        <div 
            className="diagram-container resizable-diagram-wrap group/diagram relative inline-block max-w-full" 
            style={{ 
                textAlign: q?.diagramAlignment || 'center', 
                margin: '4px auto', 
                background: '#ffffff', 
                position: 'relative', 
                zIndex: 2,
                display: 'block',
                clear: 'both',
                maxWidth: '100%',
            }}
        >
            <img
                src={imageUrl}
                alt="Question Diagram"
                style={Q.diagramImg({ ...q, diagramZoom: localZoom }, diagramMaxHeight, isTwoCol)}
                loading="lazy"
            />
            
            {/* Interactive Per-Diagram Zoom Bar: Always visible on screen, completely hidden during print/PDF */}
            <div className="no-print opacity-90 hover:opacity-100 transition-opacity absolute top-0.5 right-0.5 bg-navy/90 text-gold rounded-lg px-1.5 py-0.5 flex items-center gap-1 text-[10px] shadow-md border border-gold/40 z-20 select-none">
                <button
                    type="button"
                    onClick={handleZoomOut}
                    className="w-5 h-5 rounded bg-white/10 hover:bg-gold hover:text-navy text-gold flex items-center justify-center font-black cursor-pointer leading-none text-xs transition"
                    title="Zoom Out Diagram (−)"
                >
                    −
                </button>
                <span className="font-mono text-[9px] px-1 font-bold text-white">
                    {Math.round(localZoom * 100)}%
                </span>
                <button
                    type="button"
                    onClick={handleZoomIn}
                    className="w-5 h-5 rounded bg-white/10 hover:bg-gold hover:text-navy text-gold flex items-center justify-center font-black cursor-pointer leading-none text-xs transition"
                    title="Zoom In Diagram (+)"
                >
                    +
                </button>
                <button
                    type="button"
                    onClick={handleReset}
                    className="px-1 h-4 rounded bg-white/10 hover:bg-white/20 text-[8px] text-white/80 font-bold uppercase cursor-pointer"
                    title="Reset Diagram Zoom"
                >
                    Reset
                </button>
            </div>
        </div>
    );
}

/**
 * Intelligent Option Content Renderer: Supports text, formulas, and interactive option diagrams (+ / - zoom)
 */
function OptionContentRenderer({ opt, q, isTwoCol = false }) {
    const rawText = typeof opt === 'object' ? (opt.text || opt.optionText || '') : String(opt || '');
    
    // Check if option contains an image
    const imgMatch = rawText.match(/\{\{IMG::(.*?)\}\}/i) || rawText.match(/!\[.*?\]\((.*?)\)/i) || (rawText.startsWith('http') && rawText.match(/\.(png|jpg|jpeg|webp|svg)/i) ? [null, rawText] : null);

    if (imgMatch && imgMatch[1]) {
        const imgSrc = imgMatch[1];
        const textWithoutImg = rawText.replace(/\{\{IMG::.*?\}\}/gi, '').replace(/!\[.*?\]\(.*?\)/gi, '').trim();
        return (
            <div className="option-diagram-wrapper inline-block max-w-full">
                {textWithoutImg && <div className="mb-1"><MathRenderer inline text={textWithoutImg} /></div>}
                <DiagramViewer q={q} imageUrl={imgSrc} diagramMaxHeight="90px" isTwoCol={isTwoCol} />
            </div>
        );
    }

    return <MathRenderer inline text={rawText} />;
}

/**
 * MCQ Body with Clear Centered Diagram Placement & Uniform Typography
 */
function BodyMCQ({ q, classes, singleColMode, diagramMaxHeight = '180px', settings = null }) {
    const qText = cleanQuestionText(q.questionText || q.question || '');
    const imageUrl = q.imageUrl || q.image_url;
    const options = Array.isArray(q.options) ? q.options : [];

    // Render Options List
    const renderOptions = (forceSingle = false) => {
        if (options.length === 0) return null;
        return (
            <div style={forceSingle ? { display: 'grid', gridTemplateColumns: '1fr', gap: '2px 6px', marginTop: '3px' } : getDynamicOptGrid(options, singleColMode)}>
                {options.map((opt, i) => (
                    <div key={i} style={Q.optRow}>
                        <span style={Q.optLbl}>({optionLabel(i, classes, q, settings)})</span>
                        <span style={{ flex: 1, minWidth: 0, fontWeight: 400, fontStyle: 'normal', fontSize: 'inherit' }}>
                            <OptionContentRenderer opt={opt} q={q} isTwoCol={singleColMode} />
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    const mtfData = parseMTFFromText(qText);

    // Centered, clear, readable layout: Prompt -> Diagram (if present) -> Options
    return (
        <>
            <div style={Q.qTextBold}>
                <MathRenderer inline text={mtfData ? mtfData.stem : qText} />
            </div>

            {/* Sub-statements if present */}
            {q.statements && Array.isArray(q.statements) && q.statements.length > 0 && (
                <div style={{ borderLeft: '2px solid #555', paddingLeft: '8px', margin: '3px 0 4px' }}>
                    {q.statements.map((stmt, si) => (
                        <div key={si} style={{ marginBottom: '2px', fontWeight: 400, fontSize: 'inherit' }}>
                            <strong>Statement {si + 1}:</strong> <MathRenderer inline text={stmt} />
                        </div>
                    ))}
                </div>
            )}

            {/* Assertion & Reason if present on MCQ */}
            {q.assertion && (
                <div style={{ margin: '4px 0' }}>
                    <div style={Q.assertRow}>
                        <span style={Q.assertLabel}>Assertion (A):</span>
                        <span style={Q.assertText}><MathRenderer inline text={q.assertion} /></span>
                    </div>
                    {q.reason && (
                        <div style={Q.assertRow}>
                            <span style={Q.assertLabel}>Reason (R):</span>
                            <span style={Q.assertText}><MathRenderer inline text={q.reason} /></span>
                        </div>
                    )}
                </div>
            )}

            {/* Match pairs table if present on MCQ */}
            {q.matchPairs && Array.isArray(q.matchPairs) && q.matchPairs.length > 0 && (
                <table style={Q.matchTable}>
                    <thead>
                        <tr>
                            <th style={Q.matchTh}>Column I</th>
                            <th style={Q.matchTh}>Column II</th>
                        </tr>
                    </thead>
                    <tbody>
                        {q.matchPairs.map((pair, pi) => (
                            <tr key={pi}>
                                <td style={Q.matchTd}>
                                    <strong>({String.fromCharCode(65 + pi)})</strong>{' '}
                                    <MathRenderer inline text={pair.left || ''} />
                                </td>
                                <td style={Q.matchTd}>
                                    <strong>({pi + 1})</strong>{' '}
                                    <MathRenderer inline text={pair.right || ''} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Unstructured MTF parsed table */}
            {(!q.matchPairs || q.matchPairs.length === 0) && mtfData && (
                <table style={Q.matchTable}>
                    <thead>
                        <tr>
                            <th style={Q.matchTh}>{mtfData.col1Header}</th>
                            <th style={Q.matchTh}>{mtfData.col2Header}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: mtfData.maxRows }).map((_, rIdx) => (
                            <tr key={rIdx}>
                                <td style={Q.matchTd}>
                                    {mtfData.items1[rIdx] && (
                                        <>
                                            <strong>{mtfData.items1[rIdx].label}</strong>{' '}
                                            <MathRenderer inline text={mtfData.items1[rIdx].content} />
                                        </>
                                    )}
                                </td>
                                <td style={Q.matchTd}>
                                    {mtfData.items2[rIdx] && (
                                        <>
                                            <strong>{mtfData.items2[rIdx].label}</strong>{' '}
                                            <MathRenderer inline text={mtfData.items2[rIdx].content} />
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {imageUrl && (
                <DiagramViewer q={q} imageUrl={imageUrl} diagramMaxHeight={diagramMaxHeight} isTwoCol={singleColMode} />
            )}
            {renderOptions(false)}
        </>
    );
}

/**
 * Assertion & Reason Body
 */
function BodyAssertionReason({ q, classes, singleColMode, diagramMaxHeight, settings = null }) {
    const { assertion, reason } = parseAssertionReason(q);
    const opts = q.options && q.options.length > 0 ? q.options : AR_OPTIONS;
    const qText = cleanQuestionText(q.questionText || q.question || '');
    const imageUrl = q.imageUrl || q.image_url;

    return (
        <>
            {qText && !q.assertion && (
                <div style={{ ...Q.qTextBold, marginBottom: '3px' }}>
                    <MathRenderer inline text={qText} />
                </div>
            )}
            <div className="assert-row" data-assert-block="true" style={Q.assertRow}>
                <span style={Q.assertLabel}>Assertion (A):</span>
                <span style={Q.assertText}>
                    <MathRenderer inline text={assertion} />
                </span>
            </div>
            {reason && (
                <div className="assert-row" data-assert-block="true" style={Q.assertRow}>
                    <span style={Q.assertLabel}>Reason (R):</span>
                    <span style={Q.assertText}>
                        <MathRenderer inline text={reason} />
                    </span>
                </div>
            )}
            {imageUrl && (
                <DiagramViewer q={q} imageUrl={imageUrl} diagramMaxHeight={diagramMaxHeight} isTwoCol={singleColMode} />
            )}
            <div style={{ marginTop: '3px', ...getDynamicOptGrid(opts, singleColMode) }}>
                {opts.map((opt, i) => (
                    <div key={i} className="optRow option-item" data-option-row="true" style={{ ...Q.optRow, marginBottom: '1px' }}>
                        <span style={Q.optLbl}>({optionLabel(i, classes, q, settings)})</span>
                        <span style={{ flex: 1, minWidth: 0, fontWeight: 400, fontStyle: 'normal', fontSize: 'inherit' }}>
                            <OptionContentRenderer opt={opt} q={q} isTwoCol={singleColMode} />
                        </span>
                    </div>
                ))}
            </div>
        </>
    );
}

/**
 * Match the Following Body
 */
function BodyMatchFollowing({ q, classes, singleColMode, diagramMaxHeight, settings = null }) {
    const pairs = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0)
        ? q.matchPairs
        : (Array.isArray(q.column_a) && q.column_a.length > 0)
            ? q.column_a.map((left, pi) => ({ left, right: (q.column_b && q.column_b[pi]) || '' }))
            : (Array.isArray(q.columnA) && q.columnA.length > 0)
                ? q.columnA.map((left, pi) => ({ left, right: (q.columnB && q.columnB[pi]) || '' }))
                : [];

    const opts = (Array.isArray(q.options) && q.options.length > 0)
        ? q.options
        : (q.match_options && typeof q.match_options === 'object')
            ? ['A', 'B', 'C', 'D'].map(k => q.match_options[k]).filter(Boolean)
            : [];

    const qText = cleanQuestionText(q.questionText || q.question || '');
    const imageUrl = q.imageUrl || q.image_url;

    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: '3px' }}>
                    <MathRenderer inline text={qText} />
                </div>
            )}
            {imageUrl && (
                <DiagramViewer q={q} imageUrl={imageUrl} diagramMaxHeight={diagramMaxHeight} isTwoCol={singleColMode} />
            )}
            {pairs.length > 0 && (
                <table className="match-table" style={Q.matchTable}>
                    <thead>
                        <tr>
                            <th style={Q.matchTh}>Column A</th>
                            <th style={Q.matchTh}>Column B</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pairs.map((pair, pi) => {
                            const leftText = pair.left || '';
                            const rightText = pair.right || '';
                            const roman = ['(i)', '(ii)', '(iii)', '(iv)', '(v)', '(vi)'][pi] || `(${pi + 1})`;
                            const letter = `(${String.fromCharCode(97 + pi)})`; // (a), (b), (c)...
                            const hasLeftLabel = /^\s*(\([a-zA-Z0-9]+\)|[a-zA-Z0-9]+[\.\)])/.test(leftText);
                            const hasRightLabel = /^\s*(\([a-zA-Z0-9ivxLCDM]+\)|[a-zA-Z0-9ivxLCDM]+[\.\)])/i.test(rightText);

                            return (
                                <tr key={pi}>
                                    <td style={Q.matchTd}>
                                        {!hasLeftLabel && <span style={{ fontWeight: 500, marginRight: '4px' }}>{letter}</span>}
                                        <MathRenderer inline text={leftText} />
                                    </td>
                                    <td style={Q.matchTd}>
                                        {!hasRightLabel && <span style={{ fontWeight: 500, marginRight: '4px' }}>{roman}</span>}
                                        <MathRenderer inline text={rightText} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
            {opts.length > 0 && (
                <div style={getDynamicOptGrid(opts, singleColMode)}>
                    {opts.map((opt, i) => (
                        <div key={i} className="optRow option-item" data-option-row="true" style={{ ...Q.optRow, marginBottom: '1px' }}>
                            <span style={Q.optLbl}>({optionLabel(i, classes, q, settings)})</span>
                            <span style={{ flex: 1, minWidth: 0, fontWeight: 400, fontStyle: 'normal', fontSize: 'inherit' }}>
                                <OptionContentRenderer opt={opt} q={q} isTwoCol={singleColMode} />
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

/**
 * Statement-Based Body
 */
function BodyStatementBased({ q, classes, singleColMode, diagramMaxHeight, settings = null }) {
    const statements = q.statements || [];
    const opts = q.options || [];
    const qText = cleanQuestionText(q.questionText || q.question || '');
    const imageUrl = q.imageUrl || q.image_url;

    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: '3px' }}>
                    <MathRenderer inline text={qText} />
                </div>
            )}
            {statements.length > 0 && (
                <div style={{ borderLeft: '2px solid #888', paddingLeft: '8px', margin: '3px 0 4px' }}>
                    {statements.map((stmt, si) => (
                        <div key={si} style={{ marginBottom: '2px', fontWeight: 400, fontSize: 'inherit' }}>
                            <span style={{ fontWeight: 500 }}>Statement {si + 1}:</span> <MathRenderer inline text={stmt} />
                        </div>
                    ))}
                </div>
            )}
            {imageUrl && (
                <DiagramViewer q={q} imageUrl={imageUrl} diagramMaxHeight={diagramMaxHeight} isTwoCol={singleColMode} />
            )}
            {opts.length > 0 && (
                <div style={getDynamicOptGrid(opts, singleColMode)}>
                    {opts.map((opt, i) => (
                        <div key={i} className="optRow option-item" data-option-row="true" style={{ ...Q.optRow, marginBottom: '1px' }}>
                            <span style={Q.optLbl}>({optionLabel(i, classes, q, settings)})</span>
                            <span style={{ flex: 1, minWidth: 0, fontWeight: 400, fontStyle: 'normal', fontSize: 'inherit' }}>
                                <OptionContentRenderer opt={opt} q={q} isTwoCol={singleColMode} />
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

/**
 * Main QuestionBlock Component
 */
export default function QuestionBlock({
    q,
    displayNum = 1,
    classes = [],
    showMarks = false,
    singleColMode = false,
    fontSize = '13px',
    lineHeight = '1.45',
    formatMarks,
    extraStyle = {},
    diagramMaxHeight = '150px',
    settings = null,
}) {
    if (!q) return null;

    const qType = (q.type || q.q_type || 'MCQ').toUpperCase();
    const effectiveFontSize = q.fontSize || fontSize || '13px';
    const effectiveFontWeight = q.fontWeight || 'normal';
    const effectiveFontStyle = q.fontStyle || 'normal';
    const effectiveFontFamily = q.fontFamily || 'inherit';

    const renderBody = () => {
        if (qType.includes('ASSERTION')) {
            return (
                <BodyAssertionReason
                    q={q}
                    classes={classes}
                    singleColMode={singleColMode}
                    diagramMaxHeight={diagramMaxHeight}
                    settings={settings}
                />
            );
        }
        if (qType.includes('MATCH')) {
            return (
                <BodyMatchFollowing
                    q={q}
                    classes={classes}
                    singleColMode={singleColMode}
                    diagramMaxHeight={diagramMaxHeight}
                    settings={settings}
                />
            );
        }
        if (qType.includes('STATEMENT') || qType.includes('MULTIPLE_STATEMENT')) {
            return (
                <BodyStatementBased
                    q={q}
                    classes={classes}
                    singleColMode={singleColMode}
                    diagramMaxHeight={diagramMaxHeight}
                    settings={settings}
                />
            );
        }
        // Default MCQ & Diagram-Based
        return (
            <BodyMCQ
                q={q}
                classes={classes}
                singleColMode={singleColMode}
                diagramMaxHeight={diagramMaxHeight}
                settings={settings}
            />
        );
    };

    return (
        <div
            style={{
                ...Q.wrap,
                fontSize: effectiveFontSize,
                fontWeight: effectiveFontWeight,
                fontStyle: effectiveFontStyle,
                fontFamily: effectiveFontFamily,
                lineHeight,
                ...extraStyle
            }}
            className="question-block"
        >
            <div style={Q.row}>
                <span style={Q.num}>{displayNum}.</span>
                <div style={Q.body}>{renderBody()}</div>
                {showMarks && formatMarks && (
                    <span style={Q.marks}>[{formatMarks(q.type, classes)}]</span>
                )}
            </div>
        </div>
    );
}
