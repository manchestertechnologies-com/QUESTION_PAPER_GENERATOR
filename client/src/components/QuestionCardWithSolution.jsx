import React, { useState } from 'react';
import { Trash2, Edit3, Check, X } from 'lucide-react';
import MathRenderer from './MathRenderer';
import { isOptionCorrect, optionLabel, getResolvedAnswerLabel } from '../utils/sanitize';

/**
 * QuestionCardWithSolution.jsx
 *
 * Renders each question card in the Question Selection / Review view
 * matching the user's reference screenshot (Image 2):
 *  - Top row: Level Badge (blue) + Delete (red) + Edit (blue)
 *  - Statement with LaTeX math and edit icon
 *  - Options (A, B, C, D) with correct answer in green circle and edit icons
 *  - Light green solution explanation box with LaTeX math and edit icon
 *  - "Select Topic" pill list with active topic in solid blue
 *  - Full inline editing modal
 */
export default function QuestionCardWithSolution({
    q,
    displayNum = 1,
    onDelete,
    onUpdate,
    allConcepts = [],
    onSelectConcept,
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState(() => ({
        questionText: q.questionText || q.question || '',
        options: Array.isArray(q.options)
            ? q.options.map(opt => typeof opt === 'object' ? (opt.text || opt.optionText || '') : String(opt || ''))
            : ['', '', '', ''],
        answer: String(q.answer || q.correct_option || 'B'),
        solutionText: q.solutionText || q.solution || '',
        level: (q.level || 'medium').toLowerCase(),
        concept: q.concept || q.topic || 'General',
    }));

    const qText = q.questionText || q.question || '';
    const options = Array.isArray(q.options) ? q.options : [];
    const solutionText = q.solutionText || q.solution || '';
    const level = (q.level || 'medium').toLowerCase();
    const currentConcept = q.concept || q.topic || '';

    // Level label formatting
    const levelLabel = level === 'hard' ? 'Hard' : (level === 'easy' ? 'Easy' : 'Medium');

    const handleSaveEdit = (e) => {
        e.preventDefault();
        if (onUpdate) {
            onUpdate({
                ...q,
                ...editForm,
                answer: editForm.answer.trim(),
            });
        }
        setIsEditing(false);
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 font-sans transition hover:shadow-md relative">
            {/* Top Toolbar: Level Badge on Left, Delete and Edit on Right */}
            <div className="flex items-center justify-between pb-4 mb-3 border-b border-slate-100">
                <span className="bg-[#0d6efd] text-white text-[11px] font-bold px-3 py-1 rounded-md shadow-2xs uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-white/80"></span>
                    Level: {levelLabel}
                </span>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onDelete && onDelete(q._id || q.id || displayNum)}
                        className="bg-[#dc3545] hover:bg-rose-700 active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                        title="Delete question"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setEditForm({
                                questionText: qText,
                                options: options.map(opt => typeof opt === 'object' ? (opt.text || opt.optionText || '') : String(opt || '')),
                                answer: String(q.answer || q.correct_option || 'B'),
                                solutionText,
                                level,
                                concept: currentConcept,
                            });
                            setIsEditing(true);
                        }}
                        className="bg-[#0d6efd] hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                        title="Edit question and solution"
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                    </button>
                </div>
            </div>

            {/* Question Statement */}
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="text-slate-900 font-semibold text-sm leading-relaxed flex-1">
                    <span className="font-bold mr-1.5 text-slate-800">Q{displayNum}.</span>
                    <MathRenderer inline text={qText} />
                </div>
                <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-slate-400 hover:text-blue-600 transition p-1 rounded-md hover:bg-slate-100 cursor-pointer flex-shrink-0"
                    title="Edit question text"
                >
                    <Edit3 className="w-4 h-4" />
                </button>
            </div>

            {/* Diagram / Image if present */}
            {q.imageUrl && (
                <div className="my-3 text-center">
                    <img
                        src={q.imageUrl}
                        alt="Question Diagram"
                        className="max-h-56 max-w-full mx-auto object-contain rounded-lg border border-slate-200"
                    />
                </div>
            )}

            {/* Options List */}
            <div className="space-y-2 mb-4">
                {options.map((opt, oIdx) => {
                    const optText = typeof opt === 'object' ? (opt.text || opt.optionText || '') : String(opt || '');
                    const label = String.fromCharCode(65 + oIdx); // A, B, C, D
                    const isCorrect = isOptionCorrect(q, oIdx);

                    return (
                        <div
                            key={oIdx}
                            className={`flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl transition border ${
                                isCorrect
                                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-medium'
                                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                        isCorrect
                                            ? 'bg-[#198754] text-white shadow-xs'
                                            : 'bg-slate-200 text-slate-700'
                                    }`}
                                >
                                    {label}
                                </span>
                                <div className="text-xs leading-relaxed flex-1 min-w-0">
                                    <MathRenderer inline text={optText} />
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100 transition cursor-pointer flex-shrink-0"
                                title="Edit option"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Solution Box (Light green background with LaTeX formulas) */}
            {solutionText && (
                <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4 mb-4 text-[#166534] relative shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                        <div className="text-xs leading-relaxed flex-1 overflow-x-auto">
                            <MathRenderer text={solutionText} />
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="text-emerald-700/60 hover:text-emerald-900 p-1 rounded hover:bg-emerald-100/50 transition cursor-pointer flex-shrink-0"
                            title="Edit solution"
                        >
                            <Edit3 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Concept / Topic Pills below solution */}
            <div className="pt-3 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-700 mb-2 underline decoration-blue-500 decoration-2 underline-offset-4">
                    Select Topic
                </div>
                <div className="flex flex-wrap gap-2">
                    {allConcepts.length > 0 ? (
                        allConcepts.map((concept, cIdx) => {
                            const isActive = String(concept).toLowerCase() === String(currentConcept).toLowerCase();
                            return (
                                <button
                                    key={concept}
                                    type="button"
                                    onClick={() => onSelectConcept && onSelectConcept(q._id || q.id, concept)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer text-left ${
                                        isActive
                                            ? 'bg-[#0d6efd] text-white shadow-xs font-bold'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    {cIdx + 1}. {concept}
                                </button>
                            );
                        })
                    ) : (
                        <span className="bg-[#0d6efd] text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-xs">
                            1. {currentConcept || 'General'}
                        </span>
                    )}
                </div>
            </div>

            {/* Inline Editing Modal */}
            {isEditing && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">
                                Edit Question {displayNum}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            {/* Question Text */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Question Text (supports LaTeX $...$ or $$...$$):
                                </label>
                                <textarea
                                    rows={3}
                                    value={editForm.questionText}
                                    onChange={(e) => setEditForm({ ...editForm, questionText: e.target.value })}
                                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                    required
                                />
                            </div>

                            {/* Options */}
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-700">
                                    Options:
                                </label>
                                {editForm.options.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className="w-6 text-xs font-bold text-slate-600 text-center">
                                            ({String.fromCharCode(65 + idx)})
                                        </span>
                                        <input
                                            type="text"
                                            value={opt}
                                            onChange={(e) => {
                                                const next = [...editForm.options];
                                                next[idx] = e.target.value;
                                                setEditForm({ ...editForm, options: next });
                                            }}
                                            className="flex-1 text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                            placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Correct Answer & Difficulty Level */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Correct Answer:
                                    </label>
                                    <select
                                        value={editForm.answer}
                                        onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white cursor-pointer"
                                    >
                                        <option value="A">A (1)</option>
                                        <option value="B">B (2)</option>
                                        <option value="C">C (3)</option>
                                        <option value="D">D (4)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Difficulty Level:
                                    </label>
                                    <select
                                        value={editForm.level}
                                        onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white cursor-pointer"
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>
                            </div>

                            {/* Solution Text */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Solution / Explanation (supports LaTeX):
                                </label>
                                <textarea
                                    rows={4}
                                    value={editForm.solutionText}
                                    onChange={(e) => setEditForm({ ...editForm, solutionText: e.target.value })}
                                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                                    placeholder="Enter step-by-step solution..."
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-[#0d6efd] hover:bg-blue-700 text-white text-xs font-bold px-5 py-2 rounded-xl shadow transition cursor-pointer"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
