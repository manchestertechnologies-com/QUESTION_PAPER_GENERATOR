/**
 * client/src/utils/sanitize.js
 * Client-side HTML sanitization and examination formatting utilities.
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
 * Strips existing option prefixes (e.g., "(A) ", "A. ", "(1) ", "1. ", "a) ", "1: ", "[B] ")
 * from option strings before rendering.
 * Does NOT strip if the option itself is merely a scalar answer like "1", "4", "A", or "10".
 */
export function stripOptionPrefix(text) {
    if (!text && text !== 0) return '';
    let str = String(text)
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .trim();

    // Pattern 1: Enclosed with punctuation e.g. "(A)", "[1]", "A.", "1.", "A)", "1)", "A:", "1:", "A-", "1-" followed by content
    const prefixRegex = /^[\(\[]?\s*([A-Da-d1-4])\s*[\)\]\.\:\-]\s*(?=\S)/i;
    if (prefixRegex.test(str)) {
        const stripped = str.replace(prefixRegex, '').trim();
        if (stripped.length > 0) {
            return stripped;
        }
    }

    // Pattern 2: Naked letter/number followed by dot/colon/dash with space e.g. "A. Value" or "1: Value"
    const nakedRegex = /^([A-Da-d1-4])[\.\:\-]\s+(?=\S)/i;
    if (nakedRegex.test(str)) {
        const stripped = str.replace(nakedRegex, '').trim();
        if (stripped.length > 0) {
            return stripped;
        }
    }

    return str;
}

/**
 * Cleans unintentional italic styling from digits, numbers, or standard text
 * while strictly preserving biological binomial nomenclature (e.g. *Homo sapiens*, *Mangifera indica*).
 */
export function cleanItalicsPreservingBinomial(html) {
    if (!html || typeof html !== 'string') return '';

    // Regex for biological binomial / trinomial names:
    // Capitalized Genus + lowercase species (e.g., "Homo sapiens", "Mangifera indica", "Escherichia coli", "Pisum sativum")
    const isBinomialName = (str) => {
        const clean = str.replace(/<[^>]+>/g, '').trim();
        return /^[A-Z][a-z]+(?:\s+[a-z]+){1,2}(?:\s+(?:subsp\.|var\.|spp?\.)?\s*[a-z]+)?$/.test(clean);
    };

    // Replace <i>...</i> or <em>...</em> tags:
    return html.replace(/<(i|em)(\s+[^>]*)?>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, content) => {
        // If it's a genuine biological scientific name, preserve italics!
        if (isBinomialName(content)) {
            return `<${tag} class="scientific-name">${content}</${tag}>`;
        }
        // If content contains digits, standard formulas, punctuation, or regular words, unwrap to normal font style
        return `<span style="font-style: normal;">${content}</span>`;
    });
}

/**
 * Returns the option label for a given index based on optionStyle or exam type.
 * @param {number} idx - 0-based option index
 * @param {string[]} classes - array of exam classes on the question (e.g. ['JEE'] or ['NEET'])
 * @param {string} optionStyle - 'ABCD' | '1234'
 * @returns {string} - label string like 'A' or '1'
 */
export function optionLabel(idx, classes = [], optionStyle = null) {
    if (optionStyle === '1234' || optionStyle === 'NUMERIC') {
        return String(idx + 1);
    }
    if (optionStyle === 'ABCD' || optionStyle === 'ALPHA') {
        return String.fromCharCode(65 + idx);
    }

    const isJEE = Array.isArray(classes) && classes.some(c => String(c).toUpperCase() === 'JEE');
    return isJEE ? String.fromCharCode(65 + idx) : String(idx + 1);
}

/**
 * Detects the exact option labels used by a question (e.g. ['A', 'B', 'C', 'D'] vs ['1', '2', '3', '4'])
 * If optionStyle is passed ('ABCD' or '1234'), it is strictly enforced.
 */
