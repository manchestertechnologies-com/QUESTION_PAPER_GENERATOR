import React, { useEffect, useRef } from 'react';

/**
 * QuestionSettingsPopover.jsx
 *
 * In-Question Alignment & Layout Popover matching the user's reference design.
 * Features:
 *  - IMAGE ALIGNMENT: Left | Right | Top | Below | Center
 *  - OPTIONS PER LINE: 1 | 2 | 4
 *  - IMAGE SIZE:
 *      +10, +25, +50, +100, +250 (Green)
 *      -10, -25, -50, -100, -250 (Red/Pink)
 *  - Zero print footprint (.no-print)
 */
export default function QuestionSettingsPopover({
    isOpen,
    onClose,
    questionId,
    currentAlignment = 'Center',
    currentOptionsPerLine = 4,
    onAlignmentChange,
    onOptionsPerLineChange,
    onImageSizeDelta,
}) {
    const popoverRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                onClose();
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const alignments = ['Left', 'Right', 'Top', 'Below', 'Center'];
    const optionsPerLineChoices = [1, 2, 4];
    const plusSizes = [10, 25, 50, 100, 250];
    const minusSizes = [10, 25, 50, 100, 250];

    return (
        <div
            ref={popoverRef}
            className="no-print absolute z-50 right-0 top-8 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 text-xs font-sans animate-fade-in select-none"
            style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header / IMAGE ALIGNMENT */}
            <div className="bg-[#e9ecef] px-3 py-1.5 border-b border-slate-200">
                <span className="font-bold text-[11px] text-slate-700 tracking-wider uppercase">
                    Image Alignment
                </span>
            </div>
            <div className="p-2.5 flex items-center justify-between gap-1 bg-white">
                {alignments.map((align) => {
                    const isActive = String(currentAlignment).toLowerCase() === align.toLowerCase();
                    return (
                        <button
                            key={align}
                            type="button"
                            onClick={() => onAlignmentChange && onAlignmentChange(questionId, align)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                                isActive
                                    ? 'bg-[#0d6efd] text-white shadow-xs font-bold'
                                    : 'bg-[#f1f3f5] text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            {align}
                        </button>
                    );
                })}
            </div>

            {/* OPTIONS PER LINE */}
            <div className="bg-[#e9ecef] px-3 py-1.5 border-t border-b border-slate-200">
                <span className="font-bold text-[11px] text-slate-700 tracking-wider uppercase">
                    Options Per Line
                </span>
            </div>
            <div className="p-2.5 flex items-center gap-2 bg-white">
                {optionsPerLineChoices.map((num) => {
                    const isActive = Number(currentOptionsPerLine) === num;
                    return (
                        <button
                            key={num}
                            type="button"
                            onClick={() => onOptionsPerLineChange && onOptionsPerLineChange(questionId, num)}
                            className={`flex-1 py-1 rounded-md text-xs font-bold transition cursor-pointer text-center ${
                                isActive
                                    ? 'bg-[#0d6efd] text-white shadow-xs'
                                    : 'bg-[#f1f3f5] text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            {num}
                        </button>
                    );
                })}
            </div>

            {/* IMAGE SIZE */}
            <div className="bg-[#e9ecef] px-3 py-1.5 border-t border-b border-slate-200">
                <span className="font-bold text-[11px] text-slate-700 tracking-wider uppercase">
                    Image Size
                </span>
            </div>
            <div className="p-2.5 space-y-2 bg-white">
                {/* Positive resize buttons (Green) */}
                <div className="grid grid-cols-5 gap-1.5">
                    {plusSizes.map((delta) => (
                        <button
                            key={`plus-${delta}`}
                            type="button"
                            onClick={() => onImageSizeDelta && onImageSizeDelta(questionId, delta)}
                            className="bg-[#198754] hover:bg-green-700 active:scale-95 text-white text-[11px] font-bold py-1 px-1 rounded-md transition shadow-2xs text-center cursor-pointer"
                            title={`Increase image size by ${delta}px`}
                        >
                            +{delta}
                        </button>
                    ))}
                </div>

                {/* Negative resize buttons (Red/Pink) */}
                <div className="grid grid-cols-5 gap-1.5">
                    {minusSizes.map((delta) => (
                        <button
                            key={`minus-${delta}`}
                            type="button"
                            onClick={() => onImageSizeDelta && onImageSizeDelta(questionId, -delta)}
                            className="bg-[#dc3545] hover:bg-rose-700 active:scale-95 text-white text-[11px] font-bold py-1 px-1 rounded-md transition shadow-2xs text-center cursor-pointer"
                            title={`Decrease image size by ${delta}px`}
                        >
                            -{delta}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
