import React, { useMemo } from 'react';
import katex from 'katex';
import DOMPurify from 'dompurify';

/**
 * Renders text that may contain LaTeX math delimiters ($...$, $$...$$, \(...\), \[...\])
 * and {{IMG::...}} image blocks, into properly formatted HTML with KaTeX math rendering.
 *
 * Uses katex.renderToString() synchronously so math is ALWAYS rendered —
 * no race condition with dangerouslySetInnerHTML.
 */

// KaTeX-permissive DOMPurify config — allows all KaTeX output HTML safely
const KATEX_CONFIG = {
    ALLOWED_TAGS: [
        // Standard inline/block
        'b', 'i', 'u', 'em', 'strong', 'sup', 'sub', 'br', 'span', 'div', 'p',
        'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
        // KaTeX uses these
        'annotation', 'semantics', 'math', 'mrow', 'mi', 'mn', 'mo',
        'mfrac', 'msup', 'msub', 'mspace', 'mtext', 'mover', 'munder',
        'munderover', 'msqrt', 'mroot', 'mfenced', 'mtable', 'mtr', 'mtd',
        // Images
        'img',
        // SVG (KaTeX uses SVG for some symbols)
        'svg', 'path', 'g', 'line', 'rect', 'circle', 'use', 'defs', 'mask',
    ],
    ALLOWED_ATTR: [
        'class', 'style', 'colspan', 'rowspan', 'src', 'alt', 'width', 'height',
        'aria-hidden', 'aria-label', 'role', 'tabindex', 'focusable',
        'mathvariant', 'display', 'xmlns',
        // SVG attrs
        'viewBox', 'x', 'y', 'd', 'fill', 'stroke', 'stroke-width',
        'transform', 'clip-path', 'mask', 'id', 'href', 'xlink:href',
    ],
    FORBID_TAGS: ['script', 'object', 'embed', 'link', 'iframe', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    FORCE_BODY: false,
};

/**
 * Converts a raw text string (with LaTeX delimiters) into rendered HTML.
 * Processes in order: $$...$$ → $...$ → \[...\] → \(...\) → {{IMG::...}}
 */
function processText(text) {
    if (!text || typeof text !== 'string') return '';

    let result = text;

    // 1) Handle {{IMG::...}} image blocks
    result = result.replace(/\{\{IMG::(.*?)\}\}/gi, (_match, src) => {
        return `<img src="${src}" alt="Question Diagram" style="max-width:70%;max-height:128px;object-fit:contain;display:block;margin:8px auto;" />`;
    });

    // 2) Render display math: $$...$$
    result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false, output: 'html' });
        } catch {
            return math; // fallback: show raw content without delimiters
        }
    });

    // 3) Render display math: \[...\]
    result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false, output: 'html' });
        } catch {
            return math;
        }
    });

    // 4) Render inline math: $...$  (single dollar — careful not to match $$ again)
    result = result.replace(/\$([^$\n]+?)\$/g, (_match, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: 'html' });
        } catch {
            return math;
        }
    });

    // 5) Render inline math: \(...\)
    result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: 'html' });
        } catch {
            return math;
        }
    });

    return result;
}

const MathRenderer = ({ text, className = '', style = {}, inline = false }) => {
    const safeText = typeof text === 'string' ? text : (text ? String(text) : '');

    // Pre-render math synchronously — no useEffect race condition
    const renderedHtml = useMemo(() => {
        const processed = processText(safeText);
        return DOMPurify.sanitize(processed, KATEX_CONFIG);
    }, [safeText]);

    if (inline) {
        return (
            <span
                className={`math-renderer inline-math ${className}`}
                style={style}
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
        );
    }

    return (
        <div
            className={`math-renderer ${className}`}
            style={style}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
    );
};

export default MathRenderer;