export function getQuestionOptionLabels(q, optionStyle = null) {
    const options = Array.isArray(q?.options) ? q.options : [];
    const count = options.length || 4;

    // Explicit override from toolbar / settings
    if (optionStyle === '1234' || optionStyle === 'NUMERIC') {
        return Array.from({ length: count }, (_, i) => String(i + 1));
    }
    if (optionStyle === 'ABCD' || optionStyle === 'ALPHA') {
        return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
    }

    if (!q) return ['A', 'B', 'C', 'D'];

    // 1. If options array contains objects with explicit label property (e.g. { label: '1', text: '...' })
    const explicitLabels = options
        .map(opt => (typeof opt === 'object' && opt && opt.label ? String(opt.label).trim() : null))
        .filter(Boolean);
    if (explicitLabels.length === count && count > 0) {
        return explicitLabels;
    }

    // 2. Explicit question-level format flag
    const fmt = String(q.optionFormat || q.optionLabelFormat || q.optionType || '').toUpperCase();
    if (fmt.includes('1234') || fmt === 'NUMERIC' || fmt === '1') {
        return Array.from({ length: count }, (_, i) => String(i + 1));
    }
    if (fmt.includes('ABCD') || fmt === 'ALPHA' || fmt === 'A') {
        return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
    }

    // 3. Exam type convention (KCET/NEET/CET -> 1, 2, 3, 4; JEE -> A, B, C, D)
    const allClasses = [
        ...(Array.isArray(q.classes) ? q.classes : [q.classes]),
        q.examType,
        q.exam_type
    ].filter(Boolean).map(c => String(c).toUpperCase());

    const isExplicitJEE = allClasses.some(c => c === 'JEE');
    const isExplicitNumericExam = allClasses.some(c => c === 'KCET' || c === 'CET' || c === 'NEET' || c === 'STATE_BOARD');

    if (isExplicitJEE) {
        return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
    }
    if (isExplicitNumericExam) {
        return Array.from({ length: count }, (_, i) => String(i + 1));
    }

    // 4. Detect from answer format: if answer is numeric like '1', '2', '12', '1, 2'
    const rawAns = String(q.answer ?? q.correct_option ?? q.correctAnswer ?? '').trim();
    if (/^[1-4]$/.test(rawAns) || /^[1-4]{2,4}$/.test(rawAns) || /^[1-4]([\s,;&/]+[1-4])+$/.test(rawAns) || /both.*[1-4]/i.test(rawAns)) {
        return Array.from({ length: count }, (_, i) => String(i + 1));
    }
    if (/^[A-Da-d]$/.test(rawAns) || /^[A-Da-d]{2,4}$/.test(rawAns) || /^[A-Da-d]([\s,;&/]+[A-Da-d])+$/.test(rawAns) || /both.*[A-D]/i.test(rawAns)) {
        return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
    }

    // 5. Default fallback to alphabetic A, B, C, D
    return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
}

/**
 * Parses raw answer input into 0-based option index array.
 * Supports:
 * - Single: 1, 2, 3, 4, A, B, C, D
 * - Multi comma/space/slash: "1, 2", "1,2", "A, B", "A,B", "1/2", "A/B", "1 & 2", "A & B", "1 or 2", "A or B"
 * - Concatenated: "12", "23", "34", "123", "AB", "BC", "CD", "AC", "BD", "ABC", "ABCD"
 * - Phrases: "Both A and B", "Both 1 and 2", "Both (A) and (B)", "Both (1) and (2)", "A and B", "1 and 2"
 * - Arrays: ['A', 'B'], [1, 2]
 */
export function parseAnswerIndices(rawAns, options = []) {
    if (rawAns === null || rawAns === undefined) return [];

    if (Array.isArray(rawAns)) {
        const set = new Set();
        rawAns.forEach(item => {
            parseAnswerIndices(item, options).forEach(idx => set.add(idx));
        });
        return Array.from(set).sort((a, b) => a - b);
    }

    if (typeof rawAns === 'number') {
        if (rawAns >= 1 && rawAns <= 4) return [rawAns - 1];
        rawAns = String(rawAns);
    }

    const str = String(rawAns).trim();
    if (!str) return [];

    const indicesSet = new Set();

    // 1. Phrases like "Both A and B", "Both 1 and 2", "Both (A) and (B)", "Both (1) and (2)"
    const bothMatch = str.match(/both\s*(?:\()?\s*([A-D1-4])\s*(?:\))?\s*(?:and|&|\/|,)\s*(?:\()?\s*([A-D1-4])\s*(?:\))?/i);
    if (bothMatch) {
        const toIdx = (char) => {
            const c = char.toUpperCase();
            if (/[1-4]/.test(c)) return parseInt(c, 10) - 1;
            return c.charCodeAt(0) - 65;
        };
        indicesSet.add(toIdx(bothMatch[1]));
        indicesSet.add(toIdx(bothMatch[2]));
        return Array.from(indicesSet).sort((a, b) => a - b);
    }

    // 2. Concatenated digits: "12", "23", "34", "13", "123", "1234", "14"
    if (/^[1-4]{2,4}$/.test(str)) {
        str.split('').forEach(d => indicesSet.add(parseInt(d, 10) - 1));
        return Array.from(indicesSet).sort((a, b) => a - b);
    }

    // 3. Concatenated letters: "AB", "BC", "CD", "AC", "BD", "ABC", "ABCD"
    if (/^[A-Da-d]{2,4}$/.test(str)) {
        str.toUpperCase().split('').forEach(ch => indicesSet.add(ch.charCodeAt(0) - 65));
        return Array.from(indicesSet).sort((a, b) => a - b);
    }

    // 4. Delimited items: "1, 2", "A, B", "1 & 2", "A and B", "1 / 2", "A or B", "1 or 2", "1;2"
    const splitTokens = str
        .split(/[,;&/|\s]+|\band\b|\bor\b/i)
        .map(t => t.trim().replace(/[\(\)\[\]\.]/g, ''))
        .filter(Boolean);

    if (splitTokens.length > 1) {
        let allRecognized = true;
        const tempIndices = [];
        for (const token of splitTokens) {
            if (/^[1-4]$/.test(token)) {
                tempIndices.push(parseInt(token, 10) - 1);
            } else if (/^[A-Da-d]$/.test(token)) {
                tempIndices.push(token.toUpperCase().charCodeAt(0) - 65);
            } else {
                allRecognized = false;
                break;
            }
        }
        if (allRecognized && tempIndices.length > 0) {
            tempIndices.forEach(idx => indicesSet.add(idx));
            return Array.from(indicesSet).sort((a, b) => a - b);
        }
    }

    // 5. Single digit 1-4
    if (/^[1-4]$/.test(str)) {
        return [parseInt(str, 10) - 1];
    }

    // 6. Single letter A-D (or (A), A.)
    const singleLetter = str.match(/^[\(]?([A-Da-d])[\)\.]?$/);
    if (singleLetter) {
        return [singleLetter[1].toUpperCase().charCodeAt(0) - 65];
    }

    // 7. Match against option text
    const cleanStr = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/[\$\s\\{}]/g, '').toLowerCase();
    const targetStr = cleanStr(str);
    if (targetStr && options.length > 0) {
        const matchedIdx = options.findIndex((opt) => {
            const optText = typeof opt === 'object' && opt ? (opt.text || opt.optionText || '') : String(opt || '');
            const candidate = cleanStr(optText);
            if (!candidate) return false;
            if (candidate === targetStr) return true;
            if (targetStr.length > 4 && (candidate.includes(targetStr) || targetStr.includes(candidate))) return true;
            return false;
        });
        if (matchedIdx !== -1) return [matchedIdx];
    }

    return [];
}

