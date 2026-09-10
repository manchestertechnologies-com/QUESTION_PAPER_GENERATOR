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
 * - Interactive Diagram Resizing via ResizableDiagram (+ / - controls right on the diagram)
 * - Zero overlap, no clipping, proper line spacing, KaTeX math/chem preservation.
 */
import React from 'react';
import MathRenderer from './MathRenderer';
import ResizableDiagram from './ResizableDiagram';
import { optionLabel, getQuestionOptionLabels } from '../utils/sanitize';

/**
 * Dynamic option grid calculator based on length and complexity:
 * - Complex formulas / long equations (e.g. Q33 vector equations): 1 column (vertical stack)
 * - 2-Column paper mode:
 *     - Short scalars / tiny choices (<= 4 chars, no math): 4 columns across
 *     - Medium (<= 18 chars, e.g. "50 minutes", short math): 2x2 grid (1fr 1fr)
 *     - Long or complex formulas: 1 column (vertical stack)
 * - 1-Column paper mode:
 *     - Short scalars (<= 10 chars, no complex math): 4 columns across
 *     - Medium (<= 32 chars): 2x2 grid
 *     - Long or complex formulas: 1 column (vertical stack)
 */
function getDynamicOptGrid(options = [], isTwoColMode = false) {
    if (!options || options.length === 0) return { display: 'none' };

    let hasComplexFormula = false;
    let hasAnyMath = false;

    const parsedOptions = options.map((opt) => {
        if (!opt) return { text: '', len: 0, hasMath: false, isComplex: false, hasImage: false };
        const str = String(typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : opt).trim();
        const hasImage = /\{\{IMG::|!\[|\[DIAGRAM:|<img|https?:\/\/.*?\.(png|jpg|jpeg|webp|svg|gif)|data:image\//i.test(str);
        const clean = str.replace(/<[^>]+>/g, '').trim();

        // Detect math / LaTeX commands / symbols
        const mathMatch = /(\$|\\\(|\\\[|\\|\^|_)/i.test(clean);
        if (mathMatch) hasAnyMath = true;

        // Complex formula detection:
        // - Fractions (\frac, \dfrac)
        // - Vectors or hats (\vec, \hat)
        // - Integrals, square roots, matrices, summations (\sqrt, \int, \sum, \matrix, \begin)
        // - Long formulas with mathematical operators (+, -, =)
        const complexMatch =
            /(\\frac|\\dfrac|\\vec|\\hat|\\sqrt|\\int|\\sum|\\prod|\\matrix|\\begin|\\rightarrow|\|)/i.test(clean) ||
            (mathMatch && (clean.length > 14 || /(=|\+.*\-|\-.*\+|\^\{?\d+\}?.*_)/.test(clean)));

        if (complexMatch) {
            hasComplexFormula = true;
        }

        return {
            text: str,
            len: clean.length,
            hasMath: mathMatch,
            isComplex: complexMatch,
            hasImage,
        };
    });

    // ── HORIZONTAL GRID FOR OPTIONS WITH DIAGRAMS (Q40, Q52) ──
    const hasAnyOptionImage = parsedOptions.some((o) => o.hasImage);
    if (hasAnyOptionImage) {
        if (isTwoColMode) {
            // In 2-column mode: 2x2 grid
            return {
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '4px 8px',
                marginTop: '3px',
                alignItems: 'center',
            };
        }
        // In 1-column mode: All 4 options laid out horizontally side-by-side!
        return {
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(4, options.length)}, minmax(0, 1fr))`,
            gap: '4px 12px',
            marginTop: '3px',
            alignItems: 'center',
        };
    }

    const maxLen = Math.max(...parsedOptions.map((o) => o.len), 0);

    // ── TWO-COLUMN PAPER MODE (each column is ~350px wide) ──
    if (isTwoColMode) {
        if (hasComplexFormula) {
            return {
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: '2px 6px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }

        // Short scalar choices (e.g. 0, 1, 2, 3 or A, B, C, D)
        if (maxLen <= 5 && !hasAnyMath && options.length <= 4) {
            return {
                display: 'grid',
                gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
                gap: '2px 8px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }

        // Medium options (e.g. up to 22 chars): 2x2 grid
        if (maxLen <= 22 && options.length <= 4) {
            return {
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '2px 8px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }

        // Long text or formulas: 1 column vertical stack
        return {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: '2px 6px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    // ── SINGLE-COLUMN PAPER MODE (full A4 width ~730px) ──
    if (hasComplexFormula && maxLen > 28) {
        return {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: '3px 6px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    if (maxLen <= 16 && !hasComplexFormula && options.length <= 4) {
        return {
            display: 'grid',
            gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
            gap: '2px 14px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    if (maxLen <= 36 && options.length <= 4) {
        return {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '3px 14px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    return {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: '3px 6px',
        marginTop: '3px',
        alignItems: 'start',
    };
}

const Q = {
    wrap: {
        display: 'inline-block',
        width: '100%',
        breakInside: 'avoid',
        WebkitColumnBreakInside: 'avoid',
        pageBreakInside: 'avoid',
        marginBottom: '0px',
        color: '#111',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        fontStyle: 'normal',
        lineHeight: '1.42',
        boxSizing: 'border-box',
        verticalAlign: 'top',
    },
    row: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '6px',
        fontFamily: 'inherit',
        fontStyle: 'normal',
    },
    num: {
        fontWeight: 700,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        minWidth: '24px',
        fontSize: '1em',
        lineHeight: '1.42',
        color: '#000',
    },
    body: {
        flex: 1,
        minWidth: 0,
        fontFamily: 'inherit',
        fontStyle: 'normal',
    },
    qTextBold: {
        fontWeight: 700,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        color: '#000',
        display: 'inline',
        lineHeight: '1.42',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
    },
    marks: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        fontSize: '1em',
        alignSelf: 'flex-start',
        marginLeft: '6px',
        color: '#444',
    },
    optRow: {
        display: 'flex',
        alignItems: 'baseline',
        gap: '4px',
        wordBreak: 'normal',
        overflowWrap: 'break-word',
        minWidth: 0,
        maxWidth: '100%',
        fontSize: '1em',
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        color: '#111',
    },
    optLbl: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        minWidth: '22px',
        flexShrink: 0,
        lineHeight: '1.42',
        color: '#222',
        fontSize: '1em',
    },
    sideBySideContainer: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginTop: '3px',
    },
    sideLeftContent: {
        flex: '1 1 58%',
        minWidth: 0,
    },
    sideRightDiagram: {
        flex: '0 0 40%',
        maxWidth: '270px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2px',
    },
    matchTable: {
        width: '100%',
        borderCollapse: 'collapse',
        margin: '2px 0 4px',
        fontSize: '0.92em',
        tableLayout: 'fixed',
        fontWeight: 400,
    },
    matchTh: {
        border: '1px solid #aaa',
        padding: '2px 4px',
        background: '#f8fafc',
        fontWeight: 600,
        textAlign: 'left',
        width: '50%',
        color: '#111',
        fontSize: '0.92em',
    },
    matchTd: {
        border: '1px solid #aaa',
        padding: '2px 4px',
        verticalAlign: 'top',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        width: '50%',
        fontWeight: 400,
        color: '#111',
        fontSize: '0.92em',
    },
    assertRow: {
        display: 'flex',
        gap: '6px',
        marginBottom: '3px',
        alignItems: 'baseline',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        fontSize: '1em',
        fontWeight: 400,
        lineHeight: '1.46',
    },
    assertLabel: {
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: '#000',
        fontSize: '1em',
        minWidth: '105px',
        flexShrink: 0,
        lineHeight: '1.46',
    },
    assertText: {
        flex: 1,
        fontWeight: 400,
        color: '#111',
        fontSize: '1em',
        lineHeight: '1.46',
    },
};

/**
 * Intelligent Layout Decision:
 * Decides whether diagram should be rendered side-by-side on the right, or inline/full-width
 */
function shouldRenderSideBySide(q, isTwoCol = false, resolvedImageUrl = null) {
    // Standard assessment formatting: options strictly render below diagram
    return false;
}

/** Standard 4 assertion-reason options (NEET/CET format) */
const AR_OPTIONS = [
    'Both Assertion and Reason are correct and Reason is the correct explanation of Assertion.',
    'Both Assertion and Reason are correct but Reason is not the correct explanation of Assertion.',
    'Assertion is correct but Reason is incorrect.',
    'Assertion is incorrect but Reason is correct.',
];

function cleanStatementText(str) {
    if (!str) return '';
    return String(str)
        .replace(/^[:\-]\s*/, '')
        .replace(/```/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/** Parse assertion/reason from question text */
function parseAssertionReason(q) {
    if (q.assertion) {
        return {
            assertion: cleanStatementText(q.assertion),
            reason: cleanStatementText(q.reason || '')
        };
    }
    let txt = q.questionText || q.question || '';

    // 1. Remove markdown code fences e.g. ```
    txt = txt.replace(/```[\s\S]*?```/g, '').replace(/```/g, '');

    // 2. Remove leaked solution explanations
    txt = txt.replace(/(?:Therefore|Hence|Thus),?\s*option\s*[\(\[]?[a-d1-4][\)\]]?\s*is\s*correct[\s\S]*?(?=Reason|$)/gi, '');
    txt = txt.replace(/(?:Therefore|Hence|Thus),?\s*option\s*[\(\[]?[a-d1-4][\)\]]?\s*is\s*correct[\s\S]*/gi, '');

    // 3. Match Assertion (A) and Reason (R)
    const aMatch = txt.match(/Assertion\s*(?:\(A\))?\s*[:\-]?\s*([\s\S]*?)(?=Reason\s*(?:\(R\))?[:\-]|$)/i);
    const rMatch = txt.match(/Reason\s*(?:\(R\))?\s*[:\-]?\s*([\s\S]*)$/i);

    let assertion = aMatch ? aMatch[1].trim() : txt;
    let reason = rMatch ? rMatch[1].trim() : '';

    // 4. Remove duplicate keywords or leaked solution sentences
    assertion = assertion.replace(/^[:\-]\s*/, '').replace(/\s*(?:Assertion|Reason)\s*(?:\([AR]\))?.*$/i, '').trim();
    reason = reason.replace(/^[:\-]\s*/, '').replace(/\s*Assertion\s*(?:\(A\))?.*$/i, '').trim();

    // Specific fix for polluted questions like the one in Image 3:
    assertion = assertion.replace(/\s*The\s*Reason\s*is\s*true[\s\S]*/i, '').trim();
    reason = reason.replace(/\s*The\s*two\s*statements\s*are\s*therefore[\s\S]*/i, '').trim();

    return {
        assertion: cleanStatementText(assertion),
        reason: cleanStatementText(reason)
    };
}

function cleanQuestionText(text) {
    if (!text) return '';
    return String(text).replace(/^(\s*(?:Q\.?\s*)?\d+[\.\)\-:]\s*)+/i, '').trim();
}

/**
 * Extracts any embedded diagrams from raw question text (e.g. {{IMG::url}} or ![...](url)),
 * repairs any split words caused by inline image markers (e.g. "plo {{IMG}} s" -> "plots"),
 * and returns clean text plus the extracted diagram URL.
 */
function extractDiagramFromText(rawText, existingImageUrl) {
    if (!rawText) return { cleanText: '', diagramUrl: existingImageUrl || null };

    let cleanText = String(rawText);
    let extractedUrl = existingImageUrl || null;

    // Pattern 1: {{IMG::url}}
    const imgMatch1 = cleanText.match(/\{\{IMG::(.*?)\}\}/i);
    if (imgMatch1) {
        if (!extractedUrl) extractedUrl = imgMatch1[1].trim();
        cleanText = cleanText.replace(/(\w+)\s*\{\{IMG::.*?\}\}\s*(\w+)/gi, (m, p1, p2) => p1 + p2);
        cleanText = cleanText.replace(/\{\{IMG::.*?\}\}/gi, ' ');
    }

    // Pattern 2: ![alt](url)
    const imgMatch2 = cleanText.match(/!\[(.*?)\]\((.*?)\)/i);
    if (imgMatch2) {
        if (!extractedUrl) extractedUrl = imgMatch2[2].trim();
        cleanText = cleanText.replace(/(\w+)\s*!\[.*?\]\(.*?\)\s*(\w+)/gi, (m, p1, p2) => p1 + p2);
        cleanText = cleanText.replace(/!\[.*?\]\(.*?\)/gi, ' ');
    }

    // Pattern 3: <img ... src="..." />
    const imgMatch3 = cleanText.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (imgMatch3) {
        if (!extractedUrl) extractedUrl = imgMatch3[1].trim();
        cleanText = cleanText.replace(/(\w+)\s*<img[^>]*>\s*(\w+)/gi, (m, p1, p2) => p1 + p2);
        cleanText = cleanText.replace(/<img[^>]*>/gi, ' ');
    }

    // Clean up excessive whitespace
    cleanText = cleanText.replace(/\s{2,}/g, ' ').trim();

    return { cleanText, diagramUrl: extractedUrl };
}

/**
 * MCQ Body with Intelligent Diagram Placement & Resizing
 */
function BodyMCQ({ q, classes, isTwoCol, diagramMaxHeight = '180px', onDiagramResize, displayNum }) {
    const rawQText = cleanQuestionText(q.questionText || q.question || '');
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const options = Array.isArray(q.options) ? q.options : [];
    const isSideBySide = shouldRenderSideBySide(q, isTwoCol, imageUrl);
    const labels = getQuestionOptionLabels(q);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    const hasAnyOptionImage = options.some(opt => {
        const str = String(typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : (opt || ''));
        return /\{\{IMG::|!\[|\[DIAGRAM:|<img|https?:\/\/.*?\.(png|jpg|jpeg|webp|svg|gif)|data:image\//i.test(str);
    });

    // Render Options List
    const renderOptions = (forceSingle = false) => {
        if (options.length === 0) {
            return null;
        }
        return (
            <div
                style={
                    forceSingle
                        ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '2px 6px', marginTop: '2px' }
                        : getDynamicOptGrid(options, isTwoCol)
                }
            >
                {options.map((opt, i) => {
                    const optText = typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : String(opt || '');
                    const optHeight = q.customDiagramSizes?.[`opt_${i}`] || q.customOptionDiagramHeight || '60px';

                    return (
                        <div
                            key={i}
                            style={{
                                ...Q.optRow,
                                flexDirection: 'row',
                                alignItems: hasAnyOptionImage ? 'center' : 'baseline',
                                textAlign: 'left',
                                gap: '4px',
                            }}
                        >
                            <span style={Q.optLbl}>({labels[i] || optionLabel(i, classes)})</span>
                            <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: 400 }}>
                                <MathRenderer
                                    inline
                                    text={optText}
                                    questionId={qId}
                                    initialHeight={optHeight}
                                    customDiagramSizes={q.customDiagramSizes}
                                    isOption={true}
                                    optionIndex={i}
                                    onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || `opt_${i}`) : undefined}
                                />
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (imageUrl && isSideBySide) {
        // SIDE-BY-SIDE:
        // Top: Question statement (full width)
        // Bottom: Left = Options (stacked vertically), Right = Diagram
        return (
            <>
                {qText && (
                    <div style={{ ...Q.qTextBold, marginBottom: '3px' }}>
                        <MathRenderer
                            inline
                            text={qText}
                            questionId={qId}
                            customDiagramSizes={q.customDiagramSizes}
                            onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                        />
                    </div>
                )}
                <div style={Q.sideBySideContainer}>
                    <div style={Q.sideLeftContent}>
                        {renderOptions(true)}
                    </div>
                    <div style={Q.sideRightDiagram}>
                        <ResizableDiagram
                            src={imageUrl}
                            alt="Diagram"
                            questionId={qId}
                            diagramKey="main"
                            initialHeight={currentDiagramHeight}
                            isManual={isMainManual}
                            onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                            maxWidth="100%"
                        />
                    </div>
                </div>
            </>
        );
    }

    // INLINE / STANDARD LAYOUT
    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: imageUrl ? '3px' : '2px' }}>
                    <MathRenderer
                        inline
                        text={qText}
                        questionId={qId}
                        customDiagramSizes={q.customDiagramSizes}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                    />
                </div>
            )}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '3px auto 5px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={isMainManual}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                        maxWidth="100%"
                    />
                </div>
            )}
            {renderOptions(false)}
        </>
    );
}

/**
 * Assertion & Reason Body
 */
/**
 * Assertion & Reason Body
 */
function BodyAssertionReason({ q, classes, isTwoCol, diagramMaxHeight = '180px', onDiagramResize, displayNum }) {
    const { assertion, reason } = parseAssertionReason(q);
    const opts = q.options && q.options.length > 0 ? q.options : AR_OPTIONS;
    const rawQText = cleanQuestionText(q.questionText || q.question || '');
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    // Check if there is introductory directions text BEFORE the word "Assertion"
    let introText = '';
    const introMatch = qText.match(/^([\s\S]*?)(?=Assertion\s*(?:\(A\))?[:\-])/i);
    if (introMatch && introMatch[1].trim().length > 0) {
        const candidate = introMatch[1].trim();
        if (!/Amniocentesis|is one of the/i.test(candidate)) {
            introText = candidate;
        }
    }

    return (
        <>
            {introText && (
                <div style={{ ...Q.qTextBold, marginBottom: '2px', display: 'block' }}>
                    <MathRenderer
                        inline
                        text={introText}
                        questionId={qId}
                        customDiagramSizes={q.customDiagramSizes}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                    />
                </div>
            )}
            <div style={{ marginBottom: '3px' }}>
                <div style={{ marginBottom: '2px', lineHeight: '1.42' }}>
                    <strong style={{ color: '#000', marginRight: '6px' }}>Assertion (A):</strong>
                    <MathRenderer inline text={assertion} />
                </div>
                {reason && (
                    <div style={{ marginBottom: '2px', lineHeight: '1.42' }}>
                        <strong style={{ color: '#000', marginRight: '6px' }}>Reason (R):</strong>
                        <MathRenderer inline text={reason} />
                    </div>
                )}
            </div>
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '3px auto 5px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={isMainManual}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                        maxWidth="100%"
                    />
                </div>
            )}
            <div style={{ marginTop: '3px', ...getDynamicOptGrid(opts, isTwoCol) }}>
                {opts.map((opt, i) => (
                    <div key={i} style={Q.optRow}>
                        <span style={Q.optLbl}>({optionLabel(i, classes)})</span>
                        <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: 400 }}>
                            <MathRenderer inline text={typeof opt === 'object' ? (opt.text || opt.option || '') : opt} />
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
/** Parse match the following from text when matchPairs array is empty */
function parseMatchFromText(q) {
    if (Array.isArray(q.matchPairs) && q.matchPairs.length > 0) {
        return { introText: cleanQuestionText(q.questionText || q.question || ''), pairs: q.matchPairs };
    }
    if (Array.isArray(q.column_a) && q.column_a.length > 0 && Array.isArray(q.column_b) && q.column_b.length > 0) {
        const maxL = Math.max(q.column_a.length, q.column_b.length);
        const pairs = [];
        for (let i = 0; i < maxL; i++) {
            pairs.push({
                left: q.column_a[i] || '',
                right: q.column_b[i] || ''
            });
        }
        return { introText: cleanQuestionText(q.questionText || q.question || ''), pairs };
    }
    const txt = cleanQuestionText(q.questionText || q.question || '');
    if (!txt) return { introText: '', pairs: [] };

    // Strip bold asterisks from Column/List headers
    const clean = txt.replace(/\*\*/g, '');

    // Check if introductory match phrase exists: e.g. "Match Column I with Column II."
    let searchStart = 0;
    const introSentenceMatch = clean.match(/^[\s\S]*?(?:Match|Connect|Pair)\s+(?:the\s+)?(?:following\s+)?(?:items\s+in\s+)?(?:Column|List)\s*[-–—\s]*(?:I|1|A)\s+with\s+(?:Column|List)\s*[-–—\s]*(?:II|2|B)[^.\n]*[.\n:\-]?\s*/i);
    if (introSentenceMatch) {
        searchStart = introSentenceMatch[0].length;
    }

    const c1Regex = /(?:^|\n|\b)(?:Column|List)\s*[-–—\s]*(?:I|1|A)(?:\s*[:\-])?/i;
    const c2Regex = /(?:^|\n|\b)(?:Column|List)\s*[-–—\s]*(?:II|2|B)(?:\s*[:\-])?/i;

    let col1Offset = -1;
    let col1HeaderLen = 0;
    let col2Offset = -1;
    let col2HeaderLen = 0;

    const textToSearch = clean.substring(searchStart);
    const m1 = textToSearch.match(c1Regex);
    if (m1) {
        col1Offset = searchStart + m1.index;
        col1HeaderLen = m1[0].length;
        const afterC1 = clean.substring(col1Offset + col1HeaderLen);
        const m2 = afterC1.match(c2Regex);
        if (m2) {
            col2Offset = col1Offset + col1HeaderLen + m2.index;
            col2HeaderLen = m2[0].length;
        }
    }

    // Fallback: search anywhere in clean (skipping "Column I with Column II")
    if (col1Offset === -1 || col2Offset === -1) {
        const allC1 = [...clean.matchAll(/(?:\n|^|\b)(?:Column|List)\s*[-–—\s]*(?:I|1|A)(?:\s*[:\-])?/gi)];
        const allC2 = [...clean.matchAll(/(?:\n|^|\b)(?:Column|List)\s*[-–—\s]*(?:II|2|B)(?:\s*[:\-])?/gi)];

        for (const c1 of allC1) {
            const snippet = clean.substring(c1.index, c1.index + 35);
            if (/with\s+(?:Column|List)/i.test(snippet)) continue;

            for (const c2 of allC2) {
                if (c2.index > c1.index) {
                    col1Offset = c1.index;
                    col1HeaderLen = c1[0].length;
                    col2Offset = c2.index;
                    col2HeaderLen = c2[0].length;
                    break;
                }
            }
            if (col1Offset !== -1 && col2Offset !== -1) break;
        }
    }

    if (col1Offset === -1 || col2Offset === -1) return { introText: txt, pairs: [] };

    let introText = clean.substring(0, col1Offset).trim();
    if (!introText || introText.length < 10 || /^(?:Match|Connect|Pair)\s+(?:the\s+)?(?:Column|List)?\s*(?:I|A)?\s*(?:with|and)?$/i.test(introText)) {
        introText = 'Match Column I with Column II:';
    }

    let rawCol1 = clean.substring(col1Offset + col1HeaderLen, col2Offset).trim();
    let rawCol2 = clean.substring(col2Offset + col2HeaderLen).trim();

    // Strip trailing answer options e.g. (1) a-(i), b-(ii)... or Codes: or Choose correct option
    rawCol2 = rawCol2.replace(/(?:\n|\s)*(?:(?:\([1-4A-D]\)|[1-4A-D]\.|\b(?:Codes?|Options?))\s*(?:[a-d][\-–—\s]*\(?[ivx0-9p-t]+\)?[\s,;]*)+|(?:\([1-4A-D]\)\s+[A-Da-d][\-–—].*)|(?:Choose|Select)\s+(?:the\s+)?correct[\s\S]*)$/i, '').trim();

    const extractItems = (colStr, isLeft = true) => {
        if (!colStr) return [];

        // 1. Split by newlines first
        const rawLines = colStr.split(/\n+/).map(l => l.trim()).filter(Boolean);
        if (rawLines.length >= 2) {
            const cleaned = rawLines.map(l => {
                return l.replace(/^[\(\[]?\s*(?:[A-Za-z0-9ivxIVX]+|[p-tP-T])\s*[\)\]\.:\-]\s*/, '').trim();
            }).filter(Boolean);
            if (cleaned.length >= 2) return cleaned;
        }

        // 2. Strict inline labels: (a)-(e) for left, (i)-(vi)/(1)-(6)/(p)-(t) for right
        const strictLabelRegex = isLeft
            ? /(?:^|\s)(?:\(([a-eA-E])\)|([a-eA-E])[\.\:\-])\s+/g
            : /(?:^|\s)(?:\(([1-6]|i{1,3}|iv|v|vi|[p-tP-T])\)|([1-6]|i{1,3}|iv|v|vi|[p-tP-T])[\.\:\-])\s+/g;

        const matches = [...colStr.matchAll(strictLabelRegex)];
        if (matches.length >= 2) {
            const items = [];
            for (let i = 0; i < matches.length; i++) {
                const start = matches[i].index + matches[i][0].length;
                const end = i < matches.length - 1 ? matches[i + 1].index : colStr.length;
                const piece = colStr.substring(start, end).trim();
                if (piece) items.push(piece);
            }
            if (items.length >= 2) return items;
        }

        return rawLines.length > 0 ? rawLines : [colStr];
    };

    const leftItems = extractItems(rawCol1, true);
    const rightItems = extractItems(rawCol2, false);

    if (leftItems.length >= 2 && rightItems.length >= 2) {
        const maxLen = Math.max(leftItems.length, rightItems.length);
        const pairs = [];
        for (let i = 0; i < maxLen; i++) {
            pairs.push({
                left: leftItems[i] || '',
                right: rightItems[i] || ''
            });
        }
        return { introText, pairs };
    }

    return { introText: txt, pairs: [] };
}

/** Parse statement-based questions from text */
function parseStatementsFromText(q) {
    if (Array.isArray(q.statements) && q.statements.length > 0) {
        return { 
            introText: cleanQuestionText(q.questionText || q.question || ''), 
            statements: q.statements.map((s, idx) => ({ label: `Statement ${idx + 1}`, text: cleanStatementText(typeof s === 'object' ? (s.text || s.statement || '') : s) })),
            outroText: '' 
        };
    }
    const rawTxt = cleanQuestionText(q.questionText || q.question || '');
    if (!rawTxt) return { introText: '', statements: [], outroText: '' };

    // Common outro phrases at the end of statement questions
    const outroPattern = /(?:In the light of the above statements|Choose the correct (?:answer|option|statement)|Select the (?:correct|incorrect) (?:statement|statements|option)|Which of the (?:above )?statements? (?:is|are) (?:correct|incorrect|true|false)|How many (?:of the above )?statements? are (?:correct|incorrect|true|false))\??[\s\S]*$/i;
    let outroText = '';
    let bodyTxt = rawTxt;
    const outroMatch = rawTxt.match(outroPattern);
    if (outroMatch && outroMatch.index > 15) {
        outroText = outroMatch[0].trim();
        bodyTxt = rawTxt.substring(0, outroMatch.index).trim();
    }

    // Pattern A: Statement I: ... Statement II: ... or Statement 1: ... Statement 2: ...
    const stmtRegex = /Statement\s*([I|V|X|0-9|A-D]+)\s*[:\-]?\s*([\s\S]*?)(?=Statement\s*[I|V|X|0-9|A-D]+\s*[:\-]|$)/gi;
    let matches = [];
    let m;
    let firstIdx = -1;
    while ((m = stmtRegex.exec(bodyTxt)) !== null) {
        if (firstIdx === -1) firstIdx = m.index;
        matches.push({
            label: `Statement ${m[1]}:`,
            text: cleanStatementText(m[2])
        });
    }
    if (matches.length >= 2) {
        const introText = bodyTxt.substring(0, firstIdx).trim();
        return { introText, statements: matches, outroText };
    }

    // Pattern B: Lettered statements: A. ... B. ... C. ... D. ... or (A) ... (B) ... (C) ... (D) ...
    // e.g. "Consider an ideal transformer. A. It operates... B. Vs/Vp=... C. ... D. ... E. ... F. ..."
    const letterRegex = /(?:^|\s)(?:\(([A-Ha-h])\)|([A-Ha-h])[\.:])\s+([\s\S]*?)(?=(?:\s(?:\([A-Ha-h]\)|[A-Ha-h][\.:])\s+)|$)/g;
    let letterMatches = [];
    let lMatch;
    let firstLetterIdx = -1;
    while ((lMatch = letterRegex.exec(bodyTxt)) !== null) {
        if (firstLetterIdx === -1) firstLetterIdx = lMatch.index;
        const letter = (lMatch[1] || lMatch[2] || '').toUpperCase();
        const text = cleanStatementText(lMatch[3]);
        if (text) {
            letterMatches.push({
                label: `(${letter})`,
                text
            });
        }
    }
    if (letterMatches.length >= 2) {
        const isSequential = letterMatches[0].label.includes('A') && letterMatches[1].label.includes('B');
        if (isSequential) {
            const introText = bodyTxt.substring(0, firstLetterIdx).trim();
            return { introText, statements: letterMatches, outroText };
        }
    }

    // Pattern C: Roman numerals: (i) ... (ii) ... (iii) ... (iv) ... or I. ... II. ... III. ...
    const romanRegex = /(?:^|\s)(?:\(([ivx]+)\)|([ivx]+)[\.:])\s+([\s\S]*?)(?=(?:\s(?:\([ivx]+\)|[ivx]+[\.:])\s+)|$)/gi;
    let romanMatches = [];
    let rMatch;
    let firstRomanIdx = -1;
    while ((rMatch = romanRegex.exec(bodyTxt)) !== null) {
        if (firstRomanIdx === -1) firstRomanIdx = rMatch.index;
        const roman = (rMatch[1] || rMatch[2] || '').toLowerCase();
        const text = cleanStatementText(rMatch[3]);
        if (text) {
            romanMatches.push({
                label: `(${roman})`,
                text
            });
        }
    }
    if (romanMatches.length >= 2) {
        const introText = bodyTxt.substring(0, firstRomanIdx).trim();
        return { introText, statements: romanMatches, outroText };
    }

    return { introText: rawTxt, statements: [], outroText: '' };
}

/**
 * Match the Following Body
 */
function BodyMatchFollowing({ q, classes, isTwoCol, diagramMaxHeight = '180px', onDiagramResize, displayNum }) {
    const { introText, pairs: parsedPairs } = parseMatchFromText(q);
    const pairs = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0) ? q.matchPairs : parsedPairs;
    const opts = q.options || [];
    const rawQText = cleanQuestionText(pairs.length > 0 ? (introText || '') : (q.questionText || q.question || ''));
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: '2px', display: 'block' }}>
                    <MathRenderer
                        inline
                        text={qText}
                        questionId={qId}
                        customDiagramSizes={q.customDiagramSizes}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                    />
                </div>
            )}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '2px auto 4px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={isMainManual}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                        maxWidth="100%"
                    />
                </div>
            )}
            {pairs.length > 0 && (
                <table style={Q.matchTable}>
                    <thead>
                        <tr>
                            <th style={Q.matchTh}>Column I</th>
                            <th style={Q.matchTh}>Column II</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pairs.map((pair, pi) => {
                            const leftText = pair.left || '';
                            const rightText = pair.right || '';
                            const roman = ['(i)', '(ii)', '(iii)', '(iv)', '(v)', '(vi)'][pi] || `(${pi + 1})`;
                            const letter = `(${String.fromCharCode(97 + pi)})`; // (a), (b), (c), (d)
                            const hasLeftLabel = /^\s*(\([a-zA-Z0-9]+\)|[a-zA-Z0-9]+[\.\)])/.test(leftText);
                            const hasRightLabel = /^\s*(\([a-zA-Z0-9ivxLCDM]+\)|[a-zA-Z0-9ivxLCDM]+[\.\)])/i.test(rightText);

                            return (
                                <tr key={pi}>
                                    <td style={Q.matchTd}>
                                        {!hasLeftLabel && <strong style={{ marginRight: '4px' }}>{letter}</strong>}
                                        <MathRenderer inline text={leftText} />
                                    </td>
                                    <td style={Q.matchTd}>
                                        {!hasRightLabel && <strong style={{ marginRight: '4px' }}>{roman}</strong>}
                                        <MathRenderer inline text={rightText} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
            {opts.length > 0 && (
                <div style={getDynamicOptGrid(opts, isTwoCol)}>
                    {opts.map((opt, i) => {
                        const labels = getQuestionOptionLabels(q);
                        return (
                            <div key={i} style={Q.optRow}>
                                <span style={Q.optLbl}>({labels[i] || optionLabel(i, classes)})</span>
                                <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: 400 }}>
                                    <MathRenderer inline text={typeof opt === 'object' ? (opt.text || opt.option || '') : opt} />
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}

/**
 * Statement-Based Body
 */
function BodyStatementBased({ q, classes, isTwoCol, diagramMaxHeight = '180px', onDiagramResize, displayNum }) {
    const { introText, statements: parsedStmts, outroText } = parseStatementsFromText(q);
    const statements = (Array.isArray(q.statements) && q.statements.length > 0) 
        ? q.statements.map((s, idx) => ({ label: `Statement ${idx + 1}:`, text: typeof s === 'object' ? (s.text || '') : String(s) }))
        : parsedStmts;
    const opts = q.options || [];
    const rawQText = cleanQuestionText(statements.length > 0 ? (introText || '') : (q.questionText || q.question || ''));
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const labels = getQuestionOptionLabels(q);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: '2px', display: 'block' }}>
                    <MathRenderer
                        inline
                        text={qText}
                        questionId={qId}
                        customDiagramSizes={q.customDiagramSizes}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                    />
                </div>
            )}
            {statements.length > 0 && (
                <div style={{ margin: '3px 0 4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {statements.map((stmt, si) => (
                        <div key={si} style={{ lineHeight: '1.42', fontWeight: 400, display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <strong style={{ color: '#000', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {stmt.label || `(${String.fromCharCode(65 + si)})`}
                            </strong>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <MathRenderer inline text={stmt.text || (typeof stmt === 'string' ? stmt : '')} />
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {outroText && (
                <div style={{ ...Q.qTextBold, marginTop: '2px', marginBottom: '3px', display: 'block' }}>
                    <MathRenderer inline text={outroText} />
                </div>
            )}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '2px auto 4px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={isMainManual}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                        maxWidth="100%"
                    />
                </div>
            )}
            {opts.length > 0 && (
                <div style={getDynamicOptGrid(opts, isTwoCol)}>
                    {opts.map((opt, i) => (
                        <div key={i} style={Q.optRow}>
                            <span style={Q.optLbl}>({labels[i] || optionLabel(i, classes)})</span>
                            <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: 400 }}>
                                <MathRenderer inline text={typeof opt === 'object' ? (opt.text || opt.option || '') : opt} />
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
    isTwoCol = false,
    fontSize = '13px',
    lineHeight = '1.45',
    formatMarks,
    extraStyle = {},
    diagramMaxHeight = '180px',
    onDiagramResize,
}) {
    if (!q) return null;

    const activeFontSize = q.fontSize || fontSize;
    const qType = (q.type || q.q_type || 'MCQ').toUpperCase();
    const qTextRaw = q.questionText || q.question || '';
    const effectiveIsTwoCol = Boolean(isTwoCol);

    const matchData = parseMatchFromText(q);
    const hasMatchPairs = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0) || (matchData.pairs && matchData.pairs.length >= 2);
    const isMatch = qType.includes('MATCH') || hasMatchPairs;

    const isAssertion = qType.includes('ASSERTION') || (/Assertion\s*(?:\(A\))?/i.test(qTextRaw) && /Reason\s*(?:\(R\))?/i.test(qTextRaw));

    const stmtData = parseStatementsFromText(q);
    const hasStatements = (Array.isArray(q.statements) && q.statements.length > 0) || (stmtData.statements && stmtData.statements.length >= 2);
    const isStatement = qType.includes('STATEMENT') || hasStatements;

    const renderBody = () => {
        if (isAssertion) {
            return (
                <BodyAssertionReason
                    q={q}
                    classes={classes}
                    isTwoCol={effectiveIsTwoCol}
                    diagramMaxHeight={diagramMaxHeight}
                    onDiagramResize={onDiagramResize}
                    displayNum={displayNum}
                />
            );
        }
        if (isMatch && hasMatchPairs) {
            return (
                <BodyMatchFollowing
                    q={q}
                    classes={classes}
                    isTwoCol={effectiveIsTwoCol}
                    diagramMaxHeight={diagramMaxHeight}
                    onDiagramResize={onDiagramResize}
                    displayNum={displayNum}
                />
            );
        }
        if (isStatement && hasStatements) {
            return (
                <BodyStatementBased
                    q={q}
                    classes={classes}
                    isTwoCol={effectiveIsTwoCol}
                    diagramMaxHeight={diagramMaxHeight}
                    onDiagramResize={onDiagramResize}
                    displayNum={displayNum}
                />
            );
        }
        // Default MCQ & Diagram-Based
        return (
            <BodyMCQ
                q={q}
                classes={classes}
                isTwoCol={effectiveIsTwoCol}
                diagramMaxHeight={diagramMaxHeight}
                onDiagramResize={onDiagramResize}
                displayNum={displayNum}
            />
        );
    };

    return (
        <div style={{ ...Q.wrap, fontSize: activeFontSize, lineHeight, ...extraStyle }} className="question-block">
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
