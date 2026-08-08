/**
 * client/src/utils/sanitize.js
 * Client-side HTML sanitization using DOMPurify.
 * Apply to ALL dangerouslySetInnerHTML content to prevent XSS.
 */
import DOMPurify from 'dompurify';

// Allowed tags for mathematical/scientific question rendering
const CONFIG = {
    ALLOWED_TAGS: [
        'b', 'i', 'u', 'em', 'strong', 'sup', 'sub', 'br', 'span', 'p',
        'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
        'math', 'mrow', 'mi', 'mn', 'mo', 'mfrac', 'msup', 'msub', 'mspace',
        'mtext', 'mover', 'munder', 'munderover', 'msqrt', 'mroot', 'mfenced',
        'annotation', 'semantics'
    ],
    ALLOWED_ATTR: ['class', 'style', 'colspan', 'rowspan', 'mathvariant', 'display'],
    FORBID_TAGS: ['script', 'object', 'embed', 'link', 'iframe', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    FORCE_BODY: false,
};

/**
 * Sanitize HTML for safe rendering in dangerouslySetInnerHTML.
 * @param {string} dirty - Raw HTML string from database
 * @returns {string} - Sanitized HTML safe for rendering
 */
export function sanitize(dirty) {
    if (!dirty || typeof dirty !== 'string') return '';
    return DOMPurify.sanitize(dirty, CONFIG);
}

/**
 * Returns an object ready for dangerouslySetInnerHTML.
 * Usage: <div {...safeHtml(content)} />
 */
export function safeHtml(dirty) {
    return { __html: sanitize(dirty) };
}
