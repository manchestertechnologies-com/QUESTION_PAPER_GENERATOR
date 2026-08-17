import React, { useEffect, useRef } from 'react';
import renderMathInElement from 'katex/dist/contrib/auto-render.mjs';
import { sanitize } from '../utils/sanitize';

const MathRenderer = ({ text, className = '', style = {}, inline = false }) => {
    const containerRef = useRef(null);
    const safeText = typeof text === 'string' ? text : (text ? String(text) : '');

    useEffect(() => {
        if (containerRef.current && safeText) {
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
    }, [safeText]);

    const sanitizedHtml = sanitize(safeText);

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
