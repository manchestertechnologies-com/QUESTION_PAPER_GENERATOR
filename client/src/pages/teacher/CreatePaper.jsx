/**
 * CreatePaper.jsx
 *
 * Streamlined Step-by-Step Question Paper Generation Wizard
 *
 * Workflow:
 *  Step 1: Academic Requirements (Class, Subject, Chapter selection & Concept selection)
 *  Step 2: Choose Method (Manual Pick vs Auto Fetch)
 *  Step 3: Question Selection / Auto Generation (Filtered strictly by Chapter & Concept, no mixing)
 *  Step 4: True A4 Page-by-Page Preview
 *  Step 5: Alignment & Fine-tuning
 *  Step 6: Finalize, Validate & Save
 */
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';
import MathRenderer from '../../components/MathRenderer';
import PaperRenderer, { DEFAULT_SETTINGS } from '../../components/PaperRenderer';
import { validatePaperQuestions } from '../../utils/questionValidator';

export default function CreatePaper() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Query params if coming from Admin assignment
    const examId = searchParams.get('examId');
    const paperId = searchParams.get('paperId');

    // Wizard Step: 1 (Academic Req) -> 2 (Choose Method) -> 3 (Select/Fetch Qs) -> 4 (Preview) -> 5 (Alignment)
    const [currentStep, setCurrentStep] = useState(1);

    // Step 1: Academic Metadata
    const [title, setTitle] = useState('');
    const [examType, setExamType] = useState('CET');
    const [selectedClass, setSelectedClass] = useState('12');
    const [subject, setSubject] = useState(user?.subject || 'Physics');
    const [selectedChapters, setSelectedChapters] = useState([]);
    const [selectedConcepts, setSelectedConcepts] = useState([]);
    const [duration, setDuration] = useState('180 Minutes');
    const [targetCount, setTargetCount] = useState(60);

    // Step 2: Method selection ('manual' | 'auto')
    const [method, setMethod] = useState('manual');

    // Questions Pool & Selection
    const [availableQuestions, setAvailableQuestions] = useState([]);
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [activeTemplate, setActiveTemplate] = useState(null);

    // Manual Selection Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [filterChapter, setFilterChapter] = useState('');
    const [filterConcept, setFilterConcept] = useState('');
    const [filterDifficulty, setFilterDifficulty] = useState('');
    const [filterType, setFilterType] = useState('');

    // Auto Fetch Configuration
    const [autoQty, setAutoQty] = useState(60);
    const [autoDist, setAutoDist] = useState({ easy: 40, medium: 40, hard: 20 });

    // Alignment Settings
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);

    // Validation State
    const [validationResult, setValidationResult] = useState(null);
    const [saving, setSaving] = useState(false);

    // Load Admin Commissioned Exam metadata if examId is present
    useEffect(() => {
        const fetchExamDetails = async () => {
            if (!examId) return;
            try {
                const res = await api.get(`/api/exams/${examId}`);
                const exam = res.data;
                if (exam) {
                    setTitle(exam.title || '');
                    setExamType(exam.examType || 'CET');
                    if (exam.classes && exam.classes.length > 0) setSelectedClass(exam.classes[0]);
                    const myAssignment = (exam.subjectAssignments || []).find(
                        sa => (sa.subject || '').toLowerCase() === (user?.subject || '').toLowerCase()
                    );
                    if (myAssignment) {
                        setTargetCount(myAssignment.targetQuestions || 60);
                        if (myAssignment.difficultyDistribution) setAutoDist(myAssignment.difficultyDistribution);
                        if (myAssignment.subject) setSubject(myAssignment.subject);
                    }
                }
            } catch (err) {
                console.error('Error fetching exam assignment metadata:', err);
            }
        };

        const fetchTemplates = async () => {
            try {
                const res = await api.get('/api/templates');
                if (res.data && res.data.length > 0) {
                    setActiveTemplate(res.data[0]);
                }
            } catch (e) {
                console.error('Error loading template:', e);
            }
        };

        fetchExamDetails();
        fetchTemplates();
    }, [examId, user]);

    // Meta chapters from backend RPC
    const [metaChapters, setMetaChapters] = useState([]);

    // Fetch Questions Bank based on subject (limit=20000 to get entire pool and meta)
    const fetchQuestionsPool = async () => {
        setLoadingQuestions(true);
        try {
            const [qsRes, metaRes] = await Promise.all([
                api.get(`/api/questions?subject=${encodeURIComponent(subject)}&limit=20000`),
                api.get(`/api/questions/meta?subject=${encodeURIComponent(subject)}`).catch(() => ({ data: { chapters: [] } }))
            ]);

            const qs = Array.isArray(qsRes.data) ? qsRes.data : (qsRes.data?.questions || []);
            setAvailableQuestions(qs);

            if (metaRes.data?.chapters && Array.isArray(metaRes.data.chapters)) {
                setMetaChapters(metaRes.data.chapters);
            }
        } catch (err) {
            console.error('Error fetching questions pool:', err);
        } finally {
            setLoadingQuestions(false);
        }
    };

    useEffect(() => {
        if (subject) {
            fetchQuestionsPool();
        }
    }, [subject]);

    // Extract distinct chapters (combined from DB metadata and full pool) and chapter-to-concepts hierarchy
    const { distinctChapters, chapterConceptsMap } = useMemo(() => {
        const chaptersSet = new Set(metaChapters.filter(Boolean));
        const map = {};

        availableQuestions.forEach(q => {
            const ch = q.chapter || 'General';
            chaptersSet.add(ch);

            if (!map[ch]) map[ch] = new Set();
            const cpt = q.concept || q.topic;
            if (cpt && cpt !== 'General' && cpt !== ch) {
                map[ch].add(cpt);
            }
        });

        const sortedChapters = Array.from(chaptersSet).filter(Boolean).sort();
        const cleanMap = {};
        sortedChapters.forEach(ch => {
            cleanMap[ch] = Array.from(map[ch] || []).sort();
        });

        return { distinctChapters: sortedChapters, chapterConceptsMap: cleanMap };
    }, [availableQuestions, metaChapters]);

    // Concepts available for current filter selection (avoids mixing concepts from other chapters)
    const availableConceptsForFilter = useMemo(() => {
        if (filterChapter && chapterConceptsMap[filterChapter]) {
            return chapterConceptsMap[filterChapter];
        }
        // If no chapter filtered, collect all distinct concepts
        const allCpts = new Set();
        Object.values(chapterConceptsMap).forEach(list => list.forEach(c => allCpts.add(c)));
        return Array.from(allCpts).sort();
    }, [filterChapter, chapterConceptsMap]);

    // Handle chapter filter change: reset concept filter if not valid for selected chapter
    const handleChapterFilterChange = (newChapter) => {
        setFilterChapter(newChapter);
        if (newChapter && chapterConceptsMap[newChapter] && !chapterConceptsMap[newChapter].includes(filterConcept)) {
            setFilterConcept('');
        }
    };

    // Filter available questions for Manual Pick
    const filteredQuestions = useMemo(() => {
        return availableQuestions.filter(q => {
            const matchesSearch = !searchTerm ||
                (q.questionText || q.question || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (q.chapter || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (q.concept || q.topic || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesChapter = !filterChapter || q.chapter === filterChapter;
            const matchesConcept = !filterConcept || (q.concept === filterConcept || q.topic === filterConcept);
            const matchesDifficulty = !filterDifficulty || (q.level || 'medium').toLowerCase() === filterDifficulty.toLowerCase();
            const matchesType = !filterType || (q.type || 'MCQ').toUpperCase() === filterType.toUpperCase();

            return matchesSearch && matchesChapter && matchesConcept && matchesDifficulty && matchesType;
        });
    }, [availableQuestions, searchTerm, filterChapter, filterConcept, filterDifficulty, filterType]);

    // Toggle single question selection
    const toggleQuestion = (question) => {
        const qId = question._id || question.id;
        setSelectedQuestions(prev => {
            const exists = prev.some(q => (q._id || q.id) === qId);
            if (exists) {
                return prev.filter(q => (q._id || q.id) !== qId);
            } else {
                return [...prev, question];
            }
        });
    };

    // Auto Fetch Generator with exact concept & difficulty distribution
    const handleGenerateAuto = () => {
        let pool = [...availableQuestions];
        if (filterChapter) {
            pool = pool.filter(q => q.chapter === filterChapter);
        }
        if (filterConcept) {
            pool = pool.filter(q => q.concept === filterConcept || q.topic === filterConcept);
        }

        if (pool.length === 0) {
            return alert('No questions found matching the selected chapter/concept criteria.');
        }

        const count = Math.min(autoQty, pool.length);
        const easyTarget = Math.round(count * (autoDist.easy / 100));
        const medTarget = Math.round(count * (autoDist.medium / 100));
        const hardTarget = count - easyTarget - medTarget;

        const easyPool = pool.filter(q => (q.level || 'medium').toLowerCase() === 'easy');
        const medPool = pool.filter(q => (q.level || 'medium').toLowerCase() === 'medium');
        const hardPool = pool.filter(q => (q.level || 'medium').toLowerCase() === 'hard');

        const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

        const pickedEasy = shuffle(easyPool).slice(0, easyTarget);
        const pickedMed = shuffle(medPool).slice(0, medTarget);
        const pickedHard = shuffle(hardPool).slice(0, hardTarget);

        let combined = [...pickedEasy, ...pickedMed, ...pickedHard];
        const usedIds = new Set(combined.map(q => q._id || q.id));

        // Fill remaining if pools fell short
        if (combined.length < count) {
            const remainder = pool.filter(q => !usedIds.has(q._id || q.id));
            combined.push(...shuffle(remainder).slice(0, count - combined.length));
        }

        setSelectedQuestions(combined);
        setCurrentStep(4); // Move to Preview
    };

    // Validate paper before previewing
    const handlePreFinalizeCheck = () => {
        if (selectedQuestions.length === 0) {
            alert('Please select at least 1 question before proceeding.');
            return;
        }
        const validation = validatePaperQuestions(selectedQuestions);
        setValidationResult(validation);
        setCurrentStep(4); // Move to Preview
    };

    // Finalize and Save Paper
    const handleFinalizeAndSave = async () => {
        if (selectedQuestions.length === 0) return alert('No questions selected.');
        setSaving(true);

        try {
            const payload = {
                title: title || `${subject} ${examType} Assessment`,
                subject,
                classes: [selectedClass],
                examId: examId || undefined,
                duration,
                questions: selectedQuestions.map(q => q._id || q.id),
                questionObjects: selectedQuestions,
                difficultyDistribution: autoDist,
                status: user?.role === 'admin' ? 'Approved' : 'Pending Approval',
            };

            let res;
            if (paperId) {
                res = await api.put(`/api/papers/${paperId}`, payload);
            } else {
                res = await api.post('/api/papers', payload);
            }

            alert('✓ Question Paper successfully finalized and saved!');
            if (user?.role === 'admin') {
                navigate(`/admin/dashboard/preview/${res.data._id || paperId}`);
            } else {
                navigate('/teacher/dashboard/saved-papers');
            }
        } catch (err) {
            console.error('Error saving paper:', err);
            alert('Failed to save paper. Please verify details and try again.');
        } finally {
            setSaving(false);
        }
    };

    // Prepared paper object for preview renderer
    const currentPaperObject = useMemo(() => ({
        _id: paperId || 'new-paper',
        title: title || `${subject} ${examType} Paper`,
        subject,
        classes: [selectedClass],
        duration,
        questions: selectedQuestions,
        examType,
    }), [paperId, title, subject, selectedClass, duration, selectedQuestions, examType]);

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            
            {/* ── TOP HEADER / STEP WIZARD BAR ── */}
            <header className="bg-navy p-4 text-white flex justify-between items-center shadow-xl border-b-4 border-gold sticky top-0 z-30">
                <div className="flex items-center gap-4 ml-4">
                    <button
                        onClick={() => navigate('/teacher/dashboard')}
                        className="bg-white/10 hover:bg-white/20 text-gold px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                    >
                        ← Exit Wizard
                    </button>
                    <div>
                        <h1 className="text-base font-black uppercase tracking-tight leading-none text-white">
                            Paper Generation Wizard
                        </h1>
                        <span className="text-[10px] text-gold font-bold uppercase tracking-widest mt-0.5 block">
                            {title || `${subject} Assessment`}
                        </span>
                    </div>
                </div>

                {/* Step Indicators */}
                <div className="hidden md:flex items-center gap-2 mr-4">
                    {[
                        { num: 1, label: 'Configure' },
                        { num: 2, label: 'Method' },
                        { num: 3, label: 'Questions' },
                        { num: 4, label: 'Preview' },
                        { num: 5, label: 'Alignment' },
                    ].map((st) => (
                        <div
                            key={st.num}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                                currentStep === st.num
                                    ? 'bg-gold text-navy shadow-md'
                                    : currentStep > st.num
                                    ? 'bg-white/20 text-emerald-400'
                                    : 'bg-white/5 text-gray-400'
                            }`}
                        >
                            <span>{currentStep > st.num ? '✓' : `${st.num}.`}</span>
                            <span>{st.label}</span>
                        </div>
                    ))}
                </div>
            </header>

            {/* ── STEP CONTENT CONTAINER ── */}
            <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
                
                {/* ══════════════════════════════════════════════════════════════
                    STEP 1: ACADEMIC REQUIREMENTS & CONFIGURATION
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 1 && (
                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-200 animate-fade-in space-y-6">
                        <div className="border-b border-gray-100 pb-4">
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Step 1 of 5</span>
                            <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Academic Requirements & Syllabus Setup</h2>
                            <p className="text-xs text-gray-500 font-medium mt-1">Specify paper details, target exam format, and select syllabus chapters & concepts.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Paper Title */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Paper Title <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g. CET MOCK 1 or Chemistry Chapter Assessment"
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-gray-50/50"
                                />
                            </div>

                            {/* Exam Format */}
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Exam Format</label>
                                <select
                                    value={examType}
                                    onChange={e => setExamType(e.target.value)}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white cursor-pointer"
                                >
                                    <option value="CET">CET Assessment</option>
                                    <option value="NEET">NEET Examination</option>
                                    <option value="JEE">JEE Examination</option>
                                    <option value="BOARD">PUC Board Standard</option>
                                </select>
                            </div>

                            {/* Target Class */}
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Target Class</label>
                                <select
                                    value={selectedClass}
                                    onChange={e => setSelectedClass(e.target.value)}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white cursor-pointer"
                                >
                                    <option value="12">Class 12 (II PUC)</option>
                                    <option value="11">Class 11 (I PUC)</option>
                                    <option value="Both">Both (11th & 12th)</option>
                                </select>
                            </div>

                            {/* Subject */}
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Academic Subject</label>
                                <input
                                    type="text"
                                    value={subject}
                                    disabled={user?.role === 'teacher'}
                                    onChange={e => setSubject(e.target.value)}
                                    className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold text-navy bg-gray-100"
                                />
                            </div>

                            {/* Duration (Variable according to setter/teacher) */}
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">
                                    Exam Duration (Variable)
                                </label>
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={duration}
                                        onChange={e => setDuration(e.target.value)}
                                        placeholder="e.g. 180 Minutes, 3 Hours, 45 Mins"
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white"
                                    />
                                    <div className="flex flex-wrap gap-1.5">
                                        {['45 Minutes', '60 Minutes', '90 Minutes', '120 Minutes', '180 Minutes', '200 Minutes', '3 Hours'].map(preset => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => setDuration(preset)}
                                                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                                    duration === preset ? 'bg-navy text-gold font-black' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                {preset}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Chapter and Concept Scope Summary */}
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-navy uppercase tracking-wider">
                                    📚 Available Syllabus Chapters ({distinctChapters.length})
                                </span>
                                <span className="text-[11px] font-bold text-gray-500">
                                    {availableQuestions.length} Total Questions in Pool
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                                {distinctChapters.map(ch => (
                                    <span
                                        key={ch}
                                        className="bg-white border border-gray-300 text-navy text-[11px] font-bold px-3 py-1 rounded-xl shadow-xs"
                                    >
                                        {ch}
                                        {chapterConceptsMap[ch]?.length > 0 && (
                                            <span className="ml-1.5 text-[9px] bg-navy/10 text-navy px-1.5 py-0.5 rounded-md">
                                                {chapterConceptsMap[ch].length} Concepts
                                            </span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Navigation Actions */}
                        <div className="flex justify-end pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setCurrentStep(2)}
                                className="bg-navy text-gold hover:scale-105 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-xl flex items-center gap-2 cursor-pointer"
                            >
                                <span>Continue to Question Method</span>
                                <span>→</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 2: CHOOSE QUESTION METHOD (MANUAL PICK VS AUTO FETCH)
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 2 && (
                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-200 animate-fade-in space-y-8">
                        <div className="border-b border-gray-100 pb-4">
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Step 2 of 5</span>
                            <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Choose Question Acquisition Method</h2>
                            <p className="text-xs text-gray-500 font-medium mt-1">Select questions manually with granular chapter & concept filters or auto-fetch a balanced set.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Manual Pick Card */}
                            <div
                                onClick={() => {
                                    setMethod('manual');
                                    setCurrentStep(3);
                                }}
                                className="border-3 border-gray-200 hover:border-navy hover:shadow-2xl rounded-3xl p-8 cursor-pointer transition-all duration-300 flex flex-col justify-between group bg-surface"
                            >
                                <div>
                                    <div className="w-16 h-16 rounded-2xl bg-navy text-gold flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                                        ✍️
                                    </div>
                                    <h3 className="text-xl font-black text-navy uppercase tracking-tight mb-2">Manual Question Pick</h3>
                                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                                        Browse your repository with specific chapter & concept filters so questions and topics never get mixed. Inspect details and select exactly what you need.
                                    </p>
                                </div>
                                <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-xs font-black text-navy uppercase tracking-wider group-hover:text-gold">
                                    <span>Browse Questions ({availableQuestions.length} Available)</span>
                                    <span>→</span>
                                </div>
                            </div>

                            {/* Auto Fetch Card */}
                            <div
                                onClick={() => {
                                    setMethod('auto');
                                    setCurrentStep(3);
                                }}
                                className="border-3 border-gray-200 hover:border-gold hover:shadow-2xl rounded-3xl p-8 cursor-pointer transition-all duration-300 flex flex-col justify-between group bg-surface"
                            >
                                <div>
                                    <div className="w-16 h-16 rounded-2xl bg-gold text-navy flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                                        ⚡
                                    </div>
                                    <h3 className="text-xl font-black text-navy uppercase tracking-tight mb-2">Auto Fetch Generator</h3>
                                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                                        Automatically assemble a compliant question paper by specifying chapter, concept scope, question count, and difficulty distribution.
                                    </p>
                                </div>
                                <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-xs font-black text-navy uppercase tracking-wider group-hover:text-gold">
                                    <span>Configure & Generate</span>
                                    <span>→</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-start pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setCurrentStep(1)}
                                className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                            >
                                ← Back to Requirements
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 3: QUESTION SELECTION / AUTO GENERATION (WITH CONCEPT FILTER)
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 3 && (
                    <div className="space-y-6 animate-fade-in">
                        {method === 'auto' ? (
                            /* ── AUTO FETCH CONFIGURATION SCREEN ── */
                            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-200 space-y-6 max-w-3xl mx-auto">
                                <div className="border-b border-gray-100 pb-4">
                                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Auto Fetch Engine</span>
                                    <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Auto Fetch Configuration</h2>
                                    <p className="text-xs text-gray-500 font-medium mt-1">
                                        Select Chapter & Concept scope to target specific topics without mixing syllabus areas.
                                    </p>
                                </div>

                                <div className="space-y-5">
                                    {/* Scope Filters */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                        <div>
                                            <label className="block text-xs font-black text-navy uppercase mb-1">Target Chapter</label>
                                            <select
                                                value={filterChapter}
                                                onChange={e => handleChapterFilterChange(e.target.value)}
                                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                                            >
                                                <option value="">All Prescribed Chapters ({distinctChapters.length})</option>
                                                {distinctChapters.map(ch => (
                                                    <option key={ch} value={ch}>{ch}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-navy uppercase mb-1">Target Concept / Topic</label>
                                            <select
                                                value={filterConcept}
                                                onChange={e => setFilterConcept(e.target.value)}
                                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                                            >
                                                <option value="">All Concepts in Chapter</option>
                                                {availableConceptsForFilter.map(cpt => (
                                                    <option key={cpt} value={cpt}>{cpt}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Quantity */}
                                    <div>
                                        <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Question Quantity</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min={1}
                                                max={availableQuestions.length || 100}
                                                value={autoQty}
                                                onChange={e => setAutoQty(parseInt(e.target.value) || 0)}
                                                className="w-32 border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-lg font-black text-navy text-center outline-none"
                                            />
                                            {[30, 45, 60, 90].map(cnt => (
                                                <button
                                                    key={cnt}
                                                    type="button"
                                                    onClick={() => setAutoQty(cnt)}
                                                    className="px-3.5 py-2.5 rounded-xl font-black text-xs bg-navy/5 hover:bg-navy hover:text-gold text-navy transition cursor-pointer"
                                                >
                                                    {cnt} Qs
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Difficulty Split Slider / Visual Bar */}
                                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-black text-navy uppercase tracking-wider">Difficulty Distribution Split</label>
                                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                                {autoDist.easy + autoDist.medium + autoDist.hard}% Total
                                            </span>
                                        </div>

                                        <div className="w-full h-4 rounded-full overflow-hidden flex bg-gray-200 shadow-inner">
                                            <div style={{ width: `${autoDist.easy}%` }} className="bg-emerald-500 transition-all"></div>
                                            <div style={{ width: `${autoDist.medium}%` }} className="bg-amber-400 transition-all"></div>
                                            <div style={{ width: `${autoDist.hard}%` }} className="bg-rose-500 transition-all"></div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-white p-3 rounded-xl border border-emerald-200 text-center">
                                                <span className="text-[10px] font-black text-emerald-700 uppercase">🟢 Easy</span>
                                                <input
                                                    type="number"
                                                    value={autoDist.easy}
                                                    onChange={e => setAutoDist({ ...autoDist, easy: parseInt(e.target.value) || 0 })}
                                                    className="w-full text-center font-black text-base text-emerald-800 outline-none mt-1"
                                                />
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-amber-200 text-center">
                                                <span className="text-[10px] font-black text-amber-700 uppercase">🟡 Medium</span>
                                                <input
                                                    type="number"
                                                    value={autoDist.medium}
                                                    onChange={e => setAutoDist({ ...autoDist, medium: parseInt(e.target.value) || 0 })}
                                                    className="w-full text-center font-black text-base text-amber-800 outline-none mt-1"
                                                />
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-rose-200 text-center">
                                                <span className="text-[10px] font-black text-rose-700 uppercase">🔴 Hard</span>
                                                <input
                                                    type="number"
                                                    value={autoDist.hard}
                                                    onChange={e => setAutoDist({ ...autoDist, hard: parseInt(e.target.value) || 0 })}
                                                    className="w-full text-center font-black text-base text-rose-800 outline-none mt-1"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => setCurrentStep(2)}
                                        className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        onClick={handleGenerateAuto}
                                        className="bg-navy text-gold hover:scale-105 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-xl flex items-center gap-2 cursor-pointer"
                                    >
                                        <span>⚡ Generate & Proceed to Preview</span>
                                        <span>→</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* ── MANUAL SELECTION SCREEN WITH DEDICATED CHAPTER & CONCEPT FILTERS ── */
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-200 space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                                    <div>
                                        <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Question Bank</span>
                                        <h2 className="text-xl font-black text-navy mt-1 uppercase tracking-tight">Select Assessment Questions</h2>
                                        <p className="text-xs text-gray-500 font-bold">
                                            {selectedQuestions.length} of {targetCount} Questions Selected • {filteredQuestions.length} Matched Filters
                                        </p>
                                    </div>

                                    {/* Action Bar */}
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setCurrentStep(2)}
                                            className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                                        >
                                            ← Back
                                        </button>
                                        <button
                                            onClick={handlePreFinalizeCheck}
                                            disabled={selectedQuestions.length === 0}
                                            className="bg-navy text-gold hover:scale-105 disabled:opacity-30 disabled:pointer-events-none px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md flex items-center gap-2 cursor-pointer"
                                        >
                                            <span>Proceed to Preview ({selectedQuestions.length})</span>
                                            <span>→</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Granular Filters Bar with Chapter AND Concept separation */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                    <input
                                        type="text"
                                        placeholder="🔍 Search text / formula..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                                    />
                                    {/* Chapter Filter */}
                                    <select
                                        value={filterChapter}
                                        onChange={e => handleChapterFilterChange(e.target.value)}
                                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                                    >
                                        <option value="">All Chapters ({distinctChapters.length})</option>
                                        {distinctChapters.map(ch => (
                                            <option key={ch} value={ch}>{ch}</option>
                                        ))}
                                    </select>
                                    {/* Concept Filter (Dynamically scoped to selected chapter) */}
                                    <select
                                        value={filterConcept}
                                        onChange={e => setFilterConcept(e.target.value)}
                                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                                    >
                                        <option value="">All Concepts ({availableConceptsForFilter.length})</option>
                                        {availableConceptsForFilter.map(cpt => (
                                            <option key={cpt} value={cpt}>{cpt}</option>
                                        ))}
                                    </select>
                                    {/* Difficulty Filter */}
                                    <select
                                        value={filterDifficulty}
                                        onChange={e => setFilterDifficulty(e.target.value)}
                                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                                    >
                                        <option value="">All Difficulties</option>
                                        <option value="easy">🟢 Easy</option>
                                        <option value="medium">🟡 Medium</option>
                                        <option value="hard">🔴 Hard</option>
                                    </select>
                                    {/* Question Type Filter */}
                                    <select
                                        value={filterType}
                                        onChange={e => setFilterType(e.target.value)}
                                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                                    >
                                        <option value="">All Types</option>
                                        <option value="MCQ">MCQ</option>
                                        <option value="ASSERTION_REASON">Assertion & Reason</option>
                                        <option value="MATCH_FOLLOWING">Match the Column</option>
                                        <option value="STATEMENT_BASED">Statement Based</option>
                                    </select>
                                </div>

                                {/* Questions List */}
                                {loadingQuestions ? (
                                    <div className="p-12 text-center text-xs font-bold text-gray-400">Loading questions repository...</div>
                                ) : filteredQuestions.length === 0 ? (
                                    <div className="p-12 text-center text-xs font-bold text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                                        No questions match the selected chapter/concept filter criteria.
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                                        {filteredQuestions.map((q, idx) => {
                                            const isSelected = selectedQuestions.some(sq => (sq._id || sq.id) === (q._id || q.id));
                                            const conceptName = q.concept || q.topic;
                                            return (
                                                <div
                                                    key={q._id || idx}
                                                    onClick={() => toggleQuestion(q)}
                                                    className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-4 ${
                                                        isSelected
                                                            ? 'border-navy bg-blue-50/40 shadow-sm'
                                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {}}
                                                        className="mt-1 w-4 h-4 text-navy rounded border-gray-300 cursor-pointer"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                            <span className="text-[10px] font-black bg-navy text-gold px-2 py-0.5 rounded">
                                                                {q.type || 'MCQ'}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-navy bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                                📖 {q.chapter || 'General'}
                                                            </span>
                                                            {conceptName && conceptName !== 'General' && (
                                                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                                    💡 {conceptName}
                                                                </span>
                                                            )}
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                                (q.level || 'medium').toLowerCase() === 'easy' ? 'bg-emerald-100 text-emerald-800' :
                                                                (q.level || 'medium').toLowerCase() === 'hard' ? 'bg-rose-100 text-rose-800' :
                                                                'bg-amber-100 text-amber-800'
                                                            }`}>
                                                                {q.level || 'Medium'}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs font-bold text-navy line-clamp-2">
                                                            <MathRenderer inline text={q.questionText || q.question} />
                                                        </div>
                                                        {q.imageUrl && (
                                                            <span className="text-[10px] text-blue-600 font-bold mt-1 block">🖼 Diagram Included</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 4: TRUE A4 PAGE-BY-PAGE PREVIEW
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 4 && (
                    <div className="space-y-6 animate-fade-in">
                        {validationResult && validationResult.issues.length > 0 && (
                            <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl text-xs font-bold text-amber-900 no-print flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>{validationResult.issues.length} minor validation advisory note(s) found in selected questions.</span>
                                </div>
                                <span className="text-[10px] uppercase tracking-wider text-amber-700">Validated</span>
                            </div>
                        )}

                        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 no-print">
                            <button
                                onClick={() => setCurrentStep(3)}
                                className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                            >
                                ← Back to Questions
                            </button>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setCurrentStep(5)}
                                    className="bg-gold text-navy hover:bg-navy hover:text-gold px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>⚙️</span> Open Alignment Controls →
                                </button>
                                <button
                                    onClick={handleFinalizeAndSave}
                                    disabled={saving}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>✓</span> {saving ? 'Saving...' : 'Finalize & Save Paper'}
                                </button>
                            </div>
                        </div>

                        {/* A4 Paper Renderer */}
                        <div className="w-full flex justify-center">
                            <PaperRenderer
                                paper={currentPaperObject}
                                activeTemplate={activeTemplate}
                                settings={settings}
                                setSettings={setSettings}
                                showSettingsPanel={false}
                                onProceedToAlignment={() => setCurrentStep(5)}
                                onProceedToFinalize={handleFinalizeAndSave}
                            />
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 5: ALIGNMENT & FINE-TUNING
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 5 && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 no-print">
                            <button
                                onClick={() => setCurrentStep(4)}
                                className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                            >
                                ← Back to Preview
                            </button>
                            <button
                                onClick={handleFinalizeAndSave}
                                disabled={saving}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition shadow-lg flex items-center gap-2 cursor-pointer"
                            >
                                <span>✓</span> {saving ? 'Finalizing...' : 'Finalize & Save Paper'}
                            </button>
                        </div>

                        {/* Renderer with Alignment panel open */}
                        <div className="w-full flex justify-center">
                            <PaperRenderer
                                paper={currentPaperObject}
                                activeTemplate={activeTemplate}
                                settings={settings}
                                setSettings={setSettings}
                                showSettingsPanel={true}
                                onProceedToFinalize={handleFinalizeAndSave}
                            />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}