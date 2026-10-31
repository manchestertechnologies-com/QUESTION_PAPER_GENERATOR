import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Search, Check, X, Sparkles, Sliders, CheckSquare, Square, RefreshCw, Plus, Minus } from 'lucide-react';
import api from '../api';

/**
 * SirMvQuestionFilter.jsx
 *
 * Question Generation Filter Card:
 *  - Unified Exam Stream Row:
 *      * JEE (PCM): 20 Objective (All Types) + 5 Numericals per subject = 25 Qs/subject (75 Total)
 *      * NEET (PCBZ): 45 Qs per subject (Physics, Chemistry, Botany, Zoology) = 180 Total (No Numericals)
 *      * CET (PCMB): 60 Qs per subject (Physics, Chemistry, Mathematics, Biology) = 240 Total (No Numericals)
 *      * Single Subject: Pick any individual subject with custom question count
 *      * Multi-Subject: Custom combinations with custom question count
 *  - Multi-chapter selection
 *  - Multi-concept selection (renamed from topic to concept)
 *  - Interactive Question Types Breakdown Menu:
 *      * Single Correct MCQ
 *      * Assertion & Reasoning
 *      * Statement-Based (I & II)
 *      * Match the Following
 *      * Diagrammatic / Image-Based
 *      * Numerical Questions (Fixed 5 for JEE Section B; 0 for NEET/CET)
 *  - Selection Mode: Auto vs Manual
 *  - Auto difficulty ratios (Easy / Medium / Hard)
 */
