/**
 * QuestionBlock.jsx
 * Renders any question type with proper professional formatting.
 * Shared by PaperRenderer, AssignmentGenerator, and all preview/print contexts.
 * 
 * Supported types:
 *   MCQ, ASSERTION_REASON, MATCH_FOLLOWING, STATEMENT_BASED,
 *   NUMERICAL, DIAGRAM_BASED, TRUE_FALSE, CASE_STUDY, PASSAGE,
 *   FILL_BLANK, MULTIPLE_STATEMENT, IMAGE_BASED, and legacy types.
 */
import React from 'react';
import MathRenderer from './MathRenderer';
import { optionLabel } from '../utils/sanitize';

// ─── Shared styles ──────────────────────────────────────────────────────────
const Q = {
    wrap: {
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
        marginBottom: '14px',
        color: '#111',
    },
    row: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '6px',
    },
    num: {
        fontWeight: 700,
        whiteSpace: 'nowrap',
        minWidth: '26px',
        fontSize: '1em',
        lineHeight: '1.5',
    },
    body: { flex: 1, minWidth: 0 },
    marks: {
        fontWeight: 700,
        whiteSpace: 'nowrap',
        fontSize: '0.85em',
        alignSelf: 'flex-start',
        marginLeft: '6px',
    },
    optGrid: (count, singleCol, hasImages = false) => ({
        display: 'grid',
        gridTemplateColumns: singleCol ? '1fr' : (hasImages ? 'repeat(auto-fit, minmax(140px, 1fr))' : (count <= 2 ? '1fr 1fr' : (count <= 4 ? 'repeat(auto-fit, minmax(120px, 1fr))' : '1fr'))),
        gap: hasImages ? '8px 16px' : '3px 16px',
        marginTop: '6px',
        marginLeft: '2px',
        maxWidth: '100%',
        alignItems: 'center',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
    }),
    optRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        minWidth: 0,
    },
    optLbl: { fontWeight: 700, whiteSpace: 'nowrap', minWidth: '22px', lineHeight: '1.5' },
    img: {
        display: 'block',
        maxWidth: '240px',
        maxHeight: '120px',
        objectFit: 'contain',
        margin: '6px auto',
        borderRadius: '4px',
    },
    assertLabel: { fontWeight: 700, minWidth: 0 },
    assertRow: {
        display: 'flex',
        gap: '6px',
        marginBottom: '5px',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
    },
    matchTable: {
        width: '100%',
        borderCollapse: 'collapse',
        margin: '8px 0 10px',
        fontSize: '0.93em',
        tableLayout: 'fixed',
    },
    matchTh: {
        border: '1px solid #bbb',
        padding: '4px 8px',
        background: '#f5f5f5',
        fontWeight: 700,
        textAlign: 'left',
        width: '50%',
    },
    matchTd: {
        border: '1px solid #bbb',
        padding: '4px 8px',
        verticalAlign: 'top',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        width: '50%',
    },
    stmtBar: {
        borderLeft: '3px solid #999',
        paddingLeft: '10px',
        margin: '5px 0 7px',
    },
    stmtRow: {
        marginBottom: '3px',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
    },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Smart option grid — forces single column in 2-col paper mode or when options are long */
function optGridStyle(options, singleColMode = false) {
    if (!options || options.length === 0) return Q.optGrid(1, true);
    const hasImages = options.some(o => typeof o === 'string' && (o.includes('<img') || o.includes('{{IMG::') || o.includes('data:image') || o.includes('.png') || o.includes('.jpg')));
    const avgLen = options.reduce((s, o) => s + (o || '').replace(/\$[^$]+\$/g, 'xxx').length, 0) / options.length;
    const forceOne = singleColMode || (avgLen > 30 && !hasImages) || options.length > 4;
    return Q.optGrid(options.length, forceOne, hasImages);
}

/** Parse assertion/reason from question text if stored as a single string */
function parseAssertionReason(q) {
    if (q.assertion) return { assertion: q.assertion, reason: q.reason || '' };
    const txt = q.questionText || '';
    const aMatch = txt.match(/Assertion\s*(?:\(A\))?\s*[:\-]?\s*([\s\S]*?)(?=Reason\s*(?:\(R\))?|$)/i);
    const rMatch = txt.match(/Reason\s*(?:\(R\))?\s*[:\-]?\s*([\s\S]*)$/i);
    return {
        assertion: aMatch ? aMatch[1].trim() : txt,
        reason: rMatch ? rMatch[1].trim() : '',
    };
}

