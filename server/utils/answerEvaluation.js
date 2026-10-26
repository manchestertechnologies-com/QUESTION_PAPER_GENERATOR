/**
 * Standardized Answer Evaluation & Canonical Option Resolution Engine (Node/CommonJS)
 * Handles all Indian CBT examination answer formats (A/B/C/D, 1/2/3/4, Option 1, text matching, numerical tolerance)
 */

function stripLeadingLabel(text) {
    if (!text) return '';
    return String(text)
        .replace(/^(?:option\s*)?\(?[a-ea-e0-9]\)?[\.\:\)\s-]+/i, '')
        .trim();
}

function normalizeText(text) {
    if (!text) return '';
    return String(text)
        .toLowerCase()
        .replace(/[\$\\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Resolves any option representation (letter 'A', digit '1', 'Option 1', or option text)
 * to a zero-based option index (0, 1, 2, 3...)
 */
function resolveOptionIndex(val, options = []) {
    if (val === null || val === undefined) return -1;
    const str = String(val).trim();
    if (!str) return -1;

    // 1. Single letter 'A'-'E' or 'Option A', '(A)', 'A.'
    const letterMatch = str.match(/^(?:option\s*)?\(?([A-Ea-e])\)?[\.\:\)]?$/i);
    if (letterMatch) {
        return letterMatch[1].toUpperCase().charCodeAt(0) - 65;
    }

    // 2. Single digit 1-5 or 'Option 1', '(1)', '1.'
    const numMatch = str.match(/^(?:option\s*)?\(?([1-5])\)?[\.\:\)]?$/i);
    if (numMatch) {
        return parseInt(numMatch[1], 10) - 1;
    }

    // 3. Option text match (exact or stripped of leading labels like '1. ' or 'A. ')
    if (Array.isArray(options) && options.length > 0) {
        const cleanStr = normalizeText(str);
        const strippedStr = normalizeText(stripLeadingLabel(str));

        for (let i = 0; i < options.length; i++) {
            const optVal = options[i];
            const optText = typeof optVal === 'object' && optVal !== null ? (optVal.text || JSON.stringify(optVal)) : String(optVal);
            const cleanOpt = normalizeText(optText);
            const strippedOpt = normalizeText(stripLeadingLabel(optText));

            if (cleanStr === cleanOpt) return i;
            if (strippedStr && strippedOpt && strippedStr === strippedOpt) return i;
            if (strippedStr && strippedStr === cleanOpt) return i;
            if (strippedOpt && cleanStr === strippedOpt) return i;
        }
    }

    // 4. Any single isolated digit extracted (e.g. 'Option 1' -> '1' -> 0)
    const digits = str.replace(/[^\d]/g, '');
    if (digits.length === 1) {
        const d = parseInt(digits, 10);
        if (d >= 1 && d <= (options?.length || 5)) {
            return d - 1;
        }
    }

    return -1;
}

/**
 * Robustly checks if candidate answer is correct
 */
function checkAnswerCorrect(userAns, correctAns, options = [], tolerance = 0, qType = 'MCQ') {
    if (userAns === null || userAns === undefined || String(userAns).trim() === '') return false;
    if (correctAns === null || correctAns === undefined || String(correctAns).trim() === '') return false;

    // Numerical Question Check
    const qTypeUpper = String(qType || '').toUpperCase();
    if (qTypeUpper.includes('NUMER')) {
        const pUser = parseFloat(String(userAns).trim());
        const pCorr = parseFloat(String(correctAns).trim());
        if (!isNaN(pUser) && !isNaN(pCorr)) {
            const tol = Math.max(0, parseFloat(tolerance) || 0) + 1e-9;
            return Math.abs(pUser - pCorr) <= tol;
        }
    }

    // Direct string equality (case-insensitive)
    if (normalizeText(userAns) === normalizeText(correctAns)) return true;

    // Multi-select / Array comparison
    if (Array.isArray(userAns) || Array.isArray(correctAns)) {
        const toArr = (v) => Array.isArray(v) ? v : String(v).split(/[,;]+/);
        const uIndices = toArr(userAns).map(v => resolveOptionIndex(v, options)).filter(i => i !== -1).sort();
        const cIndices = toArr(correctAns).map(v => resolveOptionIndex(v, options)).filter(i => i !== -1).sort();
        if (uIndices.length > 0 && uIndices.length === cIndices.length && uIndices.every((val, i) => val === cIndices[i])) {
            return true;
        }
    }

    // Canonical index matching
    const uIdx = resolveOptionIndex(userAns, options);
    const cIdx = resolveOptionIndex(correctAns, options);

    if (uIdx !== -1 && cIdx !== -1 && uIdx === cIdx) {
        return true;
    }

    // Fallback numerical float parse
    const pU = parseFloat(String(userAns).trim());
    const pC = parseFloat(String(correctAns).trim());
    if (!isNaN(pU) && !isNaN(pC) && Math.abs(pU - pC) <= 1e-9) {
        return true;
    }

    return false;
}

module.exports = {
    stripLeadingLabel,
    normalizeText,
    resolveOptionIndex,
    checkAnswerCorrect
};
