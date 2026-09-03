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
        'annotation', 'semantics', 'img'
    ],
    ALLOWED_ATTR: ['class', 'style', 'colspan', 'rowspan', 'mathvariant', 'display', 'src', 'alt'],
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

/**
 * Returns the option label for a given index based on question configuration,
 * explicit option labels, or exam type.
 * Preserves exact option format (1, 2, 3, 4 vs A, B, C, D) without unwanted conversions.
 *
 * @param {number} idx - 0-based option index
 * @param {string[]|string} classes - array of exam classes on the question (e.g. ['JEE'] or ['NEET'])
 * @param {object} [question] - optional question object
 * @param {object} [settings] - optional paper settings
 * @returns {string} - label string like 'A' or '1'
 */
export function optionLabel(idx, classes = [], question = null, settings = null) {
    if (question) {
        return getQuestionOptionLabel(question, idx, settings);
    }

    const ROMAN_LOWER = ['(i)', '(ii)', '(iii)', '(iv)', '(v)', '(vi)'];
    const ROMAN_UPPER = ['(I)', '(II)', '(III)', '(IV)', '(V)', '(VI)'];

    // Check settings override if provided
    if (settings?.optionFormat) {
        const fmt = String(settings.optionFormat).toLowerCase();
        if (fmt.includes('roman') || fmt.includes('(i)')) {
            return fmt.includes('upper') ? (ROMAN_UPPER[idx] || String(idx + 1)) : (ROMAN_LOWER[idx] || String(idx + 1));
        }
        if (fmt.includes('1') || fmt.includes('numeric')) return String(idx + 1);
        if (fmt.includes('a') || fmt.includes('alpha')) return String.fromCharCode(65 + idx);
    }

    const classArr = Array.isArray(classes) ? classes : [classes];
    const isJEE = classArr.some(c => String(c).toUpperCase() === 'JEE' || String(c).toUpperCase() === 'A, B, C, D');
    return isJEE ? String.fromCharCode(65 + idx) : String(idx + 1);
}

/**
 * Dynamically resolves the exact option label for a specific question at optIndex.
 * 1. Checks option object `.label`
 * 2. Checks question `.optionFormat` or settings `.optionFormat`
 * 3. Checks whether stored answer/correct_option is 1,2,3,4 vs A,B,C,D
 * 4. Falls back to exam type
 */
export function getQuestionOptionLabel(q, optIndex, settings = null) {
    if (!q) return String.fromCharCode(65 + optIndex);

    const ROMAN_LOWER = ['(i)', '(ii)', '(iii)', '(iv)', '(v)', '(vi)'];
    const ROMAN_UPPER = ['(I)', '(II)', '(III)', '(IV)', '(V)', '(VI)'];

    // 1. Explicit option object label (e.g. { label: '1', text: '...' })
    if (Array.isArray(q.options) && q.options[optIndex]) {
        const opt = q.options[optIndex];
        if (typeof opt === 'object' && opt !== null && opt.label) {
            return String(opt.label).trim();
        }
        // Check if raw option string starts with embedded label like "(1) ", "1. ", "(A) ", "A: "
        if (typeof opt === 'string') {
            const embeddedMatch = opt.match(/^\s*(?:\(([A-Da-d1-4])\)|([A-Da-d1-4])[\.\:\)\-]\s)/);
            if (embeddedMatch) {
                return (embeddedMatch[1] || embeddedMatch[2]).toUpperCase();
            }
        }
    }

    // 2. Global settings optionFormat preference
    if (settings?.optionFormat && settings.optionFormat !== 'auto') {
        const fmt = String(settings.optionFormat).toLowerCase();
        if (fmt.includes('roman') || fmt.includes('(i)')) {
            return fmt.includes('upper') ? (ROMAN_UPPER[optIndex] || String(optIndex + 1)) : (ROMAN_LOWER[optIndex] || String(optIndex + 1));
        }
        if (fmt.includes('1') || fmt.includes('numeric')) return String(optIndex + 1);
        if (fmt.includes('a') || fmt.includes('alpha')) return String.fromCharCode(65 + optIndex);
        if (fmt.includes('(a)')) return String.fromCharCode(97 + optIndex);
    }

    // 3. Question-level optionFormat
    if (q.optionFormat) {
        const qFmt = String(q.optionFormat).toLowerCase();
        if (qFmt.includes('roman') || qFmt.includes('(i)')) {
            return qFmt.includes('upper') ? (ROMAN_UPPER[optIndex] || String(optIndex + 1)) : (ROMAN_LOWER[optIndex] || String(optIndex + 1));
        }
        if (qFmt.includes('1') || qFmt.includes('numeric')) return String(optIndex + 1);
        if (qFmt.includes('a') || qFmt.includes('alpha')) return String.fromCharCode(65 + optIndex);
    }

    // 4. Inspect original answer or correct_option representation
    const rawAns = String(q.correct_option || q.answer || '').trim();
    if (/^[1-4]$/.test(rawAns)) {
        return String(optIndex + 1);
    }
    if (/^[A-Da-d]$/.test(rawAns)) {
        return String.fromCharCode(65 + optIndex);
    }

    // 5. Fallback based on question classes / exam type
    const classes = Array.isArray(q.classes) ? q.classes : (settings?.classes || []);
    const isJEE = classes.some(c => String(c).toUpperCase() === 'JEE');
    return isJEE ? String.fromCharCode(65 + optIndex) : String(optIndex + 1);
}

