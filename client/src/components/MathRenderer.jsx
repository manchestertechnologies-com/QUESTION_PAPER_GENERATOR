import React, { useMemo } from 'react';
import katex from 'katex';
import DOMPurify from 'dompurify';

/**
 * MathRenderer.jsx
 *
 * High-performance, robust LaTeX & Chemistry renderer:
 * - Full KaTeX math delimiters: $...$, $$...$$, \(...\), \[...\]
 * - Chemistry reaction arrows: \xrightarrow{...}, \overset{...}{\rightarrow}, ->, -->
 * - Reagent above arrow detection: "CH_2=CH_2 ^{HBr} X" -> "\xrightarrow{HBr}"
 * - Chemistry formula text-spacing safety (protects spaces in \xrightarrow{aq. KOH})
 * - {{IMG::...}} image blocks and diagram containment
 * - Synchronous rendering with zero useEffect race conditions
 */

const KATEX_CONFIG = {
    ALLOWED_TAGS: [
        'b', 'i', 'u', 'em', 'strong', 'sup', 'sub', 'br', 'span', 'div', 'p',
        'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
        'annotation', 'semantics', 'math', 'mrow', 'mi', 'mn', 'mo',
        'mfrac', 'msup', 'msub', 'mspace', 'mtext', 'mover', 'munder',
        'munderover', 'msqrt', 'mroot', 'mfenced', 'mtable', 'mtr', 'mtd',
        'img', 'svg', 'path', 'g', 'line', 'rect', 'circle', 'use', 'defs', 'mask',
    ],
    ALLOWED_ATTR: [
        'class', 'style', 'colspan', 'rowspan', 'src', 'alt', 'width', 'height',
        'aria-hidden', 'aria-label', 'role', 'tabindex', 'focusable',
        'mathvariant', 'display', 'xmlns',
        'viewBox', 'x', 'y', 'd', 'fill', 'stroke', 'stroke-width',
        'transform', 'clip-path', 'mask', 'id', 'href', 'xlink:href',
    ],
    FORBID_TAGS: ['script', 'object', 'embed', 'link', 'iframe', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    FORCE_BODY: false,
};

/**
 * Pre-processes chemistry reaction chains, arrows, and bare formulas
 */
function sanitizeMathString(mathStr) {
    if (!mathStr) return '';
    let s = mathStr.trim();

    // 1. Fix chemistry superscript arrows: ^{reagent} between species -> \xrightarrow{reagent}
    s = s.replace(/\s*\^\{([^}]+)\}\s*([A-Za-z0-9_\(\[\{])/g, ' \\xrightarrow{$1} $2');

    // 2. Fix simple arrows in math mode: -> or --> to \rightarrow or \longrightarrow
    s = s.replace(/-->/g, ' \\longrightarrow ');
    s = s.replace(/->/g, ' \\rightarrow ');

    // 3. Fix unescaped spaces inside \xrightarrow{...} e.g. \xrightarrow{aq. KOH} -> \xrightarrow{\text{aq. KOH}}
    s = s.replace(/\\xrightarrow\{([^}]+)\}/g, (match, inner) => {
        if (/\s|[a-z]{2,}\./i.test(inner) && !inner.includes('\\text')) {
            return `\\xrightarrow{\\text{${inner.trim()}}}`;
        }
        return match;
    });

    return s;
}

/**
 * Safely renders a math string via KaTeX with fallback
 */
function renderKatexSafe(mathContent, displayMode = false) {
    const cleaned = sanitizeMathString(mathContent);
    try {
        return katex.renderToString(cleaned, {
            displayMode,
            throwOnError: false,
            output: 'html',
            trust: true,
            strict: false
        });
    } catch {
        // Fallback: try basic render or return clean text
        try {
            return katex.renderToString(mathContent, { displayMode, throwOnError: false, output: 'html' });
        } catch {
            return mathContent;
        }
    }
}

/**
 * Converts a raw text string into rendered HTML
 */
function processText(text, inline = false) {
    if (!text || typeof text !== 'string') return '';

    // 0) Strip internal tags & legacy font overrides
    let result = text
        .replace(/\[(?:QPV_|QBP_)?DIFFICULTY:\s*[^\]]+\]/gi, '')
        .replace(/\[(?:QPV|QBP)_[A-Za-z0-9_]+:[^\]]*\]/gi, '')
        .replace(/<font[^>]*>/gi, '')
        .replace(/<\/font>/gi, '')
        .replace(/font-size\s*:\s*[^;"]+;?/gi, '')
        .trim();

    // 1) Handle {{IMG::...}} image blocks with prominent, clear diagram sizing
    result = result.replace(/\{\{IMG::(.*?)\}\}/gi, (_match, src) => {
        return `<div class="diagram-container resizable-diagram-wrap" style="text-align:center;margin:6px auto;background:#ffffff;position:relative;z-index:2;display:block;clear:both;"><img src="${src}" alt="Question Diagram" style="max-width:100%;min-height:85px;max-height:220px;width:auto;height:auto;object-fit:contain;display:block;margin:4px auto;border-radius:4px;background:#ffffff;" loading="lazy" /></div>`;
    });

    // 2) Handle standard markdown ![alt](src) images with prominent, clear diagram sizing
    result = result.replace(/!\[(.*?)\]\((.*?)\)/gi, (_match, alt, src) => {
        return `<div class="diagram-container resizable-diagram-wrap" style="text-align:center;margin:6px auto;background:#ffffff;position:relative;z-index:2;display:block;clear:both;"><img src="${src}" alt="${alt || 'Question Diagram'}" style="max-width:100%;min-height:85px;max-height:220px;width:auto;height:auto;object-fit:contain;display:block;margin:4px auto;border-radius:4px;background:#ffffff;" loading="lazy" /></div>`;
    });

    // 3) Pre-normalize chemistry superscript arrows in plain text before delimiter parsing
    // e.g. "CH_2 = CH_2 ^{HBr} X ^{aq. KOH} Y" -> "$CH_2 = CH_2 \xrightarrow{HBr} X \xrightarrow{aq. KOH} Y$"
    result = result.replace(/\b([A-Za-z0-9_=]{2,}\s*\^\{[^}]+\}[\s\S]*?\b[A-Za-z0-9_]+\b)/g, (match) => {
        // If not already inside math delimiters
        if (!match.includes('$')) {
            return `$${match}$`;
        }
        return match;
    });

    // 4) Render display math: $$...$$
    result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => {
        return renderKatexSafe(math, false);
    });

    // 5) Render display math: \[...\]
    result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => {
        return renderKatexSafe(math, false);
    });

    // 6) Render inline math: $...$
    result = result.replace(/\$([^$\n]+?)\$/g, (_match, math) => {
        return renderKatexSafe(math, false);
    });

    // 7) Render inline math: \(...\)
    result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => {
        return renderKatexSafe(math, false);
    });

    // 8) Check for bare un-delimited chemical reactions or LaTeX symbols (e.g. \Delta, \alpha, \beta, \xrightarrow)
    if (/\\(?:Delta|alpha|beta|gamma|theta|lambda|mu|pi|sigma|omega|rightarrow|xrightarrow|leftarrow|pm|times|div|approx|neq|leq|geq)\b/i.test(result)) {
        result = result.replace(/(\\(?:Delta|alpha|beta|gamma|theta|lambda|mu|pi|sigma|omega|rightarrow|xrightarrow\{[^}]+\}|leftarrow|pm|times|div|approx|neq|leq|geq)(?:\s*[=+\-*/]\s*[A-Za-z0-9]+)?)/g, (match) => {
            return renderKatexSafe(match, false);
        });
    }

    // 9) Convert linebreaks (\r\n and \n) to <br/> tags
    result = result.replace(/\r\n/g, '<br/>').replace(/\n/g, '<br/>');

    return result;
}

const MathRenderer = ({ text, className = '', style = {}, inline = false }) => {
    const safeText = typeof text === 'string' ? text : (text ? String(text) : '');

    const renderedHtml = useMemo(() => {
        const processed = processText(safeText, inline);
        return DOMPurify.sanitize(processed, KATEX_CONFIG);
    }, [safeText, inline]);

    return (
        <span
            className={`math-renderer ${inline ? 'inline-math' : ''} ${className}`}
            style={{
                display: 'inline',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                ...style
            }}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
    );
};

export default MathRenderer;
