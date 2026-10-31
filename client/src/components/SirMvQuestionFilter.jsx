import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Search, Check, X, Sparkles, Sliders, CheckSquare, Square } from 'lucide-react';
import api from '../api';

/**
 * SirMvQuestionFilter.jsx
 *
 * Implements the Question Generation Filter Card matching Image 1:
 *  - Title: "(Q) SIR MV PU College Questions"
 *  - Target Exam & Subjects: CET, NEET, JEE, and individual PCMB subjects (Physics, Chemistry, Mathematics, Biology)
 *  - Multi-Chapter selector (Allows selecting multiple chapters)
 *  - Multi-Concept selector (Topic changed to Concept, allows selecting multiple concepts)
 *  - Auto or Manual question selection mode before loading questions
 *  - Auto selection: question count & difficulty sliders (Easy, Medium, Hard)
 *  - Blue "Load Questions" primary button
 */
export default function SirMvQuestionFilter({
    onLoadQuestions,
    loading = false,
}) {
    // 1. Target Exam & Subject Selection
    const [examCategory, setExamCategory] = useState('CET'); // CET | NEET | JEE | PCMB
    const [selectedSubject, setSelectedSubject] = useState('Physics');

    // 2. Multi-Chapter selection
    const [availableChapters, setAvailableChapters] = useState([]);
    const [selectedChapters, setSelectedChapters] = useState([]);
    const [chapterSearch, setChapterSearch] = useState('');
    const [isChapterDropdownOpen, setIsChapterDropdownOpen] = useState(false);
    const chapterDropdownRef = useRef(null);

    // 3. Multi-Concept selection (renamed from topic!)
    const [availableConcepts, setAvailableConcepts] = useState([]);
    const [selectedConcepts, setSelectedConcepts] = useState([]);
    const [conceptSearch, setConceptSearch] = useState('');
    const [isConceptDropdownOpen, setIsConceptDropdownOpen] = useState(false);
    const conceptDropdownRef = useRef(null);

    // 4. Selection Mode: Auto vs Manual
    const [selectionMode, setSelectionMode] = useState('auto'); // 'auto' | 'manual'
    const [targetQuestionCount, setTargetQuestionCount] = useState(30);
    const [difficulty, setDifficulty] = useState({
        easy: 40,
        medium: 40,
        hard: 20,
    });

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (chapterDropdownRef.current && !chapterDropdownRef.current.contains(e.target)) {
                setIsChapterDropdownOpen(false);
            }
            if (conceptDropdownRef.current && !conceptDropdownRef.current.contains(e.target)) {
                setIsConceptDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Exam subjects mapping
    const examSubjects = useMemo(() => {
        switch (examCategory) {
            case 'CET':
                return ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
            case 'NEET':
                return ['Physics', 'Chemistry', 'Biology'];
            case 'JEE':
                return ['Physics', 'Chemistry', 'Mathematics'];
            case 'PCMB':
            default:
                return ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
        }
    }, [examCategory]);

    // Ensure selectedSubject is valid for current exam
    useEffect(() => {
        if (!examSubjects.includes(selectedSubject)) {
            setSelectedSubject(examSubjects[0] || 'Physics');
        }
    }, [examCategory, examSubjects, selectedSubject]);

    // Fetch chapters when subject changes
    useEffect(() => {
        let isMounted = true;
        const fetchMeta = async () => {
            try {
                const res = await api.get('/api/questions/meta', {
                    params: { subject: selectedSubject, class: 'Both' }
                });
                if (isMounted && res.data) {
                    const chs = Array.isArray(res.data.chapters) ? res.data.chapters : [];
                    setAvailableChapters(chs);
                    // Default select first chapter if none selected
                    setSelectedChapters(chs.slice(0, 1));
                    setSelectedConcepts([]);
                }
            } catch (err) {
                console.error('Error fetching subject chapters:', err);
            }
        };
        fetchMeta();
        return () => { isMounted = false; };
    }, [selectedSubject]);

    // Fetch concepts dynamically for selected chapters
    useEffect(() => {
        let isMounted = true;
        if (selectedChapters.length === 0) {
            setAvailableConcepts([]);
            setSelectedConcepts([]);
            return;
        }

        const fetchConcepts = async () => {
            try {
                const res = await api.get('/api/questions', {
                    params: {
                        subject: selectedSubject,
                        chapter: selectedChapters.join(','),
                        limit: 500,
                    }
                });
                if (isMounted && res.data) {
                    const qs = Array.isArray(res.data) ? res.data : (res.data.questions || []);
                    const distinctConcepts = Array.from(
                        new Set(
                            qs
                                .map(q => q.concept || q.topic)
                                .filter(Boolean)
                                .map(c => c.trim())
                        )
                    ).sort();
                    setAvailableConcepts(distinctConcepts);
                }
            } catch (err) {
                console.error('Error fetching concepts:', err);
            }
        };
        fetchConcepts();
        return () => { isMounted = false; };
    }, [selectedSubject, selectedChapters]);

    // Chapter filter helper
    const filteredChapters = useMemo(() => {
        if (!chapterSearch.trim()) return availableChapters;
        const s = chapterSearch.toLowerCase();
        return availableChapters.filter(ch => ch.toLowerCase().includes(s));
    }, [availableChapters, chapterSearch]);

    // Concept filter helper
    const filteredConcepts = useMemo(() => {
        if (!conceptSearch.trim()) return availableConcepts;
        const s = conceptSearch.toLowerCase();
        return availableConcepts.filter(c => c.toLowerCase().includes(s));
    }, [availableConcepts, conceptSearch]);

    const toggleChapter = (chapter) => {
        setSelectedChapters(prev => {
            if (prev.includes(chapter)) {
                return prev.filter(c => c !== chapter);
            } else {
                return [...prev, chapter];
            }
        });
    };

    const toggleConcept = (concept) => {
        setSelectedConcepts(prev => {
            if (prev.includes(concept)) {
                return prev.filter(c => c !== concept);
            } else {
                return [...prev, concept];
            }
        });
    };

    const handleSelectAllChapters = () => {
        if (selectedChapters.length === availableChapters.length) {
            setSelectedChapters([]);
        } else {
            setSelectedChapters([...availableChapters]);
        }
    };

    const handleSelectAllConcepts = () => {
        if (selectedConcepts.length === availableConcepts.length) {
            setSelectedConcepts([]);
        } else {
            setSelectedConcepts([...availableConcepts]);
        }
    };

    const handleLoadQuestions = () => {
        if (selectedChapters.length === 0) {
            alert('Please select at least one chapter.');
            return;
        }

        onLoadQuestions({
            examCategory,
            subject: selectedSubject,
            chapters: selectedChapters,
            concepts: selectedConcepts,
            selectionMode,
            targetCount: Number(targetQuestionCount) || 30,
            difficulty,
            allConcepts: availableConcepts,
        });
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-4xl mx-auto p-8 font-sans select-none animate-fade-in">
            {/* Header with Title and icon badge */}
            <div className="flex items-center gap-3 pb-6 mb-6 border-b border-slate-100">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                    Q
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                        Question Paper Generator
                    </h1>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                        High-yield CET, NEET, and JEE Examination Question Paper Suite
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                {/* 1. Exam Category & Individual Subject Selector */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Target Exam & Stream:
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        {['CET', 'NEET', 'JEE', 'PCMB'].map((cat) => {
                            const isSelected = examCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setExamCategory(cat)}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer text-center border ${
                                        isSelected
                                            ? 'bg-[#0d6efd] text-white border-blue-600 shadow-xs'
                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                >
                                    {cat}
                                </button>
                            );
                        })}
                    </div>

                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Select Subject <span className="text-rose-500">*</span>:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {examSubjects.map((sub) => {
                            const isSelected = selectedSubject === sub;
                            return (
                                <button
                                    key={sub}
                                    type="button"
                                    onClick={() => setSelectedSubject(sub)}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer text-center border ${
                                        isSelected
                                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                                    }`}
                                >
                                    {sub}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 2. Multi-Chapter Selector & Multi-Concept Selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Chapter Selector */}
                    <div className="relative" ref={chapterDropdownRef}>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-slate-700">
                                Select chapter <span className="text-rose-500">*</span>
                            </label>
                            {availableChapters.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleSelectAllChapters}
                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                                >
                                    {selectedChapters.length === availableChapters.length ? 'Deselect All' : 'Select All'}
                                </button>
                            )}
                        </div>

                        {/* Trigger button / box */}
                        <div
                            onClick={() => setIsChapterDropdownOpen(!isChapterDropdownOpen)}
                            className="min-h-[46px] w-full border border-slate-300 rounded-xl px-3.5 py-2 bg-white flex items-center justify-between cursor-pointer hover:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500 shadow-2xs"
                        >
                            <div className="flex flex-wrap gap-1.5 items-center flex-1 pr-2">
                                {selectedChapters.length === 0 ? (
                                    <span className="text-xs text-slate-400">
                                        Please select chapter(s)...
                                    </span>
                                ) : (
                                    selectedChapters.slice(0, 2).map((ch) => (
                                        <span
                                            key={ch}
                                            className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1"
                                        >
                                            <span className="truncate max-w-[140px]">{ch}</span>
                                            <X
                                                className="w-3 h-3 hover:text-rose-600 cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleChapter(ch);
                                                }}
                                            />
                                        </span>
                                    ))
                                )}
                                {selectedChapters.length > 2 && (
                                    <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-md">
                                        +{selectedChapters.length - 2} more
                                    </span>
                                )}
                            </div>
                            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        </div>

                        {/* Dropdown Menu */}
                        {isChapterDropdownOpen && (
                            <div className="absolute z-30 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl p-3 max-h-64 overflow-y-auto">
                                <div className="relative mb-2">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search chapters..."
                                        value={chapterSearch}
                                        onChange={(e) => setChapterSearch(e.target.value)}
                                        className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    {filteredChapters.map((ch) => {
                                        const isSelected = selectedChapters.includes(ch);
                                        return (
                                            <div
                                                key={ch}
                                                onClick={() => toggleChapter(ch)}
                                                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                                                    isSelected ? 'bg-blue-50 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                                                }`}
                                            >
                                                {isSelected ? (
                                                    <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                                )}
                                                <span className="truncate">{ch}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Concept Selector (Topic changed to concept) */}
                    <div className="relative" ref={conceptDropdownRef}>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-slate-700">
                                Select concept <span className="text-rose-500">*</span>
                            </label>
                            {availableConcepts.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleSelectAllConcepts}
                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                                >
                                    {selectedConcepts.length === availableConcepts.length ? 'Deselect All' : 'Select All'}
                                </button>
                            )}
                        </div>

                        {/* Trigger button / box */}
                        <div
                            onClick={() => setIsConceptDropdownOpen(!isConceptDropdownOpen)}
                            className="min-h-[46px] w-full border border-slate-300 rounded-xl px-3.5 py-2 bg-white flex items-center justify-between cursor-pointer hover:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500 shadow-2xs"
                        >
                            <div className="flex flex-wrap gap-1.5 items-center flex-1 pr-2">
                                {selectedConcepts.length === 0 ? (
                                    <span className="text-xs text-slate-400">
                                        {selectedChapters.length === 0
                                            ? 'Please select chapter first'
                                            : 'All concepts (or click to filter)'}
                                    </span>
                                ) : (
                                    selectedConcepts.slice(0, 2).map((conc) => (
                                        <span
                                            key={conc}
                                            className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1"
                                        >
                                            <span className="truncate max-w-[140px]">{conc}</span>
                                            <X
                                                className="w-3 h-3 hover:text-rose-600 cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleConcept(conc);
                                                }}
                                            />
                                        </span>
                                    ))
                                )}
                                {selectedConcepts.length > 2 && (
                                    <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-md">
                                        +{selectedConcepts.length - 2} more
                                    </span>
                                )}
                            </div>
                            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        </div>

                        {/* Dropdown Menu */}
                        {isConceptDropdownOpen && (
                            <div className="absolute z-30 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl p-3 max-h-64 overflow-y-auto">
                                <div className="relative mb-2">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search concepts..."
                                        value={conceptSearch}
                                        onChange={(e) => setConceptSearch(e.target.value)}
                                        className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    {filteredConcepts.map((conc) => {
                                        const isSelected = selectedConcepts.includes(conc);
                                        return (
                                            <div
                                                key={conc}
                                                onClick={() => toggleConcept(conc)}
                                                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                                                    isSelected ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                                                }`}
                                            >
                                                {isSelected ? (
                                                    <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                                )}
                                                <span className="truncate">{conc}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Auto vs Manual Question Selection Mode */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Sliders className="w-4 h-4 text-blue-600" />
                            Question Selection Mode:
                        </span>
                        <div className="flex rounded-lg border border-slate-300 overflow-hidden shadow-2xs">
                            <button
                                type="button"
                                onClick={() => setSelectionMode('auto')}
                                className={`px-4 py-1.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                    selectionMode === 'auto'
                                        ? 'bg-[#0d6efd] text-white'
                                        : 'bg-white text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                Auto Selection
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectionMode('manual')}
                                className={`px-4 py-1.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                    selectionMode === 'manual'
                                        ? 'bg-[#0d6efd] text-white'
                                        : 'bg-white text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                Manual Selection
                            </button>
                        </div>
                    </div>

                    {/* Auto mode specific settings */}
                    {selectionMode === 'auto' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200/80">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                    Number of Questions:
                                </label>
                                <div className="flex items-center gap-2">
                                    {[15, 30, 45, 60].map((cnt) => (
                                        <button
                                            key={cnt}
                                            type="button"
                                            onClick={() => setTargetQuestionCount(cnt)}
                                            className={`flex-1 py-1 rounded-lg text-xs font-bold transition border cursor-pointer text-center ${
                                                targetQuestionCount === cnt
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {cnt} Qs
                                        </button>
                                    ))}
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={targetQuestionCount}
                                        onChange={(e) => setTargetQuestionCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                        className="w-16 text-xs text-center font-bold border border-slate-300 rounded-lg py-1 bg-white"
                                        title="Custom question count"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                    Difficulty Ratio (Easy / Medium / Hard):
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Easy</span>
                                        <input
                                            type="number"
                                            value={difficulty.easy}
                                            onChange={(e) => setDifficulty({ ...difficulty, easy: parseInt(e.target.value, 10) || 0 })}
                                            className="w-full text-xs text-center border border-slate-300 rounded-lg py-1 bg-white font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Medium</span>
                                        <input
                                            type="number"
                                            value={difficulty.medium}
                                            onChange={(e) => setDifficulty({ ...difficulty, medium: parseInt(e.target.value, 10) || 0 })}
                                            className="w-full text-xs text-center border border-slate-300 rounded-lg py-1 bg-white font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Hard</span>
                                        <input
                                            type="number"
                                            value={difficulty.hard}
                                            onChange={(e) => setDifficulty({ ...difficulty, hard: parseInt(e.target.value, 10) || 0 })}
                                            className="w-full text-xs text-center border border-slate-300 rounded-lg py-1 bg-white font-semibold"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Primary Button: Load Questions (Large vibrant blue rounded button matching Image 1) */}
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={handleLoadQuestions}
                        disabled={loading}
                        className="bg-[#0d6efd] hover:bg-blue-700 active:scale-98 text-white font-bold text-sm px-8 py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        {loading ? (
                            <span>Loading Questions...</span>
                        ) : (
                            <span>Load Questions</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