/** Standard 4 assertion-reason options (NEET/CET numbering) */
const AR_OPTIONS = [
    'Both Assertion and Reason are correct and Reason is the correct explanation of Assertion.',
    'Both Assertion and Reason are correct but Reason is not the correct explanation of Assertion.',
    'Assertion is correct but Reason is incorrect.',
    'Assertion is incorrect but Reason is correct.',
];

// ─── Type Renderers ──────────────────────────────────────────────────────────

function BodyMCQ({ q, classes, singleColMode }) {
    return (
        <>
            <MathRenderer style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }} text={q.questionText} />
            {q.imageUrl && (
                <img src={q.imageUrl} alt="Diagram" style={{ ...Q.img, maxHeight: '160px' }} />
            )}
            {q.options && q.options.length > 0 && (
                <div style={optGridStyle(q.options, singleColMode)}>
                    {q.options.map((opt, i) => (
                        <div key={i} style={Q.optRow}>
                            <span style={Q.optLbl}>{optionLabel(i, classes)})</span>
                            <span style={{ flex: 1, minWidth: 0 }}><MathRenderer inline text={opt} /></span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

function BodyAssertionReason({ q, classes, singleColMode }) {
    const { assertion, reason } = parseAssertionReason(q);
    const opts = q.options && q.options.length > 0 ? q.options : AR_OPTIONS;
    return (
        <>
            {q.questionText && !q.assertion && (
                <MathRenderer style={{ marginBottom: '6px', wordBreak: 'break-word' }} text={q.questionText} />
            )}
            <div style={Q.assertRow}>
                <strong style={Q.assertLabel}>Assertion (A):</strong>
                <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                    <MathRenderer inline text={assertion} />
                </span>
            </div>
            {reason && (
                <div style={Q.assertRow}>
                    <strong style={Q.assertLabel}>Reason (R):</strong>
                    <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                        <MathRenderer inline text={reason} />
                    </span>
                </div>
            )}
            {q.imageUrl && (
                <img src={q.imageUrl} alt="Diagram" style={{ ...Q.img, maxHeight: '120px' }} />
            )}
            <div style={{ marginTop: '6px' }}>
                {opts.map((opt, i) => (
                    <div key={i} style={{ ...Q.optRow, marginBottom: '2px' }}>
                        <span style={Q.optLbl}>{optionLabel(i, classes)})</span>
                        <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                            <MathRenderer inline text={opt} />
                        </span>
                    </div>
                ))}
            </div>
        </>
    );
}

function BodyMatchFollowing({ q, classes, singleColMode }) {
    const pairs = q.matchPairs || [];
    const opts = q.options || [];
    return (
        <>
            <MathRenderer style={{ marginBottom: '6px', wordBreak: 'break-word' }} text={q.questionText} />
            {q.imageUrl && (
                <img src={q.imageUrl} alt="Diagram" style={{ ...Q.img, maxHeight: '120px' }} />
            )}
            <table style={Q.matchTable}>
                <thead>
                    <tr>
                        <th style={Q.matchTh}>Column I</th>
                        <th style={Q.matchTh}>Column II</th>
                    </tr>
                </thead>
                <tbody>
                    {pairs.map((pair, pi) => (
                        <tr key={pi}>
                            <td style={Q.matchTd}>
                                <strong>({String.fromCharCode(65 + pi)})</strong>
                                {' '}<MathRenderer inline text={pair.left || ''} />
                            </td>
                            <td style={Q.matchTd}>
                                <strong>({pi + 1})</strong>
                                {' '}<MathRenderer inline text={pair.right || ''} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {opts.length > 0 && (
                <div style={optGridStyle(opts, true)}>
                    {opts.map((opt, i) => (
                        <div key={i} style={Q.optRow}>
                            <span style={Q.optLbl}>{optionLabel(i, classes)})</span>
                            <span style={{ flex: 1, minWidth: 0 }}><MathRenderer inline text={opt} /></span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

function BodyStatementBased({ q, classes, singleColMode }) {
    const stmts = q.statements || [];
    return (
        <>
            <MathRenderer style={{ marginBottom: '6px', wordBreak: 'break-word' }} text={q.questionText} />
            {stmts.length > 0 && (
                <div style={Q.stmtBar}>
                    {stmts.map((s, i) => (
                        <div key={i} style={Q.stmtRow}>
                            <strong>Statement {i + 1}:</strong>{' '}
                            <MathRenderer inline text={s} />
                        </div>
                    ))}
                </div>
            )}
            {q.imageUrl && (
                <img src={q.imageUrl} alt="Diagram" style={{ ...Q.img, maxHeight: '130px' }} />
            )}
            {q.options && q.options.length > 0 && (
                <div style={optGridStyle(q.options, true)}>
                    {q.options.map((opt, i) => (
                        <div key={i} style={Q.optRow}>
                            <span style={Q.optLbl}>{optionLabel(i, classes)})</span>
                            <span style={{ flex: 1, minWidth: 0 }}><MathRenderer inline text={opt} /></span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

function BodyMultipleStatement({ q, classes, singleColMode }) {
    // Multi-statement: statements labeled A, B, C, D then options like "A and B only"
    const stmts = q.statements || [];
    return (
        <>
            <MathRenderer style={{ marginBottom: '6px', wordBreak: 'break-word' }} text={q.questionText} />
            {stmts.length > 0 && (
                <div style={{ margin: '5px 0 7px 4px' }}>
                    {stmts.map((s, i) => (
                        <div key={i} style={{ ...Q.stmtRow, display: 'flex', gap: '6px' }}>
                            <strong style={{ minWidth: '18px' }}>{String.fromCharCode(65 + i)})</strong>
                            <span style={{ flex: 1, minWidth: 0 }}><MathRenderer inline text={s} /></span>
                        </div>
                    ))}
                </div>
            )}
            {q.imageUrl && (
                <img src={q.imageUrl} alt="Diagram" style={{ ...Q.img, maxHeight: '130px' }} />
            )}
            {q.options && q.options.length > 0 && (
                <div style={optGridStyle(q.options, singleColMode)}>
                    {q.options.map((opt, i) => (
                        <div key={i} style={Q.optRow}>
                            <span style={Q.optLbl}>{optionLabel(i, classes)})</span>
                            <span style={{ flex: 1, minWidth: 0 }}><MathRenderer inline text={opt} /></span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

function BodyNumerical({ q }) {
    return (
        <>
            <MathRenderer style={{ wordBreak: 'break-word' }} text={q.questionText} />
            {q.imageUrl && (
                <img src={q.imageUrl} alt="Diagram" style={{ ...Q.img, maxHeight: '150px' }} />
            )}
            <div style={{ marginTop: '6px', borderBottom: '1px solid #aaa', minHeight: '24px', maxWidth: '160px' }} />
        </>
    );
}

function BodyTrueFalse({ q, classes, singleColMode }) {
    const opts = q.options && q.options.length > 0 ? q.options : ['True', 'False'];
    return (
        <>
            <MathRenderer style={{ wordBreak: 'break-word' }} text={q.questionText} />
            {q.imageUrl && (
                <img src={q.imageUrl} alt="Diagram" style={{ ...Q.img, maxHeight: '130px' }} />
            )}
            <div style={optGridStyle(opts, singleColMode)}>
                {opts.map((opt, i) => (
                    <div key={i} style={Q.optRow}>
                        <span style={Q.optLbl}>{optionLabel(i, classes)})</span>
                        <span style={{ flex: 1, minWidth: 0 }}><MathRenderer inline text={opt} /></span>
                    </div>
                ))}
            </div>
        </>
    );
}

function BodyPassage({ q, classes, singleColMode }) {
    const subQs = q.subQuestions || [];
    return (
        <>
            {/* Passage block */}
            <div style={{
                background: '#fafafa',
                border: '1px solid #ddd',
                borderLeft: '4px solid #888',
                padding: '8px 12px',
                marginBottom: '10px',
                fontSize: '0.95em',
                wordBreak: 'break-word',
            }}>
                <MathRenderer text={q.questionText} />
            </div>
            {q.imageUrl && (
                <img src={q.imageUrl} alt="Diagram" style={{ ...Q.img, maxHeight: '150px' }} />
            )}
            {subQs.length > 0 && subQs.map((sq, si) => (
                <div key={si} style={{ marginBottom: '8px', paddingLeft: '8px', borderLeft: '2px solid #ccc' }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                        <strong style={{ minWidth: '20px' }}>{si + 1}.</strong>
                        <span style={{ flex: 1, wordBreak: 'break-word' }}>
                            <MathRenderer inline text={sq.questionText || ''} />
                        </span>
                    </div>
                    {sq.options && sq.options.length > 0 && (
                        <div style={optGridStyle(sq.options, singleColMode)}>
                            {sq.options.map((opt, oi) => (
                                <div key={oi} style={Q.optRow}>
                                    <span style={Q.optLbl}>{optionLabel(oi, classes)})</span>
                                    <span style={{ flex: 1, minWidth: 0 }}><MathRenderer inline text={opt} /></span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            {/* Fallback: if no subQuestions but has options */}
            {subQs.length === 0 && q.options && q.options.length > 0 && (
                <div style={optGridStyle(q.options, singleColMode)}>
                    {q.options.map((opt, i) => (
                        <div key={i} style={Q.optRow}>
                            <span style={Q.optLbl}>{optionLabel(i, classes)})</span>
                            <span style={{ flex: 1, minWidth: 0 }}><MathRenderer inline text={opt} /></span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

function BodyFillBlank({ q }) {
    return (
        <>
            <MathRenderer style={{ wordBreak: 'break-word' }} text={q.questionText} />
            {q.imageUrl && (
                <img src={q.imageUrl} alt="Diagram" style={{ ...Q.img, maxHeight: '130px' }} />
            )}
        </>
    );
}

// ─── Main QuestionBlock ───────────────────────────────────────────────────────

/**
 * @param {object} q           - question object from DB
 * @param {number} displayNum  - display number (may differ from idx if start≠1)
 * @param {string[]} classes   - paper classes for option labels (e.g. ['JEE'])
 * @param {boolean} showMarks  - whether to show marks badge
 * @param {boolean} singleColMode - true when rendering inside a 2-column layout
 * @param {string} fontSize    - CSS font size string
 * @param {string} lineHeight  - CSS line-height string
 * @param {function} formatMarks - function(type, classes) → string
 * @param {object} extraStyle  - extra style overrides for wrap div
 */
const QuestionBlock = ({
    q,
    displayNum,
    classes = [],
    showMarks = false,
    singleColMode = false,
    fontSize = '14px',
    lineHeight = '1.5',
    formatMarks,
    extraStyle = {},
}) => {
    const type = (q.type || 'MCQ').toUpperCase();

    const renderBody = () => {
        switch (type) {
            case 'ASSERTION_REASON': return <BodyAssertionReason q={q} classes={classes} singleColMode={singleColMode} />;
            case 'MATCH_FOLLOWING': return <BodyMatchFollowing q={q} classes={classes} singleColMode={singleColMode} />;
            case 'STATEMENT_BASED': return <BodyStatementBased q={q} classes={classes} singleColMode={singleColMode} />;
            case 'MULTIPLE_STATEMENT': return <BodyMultipleStatement q={q} classes={classes} singleColMode={singleColMode} />;
            case 'NUMERICAL': return <BodyNumerical q={q} />;
            case 'TRUE_FALSE': return <BodyTrueFalse q={q} classes={classes} singleColMode={singleColMode} />;
            case 'CASE_STUDY':
            case 'PASSAGE': return <BodyPassage q={q} classes={classes} singleColMode={singleColMode} />;
            case 'FILL_BLANK': return <BodyFillBlank q={q} />;
            case 'DIAGRAM_BASED':
            case 'IMAGE_BASED':
            case 'MCQ':
            default: return <BodyMCQ q={q} classes={classes} singleColMode={singleColMode} />;
        }
    };

    return (
        <div style={{ ...Q.wrap, fontSize, lineHeight, ...extraStyle }}>
            <div style={Q.row}>
                <div style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                    <span style={Q.num}>{displayNum}.</span>
                    <div style={{ ...Q.body, paddingLeft: '2px' }}>
                        {renderBody()}
                    </div>
                </div>
                {showMarks && formatMarks && (
                    <span style={Q.marks}>[{formatMarks(q.type, classes)}]</span>
                )}
            </div>
        </div>
    );
};

export default QuestionBlock;