/**
 * Returns the 0-based option index (0..3) corresponding to the correct answer of question `q`.
 */
export function getQuestionCorrectOptionIndex(q) {
    if (!q) return 0;

    const rawAns = String(q.correct_option || q.answer || '').trim();
    const upperAns = rawAns.toUpperCase();

    // Direct Letter match
    if (upperAns === 'A') return 0;
    if (upperAns === 'B') return 1;
    if (upperAns === 'C') return 2;
    if (upperAns === 'D') return 3;

    // Direct Number match (1..4)
    if (rawAns === '1') return 0;
    if (rawAns === '2') return 1;
    if (rawAns === '3') return 2;
    if (rawAns === '4') return 3;

    // Direct Roman Numeral match ((i)..(iv) or i..iv)
    const lowerAns = rawAns.toLowerCase();
    if (lowerAns === '(i)' || lowerAns === 'i') return 0;
    if (lowerAns === '(ii)' || lowerAns === 'ii') return 1;
    if (lowerAns === '(iii)' || lowerAns === 'iii') return 2;
    if (lowerAns === '(iv)' || lowerAns === 'iv') return 3;

    // Match against options array by label or text
    if (Array.isArray(q.options) && q.options.length > 0 && rawAns) {
        // First try matching option.label (e.g. opt.label === '2' or '(ii)')
        const foundByLabel = q.options.findIndex(opt => {
            if (typeof opt === 'object' && opt !== null) {
                const optLbl = (opt.label || '').trim().toLowerCase();
                return optLbl === lowerAns;
            }
            return false;
        });
        if (foundByLabel >= 0) return foundByLabel;

        // Next try matching option text
        const foundIdx = q.options.findIndex(opt => {
            const optText = typeof opt === 'object' && opt !== null ? (opt.text || opt.optionText || '') : String(opt || '');
            return optText.trim().toLowerCase() === lowerAns;
        });
        if (foundIdx >= 0) return foundIdx;
    }

    return 0;
}

/**
 * Returns the exact correct answer label dynamically matched to the option labels
 * displayed on the question.
 *
 * If question options are labeled 1, 2, 3, 4 -> returns '1', '2', '3', or '4'.
 * If question options are labeled A, B, C, D -> returns 'A', 'B', 'C', or 'D'.
 * Never converts 1, 2, 3, 4 into A, B, C, D.
 */
export function getQuestionCorrectAnswerLabel(q, settings = null) {
    if (!q) return 'N/A';

    const qType = (q.type || q.q_type || '').toUpperCase();
    if (qType === 'NUMERICAL') {
        return String(q.num_answer || q.answer || 'N/A');
    }

    const correctIdx = getQuestionCorrectOptionIndex(q);
    return getQuestionOptionLabel(q, correctIdx, settings);
}

/**
 * Strips QPV, QBP, and internal metadata difficulty tags before display.
 * Removes patterns like [QPV_DIFFICULTY:Easy], [QBP_DIFFICULTY:Medium], [DIFFICULTY:Hard], etc.
 * @param {string} text
 * @returns {string}
 */
export function stripQBPTags(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\[(?:QPV_|QBP_)?DIFFICULTY:\s*[^\]]+\]/gi, '')
        .replace(/\[(?:QPV|QBP)_[A-Za-z0-9_]+:[^\]]*\]/gi, '')
        .trim();
}

