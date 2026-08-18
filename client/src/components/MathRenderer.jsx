import React, { useEffect, useRef } from 'react';
import renderMathInElement from 'katex/dist/contrib/auto-render.mjs';
import { sanitize } from '../utils/sanitize';

const MathRenderer = ({ text, className = '', style = {}, inline = false }) => {
    const containerRef = useRef(null);
    const safeText = typeof text === 'string' ? text : (text ? String(text) : '');

    // Parse inline image blocks {{IMG::...}}
    let htmlToRender = safeText;
    if (htmlToRender.includes('{{IMG::')) {
        htmlToRender = htmlToRender.replace(/\{\{IMG::(.*?)\}\}/gi, (match, src) => {
            return `<img src="${src}" alt="Question Diagram" class="max-w-full max-h-64 object-contain rounded-lg shadow-sm mx-auto my-3" style="display: block; margin: 12px auto;" />`;
        });
    }

    useEffect(() => {
        if (containerRef.current && htmlToRender) {
            try {
                renderMathInElement(containerRef.current, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\[', display: true }
                    ],
                    throwOnError: false,
                });
            } catch (err) {
                console.error('KaTeX rendering error:', err);
            }
        }
    }, [htmlToRender]);

    const sanitizedHtml = sanitize(htmlToRender);

    if (inline) {
        return (
            <span
                ref={containerRef}
                className={`math-renderer inline-math ${className}`}
                style={style}
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
        );
    }

    return (
        <div
            ref={containerRef}
            className={`math-renderer ${className}`}
            style={style}
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
    );
};

export default MathRenderer;