/**
 * Returns the exact option label for a question's correct answer.
 * Seamlessly resolves single or multiple options with optionStyle support:
 * - If optionStyle is '1234' -> returns '1', '2', '3', '4' (or '1, 2')
 * - If optionStyle is 'ABCD' -> returns 'A', 'B', 'C', 'D' (or 'A, B')
 */
export function getResolvedAnswerLabel(q, optionStyle = null) {
    if (!q) return 'N/A';
    const rawAns = q.answer ?? q.correct_option ?? q.correctAnswer ?? '';
    const options = Array.isArray(q.options) ? q.options : [];
    const labels = getQuestionOptionLabels(q, optionStyle);

    const indices = parseAnswerIndices(rawAns, options);
    if (indices.length > 0) {
        const mapped = indices
            .filter(idx => idx >= 0 && idx < labels.length)
            .map(idx => labels[idx]);
        if (mapped.length > 0) {
            if (mapped.length === 1) return mapped[0];

            // If raw input was strictly compact like "12" or "AB", return compact "12" or "AB"
            const cleanRaw = String(rawAns).trim();
            if (/^[1-4]{2,4}$/.test(cleanRaw) || /^[A-Da-d]{2,4}$/.test(cleanRaw)) {
                return mapped.join('');
            }
            return mapped.join(', ');
        }
    }

    const cleanRaw = String(rawAns).trim();
    return cleanRaw || 'N/A';
}

/**
 * Returns compact code for answer (e.g. "12" or "AB")
 */
export function getResolvedAnswerCode(q, optionStyle = null) {
    if (!q) return 'N/A';
    const rawAns = q.answer ?? q.correct_option ?? q.correctAnswer ?? '';
    const options = Array.isArray(q.options) ? q.options : [];
    const labels = getQuestionOptionLabels(q, optionStyle);
    const indices = parseAnswerIndices(rawAns, options);
    if (indices.length > 0) {
        return indices
            .filter(idx => idx >= 0 && idx < labels.length)
            .map(idx => labels[idx])
            .join('');
    }
    return String(rawAns).trim() || 'N/A';
}

/**
 * Checks whether a given option index (0-based) is among the correct answers.
 * Supports questions with multiple correct options (e.g. 1 & 2, A & B).
 */
export function isOptionCorrect(q, optIndex) {
    if (!q || optIndex === undefined) return false;
    const rawAns = q.answer ?? q.correct_option ?? q.correctAnswer ?? '';
    const options = Array.isArray(q.options) ? q.options : [];
    const indices = parseAnswerIndices(rawAns, options);
    return indices.includes(optIndex);
}

/**
 * Strips QPV, QBP, and internal metadata difficulty tags before display.
 */
export function stripQBPTags(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\[(?:QPV_|QBP_)?DIFFICULTY:\s*[^\]]+\]/gi, '')
        .replace(/\[(?:QPV|QBP)_[A-Za-z0-9_]+:[^\]]*\]/gi, '')
        .trim();
}
