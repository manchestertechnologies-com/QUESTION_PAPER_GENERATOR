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

    // Fast check: must have indicators of two columns or match lists
    const hasMTFKeyword = /match\s+(?:the\s+)?(?:list|column|pairs?)|(?:column|list)\s*[-–—\s]*I\b/i.test(text);
    if (!hasMTFKeyword) return null;

    let c1Match = null;
    let c2Match = null;

    // Strategy 1: Look for markdown bold **Column I** / **List-I** and **Column II** / **List-II**
    const boldC1 = text.match(/\*{2}(?:Column|List)\s*[-–—\s]*(?:I|1|A)\*{2}/i);
    const boldC2 = text.match(/\*{2}(?:Column|List)\s*[-–—\s]*(?:II|2|B)\*{2}/i);

    if (boldC1 && boldC2 && boldC1.index < boldC2.index) {
        c1Match = boldC1;
        c2Match = boldC2;
    } else {
        // Strategy 2: Look for non-bold Column I / Column II (avoiding "List-I with List-II" in introduction)
        const allC1 = [...text.matchAll(/(?:\n|<br\s*\/?>|\.|\b)(?:Column|List)\s*[-–—\s]*(?:I|1|A)(?:\s*[:\-])?/gi)];
        const allC2 = [...text.matchAll(/(?:\n|<br\s*\/?>|\.|\b)(?:Column|List)\s*[-–—\s]*(?:II|2|B)(?:\s*[:\-])?/gi)];

        for (const m1 of allC1) {
            const afterM1 = text.substring(m1.index, m1.index + 25);
            if (/with|and\s+list/i.test(afterM1)) continue;

            for (const m2 of allC2) {
                if (m2.index > m1.index) {
                    c1Match = m1;
                    c2Match = m2;
                    break;
                }
            }
            if (c1Match && c2Match) break;
        }
    }

    if (!c1Match || !c2Match) return null;

    const stem = text.substring(0, c1Match.index).trim();
    const col1Header = c1Match[0].replace(/[\*\n\r:]/g, '').trim() || 'Column I';
    const col2Header = c2Match[0].replace(/[\*\n\r:]/g, '').trim() || 'Column II';

    const col1Raw = text.substring(c1Match.index + c1Match[0].length, c2Match.index).trim();
    const col2Raw = text.substring(c2Match.index + c2Match[0].length).trim();

    function extractItems(raw, defaultLabels) {
        if (!raw) return [];

        // 1. Try explicit labels: (A), (B), (C), (D) or (p), (q), (r), (s) or (i), (ii), (iii), (iv) or a), b), c), d) or 1., 2., 3., 4.
        const labelRegex = /(?:^\s*|\s+)(?:\(([A-Za-z0-9ivxLCDM]+)\)|([A-Za-z0-9ivxLCDM]+)[\.\)]|\b([pqrstuvw])\)|\b([a-d])\))\s*/gi;
        const matches = [...raw.matchAll(labelRegex)];

        if (matches.length >= 2) {
            const items = [];
            for (let i = 0; i < matches.length; i++) {
                const fullMatch = matches[i][0];
                const cleanLabel = matches[i][1] || matches[i][2] || matches[i][3] || matches[i][4] || fullMatch.trim();
                const start = matches[i].index + fullMatch.length;
                const end = i < matches.length - 1 ? matches[i + 1].index : raw.length;
                const content = raw.substring(start, end).trim();
                items.push({ label: `(${cleanLabel})`, content });
            }
            return items;
        }

        // 2. Try splitting by newlines or <br>
        const lines = raw.split(/\r\n|\n|<br\s*\/?>/i).map(l => l.trim()).filter(Boolean);
        if (lines.length >= 2) {
            return lines.map((l, idx) => ({
                label: defaultLabels[idx] || `(${idx + 1})`,
                content: l
            }));
        }

        // 3. Fallback: single item
        return [{ label: defaultLabels[0] || '(1)', content: raw }];
    }

    const items1 = extractItems(col1Raw, ['(A)', '(B)', '(C)', '(D)', '(E)']);
    const items2 = extractItems(col2Raw, ['(p)', '(q)', '(r)', '(s)', '(t)']);

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
