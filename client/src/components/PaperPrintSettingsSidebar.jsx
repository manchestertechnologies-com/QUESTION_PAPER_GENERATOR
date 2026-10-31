import React from 'react';
import { Download, FileText, Printer, Check } from 'lucide-react';

/**
 * PaperPrintSettingsSidebar.jsx
 *
 * Professional Paper Print Settings sidebar matching the user's uploaded reference screenshots:
 *  - Display Questions, Solutions (7 exact options)
 *  - Options Per Line: 1 | 2 | 4 (segmented control)
 *  - Options Name: (1)(2)(3)(4) | (A)(B)(C)(D) | (a)(b)(c)(d)
 *  - Select Font Family: Times New Roman, Arial, Garamond, Cambria, Palatino, Goudy, Baskerville, PT Serif
 *  - Font Size: 14 to 27
 *  - Custom Sl No
 *  - Gap Between Options: No Spacing, Default, 5, 10, 15
 *  - Gap Between Questions: No Spacing, Default, 5, 10, 15
 *  - Checkboxes:
 *      * Show Question Level
 *      * Image below Question
 *      * Paper 2 Column
 *      * Paper 2 Column Question Break
 *  - Download PDF button (vibrant blue with icon)
 */
export default function PaperPrintSettingsSidebar({
    settings = {},
    setSettings,
    onDownloadPdf,
}) {
    const update = (key, val) => {
        setSettings(prev => ({
            ...prev,
            [key]: val,
        }));
    };

    const displayOptions = [
        '1. Questions',
        '2. Questions with Answers',
        '3. Questions with Answers & Solutions',
        '4. Questions after Answers & Solutions',
        '5. Only Questions with No Options',
        '6. Only Answers & Solutions',
        '7. Only Answers',
    ];

    const optionsNameChoices = [
        '(1) (2) (3) (4)',
        '(A) (B) (C) (D)',
        '(a) (b) (c) (d)',
    ];

    const fontFamilies = [
        'Times New Roman',
        'Arial',
        'Garamond',
        'Cambria',
        'Palatino',
        'Goudy',
        'Baskerville',
        'PT Serif',
    ];

    const fontSizes = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27];

    const gapChoices = ['No Spacing', 'Default', '5', '10', '15'];

    const currentDisplayMode = settings.displayMode || '1. Questions';
    const currentOptionsPerLine = Number(settings.optionsPerLine) || 4;
    const currentOptionStyle = settings.optionStyle || '(1) (2) (3) (4)';
    const currentFontFamily = settings.fontFamily || 'Times New Roman';
    const currentFontSize = Number(settings.fontSize?.replace?.('px', '') || settings.fontSize) || 16;
    const currentStartQNo = settings.customStartQNo ?? settings.startQNo ?? 1;
    const currentGapOptions = settings.gapBetweenOptions || 'Default';
    const currentGapQuestions = settings.gapBetweenQuestions || 'Default';

    return (
        <aside className="no-print w-80 bg-white border-r border-slate-200 p-5 shadow-sm overflow-y-auto flex flex-col justify-between h-full select-none text-slate-700 font-sans">
            <div className="space-y-4">
                {/* Header with printer icon */}
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Printer className="w-5 h-5 text-slate-800" />
                    <h2 className="text-base font-bold text-slate-800 tracking-tight">
                        Paper Print Settings
                    </h2>
                </div>

                {/* 1. Display Questions, Solutions */}
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Display Questions, Solutions <span className="text-rose-500">*</span>
                    </label>
                    <select
                        value={currentDisplayMode}
                        onChange={(e) => update('displayMode', e.target.value)}
                        className="w-full text-xs font-medium text-slate-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer shadow-2xs"
                    >
                        {displayOptions.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 2. Options Per Line & Options Name in grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Options Per Line <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-300 shadow-2xs">
                            {[1, 2, 4].map((num) => {
                                const isActive = currentOptionsPerLine === num;
                                return (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => update('optionsPerLine', num)}
                                        className={`flex-1 py-1.5 text-xs font-bold transition text-center cursor-pointer ${
                                            isActive
                                                ? 'bg-[#0d6efd] text-white'
                                                : 'bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        {num}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Options Name <span className="text-rose-500">*</span>
                        </label>
                        <select
                            value={currentOptionStyle}
                            onChange={(e) => update('optionStyle', e.target.value)}
                            className="w-full text-xs font-medium text-slate-800 border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer shadow-2xs"
                        >
                            {optionsNameChoices.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 3. Font Family & Font Size */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Select Font Family <span className="text-rose-500">*</span>
                        </label>
                        <select
                            value={currentFontFamily}
                            onChange={(e) => update('fontFamily', e.target.value)}
                            className="w-full text-xs font-medium text-slate-800 border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer shadow-2xs"
                        >
                            {fontFamilies.map((f) => (
                                <option key={f} value={f}>
                                    {f}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Font Size <span className="text-rose-500">*</span>
                        </label>
                        <select
                            value={currentFontSize}
                            onChange={(e) => update('fontSize', `${e.target.value}px`)}
                            className="w-full text-xs font-medium text-slate-800 border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer shadow-2xs"
                        >
                            {fontSizes.map((sz) => (
                                <option key={sz} value={sz}>
                                    {sz}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 4. Custom Sl No & Gap Between Options */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Custom Sl No <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={currentStartQNo}
                            onChange={(e) => update('customStartQNo', Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full text-xs font-medium text-slate-800 border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Gap Between Options <span className="text-rose-500">*</span>
                        </label>
                        <select
                            value={currentGapOptions}
                            onChange={(e) => update('gapBetweenOptions', e.target.value)}
                            className="w-full text-xs font-medium text-slate-800 border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer shadow-2xs"
                        >
                            {gapChoices.map((g) => (
                                <option key={g} value={g}>
                                    {g}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 5. Gap Between Questions */}
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Gap Between Questions <span className="text-rose-500">*</span>
                    </label>
                    <select
                        value={currentGapQuestions}
                        onChange={(e) => update('gapBetweenQuestions', e.target.value)}
                        className="w-full text-xs font-medium text-slate-800 border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer shadow-2xs"
                    >
                        {gapChoices.map((g) => (
                            <option key={g} value={g}>
                                {g}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Checkboxes list */}
                <div className="pt-2 space-y-2.5 border-t border-slate-100">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900">
                        <input
                            type="checkbox"
                            checked={Boolean(settings.showQuestionLevel)}
                            onChange={(e) => update('showQuestionLevel', e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                        <span>Show Question Level</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900">
                        <input
                            type="checkbox"
                            checked={Boolean(settings.imageBelowQuestion)}
                            onChange={(e) => update('imageBelowQuestion', e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                        <span>Image below Question</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900">
                        <input
                            type="checkbox"
                            checked={Boolean(settings.paper2Column || settings.columns === 2)}
                            onChange={(e) => {
                                update('paper2Column', e.target.checked);
                                update('columns', e.target.checked ? 2 : 1);
                            }}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                        <span>Paper 2 Column</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900">
                        <input
                            type="checkbox"
                            checked={Boolean(settings.paper2ColumnQuestionBreak)}
                            onChange={(e) => update('paper2ColumnQuestionBreak', e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                        <span>Paper 2 Column Question Break</span>
                    </label>
                </div>
            </div>

            {/* Bottom Download PDF Button */}
            <div className="pt-5 mt-4 border-t border-slate-100">
                <button
                    type="button"
                    onClick={onDownloadPdf}
                    className="w-full bg-[#0d6efd] hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                    <FileText className="w-4 h-4 ml-0.5" />
                </button>
            </div>
        </aside>
    );
}