export default function SirMvQuestionFilter({
    onLoadQuestions,
    loading = false,
}) {
    // 1. One Unified Exam Option: 'JEE' | 'NEET' | 'CET' | 'Single' | 'Multi'
    const [examOption, setExamOption] = useState('JEE');

    // For Single Subject mode
    const [singleSubject, setSingleSubject] = useState('Physics');

    // For Multi-Subject custom mode
    const [customSubjects, setCustomSubjects] = useState(['Physics', 'Chemistry']);

    // Active subjects determined by examOption
    const activeSubjects = useMemo(() => {
        switch (examOption) {
            case 'JEE':
                return ['Physics', 'Chemistry', 'Mathematics'];
            case 'NEET':
                return ['Physics', 'Chemistry', 'Botany', 'Zoology'];
            case 'CET':
                return ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
            case 'Single':
                return [singleSubject];
            case 'Multi':
                return customSubjects.length > 0 ? customSubjects : ['Physics'];
            default:
                return ['Physics', 'Chemistry', 'Mathematics'];
        }
    }, [examOption, singleSubject, customSubjects]);

    // Active subject tab inside Chapter dropdown for convenient browsing
    const [activeChapterTab, setActiveChapterTab] = useState('All');

    // 2. Multi-Chapter selection
    const [availableChapters, setAvailableChapters] = useState([]);
    const [selectedChapters, setSelectedChapters] = useState([]); // array of chapter names
    const [chapterSearch, setChapterSearch] = useState('');
    const [isChapterDropdownOpen, setIsChapterDropdownOpen] = useState(false);
    const chapterDropdownRef = useRef(null);

    // 3. Multi-Concept selection
    const [availableConcepts, setAvailableConcepts] = useState([]);
    const [selectedConcepts, setSelectedConcepts] = useState([]);
    const [conceptSearch, setConceptSearch] = useState('');
    const [isConceptDropdownOpen, setIsConceptDropdownOpen] = useState(false);
    const conceptDropdownRef = useRef(null);

    // 4. Question Types Distribution Presets
    const DEFAULT_TYPE_PRESETS = useMemo(() => ({
        JEE: {
            mcq: 10,
            ar: 3,
            statement: 3,
            match: 2,
            diagram: 2,
            numerical: 5,
        },
        NEET: {
            mcq: 30,
            ar: 5,
            statement: 4,
            match: 3,
            diagram: 3,
            numerical: 0,
        },
        CET: {
            mcq: 45,
            ar: 5,
            statement: 4,
            match: 3,
            diagram: 3,
            numerical: 0,
        },
        Single: {
            mcq: 15,
            ar: 4,
            statement: 4,
            match: 3,
            diagram: 2,
            numerical: 2,
        },
        Multi: {
            mcq: 15,
            ar: 4,
            statement: 4,
            match: 3,
            diagram: 2,
            numerical: 0,
        },
    }), []);

    const [typeCounts, setTypeCounts] = useState(DEFAULT_TYPE_PRESETS.JEE);

    // Sync type counts when examOption changes
    useEffect(() => {
        setTypeCounts(DEFAULT_TYPE_PRESETS[examOption] || DEFAULT_TYPE_PRESETS.Single);
    }, [examOption, DEFAULT_TYPE_PRESETS]);

    // Calculations
    const perSubjectTotal = useMemo(() => {
        return Object.values(typeCounts).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
    }, [typeCounts]);

    const perSubjectObjective = useMemo(() => {
        const { numerical = 0, ...others } = typeCounts;
        return Object.values(others).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
    }, [typeCounts]);

    const perSubjectNumerical = parseInt(typeCounts.numerical, 10) || 0;

    const totalExamQuestions = useMemo(() => {
        return perSubjectTotal * activeSubjects.length;
    }, [perSubjectTotal, activeSubjects]);

    // 5. Selection Mode: Auto vs Manual
    const [selectionMode, setSelectionMode] = useState('auto');
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

    // Fetch chapters for all activeSubjects whenever activeSubjects changes
    useEffect(() => {
        let isMounted = true;
        const fetchChapters = async () => {
            try {
                const results = await Promise.all(
                    activeSubjects.map(sub =>
                        api.get('/api/questions/meta', {
                            params: { subject: sub, class: 'Both' }
                        }).then(res => {
                            const chs = Array.isArray(res.data?.chapters) ? res.data.chapters : [];
                            return chs.map(ch => ({ name: ch, subject: sub }));
                        }).catch(() => [])
                    )
                );

                if (isMounted) {
                    const combined = results.flat();
                    const seen = new Set();
                    const distinct = [];
                    for (const item of combined) {
                        const key = `${item.subject}::${item.name}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            distinct.push(item);
                        }
                    }
                    setAvailableChapters(distinct);

                    setSelectedChapters(prev => {
                        const validNames = new Set(distinct.map(d => d.name));
                        const stillValid = prev.filter(p => validNames.has(p));
                        if (stillValid.length > 0) return stillValid;
                        return distinct.slice(0, 1).map(d => d.name);
                    });
                    setSelectedConcepts([]);
                }
            } catch (err) {
                console.error('Error fetching chapters for subjects:', err);
            }
        };

        fetchChapters();
        return () => { isMounted = false; };
    }, [activeSubjects]);

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
                const relevantSubjects = Array.from(
                    new Set(
                        availableChapters
                            .filter(c => selectedChapters.includes(c.name))
                            .map(c => c.subject)
                    )
                );
                const subjectsToQuery = relevantSubjects.length > 0 ? relevantSubjects : activeSubjects;

                const results = await Promise.all(
                    subjectsToQuery.map(sub => {
                        const chsForSub = availableChapters
                            .filter(c => c.subject === sub && selectedChapters.includes(c.name))
                            .map(c => c.name);
                        if (chsForSub.length === 0) return Promise.resolve([]);
                        return api.get('/api/questions', {
                            params: {
                                subject: sub,
                                chapter: chsForSub.join(','),
                                limit: 500,
                            }
                        }).then(res => {
                            const qs = Array.isArray(res.data) ? res.data : (res.data.questions || []);
                            return qs.map(q => q.concept || q.topic).filter(Boolean);
                        }).catch(() => []);
                    })
                );

                if (isMounted) {
                    const allFound = Array.from(new Set(results.flat().map(c => String(c).trim()))).sort();
                    setAvailableConcepts(allFound);
                }
            } catch (err) {
                console.error('Error fetching concepts:', err);
            }
        };

        fetchConcepts();
        return () => { isMounted = false; };
    }, [selectedChapters, availableChapters, activeSubjects]);

    // Filter chapters
    const filteredChapters = useMemo(() => {
        let list = availableChapters;
        if (activeChapterTab !== 'All') {
            list = list.filter(c => c.subject.toLowerCase() === activeChapterTab.toLowerCase());
        }
        if (chapterSearch.trim()) {
            const s = chapterSearch.toLowerCase();
            list = list.filter(c => c.name.toLowerCase().includes(s));
        }
        return list;
    }, [availableChapters, activeChapterTab, chapterSearch]);

    // Filter concepts
    const filteredConcepts = useMemo(() => {
        if (!conceptSearch.trim()) return availableConcepts;
        const s = conceptSearch.toLowerCase();
        return availableConcepts.filter(c => c.toLowerCase().includes(s));
    }, [availableConcepts, conceptSearch]);

    const toggleChapter = (chapterName) => {
        setSelectedChapters(prev => {
            if (prev.includes(chapterName)) {
                return prev.filter(c => c !== chapterName);
            } else {
                return [...prev, chapterName];
            }
        });
    };

    const toggleConcept = (conceptName) => {
        setSelectedConcepts(prev => {
            if (prev.includes(conceptName)) {
                return prev.filter(c => c !== conceptName);
            } else {
                return [...prev, conceptName];
            }
        });
    };

    const handleSelectAllChapters = () => {
        const currentTabNames = filteredChapters.map(c => c.name);
        const allTabSelected = currentTabNames.every(name => selectedChapters.includes(name));
        if (allTabSelected) {
            setSelectedChapters(prev => prev.filter(name => !currentTabNames.includes(name)));
        } else {
            setSelectedChapters(prev => Array.from(new Set([...prev, ...currentTabNames])));
        }
    };

    const handleSelectAllConcepts = () => {
        if (selectedConcepts.length === availableConcepts.length) {
            setSelectedConcepts([]);
        } else {
            setSelectedConcepts([...availableConcepts]);
        }
    };

    const updateTypeCount = (key, val) => {
        setTypeCounts(prev => ({
            ...prev,
            [key]: Math.max(0, parseInt(val, 10) || 0)
        }));
    };

    const handleLoadQuestions = () => {
        if (selectedChapters.length === 0) {
            alert('Please select at least one chapter.');
            return;
        }

        // Build subject-to-chapter map so each subject queries its specific chapters
        const subjectChaptersMap = {};
        activeSubjects.forEach(sub => {
            const chs = selectedChapters.filter(chName =>
                availableChapters.some(ac => ac.name === chName && ac.subject.toLowerCase() === sub.toLowerCase())
            );
            subjectChaptersMap[sub] = chs.length > 0 ? chs : selectedChapters;
        });

        onLoadQuestions({
            examCategory: examOption === 'JEE' ? 'JEE' : (examOption === 'NEET' ? 'NEET' : (examOption === 'CET' ? 'CET' : 'Assessment')),
            examOption,
            subjects: activeSubjects,
            subject: activeSubjects.length === 1 ? activeSubjects[0] : activeSubjects.join(' & '),
            chapters: selectedChapters,
            subjectChaptersMap,
            concepts: selectedConcepts,
            selectionMode,
            targetCount: totalExamQuestions,
            perSubjectCount: perSubjectTotal,
            typeCounts,
            difficulty,
            allConcepts: availableConcepts,
        });
    };

    const examOptionsList = [
        { id: 'JEE', label: 'JEE (PCM)', desc: '20 Obj + 5 Num / subject (75 Qs)' },
        { id: 'NEET', label: 'NEET (PCBZ)', desc: '45 Qs / subject (180 Qs, No Num)' },
        { id: 'CET', label: 'CET (PCMB)', desc: '60 Qs / subject (240 Qs, No Num)' },
        { id: 'Single', label: 'Single Subject', desc: 'Custom Qs count & distribution' },
        { id: 'Multi', label: 'Multi-Subject', desc: 'Custom subject combinations' },
    ];

    const QUESTION_TYPES_CONFIG = [
        {
            key: 'mcq',
            label: 'Single Correct MCQ',
            shortDesc: 'Standard 4-option objective questions',
            icon: '📝',
        },
        {
            key: 'ar',
            label: 'Assertion & Reasoning',
            shortDesc: 'Assertion (A) & Reason (R) statements',
            icon: '⚖️',
        },
        {
            key: 'statement',
            label: 'Statement-Based',
            shortDesc: 'Statement I & Statement II evaluation',
            icon: '📋',
        },
        {
            key: 'match',
            label: 'Match the Following',
            shortDesc: 'Column I & Column II pairing lists',
            icon: '🔗',
        },
        {
            key: 'diagram',
            label: 'Diagram / Image-Based',
            shortDesc: 'Questions with diagrams, circuits, or figures',
            icon: '🖼️',
        },
        {
            key: 'numerical',
            label: 'Numerical Questions',
            shortDesc: examOption === 'JEE' ? 'Fixed Section B (5 Qs per subject)' : (examOption === 'NEET' || examOption === 'CET' ? '0 in NEET/CET standard pattern' : 'Integer / numerical answers without options'),
            icon: '🔢',
            isSpecial: true,
        },
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-4xl mx-auto p-6 md:p-8 font-sans select-none animate-fade-in">
            {/* Header: Clean unbranded title */}
            <div className="flex items-center gap-3 pb-5 mb-6 border-b border-slate-100">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                    Q
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                        Question Paper Generator
                    </h1>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                        CET, NEET, and JEE Examination Paper Generator with Precise Question Type Control
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                {/* 1. Single Unified Option Selector (One row only!) */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Target Exam & Subject Stream <span className="text-rose-500">*</span>:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        {examOptionsList.map((item) => {
                            const isSelected = examOption === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setExamOption(item.id)}
                                    className={`py-3 px-3 rounded-xl text-xs font-bold transition cursor-pointer text-center border flex flex-col items-center justify-center gap-1 ${
                                        isSelected
                                            ? 'bg-[#0d6efd] text-white border-blue-600 shadow-md ring-2 ring-blue-400/30'
                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                >
                                    <span className="text-xs font-black tracking-tight">{item.label}</span>
                                    <span className={`text-[10px] line-clamp-1 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                        {item.desc}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Sub-selector shown ONLY when "Single Subject" is selected */}
                    {examOption === 'Single' && (
                        <div className="mt-3 p-3 bg-blue-50/60 border border-blue-200 rounded-xl animate-fade-in">
                            <span className="block text-[11px] font-bold text-blue-900 mb-2 uppercase tracking-wider">
                                Choose Individual Subject:
                            </span>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                {['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Botany', 'Zoology'].map((sub) => {
                                    const isSel = singleSubject === sub;
                                    return (
                                        <button
                                            key={sub}
                                            type="button"
                                            onClick={() => setSingleSubject(sub)}
                                            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer text-center border ${
                                                isSel
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            {sub}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Sub-selector shown ONLY when "Multi-Subject" custom mode is selected */}
                    {examOption === 'Multi' && (
                        <div className="mt-3 p-3 bg-blue-50/60 border border-blue-200 rounded-xl animate-fade-in">
                            <span className="block text-[11px] font-bold text-blue-900 mb-2 uppercase tracking-wider">
                                Select Custom Subjects to Include:
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {['Physics', 'Chemistry', 'Mathematics', 'Biology'].map((sub) => {
                                    const isSel = customSubjects.includes(sub);
                                    return (
                                        <button
                                            key={sub}
                                            type="button"
                                            onClick={() => {
                                                if (isSel) {
                                                    if (customSubjects.length > 1) {
                                                        setCustomSubjects(customSubjects.filter(s => s !== sub));
                                                    }
                                                } else {
                                                    setCustomSubjects([...customSubjects, sub]);
                                                }
                                            }}
                                            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer text-center border flex items-center justify-center gap-1.5 ${
                                                isSel
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            {isSel ? <Check className="w-3.5 h-3.5" /> : null}
                                            <span>{sub}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
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
                                    {selectedChapters.length === filteredChapters.length ? 'Deselect All' : 'Select All'}
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
                                    <span className="text-xs text-slate-400">Select chapters...</span>
                                ) : (
                                    selectedChapters.slice(0, 2).map((chName) => (
                                        <span
                                            key={chName}
                                            className="bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1"
                                        >
                                            <span className="truncate max-w-[140px]">{chName}</span>
                                            <X
                                                className="w-3 h-3 hover:text-rose-600 cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleChapter(chName);
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
                            <div className="absolute z-30 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl p-3 max-h-72 overflow-y-auto">
                                {/* Subject Tabs inside Chapter Dropdown */}
                                {activeSubjects.length > 1 && (
                                    <div className="flex items-center gap-1 mb-2 pb-2 border-b border-slate-100 overflow-x-auto">
                                        {['All', ...activeSubjects].map((subTab) => (
                                            <button
                                                key={subTab}
                                                type="button"
                                                onClick={() => setActiveChapterTab(subTab)}
                                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                                                    activeChapterTab === subTab
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {subTab}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Search bar */}
                                <div className="relative mb-2">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search chapters..."
                                        value={chapterSearch}
                                        onChange={(e) => setChapterSearch(e.target.value)}
                                        className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                {/* Chapters List */}
                                <div className="space-y-1">
                                    {filteredChapters.length === 0 ? (
                                        <div className="text-center py-4 text-xs text-slate-400">
                                            No chapters found
                                        </div>
                                    ) : (
                                        filteredChapters.map((item) => {
                                            const isSelected = selectedChapters.includes(item.name);
                                            return (
                                                <div
                                                    key={`${item.subject}-${item.name}`}
                                                    onClick={() => toggleChapter(item.name)}
                                                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                                                        isSelected ? 'bg-blue-50 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 truncate">
                                                        {isSelected ? (
                                                            <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                                        ) : (
                                                            <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                                        )}
                                                        <span className="truncate">{item.name}</span>
                                                    </div>
                                                    {activeSubjects.length > 1 && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex-shrink-0">
                                                            {item.subject.slice(0, 3)}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
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
                                        className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div className="space-y-1">
                                    {filteredConcepts.length === 0 ? (
                                        <div className="text-center py-4 text-xs text-slate-400">
                                            {selectedChapters.length === 0
                                                ? 'Select at least one chapter first'
                                                : 'No concepts found'}
                                        </div>
                                    ) : (
                                        filteredConcepts.map((conc) => {
                                            const isSelected = selectedConcepts.includes(conc);
                                            return (
                                                <div
                                                    key={conc}
                                                    onClick={() => toggleConcept(conc)}
                                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
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
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. QUESTION TYPES BREAKDOWN MENU */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <span className="text-base">📊</span> Question Types Breakdown Menu
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Set how many questions of each type to include in the paper
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-100/70 text-blue-900 border border-blue-200">
                                {examOption === 'JEE' && 'JEE Format: 20 Objective + 5 Numerical (75 Qs Total)'}
                                {examOption === 'NEET' && 'NEET Format: 45 Qs / Subject across PCBZ (180 Qs Total)'}
                                {examOption === 'CET' && 'CET Format: 60 Qs / Subject across PCMB (240 Qs Total)'}
                                {examOption === 'Single' && `${perSubjectTotal} Questions Total`}
                                {examOption === 'Multi' && `${perSubjectTotal} Qs per subject (${totalExamQuestions} Total)`}
                            </span>
                            <button
                                type="button"
                                onClick={() => setTypeCounts(DEFAULT_TYPE_PRESETS[examOption] || DEFAULT_TYPE_PRESETS.Single)}
                                className="text-xs font-bold text-slate-600 hover:text-blue-600 bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Reset to standard official exam format"
                            >
                                <RefreshCw className="w-3 h-3" />
                                <span>Reset Format</span>
                            </button>
                        </div>
                    </div>

                    {/* Question Types Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {QUESTION_TYPES_CONFIG.map((item) => {
                            const count = typeCounts[item.key] || 0;
                            const isNumericalDisabled = (examOption === 'NEET' || examOption === 'CET') && item.key === 'numerical';

                            return (
                                <div
                                    key={item.key}
                                    className={`p-3.5 rounded-xl border transition flex flex-col justify-between ${
                                        isNumericalDisabled
                                            ? 'bg-slate-100/60 border-slate-200 opacity-60'
                                            : count > 0
                                            ? 'bg-white border-blue-300 shadow-xs'
                                            : 'bg-white border-slate-200'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">{item.icon}</span>
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-800 leading-tight">
                                                    {item.label}
                                                </h4>
                                                <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                                                    {item.shortDesc}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stepper Controls */}
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                        <div className="text-[11px] text-slate-500 font-medium">
                                            {activeSubjects.length > 1 ? (
                                                <span>Total: <strong className="text-slate-800">{count * activeSubjects.length}</strong></span>
                                            ) : (
                                                <span>Questions</span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                disabled={isNumericalDisabled || count <= 0}
                                                onClick={() => updateTypeCount(item.key, count - 1)}
                                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center font-bold transition cursor-pointer"
                                                title="Decrease"
                                            >
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                disabled={isNumericalDisabled}
                                                value={count}
                                                onChange={(e) => updateTypeCount(item.key, e.target.value)}
                                                className="w-12 text-center text-xs font-bold py-1 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 focus:outline-none focus:border-blue-500"
                                            />
                                            <button
                                                type="button"
                                                disabled={isNumericalDisabled}
                                                onClick={() => updateTypeCount(item.key, count + 1)}
                                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center font-bold transition cursor-pointer"
                                                title="Increase"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Summary Row */}
                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-2xs">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-bold text-slate-700">Per Subject:</span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-800">
                                Objective: <strong>{perSubjectObjective}</strong>
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-800">
                                Numerical: <strong>{perSubjectNumerical}</strong>
                            </span>
                            <span className="px-2 py-0.5 rounded bg-blue-50 font-bold text-blue-900 border border-blue-200">
                                Per Subject Total: <strong>{perSubjectTotal}</strong> Qs
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 bg-emerald-50 text-emerald-950 px-3 py-1 rounded-lg border border-emerald-300">
                                Paper Total: {totalExamQuestions} Questions ({activeSubjects.length} {activeSubjects.length > 1 ? 'Subjects' : 'Subject'})
                            </span>
                        </div>
                    </div>
                </div>

                {/* 4. Selection Mode: Auto vs Manual */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Selection Method:
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

                    {/* Auto mode difficulty sliders */}
                    {selectionMode === 'auto' && (
                        <div className="pt-3 border-t border-slate-200/80">
                            <label className="block text-xs font-semibold text-slate-600 mb-2">
                                Difficulty Ratio Target (Easy % / Medium % / Hard %):
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Easy (%)</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={difficulty.easy}
                                        onChange={(e) => setDifficulty({ ...difficulty, easy: parseInt(e.target.value, 10) || 0 })}
                                        className="w-full text-xs text-center border border-slate-300 rounded-lg py-1 bg-white font-semibold"
                                    />
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Medium (%)</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={difficulty.medium}
                                        onChange={(e) => setDifficulty({ ...difficulty, medium: parseInt(e.target.value, 10) || 0 })}
                                        className="w-full text-xs text-center border border-slate-300 rounded-lg py-1 bg-white font-semibold"
                                    />
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Hard (%)</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={difficulty.hard}
                                        onChange={(e) => setDifficulty({ ...difficulty, hard: parseInt(e.target.value, 10) || 0 })}
                                        className="w-full text-xs text-center border border-slate-300 rounded-lg py-1 bg-white font-semibold"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Primary Button: Load Questions */}
                <div className="pt-2 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={handleLoadQuestions}
                        disabled={loading}
                        className="bg-[#0d6efd] hover:bg-blue-700 active:scale-98 text-white font-bold text-sm px-8 py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        {loading ? (
                            <span>Loading Questions...</span>
                        ) : (
                            <span>Load {totalExamQuestions} Questions</span>
                        )}
                    </button>
                    <span className="text-xs text-slate-500 font-medium">
                        {activeSubjects.length} {activeSubjects.length > 1 ? 'Subjects' : 'Subject'} &bull; {selectedChapters.length} {selectedChapters.length > 1 ? 'Chapters' : 'Chapter'} selected
                    </span>
                </div>
            </div>
        </div>
    );
}
