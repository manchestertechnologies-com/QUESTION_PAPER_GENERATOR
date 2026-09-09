/**
 * MatchTable.jsx
 *
 * Universal 2-Column Match the Following (MTF) / Match the List Table Component.
 * Supports:
 * 1. Questions with structured q.matchPairs = [{ left, right }]
 * 2. Unstructured questionText containing "**Column I** ... **Column II**" or "List-I ... List-II"
 * 3. Side-by-side balanced 2-column layout with KaTeX math rendering for both columns.
 */

import React from 'react';
import MathRenderer from './MathRenderer';

/**
 * Parses raw question text to detect and extract Column I & Column II items.
 * Returns parsed object { stem, col1Header, col2Header, items1, items2, isMTF: true } or null.
 */
export function parseMTFFromText(text) {
    if (!text || typeof text !== 'string') return null;

    const hasMTFKeyword = /match\s+(?:the\s+)?(?:list|column|pairs?)|(?:column|list)\s*[-–—\s]*I\b/i.test(text);
    if (!hasMTFKeyword) return null;

    const clean = text.replace(/\*\*/g, '');

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

    if (col1Offset === -1 || col2Offset === -1) return null;

    const stem = clean.substring(0, col1Offset).trim();
    const col1Header = clean.substring(col1Offset, col1Offset + col1HeaderLen).replace(/[\*\n\r:]/g, '').trim() || 'Column I';
    const col2Header = clean.substring(col2Offset, col2Offset + col2HeaderLen).replace(/[\*\n\r:]/g, '').trim() || 'Column II';

    let col1Raw = clean.substring(col1Offset + col1HeaderLen, col2Offset).trim();
    let col2Raw = clean.substring(col2Offset + col2HeaderLen).trim();

    col2Raw = col2Raw.replace(/(?:\n|\s)*(?:(?:\([1-4A-D]\)|[1-4A-D]\.|\b(?:Codes?|Options?))\s*(?:[a-d][\-–—\s]*\(?[ivx0-9p-t]+\)?[\s,;]*)+|(?:\([1-4A-D]\)\s+[A-Da-d][\-–—].*)|(?:Choose|Select)\s+(?:the\s+)?correct[\s\S]*)$/i, '').trim();

    function extractItems(raw, isLeft = true, defaultLabels) {
        if (!raw) return [];

        const lines = raw.split(/\r\n|\n|<br\s*\/?>/i).map(l => l.trim()).filter(Boolean);
        if (lines.length >= 2) {
            return lines.map((l, idx) => {
                const cleaned = l.replace(/^[\(\[]?\s*(?:[A-Za-z0-9ivxIVX]+|[p-tP-T])\s*[\)\]\.:\-]\s*/, '').trim();
                const label = isLeft ? `(${String.fromCharCode(97 + idx)})` : `(${['i','ii','iii','iv','v','vi'][idx] || (idx+1)})`;
                return { label, content: cleaned || l };
            });
        }

        const strictLabelRegex = isLeft
            ? /(?:^|\s)(?:\(([a-eA-E])\)|([a-eA-E])[\.\:\-])\s+/g
            : /(?:^|\s)(?:\(([1-6]|i{1,3}|iv|v|vi|[p-tP-T])\)|([1-6]|i{1,3}|iv|v|vi|[p-tP-T])[\.\:\-])\s+/g;

        const matches = [...raw.matchAll(strictLabelRegex)];
        if (matches.length >= 2) {
            const items = [];
            for (let i = 0; i < matches.length; i++) {
                const start = matches[i].index + matches[i][0].length;
                const end = i < matches.length - 1 ? matches[i + 1].index : raw.length;
                const piece = raw.substring(start, end).trim();
                const label = isLeft ? `(${String.fromCharCode(97 + i)})` : `(${['i','ii','iii','iv','v','vi'][i] || (i+1)})`;
                if (piece) items.push({ label, content: piece });
            }
            if (items.length >= 2) return items;
        }

        return [{ label: defaultLabels[0] || '(1)', content: raw }];
    }

    const items1 = extractItems(col1Raw, true, ['(a)', '(b)', '(c)', '(d)', '(e)']);
    const items2 = extractItems(col2Raw, false, ['(i)', '(ii)', '(iii)', '(iv)', '(v)']);

    if (items1.length === 0 && items2.length === 0) return null;

    return {
        stem,
        col1Header,
        col2Header,
        items1,
        items2,
        maxRows: Math.max(items1.length, items2.length),
        isMTF: true
    };
}

/**
 * MatchTable Component
 * Renders structured match pairs or parsed MTF text into a clean side-by-side 2-column table.
 */
const MatchTable = ({ question, className = '', isPrint = false }) => {
    if (!question) return null;

    // Option A: Structured matchPairs on the question object
    if (Array.isArray(question.matchPairs) && question.matchPairs.length > 0) {
        return (
            <div className={`my-3 overflow-hidden rounded-xl border border-gray-300 shadow-sm bg-white ${className}`}>
                <table className="w-full border-collapse text-left text-xs sm:text-sm">
                    <thead>
                        <tr className="bg-slate-100/90 text-navy font-black border-b border-gray-300">
                            <th className="p-2.5 sm:p-3 border-r border-gray-300 w-1/2 uppercase tracking-wider">Column I</th>
                            <th className="p-2.5 sm:p-3 w-1/2 uppercase tracking-wider">Column II</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {question.matchPairs.map((pair, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="p-2.5 sm:p-3 border-r border-gray-200 align-top">
                                    <span className="font-bold text-navy mr-1.5">({String.fromCharCode(65 + idx)})</span>
                                    <MathRenderer inline text={pair.left || ''} />
                                </td>
                                <td className="p-2.5 sm:p-3 align-top">
                                    <span className="font-bold text-navy mr-1.5">({idx + 1})</span>
                                    <MathRenderer inline text={pair.right || ''} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    // Option B: Text containing Column I / Column II
    const text = question.questionText || question.stem || question.question || '';
    const parsed = parseMTFFromText(text);

    if (!parsed) return null;

    const rows = [];
    for (let i = 0; i < parsed.maxRows; i++) {
        rows.push({
            item1: parsed.items1[i] || null,
            item2: parsed.items2[i] || null,
        });
    }

    return (
        <div className={`my-3 overflow-hidden rounded-xl border border-gray-300 shadow-sm bg-white ${className}`}>
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                    <tr className="bg-slate-100/90 text-navy font-black border-b border-gray-300">
                        <th className="p-2.5 sm:p-3 border-r border-gray-300 w-1/2 uppercase tracking-wider">{parsed.col1Header}</th>
                        <th className="p-2.5 sm:p-3 w-1/2 uppercase tracking-wider">{parsed.col2Header}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {rows.map((row, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <td className="p-2.5 sm:p-3 border-r border-gray-200 align-top">
                                {row.item1 && (
                                    <div className="flex items-start gap-1.5">
                                        <span className="font-bold text-navy shrink-0">{row.item1.label}</span>
                                        <div className="min-w-0 font-normal">
                                            <MathRenderer inline text={row.item1.content} />
                                        </div>
                                    </div>
                                )}
                            </td>
                            <td className="p-2.5 sm:p-3 align-top">
                                {row.item2 && (
                                    <div className="flex items-start gap-1.5">
                                        <span className="font-bold text-navy shrink-0">{row.item2.label}</span>
                                        <div className="min-w-0 font-normal">
                                            <MathRenderer inline text={row.item2.content} />
                                        </div>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default MatchTable;
