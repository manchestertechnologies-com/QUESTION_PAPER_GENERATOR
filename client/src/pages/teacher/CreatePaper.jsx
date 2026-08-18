import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { sanitize, optionLabel } from '../../utils/sanitize';
import MathRenderer from '../../components/MathRenderer';

// ─── Small helper: toast notification ───────────────────────────────────────
const Toast = ({ msg, type, onClose }) => {
    useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
    const colors = type === 'success'
        ? 'bg-green-50 border-green-300 text-green-800'
        : type === 'error'
            ? 'bg-red-50 border-red-300 text-red-800'
            : 'bg-blue-50 border-blue-300 text-blue-800';
    return (
        <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-lg text-sm font-semibold animate-fade-in-up ${colors}`}>
            {type === 'success' && <span>✓</span>}
            {type === 'error' && <span>✕</span>}
            {type === 'info' && <span>ℹ</span>}
            {msg}
            <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100 text-lg leading-none">×</button>
        </div>
    );
};

// ─── Auto Get Questions Modal ────────────────────────────────────────────────
const AutoGetModal = ({ onClose, onConfirm, filteredCount }) => {
    const [qty, setQty] = useState('');
    const [level, setLevel] = useState('random');
    const max = filteredCount;

    const handleConfirm = () => {
        const n = parseInt(qty);
        if (!n || n < 1) return alert('Enter a valid number.');
        if (n > max) return alert(`Only ${max} questions available with current filters.`);
        onConfirm(n, level);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-surface rounded-[2rem] shadow-2xl w-full max-w-md p-10 border-b-8 border-gold animate-fade-in-up">
                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-navy mb-1 tracking-tight">Auto Fetch</h2>
                        <p className="text-xs text-slate/40 font-bold uppercase tracking-widest">
                            {max} Questions Available
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate/30 hover:text-red-500 bg-gray-50 rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold border border-gray-100 transition">×</button>
                </div>

                {/* Filter summary */}
                <div className="bg-navy/5 border border-navy/10 rounded-2xl p-5 mb-8">
                    <p className="text-[10px] font-black text-navy uppercase tracking-[0.2em] mb-2 opacity-50">Active Context</p>
                    <p className="text-sm text-navy font-medium leading-relaxed">The system will select the best matches based on your currently active filters.</p>
                </div>

                {/* Quantity input */}
                <div className="mb-8">
                    <label className="block text-[10px] font-black text-navy uppercase tracking-[0.2em] mb-3 ml-1">
                        Question Quantity
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            type="number"
                            min={1}
                            max={max}
                            value={qty}
                            onChange={e => setQty(e.target.value)}
                            placeholder={`1 – ${max}`}
                            className="flex-1 border-2 border-gray-100 focus:border-navy rounded-2xl px-5 py-4 text-2xl font-black text-navy outline-none text-center transition bg-gray-50/50"
                        />
                        <button onClick={() => setQty(String(max))} className="text-[10px] bg-navy text-gold font-black px-4 py-5 rounded-2xl shadow-lg hover:scale-105 transition active:scale-95 uppercase tracking-widest">
                            Max
                        </button>
                    </div>
                </div>

                {/* Level preference */}
                <div className="mb-10">
                    <label className="block text-[10px] font-black text-navy uppercase tracking-[0.2em] mb-3 ml-1">
                        Selection Strategy
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { val: 'random', label: 'Random' },
                            { val: 'easy', label: 'Easy First' },
                            { val: 'hard', label: 'Hard First' },
                            { val: 'balanced', label: 'Balanced' },
                        ].map(opt => (
                            <button
                                key={opt.val}
                                onClick={() => setLevel(opt.val)}
                                className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${level === opt.val
                                        ? 'bg-navy text-gold border-navy shadow-lg'
                                        : 'bg-white text-slate/50 border-gray-100 hover:border-navy/30'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                    <button onClick={onClose} className="flex-1 bg-gray-50 text-slate/60 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition">
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!qty || parseInt(qty) < 1}
                        className="flex-[2] bg-gold text-navy py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-xl transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-3 shadow-lg"
                    >
                        Confirm Fetch
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Generate Paper Modal ────────────────────────────────────────────────────
const GeneratePaperModal = ({ onClose, onGenerate, filters, allQuestions, setFilters, uniqueChapters, uniqueConcepts }) => {
    const [localPattern, setLocalPattern] = useState([
        { sectionName: 'Section A', numQuestions: '', type: '', description: '', marks: 0 }
    ]);
    const [localFilters, setLocalFilters] = useState({ ...filters });
    const [step, setStep] = useState(1); // 1: filters+pattern, 2: confirm

    const getTypeMultiplier = (type) => {
        const isNeet = localFilters.class === 'NEET';
        const map = { MCQ: isNeet ? 4 : 1, '1m': 1, '2m': 2, '3m': 3, '4m': 4, '5m': 5 };
        return map[type] || 0;
    };

    const handlePatternChange = (idx, field, value) => {
        const updated = [...localPattern];
        updated[idx][field] = value;
        const num = field === 'numQuestions' ? parseInt(value) || 0 : parseInt(updated[idx].numQuestions) || 0;
        const type = field === 'type' ? value : updated[idx].type;
        updated[idx].marks = num * getTypeMultiplier(type);
        setLocalPattern(updated);
    };

    const addSection = () => {
        setLocalPattern([...localPattern, {
            sectionName: `Section ${String.fromCharCode(65 + localPattern.length)}`,
            numQuestions: '', type: '', description: '', marks: 0
        }]);
    };

    const removeSection = (idx) => {
        const updated = localPattern.filter((_, i) => i !== idx)
            .map((s, i) => ({ ...s, sectionName: `Section ${String.fromCharCode(65 + i)}` }));
        setLocalPattern(updated);
    };

    const totalQuestionsNeeded = localPattern.reduce((sum, s) => sum + (parseInt(s.numQuestions) || 0), 0);
    const totalMarks = localPattern.reduce((sum, s) => sum + (s.marks || 0), 0);

    // Count available per section type
    const availableForSection = (sec) => {
        return allQuestions.filter(q => {
            const matchClass = !localFilters.class || q.classes?.includes(localFilters.class) || q.class === localFilters.class;
            const matchLevel = !localFilters.level || q.level === localFilters.level;
            const matchType = !sec.type || q.type === sec.type;
            const matchChapter = !localFilters.chapter || q.chapter === localFilters.chapter;
            const matchConcept = !localFilters.concept || q.concept === localFilters.concept;
            return matchClass && matchLevel && matchType && matchChapter && matchConcept;
        }).length;
    };

    const isPatternValid = localPattern.every(s => s.numQuestions && s.type);

    const handleGenerate = () => {
        onGenerate(localPattern, localFilters);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-surface rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden">

                {/* Modal Header */}
                <div className="flex justify-between items-center p-10 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h2 className="text-3xl font-black text-navy mb-2 flex items-center gap-4">
                            <span className="bg-gold text-navy w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg rotate-3">⚡</span>
                            Generation Engine
                        </h2>
                        <p className="text-xs text-slate/40 font-bold uppercase tracking-widest">Automatic assessment assembly based on your parameters</p>
                    </div>
                    <button onClick={onClose} className="text-slate/30 hover:text-red-500 bg-white rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold border border-gray-100 shadow-sm transition">×</button>
                </div>

                <div className="flex-1 overflow-y-auto p-10 space-y-10">

                    {/* Step 1: Filter Settings */}
                    <div>
                        <div className="flex items-center gap-4 mb-6">
                            <span className="w-8 h-8 rounded-xl bg-navy text-gold text-xs font-black flex items-center justify-center shadow-lg">01</span>
                            <h3 className="font-black text-navy text-sm uppercase tracking-[0.2em]">Domain Context</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-gray-50 p-8 rounded-[2rem] border border-gray-100">
                            {[
                                {
                                    label: 'Academic Class', key: 'class',
                                    options: [
                                        { value: '', label: 'All Classes' },
                                        { value: '11', label: 'Class 11' },
                                        { value: '12', label: 'Class 12' },
                                        { value: 'JEE', label: 'JEE' },
                                        { value: 'KCET', label: 'KCET' },
                                        { value: 'NEET', label: 'NEET' },
                                    ]
                                },
                                {
                                    label: 'Difficulty Level', key: 'level',
                                    options: [
                                        { value: '', label: 'All Levels' },
                                        { value: 'easy', label: 'Easy' },
                                        { value: 'medium', label: 'Medium' },
                                        { value: 'hard', label: 'Hard' },
                                    ]
                                },
                            ].map(({ label, key, options }) => (
                                <div key={key} className="relative">
                                    <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2 ml-1">{label}</label>
                                    <select
                                        value={localFilters[key] || ''}
                                        onChange={e => setLocalFilters({ ...localFilters, [key]: e.target.value })}
                                        className="w-full border-2 border-gray-100 p-3.5 rounded-2xl text-sm font-bold text-navy bg-white focus:border-navy outline-none cursor-pointer transition-all shadow-sm"
                                    >
                                        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                            ))}
                            <div>
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2 ml-1">Curriculum Chapter</label>
                                <select
                                    value={localFilters.chapter || ''}
                                    onChange={e => setLocalFilters({ ...localFilters, chapter: e.target.value, concept: '' })}
                                    className="w-full border-2 border-gray-100 p-3.5 rounded-2xl text-sm font-bold text-navy bg-white focus:border-navy outline-none cursor-pointer transition-all shadow-sm"
                                >
                                    <option value="">All Chapters</option>
                                    {uniqueChapters.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2 ml-1">Specific Concept</label>
                                <select
                                    value={localFilters.concept || ''}
                                    onChange={e => setLocalFilters({ ...localFilters, concept: e.target.value })}
                                    className="w-full border-2 border-gray-100 p-3.5 rounded-2xl text-sm font-bold text-navy bg-white focus:border-navy outline-none cursor-pointer transition-all shadow-sm"
                                >
                                    <option value="">All Concepts</option>
                                    {uniqueConcepts.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Pattern */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-7 h-7 rounded-full bg-[#1e3280] text-white text-xs font-black flex items-center justify-center">2</span>
                            <h3 className="font-black text-gray-700 text-sm uppercase tracking-wider">Define Paper Pattern</h3>
                            {/* Totals */}
                            <div className="ml-auto flex gap-3">
                                <span className="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-full text-xs font-bold">
                                    {totalQuestionsNeeded} Questions
                                </span>
                                <span className="bg-green-50 text-green-700 border border-green-100 px-3 py-1 rounded-full text-xs font-bold">
                                    {totalMarks} Total Marks
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {localPattern.map((sec, idx) => {
                                const avail = availableForSection(sec);
                                const needed = parseInt(sec.numQuestions) || 0;
                                const isShort = needed > 0 && avail < needed;
                                return (
                                    <div key={idx} className={`relative flex flex-col md:flex-row gap-4 items-start md:items-center p-5 rounded-2xl border-l-4 group transition ${isShort ? 'bg-red-50 border-l-red-400 border border-red-100' : 'bg-gray-50 border-l-[#1e3280] border border-gray-100'}`}>

                                        {/* Section Name */}
                                        <div className="font-black text-sm text-[#1e3280] bg-white px-4 py-2.5 rounded-xl border border-blue-100 uppercase tracking-widest min-w-[120px] text-center shadow-sm">
                                            {sec.sectionName}
                                        </div>

                                        {/* Qty with dynamic +/- buttons */}
                                        <div className="relative flex-shrink-0">
                                            <label className="absolute -top-2 left-3 bg-gray-50 px-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Questions</label>
                                            <div className="flex items-center gap-1 mt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const current = parseInt(sec.numQuestions) || 0;
                                                        if (current > 1) handlePatternChange(idx, 'numQuestions', current - 1);
                                                    }}
                                                    className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 font-black text-navy flex items-center justify-center transition shadow-sm"
                                                    title="Decrease question count"
                                                >-</button>
                                                <input
                                                    type="number" min="1" placeholder="Qty"
                                                    value={sec.numQuestions}
                                                    onChange={e => handlePatternChange(idx, 'numQuestions', e.target.value)}
                                                    className="border border-gray-200 p-2 rounded-xl w-16 text-sm font-bold text-gray-700 outline-none text-center focus:border-[#1e3280] bg-white"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const current = parseInt(sec.numQuestions) || 0;
                                                        handlePatternChange(idx, 'numQuestions', current + 1);
                                                    }}
                                                    className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 font-black text-navy flex items-center justify-center transition shadow-sm"
                                                    title="Increase question count"
                                                >+</button>
                                            </div>
                                        </div>

                                        {/* Type */}
                                        <div className="relative flex-shrink-0">
                                            <label className="absolute -top-2 left-3 bg-gray-50 px-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Type</label>
                                            <select
                                                value={sec.type}
                                                onChange={e => handlePatternChange(idx, 'type', e.target.value)}
                                                className="border border-gray-200 p-3 rounded-xl w-36 text-sm font-bold text-gray-700 outline-none focus:border-[#1e3280] bg-white appearance-none cursor-pointer"
                                            >
                                                <option value="">Select Type</option>
                                                <option value="MCQ">MCQ</option>
                                                <option value="ASSERTION_REASON">Assertion / Reason</option>
                                                <option value="STATEMENT_BASED">Statement Based</option>
                                                <option value="MATCH_FOLLOWING">Match the Following</option>
                                                <option value="TRUE_FALSE">True / False</option>
                                                <option value="NUMERICAL">Numerical</option>
                                                <option value="1m">1 Mark</option>
                                                <option value="2m">2 Marks</option>
                                                <option value="3m">3 Marks</option>
                                                <option value="4m">4 Marks</option>
                                                <option value="5m">5 Marks</option>
                                            </select>
                                        </div>

                                        {/* Instructions */}
                                        <div className="relative flex-1">
                                            <label className="absolute -top-2 left-3 bg-gray-50 px-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Instructions</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Answer any 5 of the following..."
                                                value={sec.description}
                                                onChange={e => handlePatternChange(idx, 'description', e.target.value)}
                                                className="border border-gray-200 p-3 rounded-xl w-full text-sm font-medium text-gray-700 outline-none focus:border-[#1e3280] bg-white"
                                            />
                                        </div>

                                        {/* Marks */}
                                        <div className={`flex items-center justify-center px-4 py-2.5 rounded-xl shadow-inner min-w-[90px] flex-shrink-0 ${isShort ? 'bg-red-100 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                                            <span className={`font-bold text-[11px] uppercase tracking-widest flex flex-col items-center leading-tight ${isShort ? 'text-red-700' : 'text-green-700'}`}>
                                                Marks
                                                <span className="text-xl mt-0.5">{sec.marks}</span>
                                            </span>
                                        </div>

                                        {/* Available count */}
                                        {sec.type && (
                                            <div className={`text-[10px] font-bold px-3 py-1 rounded-full border flex-shrink-0 ${isShort ? 'bg-red-100 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                {isShort ? `⚠ Only ${avail} available` : `${avail} available`}
                                            </div>
                                        )}

                                        {/* Remove */}
                                        {localPattern.length > 1 && (
                                            <button
                                                onClick={() => removeSection(idx)}
                                                className="absolute -top-3 -right-3 bg-white border border-gray-200 text-red-500 hover:text-white w-7 h-7 rounded-full font-bold shadow hover:bg-red-500 hover:border-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs z-10"
                                            >✕</button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            onClick={addSection}
                            className="mt-4 flex items-center gap-2 text-[#1e3280] bg-blue-50 hover:bg-[#1e3280] hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all border border-blue-100"
                        >
                            <span className="text-lg leading-none">+</span> Add Section
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center p-10 border-t border-gray-100 bg-gray-50/50">
                    <div className="flex gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-navy/40 uppercase tracking-widest">Total Volume</span>
                            <span className="text-xl font-black text-navy">{totalQuestionsNeeded} <small className="text-xs opacity-50 uppercase tracking-widest">Questions</small></span>
                        </div>
                        <div className="w-px h-10 bg-gray-200"></div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-navy/40 uppercase tracking-widest">Assessment Score</span>
                            <span className="text-xl font-black text-navy">{totalMarks} <small className="text-xs opacity-50 uppercase tracking-widest">Marks</small></span>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="bg-white border-2 border-gray-100 text-slate/50 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-navy/20 hover:text-navy transition-all shadow-sm">
                            Cancel
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={!isPatternValid || totalQuestionsNeeded === 0}
                            className="bg-gold text-navy px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-2xl hover:scale-105 transition-all disabled:opacity-30 disabled:grayscale shadow-xl active:scale-95"
                        >
                            Execute Generation
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const MultiSelectCheckbox = ({ label, options, selectedValues, onChange, disabled }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (val) => {
        if (selectedValues.includes(val)) {
            onChange(selectedValues.filter(v => v !== val));
        } else {
            onChange([...selectedValues, val]);
        }
    };

    return (
        <div ref={containerRef} className={`relative inline-block text-left w-48 select-none ${isOpen ? 'z-50' : 'z-10'}`}>
            <div>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full border border-gray-300 p-2.5 rounded-lg text-sm text-gray-700 bg-white focus:border-blue-500 outline-none shadow-sm cursor-pointer flex justify-between items-center disabled:opacity-50 text-left font-medium"
                >
                    <span className="truncate">
                        {selectedValues.length === 0 ? label : `${label} (${selectedValues.length})`}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">▼</span>
                </button>
            </div>

            {isOpen && !disabled && (
                <div className="absolute left-0 mt-1 w-64 rounded-xl shadow-2xl bg-white ring-1 ring-black/10 z-[999] max-h-60 overflow-y-auto border border-gray-200 p-1">
                    <div>
                        {options.length === 0 ? (
                            <div className="px-4 py-2 text-sm text-gray-400 italic">No options available</div>
                        ) : (
                            options.map((opt) => {
                                const checked = selectedValues.includes(opt);
                                return (
                                    <label key={opt} className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 rounded-lg cursor-pointer whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleOption(opt)}
                                            className="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2 focus:ring-blue-500"
                                        />
                                        <span className="truncate font-medium">{opt}</span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const CreatePaper = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [filters, setFilters] = useState({ class: '', level: [], type: [], chapter: [], concept: [], sourceType: '', sourcePaperId: '' });
    const [questions, setQuestions] = useState([]);
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [previewQuestion, setPreviewQuestion] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [paperTitle, setPaperTitle] = useState('');
    const [allQuestions, setAllQuestions] = useState([]);
    const [showPatternModal, setShowPatternModal] = useState(false);
    const [pattern, setPattern] = useState([{ sectionName: 'Section A', numQuestions: '', type: '', description: '', marks: 0 }]);

    // New state
    const [showAutoGetModal, setShowAutoGetModal] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [toast, setToast] = useState(null);

    const [blueprints, setBlueprints] = useState([]);
    const [grandTests, setGrandTests] = useState([]);
    const [previousYearPapers, setPreviousYearPapers] = useState([]);
    const [selectedBlueprintId, setSelectedBlueprintId] = useState('');

    const showToast = (msg, type = 'info') => setToast({ msg, type });

    useEffect(() => {
        api.get('/api/questions?limit=2000').then(res => {
            const list = Array.isArray(res.data) ? res.data : (res.data?.questions || []);
            setAllQuestions(list);
        }).catch(console.error);
        api.get('/api/exam-blueprints').then(res => setBlueprints(Array.isArray(res.data) ? res.data : [])).catch(console.error);
        api.get('/api/grand-tests').then(res => setGrandTests(Array.isArray(res.data) ? res.data : [])).catch(console.error);
        api.get('/api/previous-year-papers').then(res => setPreviousYearPapers(Array.isArray(res.data) ? res.data : [])).catch(console.error);
    }, []);

    const safeAllQuestions = Array.isArray(allQuestions) ? allQuestions : [];
    const uniqueChapters = [...new Set(safeAllQuestions.map(q => q.chapter))].filter(Boolean);
    const uniqueConcepts = [...new Set(safeAllQuestions.filter(q => filters.chapter.length === 0 || filters.chapter.includes(q.chapter)).map(q => q.concept))].filter(Boolean);

    const fetchFilteredQuestions = async () => {
        try {
            const queryData = { limit: 2000 };
            Object.keys(filters).forEach(k => {
                if (Array.isArray(filters[k])) {
                    if (filters[k].length > 0) {
                        queryData[k] = filters[k].join(',');
                    }
                } else if (filters[k]) {
                    queryData[k] = filters[k];
                }
            });
            if (queryData.class) { queryData.classes = queryData.class; delete queryData.class; }
            const res = await api.get(`/api/questions?${new URLSearchParams(queryData).toString()}`);
            const list = Array.isArray(res.data) ? res.data : (res.data?.questions || []);
            setQuestions(list);
        } catch (err) { console.error(err); }
    };

    useEffect(() => { fetchFilteredQuestions(); }, [filters]);

    const handleSelect = (q) => {
        if (!selectedQuestions.find(sq => sq._id === q._id))
            setSelectedQuestions(prev => [...prev, q]);
    };

    const handleDeselect = (id) => setSelectedQuestions(prev => prev.filter(q => q._id !== id));

    const handleBlueprintChange = (blueprintId) => {
        setSelectedBlueprintId(blueprintId);
        if (!blueprintId) return;
        const bp = blueprints.find(b => b._id === blueprintId);
        if (bp) {
            const userSub = user?.subject?.toLowerCase() || '';
            const matchingSub = bp.subjects.find(s => s.subjectName.toLowerCase().includes(userSub) || userSub.includes(s.subjectName.toLowerCase()));
            const targetSubject = matchingSub || bp.subjects[0];
            if (targetSubject && targetSubject.sections) {
                const mappedPattern = targetSubject.sections.map((sec, idx) => ({
                    sectionName: sec.sectionName || `Section ${String.fromCharCode(65 + idx)}`,
                    numQuestions: sec.numQuestions || '',
                    type: sec.questionTypes[0] || 'MCQ',
                    description: sec.allowedToAnswer ? `Answer any ${sec.allowedToAnswer} questions` : '',
                    marks: (sec.numQuestions || 0) * (sec.markingRules?.correct || 4)
                }));
                setPattern(mappedPattern);
                showToast(`✓ Pattern pre-populated from Blueprint: ${bp.name}`, 'success');
            }
        }
    };

    // ── Auto Get Questions handler ──
    const handleAutoGet = (qty, level) => {
        let pool = [...questions.filter(q => !selectedQuestions.find(sq => sq._id === q._id))];

        if (level === 'easy') pool.sort((a, b) => { const o = ['easy', 'medium', 'hard']; return o.indexOf(a.level) - o.indexOf(b.level); });
        else if (level === 'hard') pool.sort((a, b) => { const o = ['hard', 'medium', 'easy']; return o.indexOf(a.level) - o.indexOf(b.level); });
        else if (level === 'balanced') {
            const easy = pool.filter(q => q.level === 'easy');
            const medium = pool.filter(q => q.level === 'medium');
            const hard = pool.filter(q => q.level === 'hard');
            const third = Math.ceil(qty / 3);
            pool = [...easy.slice(0, third), ...medium.slice(0, third), ...hard.slice(0, third)];
        } else {
            // random shuffle
            pool.sort(() => Math.random() - 0.5);
        }

        const picked = pool.slice(0, qty);
        setSelectedQuestions(prev => {
            const newOnes = picked.filter(p => !prev.find(s => s._id === p._id));
            return [...prev, ...newOnes];
        });
        setShowAutoGetModal(false);
        showToast(`✓ Added ${picked.length} question${picked.length !== 1 ? 's' : ''} to Selected`, 'success');
    };

    // ── Generate Question Paper handler ──
    const handleGeneratePaper = (genPattern, genFilters) => {
        // For each section, pick matching questions
        const alreadyPicked = new Set();
        const newSelected = [];

        for (const sec of genPattern) {
            const needed = parseInt(sec.numQuestions) || 0;
            if (!needed || !sec.type) continue;

            let pool = allQuestions.filter(q => {
                if (alreadyPicked.has(q._id)) return false;
                const matchClass = !genFilters.class || q.classes?.includes(genFilters.class) || q.class === genFilters.class;
                const matchLevel = !genFilters.level || q.level === genFilters.level;
                const matchType = q.type === sec.type;
                const matchChapter = !genFilters.chapter || q.chapter === genFilters.chapter;
                const matchConcept = !genFilters.concept || q.concept === genFilters.concept;
                return matchClass && matchLevel && matchType && matchChapter && matchConcept;
            });

            // shuffle pool
            pool.sort(() => Math.random() - 0.5);
            const picked = pool.slice(0, needed);
            picked.forEach(q => { alreadyPicked.add(q._id); newSelected.push(q); });
        }

        if (newSelected.length === 0) {
            showToast('No questions found matching your pattern + filters.', 'error');
            setShowGenerateModal(false);
            return;
        }

        setSelectedQuestions(newSelected);
        setPattern(genPattern);
        setFilters(genFilters);
        setShowGenerateModal(false);

        const total = genPattern.reduce((s, p) => s + (parseInt(p.numQuestions) || 0), 0);
        showToast(`✓ Generated paper: ${newSelected.length}/${total} questions selected`, newSelected.length < total ? 'info' : 'success');
    };

    // Pattern modal helpers (original)
    const handleAddSection = () => {
        setPattern([...pattern, { sectionName: `Section ${String.fromCharCode(65 + pattern.length)}`, numQuestions: '', type: '', description: '', marks: 0 }]);
    };
    const handleRemoveSection = (index) => {
        const renamed = pattern.filter((_, i) => i !== index).map((s, i) => ({ ...s, sectionName: `Section ${String.fromCharCode(65 + i)}` }));
        setPattern(renamed);
    };
    const handlePatternChange = (index, field, value) => {
        const newP = [...pattern];
        newP[index][field] = value;
        const num = field === 'numQuestions' ? parseInt(value) || 0 : parseInt(newP[index].numQuestions) || 0;
        const typeStr = field === 'type' ? value : newP[index].type;
        const mult = { MCQ: 1, '1m': 1, '2m': 2, '3m': 3, '4m': 4, '5m': 5 }[typeStr] || 0;
        newP[index].marks = num * mult;
        setPattern(newP);
    };

    const handleSavePaper = async () => {
        if (!paperTitle || selectedQuestions.length === 0) { alert('Please provide a title and select at least one question.'); return; }
        try {
            await api.post('/api/papers', {
                title: paperTitle,
                classes: filters.class ? [filters.class] : [],
                questions: selectedQuestions.map(q => q._id),
                pattern: (filters.class === '11' || filters.class === '12') ? pattern : []
            });
            showToast('Paper saved successfully!', 'success');
            setTimeout(() => navigate('/teacher/dashboard/saved-papers'), 1500);
        } catch (err) {
            showToast('Failed to save paper', 'error');
        }
    };

    const filteredDisplayQuestions = questions.filter(q =>
        q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.questionId && q.questionId.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="h-screen bg-gray-50 flex flex-col font-sans animate-fade-in-up">

            {/* Toast */}
            {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

            {/* Top Navigation Bar */}
            <nav className="bg-navy p-4 text-white flex justify-between items-center z-10 border-b-4 border-gold mx-4 mt-4 shadow-2xl rounded-t-3xl">
                <div className="flex items-center gap-6 ml-4">
                    <div className="bg-gold text-navy font-black rounded-xl w-10 h-10 flex items-center justify-center text-xl shadow-lg rotate-3">P</div>
                    <h1 className="text-xl font-black tracking-tight uppercase">Paper Builder</h1>
                    <div className="bg-white/10 text-gold text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-[0.2em] border border-gold/20">
                        {user?.subject || 'PHYSICS'}
                    </div>
                </div>
                <div className="flex items-center gap-3 mr-4">
                    {(filters.class === '11' || filters.class === '12') && (
                        <button onClick={() => setShowPatternModal(true)} className="bg-white/5 border border-gold/30 text-gold px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition">
                            Config Pattern
                        </button>
                    )}

                    {/* ── Auto Get Questions button ── */}
                    <button
                        onClick={() => setShowAutoGetModal(true)}
                        className="flex items-center gap-2 bg-white/5 border border-gold/30 text-gold px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition"
                    >
                        Auto Fetch
                    </button>

                    {/* ── Generate Question Paper button ── */}
                    <button
                        onClick={() => setShowGenerateModal(true)}
                        className="flex items-center gap-2 bg-gold text-navy px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg active:scale-95"
                    >
                        Generate Engine
                    </button>

                    <div className="w-px h-8 bg-gold/20 mx-2"></div>

                    <button onClick={() => navigate(-1)} className="bg-white/5 border border-gold/30 text-gold px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition">
                        Back
                    </button>
                    <button onClick={handleSavePaper} className="bg-navy text-gold border border-gold px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gold hover:text-navy transition-all shadow-lg">
                        Finalize & Save
                    </button>
                </div>
            </nav>

            {/* Filter Bar */}
            <div className="px-6 py-4 bg-white border-b border-gray-200 flex flex-wrap gap-4 items-center relative z-30 mx-4 border-x">
                <input type="text" placeholder="Paper Title" value={paperTitle} onChange={e => setPaperTitle(e.target.value)} className="border border-gray-300 p-2 rounded-lg font-medium w-48 text-sm focus:border-blue-500 outline-none" />
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mx-2">Blueprint</div>
                <select value={selectedBlueprintId} onChange={e => handleBlueprintChange(e.target.value)} className="border border-gray-300 p-2 rounded-lg text-sm text-gray-700 bg-white focus:border-blue-500 outline-none shadow-sm cursor-pointer w-48">
                    <option value="">-- Apply Blueprint --</option>
                    {blueprints.map(bp => <option key={bp._id} value={bp._id}>{bp.name} ({bp.examType})</option>)}
                </select>

                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mx-2">Source</div>
                <select value={filters.sourceType} onChange={e => setFilters({ ...filters, sourceType: e.target.value, sourcePaperId: '' })} className="border border-gray-300 p-2 rounded-lg text-sm text-gray-700 bg-white focus:border-blue-500 outline-none shadow-sm cursor-pointer">
                    <option value="">All Sources</option>
                    <option value="REGULAR">Repository (Regular)</option>
                    <option value="GT">Grand Tests (GT)</option>
                    <option value="PYQ">Previous Years (PYQ)</option>
                </select>

                {filters.sourceType === 'GT' && (
                    <select value={filters.sourcePaperId} onChange={e => setFilters({ ...filters, sourcePaperId: e.target.value })} className="border border-gray-300 p-2 rounded-lg text-sm text-gray-700 bg-white focus:border-blue-500 outline-none shadow-sm cursor-pointer w-40">
                        <option value="">-- Choose GT --</option>
                        {grandTests.map(gt => <option key={gt._id} value={gt._id}>{gt.title}</option>)}
                    </select>
                )}

                {filters.sourceType === 'PYQ' && (
                    <select value={filters.sourcePaperId} onChange={e => setFilters({ ...filters, sourcePaperId: e.target.value })} className="border border-gray-300 p-2 rounded-lg text-sm text-gray-700 bg-white focus:border-blue-500 outline-none shadow-sm cursor-pointer w-40">
                        <option value="">-- Choose PYQ --</option>
                        {previousYearPapers.map(pyq => <option key={pyq._id} value={pyq._id}>{pyq.title} ({pyq.year})</option>)}
                    </select>
                )}

                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mx-2">Filter</div>
                <select value={filters.class} onChange={e => {
                    const val = e.target.value;
                    const nf = { ...filters, class: val };
                    if (['JEE', 'KCET', 'NEET'].includes(val)) nf.type = 'MCQ';
                    setFilters(nf);
                }} className="border border-gray-300 p-2 rounded-lg text-sm text-gray-700 bg-white focus:border-blue-500 outline-none shadow-sm cursor-pointer">
                    <option value="">All Classes</option>
                    <option value="11">Class 11</option><option value="12">Class 12</option>
                    <option value="JEE">JEE</option><option value="KCET">KCET</option><option value="NEET">NEET</option>
                </select>
                <MultiSelectCheckbox 
                    label="All Levels" 
                    options={["easy", "medium", "hard"]} 
                    selectedValues={filters.level} 
                    onChange={vals => setFilters(f => ({ ...f, level: vals }))} 
                />
                <MultiSelectCheckbox 
                    label="All Types" 
                    options={["MCQ", "ASSERTION_REASON", "STATEMENT_BASED", "TRUE_FALSE", "MATCH_FOLLOWING", "NUMERICAL", "1m", "2m", "3m", "4m", "5m"]} 
                    selectedValues={filters.type} 
                    onChange={vals => setFilters(f => ({ ...f, type: vals }))} 
                />
                <MultiSelectCheckbox 
                    label="All Chapters" 
                    options={uniqueChapters} 
                    selectedValues={filters.chapter} 
                    onChange={vals => setFilters(f => ({ ...f, chapter: vals, concept: [] }))} 
                />
                <MultiSelectCheckbox 
                    label="All Concepts" 
                    options={uniqueConcepts} 
                    selectedValues={filters.concept} 
                    onChange={vals => setFilters(f => ({ ...f, concept: vals }))} 
                    disabled={filters.chapter.length === 0}
                />
            </div>

            {/* Three Columns Workspace */}
            <div className="flex-1 flex gap-6 overflow-hidden p-6 mx-4 mb-4 border-x border-b border-gray-200 bg-[#f8fafc] rounded-b-lg relative z-0">

                {/* Left: Available Questions */}
                <div className="w-1/3 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
                    <div className="flex justify-between items-center p-5 border-b border-gray-100">
                        <h3 className="font-bold text-gray-400 text-xs tracking-widest uppercase">Available Questions</h3>
                        <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold">{filteredDisplayQuestions.length}</span>
                    </div>
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                            <input type="text" placeholder="Search questions..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full border border-gray-200 pl-9 pr-3 py-2 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {filteredDisplayQuestions.map(q => (
                            <div key={q._id} className={`border p-4 rounded-xl cursor-pointer transition flex items-start gap-3 ${selectedQuestions.some(sq => sq._id === q._id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`} onClick={() => setPreviewQuestion(q)}>
                                <div className="mt-0.5">
                                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        checked={selectedQuestions.some(sq => sq._id === q._id)}
                                        onChange={e => { e.stopPropagation(); if (e.target.checked) handleSelect(q); else handleDeselect(q._id); }}
                                    />
                                </div>
                                <div className="flex-1">
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        <span className="font-semibold text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-md border border-blue-100">{q.questionId}</span>
                                        <span className="font-semibold text-[10px] bg-green-50 text-green-700 px-2 py-1 rounded-md border border-green-100">{q.type}</span>
                                        <span className={`font-semibold text-[10px] px-2 py-1 rounded-md border ${q.level === 'hard' ? 'bg-orange-50 text-orange-700 border-orange-100' : q.level === 'medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{q.level}</span>
                                    </div>
                                    <MathRenderer className="text-sm text-gray-700 line-clamp-3 font-medium" text={q.questionText} />
                                </div>
                            </div>
                        ))}
                        {filteredDisplayQuestions.length === 0 && (
                            <div className="text-center p-8"><p className="text-gray-400 text-sm">No matching questions found.</p></div>
                        )}
                    </div>
                </div>

                {/* Middle: Preview */}
                <div className="w-1/3 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-gray-100">
                        <h3 className="font-bold text-gray-400 text-xs tracking-widest uppercase">Preview</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col">
                        {previewQuestion ? (
                            <div className="animate-fade-in-up">
                                <div className="flex gap-2 mb-4">
                                    <span className="font-semibold text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md border border-blue-100">{previewQuestion.questionId}</span>
                                    <span className="font-semibold text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-200">Class: {previewQuestion.classes?.join(',')}</span>
                                    <span className="font-semibold text-xs bg-green-50 text-green-700 px-2 py-1 rounded-md border border-green-100">{previewQuestion.type}</span>
                                </div>
                                <MathRenderer 
                                    className="text-gray-800 font-medium whitespace-pre-wrap mb-6 text-sm leading-relaxed"
                                    text={previewQuestion.questionText}
                                />
                                {previewQuestion.imageUrl && <div className="mb-6"><img src={previewQuestion.imageUrl} alt="Question Reference" className="max-w-full rounded border border-gray-200" /></div>}
                                {previewQuestion.type === 'MCQ' && previewQuestion.options && (
                                    <ul className="space-y-3 text-sm text-gray-600 mb-6">
                                        {previewQuestion.options.map((opt, i) => (
                                            <li key={i} className="flex items-center gap-3 font-medium">
                                                <span className="bg-gray-100 w-6 h-6 flex items-center justify-center rounded-full text-gray-500 font-bold text-xs">{optionLabel(i, previewQuestion.classes)}</span>
                                                <MathRenderer inline={true} text={opt} />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {previewQuestion.answer && (
                                    <div className="mt-auto pt-4 border-t border-gray-100 text-sm bg-gray-50 p-4 rounded-xl">
                                        <span className="font-bold text-gray-700 block mb-1">Answer / Marking Scheme:</span>
                                        <span className="text-gray-600">{previewQuestion.answer}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                                <div className="w-16 h-16 rounded-full border-2 border-gray-200 flex items-center justify-center mb-4 bg-gray-50">
                                    <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </div>
                                <p className="text-gray-400 font-medium text-sm">Select a question to preview</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Selected */}
                <div className="w-1/3 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
                    <div className="flex justify-between items-center p-5 border-b border-gray-100">
                        <h3 className="font-bold text-gray-400 text-xs tracking-widest uppercase">Selected</h3>
                        <div className="flex items-center gap-2">
                            {selectedQuestions.length > 0 && (
                                <button onClick={() => { setSelectedQuestions([]); showToast('Cleared all selected questions', 'info'); }} className="text-[10px] font-bold text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-2 py-1 rounded-lg transition">
                                    Clear all
                                </button>
                            )}
                            <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold">{selectedQuestions.length}</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {selectedQuestions.map((q, idx) => (
                            <div key={q._id} className="border border-gray-100 p-4 rounded-xl bg-gray-50 relative group flex gap-3">
                                <div className="font-bold text-gray-400 text-xs mt-0.5">{idx + 1}.</div>
                                <div className="flex-1">
                                    <p className="text-sm text-gray-700 font-medium leading-relaxed pr-6 line-clamp-3" dangerouslySetInnerHTML={{ __html: sanitize(q.questionText) }}></p>
                                    {q.imageUrl && <div className="mt-2"><img src={q.imageUrl} alt="Question Reference" className="max-w-full rounded border border-gray-200 max-h-32 object-contain" /></div>}
                                </div>
                                <button className="absolute top-3 right-3 text-red-400 hover:text-red-600 cursor-pointer hidden group-hover:block transition" onClick={() => handleDeselect(q._id)}>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))}
                        {selectedQuestions.length === 0 && (
                            <div className="flex-1 h-full flex flex-col items-center justify-center text-gray-300 min-h-[300px]">
                                <svg className="w-12 h-12 mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                <p className="text-gray-400 font-medium text-sm">No questions selected</p>
                                <p className="text-gray-300 text-xs mt-1">Use Auto Get or Generate Paper</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Original Pattern Modal ── */}
            {showPatternModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-md animate-fade-in-up">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col transform transition-all border border-gray-100">
                        <div className="flex justify-between items-start mb-6 pb-5 border-b border-gray-100">
                            <div>
                                <h2 className="text-2xl font-black text-[#1e3280] tracking-tight mb-1">Configure Paper Pattern</h2>
                                <p className="text-sm text-gray-500 font-medium">Define sections, question counts, and instructions for this assessment.</p>
                            </div>
                            <button onClick={() => setShowPatternModal(false)} className="text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-full w-9 h-9 flex items-center justify-center text-xl transition-colors font-bold shadow-sm border border-gray-100 hover:border-red-200">×</button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-5 mb-6 pr-2">
                            {pattern.map((sec, idx) => (
                                <div key={idx} className="flex flex-col md:flex-row gap-5 items-start md:items-center border border-gray-100 p-5 rounded-2xl bg-[#f8fafc] shadow-sm relative group hover:shadow-md transition-shadow border-l-4 border-l-[#1e3280]">
                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        <div className="font-black text-sm text-[#1e3280] bg-white px-5 py-3 rounded-xl border border-blue-100 text-center tracking-widest uppercase shadow-sm whitespace-nowrap min-w-[120px]">{sec.sectionName}</div>
                                    </div>
                                    <div className="flex flex-wrap md:flex-nowrap gap-4 w-full items-center">
                                        <div className="relative group/input">
                                            <label className="absolute -top-2 left-3 bg-[#f8fafc] px-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Questions</label>
                                            <input type="number" placeholder="Qty" value={sec.numQuestions} onChange={e => handlePatternChange(idx, 'numQuestions', e.target.value)} className="border border-gray-200 p-3 rounded-xl w-24 text-sm font-bold text-gray-700 outline-none text-center focus:border-[#1e3280] bg-white shadow-sm" min="1" />
                                        </div>
                                        <div className="relative group/input">
                                            <label className="absolute -top-2 left-3 bg-[#f8fafc] px-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type</label>
                                            <select value={sec.type} onChange={e => handlePatternChange(idx, 'type', e.target.value)} className="border border-gray-200 p-3 rounded-xl w-36 text-sm font-bold text-gray-700 outline-none focus:border-[#1e3280] bg-white shadow-sm appearance-none cursor-pointer">
                                                <option value="" disabled>Select Type</option>
                                                <option value="MCQ">MCQ</option>
                                                <option value="ASSERTION_REASON">Assertion / Reason</option>
                                                <option value="STATEMENT_BASED">Statement Based</option>
                                                <option value="MATCH_FOLLOWING">Match the Following</option>
                                                <option value="TRUE_FALSE">True / False</option>
                                                <option value="NUMERICAL">Numerical</option>
                                                <option value="1m">1 Mark</option><option value="2m">2 Marks</option><option value="3m">3 Marks</option><option value="4m">4 Marks</option><option value="5m">5 Marks</option>
                                            </select>
                                        </div>
                                        <div className="relative flex-1 group/input">
                                            <label className="absolute -top-2 left-3 bg-[#f8fafc] px-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Instructions</label>
                                            <input type="text" placeholder="e.g. Answer any 5 of the following..." value={sec.description} onChange={e => handlePatternChange(idx, 'description', e.target.value)} className="border border-gray-200 p-3 rounded-xl w-full text-sm font-medium text-gray-700 outline-none focus:border-[#1e3280] bg-white shadow-sm" />
                                        </div>
                                        <div className="flex items-center justify-center bg-green-50 border border-green-200 px-5 py-2.5 rounded-xl shadow-inner min-w-[110px]">
                                            <span className="font-bold text-[11px] text-green-700 uppercase tracking-widest flex flex-col items-center leading-tight">Total Marks<span className="text-xl mt-0.5">{sec.marks}</span></span>
                                        </div>
                                    </div>
                                    {pattern.length > 1 && (
                                        <button onClick={() => handleRemoveSection(idx)} className="absolute -top-3 -right-3 bg-white border border-gray-200 text-red-500 hover:text-white w-8 h-8 rounded-full font-bold shadow-md hover:bg-red-500 hover:border-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-sm z-10">✕</button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-6 border-t border-gray-100 bg-white">
                            <button onClick={handleAddSection} className="flex items-center gap-2 text-[#1e3280] bg-blue-50 hover:bg-[#1e3280] hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm">
                                <span className="text-lg leading-none">+</span> Add New Section
                            </button>
                            <button onClick={() => setShowPatternModal(false)} className="bg-gradient-to-r from-[#1e3280] to-blue-700 text-white px-8 py-3.5 rounded-xl font-bold hover:shadow-lg transition-all text-sm tracking-wide flex items-center gap-2">
                                Confirm & Save Pattern
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Auto Get Modal ── */}
            {showAutoGetModal && (
                <AutoGetModal
                    onClose={() => setShowAutoGetModal(false)}
                    onConfirm={handleAutoGet}
                    filteredCount={questions.filter(q => !selectedQuestions.find(sq => sq._id === q._id)).length}
                />
            )}

            {/* ── Generate Paper Modal ── */}
            {showGenerateModal && (
                <GeneratePaperModal
                    onClose={() => setShowGenerateModal(false)}
                    onGenerate={handleGeneratePaper}
                    filters={filters}
                    allQuestions={allQuestions}
                    setFilters={setFilters}
                    uniqueChapters={uniqueChapters}
                    uniqueConcepts={uniqueConcepts}
                />
            )}
        </div>
    );
};

export default CreatePaper;