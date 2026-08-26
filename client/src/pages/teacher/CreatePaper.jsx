/**
 * CreatePaper.jsx
 *
 * Professional Assessment & Assignment Generation Suite
 *
 * Workflow:
 *  Step 1: Scope & Mode Setup (Test vs Assignment, Multi-Select Chapters & Concepts via Checkbox Boxes, Manual Duration)
 *  Step 2: Choose Acquisition Method (Manual Question Pick vs Auto Fetch Generator)
 *  Step 3: Question Selection / Auto Assembly from Multi-Topic Pool
 *  Step 4: True A4 Paginated Preview (Page-by-Page, Balanced Distribution)
 *  Step 5: Layout Alignment & Fine-tuning
 *  Step 6: Finalize, Validate & Save / PDF Export
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

    // Query params
    const examId = searchParams.get('examId');
    const paperId = searchParams.get('paperId');
    const initialCategory = searchParams.get('category') === 'assignment' ? 'assignment' : 'test';

    // Wizard Step: 1 (Configure) -> 2 (Method) -> 3 (Questions) -> 4 (Preview) -> 5 (Alignment)
    const [currentStep, setCurrentStep] = useState(1);

    // Step 1: Mode & Academic Metadata
    const [paperCategory, setPaperCategory] = useState(initialCategory); // 'test' | 'assignment'
    const [subject, setSubject] = useState(user?.subject || 'Physics');
    const [selectedClass, setSelectedClass] = useState('12');
    const [examType, setExamType] = useState('CET');
    const [title, setTitle] = useState('');
    const [duration, setDuration] = useState('180 Minutes');
    const [targetCount, setTargetCount] = useState(60);

    // Assignment custom question numbering
    const [startQNo, setStartQNo] = useState(1);
    const [endQNo, setEndQNo] = useState(null);

    // Multi-Select Checkbox States for Chapters & Concepts
    const [selectedChapters, setSelectedChapters] = useState([]);
    const [selectedConcepts, setSelectedConcepts] = useState([]);

    // Step 2: Method selection ('manual' | 'auto')
    const [method, setMethod] = useState('manual');

    // Questions Pool & Selection
    const [availableQuestions, setAvailableQuestions] = useState([]);
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [activeTemplate, setActiveTemplate] = useState(null);

    // Manual Selection Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDifficulty, setFilterDifficulty] = useState('');
    const [filterType, setFilterType] = useState('');
    const [singleFilterChapter, setSingleFilterChapter] = useState('');
    const [singleFilterConcept, setSingleFilterConcept] = useState('');

    // Auto Fetch Configuration
    const [autoQty, setAutoQty] = useState(60);
    const [autoDist, setAutoDist] = useState({ easy: 40, medium: 40, hard: 20 });

    // Alignment Settings
    const [settings, setSettings] = useState({
        ...DEFAULT_SETTINGS,
        showCoverPage: false,
        startQNo: 1,
    });

    // Validation State
    const [validationResult, setValidationResult] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showReviewSelectedModal, setShowReviewSelectedModal] = useState(false);
    const [showLimitReachedModal, setShowLimitReachedModal] = useState(false);

    // Maximum Target Questions Limit
    const targetLimit = useMemo(() => {
        if (paperCategory === 'assignment') return autoQty || 60;
        if (pattern && pattern.length > 0) {
            const patternQCount = pattern.reduce((acc, sec) => acc + (sec.questions?.length || sec.questionCount || 0), 0);
            if (patternQCount > 0) return patternQCount;
        }
        return autoQty || 60;
    }, [paperCategory, autoQty, pattern]);

    // Meta chapters from backend RPC
    const [metaChapters, setMetaChapters] = useState([]);

    // Auto default title when category or subject changes
    useEffect(() => {
        if (!title || title.includes('Assessment') || title.includes('Assignment') || title.includes('Paper')) {
            if (paperCategory === 'assignment') {
                setTitle(`${subject} Assignment`);
            } else {
                setTitle(`${subject} Assessment`);
            }
        }
    }, [paperCategory, subject]);

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
                        setAutoQty(myAssignment.targetQuestions || 60);
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

    // Extract distinct chapters and chapter-to-concepts hierarchy
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

    // Extract concepts available for currently checked chapters
    const availableConceptsForSelectedChapters = useMemo(() => {
        if (selectedChapters.length === 0) return [];
        const conceptsList = [];
        selectedChapters.forEach(ch => {
            const cList = chapterConceptsMap[ch] || [];
            cList.forEach(c => {
                if (!conceptsList.some(item => item.concept === c && item.chapter === ch)) {
                    conceptsList.push({ concept: c, chapter: ch });
                }
            });
        });

        return conceptsList;
    }, [selectedChapters, chapterConceptsMap]);

    // ── Checkbox Toggle Handlers ──
    const toggleChapter = (ch) => {
        setSelectedChapters(prev => {
            if (prev.includes(ch)) {
                // If unchecking chapter, also remove concepts belonging to this chapter
                const chapterConcepts = chapterConceptsMap[ch] || [];
                setSelectedConcepts(cPrev => cPrev.filter(c => !chapterConcepts.includes(c)));
                return prev.filter(item => item !== ch);
            } else {
                return [...prev, ch];
            }
        });
    };

    const selectAllChapters = () => {
        setSelectedChapters([...distinctChapters]);
    };

    const deselectAllChapters = () => {
        setSelectedChapters([]);
        setSelectedConcepts([]);
    };

    const toggleConcept = (cpt) => {
        setSelectedConcepts(prev => 
            prev.includes(cpt) ? prev.filter(c => c !== cpt) : [...prev, cpt]
        );
    };

    const selectAllConcepts = () => {
        const allCpts = availableConceptsForSelectedChapters.map(i => i.concept);
        setSelectedConcepts([...new Set(allCpts)]);
    };

    const deselectAllConcepts = () => {
        setSelectedConcepts([]);
    };

    // ── Matched Question Pool (Filtered strictly by multi-selected chapters & concepts & class) ──
    const scopedQuestionPool = useMemo(() => {
        return availableQuestions.filter(q => {
            // Class/Standard check (if classes are specified for paper, e.g. Class 12)
            if (classes && classes.length > 0 && q.classes && q.classes.length > 0) {
                const matchesClass = classes.some(c => {
                    const cleanC = String(c).replace(/^(class|grade|puc)\s*/i, '').trim().toLowerCase();
                    return q.classes.some(qc => {
                        const cleanQC = String(qc).replace(/^(class|grade|puc)\s*/i, '').trim().toLowerCase();
                        return cleanQC === cleanC || cleanQC.includes(cleanC) || cleanC.includes(cleanQC);
                    });
                });
                if (!matchesClass) return false;
            }

            // Chapter check
            if (selectedChapters.length > 0) {
                if (!selectedChapters.includes(q.chapter)) {
                    return false;
                }
            }

            // Concept check
            if (selectedConcepts.length > 0) {
                const qConcept = q.concept || q.topic;
                if (!selectedConcepts.includes(qConcept)) {
                    return false;
                }
            }
            return true;
        });
    }, [availableQuestions, selectedChapters, selectedConcepts, classes]);

    // Filtered questions for Manual Selection (includes search, difficulty, and type)
    const filteredQuestions = useMemo(() => {
        return scopedQuestionPool.filter(q => {
            const matchesSearch = !searchTerm ||
                (q.questionText || q.question || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (q.chapter || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (q.concept || q.topic || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesSingleChapter = !singleFilterChapter || q.chapter === singleFilterChapter;
            const matchesSingleConcept = !singleFilterConcept || (q.concept === singleFilterConcept || q.topic === singleFilterConcept);
            const matchesDifficulty = !filterDifficulty || (q.level || 'medium').toLowerCase() === filterDifficulty.toLowerCase();
            const matchesType = !filterType || (q.type || 'MCQ').toUpperCase() === filterType.toUpperCase();

            return matchesSearch && matchesSingleChapter && matchesSingleConcept && matchesDifficulty && matchesType;
        });
    }, [scopedQuestionPool, searchTerm, singleFilterChapter, singleFilterConcept, filterDifficulty, filterType]);

    // Toggle single question selection with Max Limit enforcement
    const toggleQuestion = (question) => {
        const qId = question._id || question.id;
        setSelectedQuestions(prev => {
            const exists = prev.some(q => (q._id || q.id) === qId);
            if (exists) {
                return prev.filter(q => (q._id || q.id) !== qId);
            } else {
                if (prev.length >= targetLimit) {
                    setShowLimitReachedModal(true);
                    return prev;
                }
                return [...prev, question];
            }
        });
    };

    const selectAllMatching = () => {
        setSelectedQuestions(prev => {
            const prevIds = new Set(prev.map(q => q._id || q.id));
            const newToAdd = filteredQuestions.filter(q => !prevIds.has(q._id || q.id));
            const availableSlots = Math.max(0, targetLimit - prev.length);
            if (availableSlots <= 0) {
                setShowLimitReachedModal(true);
                return prev;
            }
            if (newToAdd.length > availableSlots) {
                setShowLimitReachedModal(true);
                return [...prev, ...newToAdd.slice(0, availableSlots)];
            }
            return [...prev, ...newToAdd];
        });
    };

    const deselectAllMatching = () => {
        const matchingIds = new Set(filteredQuestions.map(q => q._id || q.id));
        setSelectedQuestions(prev => prev.filter(q => !matchingIds.has(q._id || q.id)));
    };

    // Auto Fetch Generator
    const handleGenerateAuto = () => {
        if (scopedQuestionPool.length === 0) {
            return alert('No questions found matching the selected syllabus chapters & concepts.');
        }

        const count = Math.min(targetLimit, scopedQuestionPool.length);
        const easyTarget = Math.round(count * (autoDist.easy / 100));
        const medTarget = Math.round(count * (autoDist.medium / 100));
        const hardTarget = count - easyTarget - medTarget;

        const easyPool = scopedQuestionPool.filter(q => (q.level || 'medium').toLowerCase() === 'easy');
        const medPool = scopedQuestionPool.filter(q => (q.level || 'medium').toLowerCase() === 'medium');
        const hardPool = scopedQuestionPool.filter(q => (q.level || 'medium').toLowerCase() === 'hard');

        const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

        const pickedEasy = shuffle(easyPool).slice(0, easyTarget);
        const pickedMed = shuffle(medPool).slice(0, medTarget);
        const pickedHard = shuffle(hardPool).slice(0, hardTarget);

        let combined = [...pickedEasy, ...pickedMed, ...pickedHard];
        const usedIds = new Set(combined.map(q => q._id || q.id));

        if (combined.length < count) {
            const remainder = scopedQuestionPool.filter(q => !usedIds.has(q._id || q.id));
            combined.push(...shuffle(remainder).slice(0, count - combined.length));
        }

        setSelectedQuestions(combined);
        setCurrentStep(4); // Move to Preview
    };

    // Pre-finalize check
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
                title: title || (paperCategory === 'assignment' ? `${subject} Assignment` : `${subject} Assessment`),
                subject,
                classes: [selectedClass],
                examId: examId || undefined,
                duration: duration || (paperCategory === 'assignment' ? null : '180 Minutes'),
                isAssignment: paperCategory === 'assignment',
                startQNo: startQNo || 1,
                endQNo: endQNo || (startQNo + selectedQuestions.length - 1),
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

            alert(`✓ ${paperCategory === 'assignment' ? 'Assignment' : 'Question Paper'} successfully saved!`);
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
    const currentPaperObject = useMemo(() => {
        const effectiveEnd = endQNo || (startQNo + selectedQuestions.length - 1);
        const requiredCount = Math.max(0, effectiveEnd - startQNo + 1);
        const displayQuestions = selectedQuestions.slice(0, requiredCount || selectedQuestions.length);

        return {
            _id: paperId || 'new-paper',
            title: title || (paperCategory === 'assignment' ? `${subject} Assignment` : `${subject} Assessment`),
            subject,
            classes: [selectedClass],
            duration: duration || null,
            questions: displayQuestions,
            examType: paperCategory === 'assignment' ? 'ASSIGNMENT' : examType,
            isAssignment: paperCategory === 'assignment',
        };
    }, [paperId, title, paperCategory, subject, selectedClass, duration, selectedQuestions, examType, startQNo, endQNo]);

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
                            {paperCategory === 'assignment' ? 'Assignment Generator' : 'Question Paper Generator'}
                        </h1>
                        <span className="text-[10px] text-gold font-bold uppercase tracking-widest mt-0.5 block">
                            {title || `${subject} Assessment`}
                        </span>
                    </div>
                </div>

                {/* Step Indicators */}
                <div className="hidden md:flex items-center gap-2 mr-4">
                    {[
                        { num: 1, label: 'Scope & Setup' },
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
                    STEP 1: SCOPE, MODE & MULTI-SELECT CHAPTERS / CONCEPTS
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 1 && (
                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-200 animate-fade-in space-y-8">
                        <div className="border-b border-gray-100 pb-4">
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Step 1 of 5</span>
                            <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Academic Scope & Syllabus Setup</h2>
                            <p className="text-xs text-gray-500 font-medium mt-1">
                                Choose mode, specify details, and check multiple chapters and concepts to diversify questions.
                            </p>
                        </div>

                        {/* ── MODE SELECTION: TEST VS ASSIGNMENT ── */}
                        <div>
                            <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Paper Type</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div
                                    onClick={() => setPaperCategory('test')}
                                    className={`p-5 rounded-2xl border-2 cursor-pointer transition flex items-start gap-4 ${
                                        paperCategory === 'test'
                                            ? 'border-navy bg-blue-50/50 shadow-md ring-2 ring-navy/10'
                                            : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-navy text-gold flex items-center justify-center text-xl font-bold">
                                        🎓
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-navy uppercase">Standard Assessment / Test</h4>
                                        <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                                            Formal examination paper with manual timing, cover page, and institutional headers.
                                        </p>
                                    </div>
                                </div>

                                <div
                                    onClick={() => setPaperCategory('assignment')}
                                    className={`p-5 rounded-2xl border-2 cursor-pointer transition flex items-start gap-4 ${
                                        paperCategory === 'assignment'
                                            ? 'border-gold bg-amber-50/50 shadow-md ring-2 ring-gold/20'
                                            : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-gold text-navy flex items-center justify-center text-xl font-bold">
                                        📝
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-navy uppercase">Practice Assignment / Homework</h4>
                                        <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                                            Subject-focused practice sheet with custom question ranges and direct layout.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── METADATA INPUTS ── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                            {/* Title */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">
                                    {paperCategory === 'assignment' ? 'Assignment Title' : 'Paper Title'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder={paperCategory === 'assignment' ? "e.g. Chemistry Assignment or Organic Practice Sheet" : "e.g. Physics Midterm Assessment"}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white"
                                />
                            </div>

                            {/* Format (Only for Tests) */}
                            {paperCategory === 'test' ? (
                                <div>
                                    <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Exam Format</label>
                                    <select
                                        value={examType}
                                        onChange={e => setExamType(e.target.value)}
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white cursor-pointer"
                                    >
                                        <option value="CET">CET Standard</option>
                                        <option value="NEET">NEET Standard</option>
                                        <option value="JEE">JEE Standard</option>
                                        <option value="BOARD">PUC Board Standard</option>
                                    </select>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Target Questions Count</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={targetCount}
                                        onChange={e => {
                                            const v = parseInt(e.target.value) || 10;
                                            setTargetCount(v);
                                            setAutoQty(v);
                                        }}
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white"
                                    />
                                </div>
                            )}

                            {/* Class */}
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

                            {/* Duration (Manual Input Only) */}
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">
                                    Duration (Manual Entry)
                                </label>
                                <input
                                    type="text"
                                    value={duration}
                                    onChange={e => setDuration(e.target.value)}
                                    placeholder="e.g. 180 Minutes, 45 Mins, 1 Hour 30 Mins"
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white"
                                />
                            </div>

                            {/* Assignment Question Range */}
                            {paperCategory === 'assignment' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Start Question No.</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={startQNo}
                                            onChange={e => setStartQNo(parseInt(e.target.value) || 1)}
                                            className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">End Question No. (Optional)</label>
                                        <input
                                            type="number"
                                            min={startQNo}
                                            placeholder={`Default: ${startQNo + targetCount - 1}`}
                                            value={endQNo || ''}
                                            onChange={e => setEndQNo(e.target.value ? parseInt(e.target.value) : null)}
                                            className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* ── MULTI-SELECT CHAPTERS (CHECKBOX BOX GRID) ── */}
                        <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
                                <div>
                                    <h3 className="text-sm font-black text-navy uppercase tracking-wider flex items-center gap-2">
                                        <span>📚</span> Select Chapters ({selectedChapters.length} of {distinctChapters.length} Selected)
                                    </h3>
                                    <p className="text-[11px] text-gray-500 font-medium">
                                        Check one or multiple chapters to include in the question pool.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAllChapters}
                                        className="text-[11px] font-bold text-navy bg-navy/10 hover:bg-navy hover:text-gold px-3 py-1 rounded-xl transition cursor-pointer"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={deselectAllChapters}
                                        className="text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-xl transition cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-56 overflow-y-auto p-1">
                                {distinctChapters.map(ch => {
                                    const isChecked = selectedChapters.includes(ch);
                                    const cCount = (chapterConceptsMap[ch] || []).length;
                                    return (
                                        <div
                                            key={ch}
                                            onClick={() => toggleChapter(ch)}
                                            className={`p-3 rounded-2xl border-2 cursor-pointer transition flex items-center gap-3 ${
                                                isChecked
                                                    ? 'border-navy bg-blue-50/60 shadow-xs'
                                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {}}
                                                className="w-4 h-4 text-navy rounded border-gray-300 cursor-pointer"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-xs font-bold text-navy block truncate" title={ch}>
                                                    {ch}
                                                </span>
                                                <span className="text-[10px] text-gray-500 font-medium">
                                                    {cCount} {cCount === 1 ? 'Concept' : 'Concepts'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── MULTI-SELECT CONCEPTS (ONLY VISIBLE AFTER CHAPTER SELECTION) ── */}
                        {selectedChapters.length > 0 ? (
                            <div className="space-y-3 animate-fade-in">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
                                    <div>
                                        <h3 className="text-sm font-black text-navy uppercase tracking-wider flex items-center gap-2">
                                            <span>💡</span> Select Concepts & Topics ({selectedConcepts.length} of {availableConceptsForSelectedChapters.length} Selected)
                                        </h3>
                                        <p className="text-[11px] text-gray-500 font-medium">
                                            Available concepts under the {selectedChapters.length} selected chapter(s).
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={selectAllConcepts}
                                            className="text-[11px] font-bold text-navy bg-navy/10 hover:bg-navy hover:text-gold px-3 py-1 rounded-xl transition cursor-pointer"
                                        >
                                            Select All
                                        </button>
                                        <button
                                            type="button"
                                            onClick={deselectAllConcepts}
                                            className="text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-xl transition cursor-pointer"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                {availableConceptsForSelectedChapters.length === 0 ? (
                                    <div className="p-6 text-center text-xs font-bold text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                                        No specific sub-concepts mapped under selected chapters. Questions will be drawn from all chapter topics.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-56 overflow-y-auto p-1">
                                        {availableConceptsForSelectedChapters.map(({ concept: cpt, chapter: ch }) => {
                                            const isChecked = selectedConcepts.includes(cpt);
                                            return (
                                                <div
                                                    key={`${ch}-${cpt}`}
                                                    onClick={() => toggleConcept(cpt)}
                                                    className={`p-3 rounded-2xl border-2 cursor-pointer transition flex items-center gap-3 ${
                                                        isChecked
                                                            ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {}}
                                                        className="w-4 h-4 text-emerald-600 rounded border-gray-300 cursor-pointer"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-xs font-bold text-navy block truncate" title={cpt}>
                                                            {cpt}
                                                        </span>
                                                        <span className="text-[9px] text-gray-500 font-medium block truncate" title={ch}>
                                                            📖 {ch}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center gap-3">
                                <span className="text-lg">💡</span>
                                <span className="text-xs font-bold text-navy">
                                    Select one or more chapters above to view and filter specific concepts & topics.
                                </span>
                            </div>
                        )}

                        {/* ── SCOPE SUMMARY BAR ── */}
                        <div className="bg-navy text-white p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <span className="text-[10px] text-gold font-bold uppercase tracking-widest">Active Scope Pool</span>
                                <div className="text-sm font-black mt-0.5">
                                    {scopedQuestionPool.length} Questions Available across {selectedChapters.length || 'All'} Chapters & {selectedConcepts.length || 'All'} Concepts
                                </div>
                            </div>
                            <button
                                onClick={() => setCurrentStep(2)}
                                className="bg-gold text-navy hover:scale-105 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>Proceed to Method</span>
                                <span>→</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 2: CHOOSE METHOD (MANUAL PICK VS AUTO FETCH)
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 2 && (
                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-200 animate-fade-in space-y-8">
                        <div className="border-b border-gray-100 pb-4">
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Step 2 of 5</span>
                            <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Choose Acquisition Method</h2>
                            <p className="text-xs text-gray-500 font-medium mt-1">
                                Pick questions individually from your selected topics or auto-generate a balanced set.
                            </p>
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
                                        Browse all {scopedQuestionPool.length} questions matching your checked chapters and concepts. Select exactly what you need.
                                    </p>
                                </div>
                                <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-xs font-black text-navy uppercase tracking-wider group-hover:text-gold">
                                    <span>Browse Questions ({scopedQuestionPool.length} In Scope)</span>
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
                                        Automatically assemble questions across all your checked chapters and concepts with customized difficulty distribution.
                                    </p>
                                </div>
                                <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-xs font-black text-navy uppercase tracking-wider group-hover:text-gold">
                                    <span>Configure & Auto-Generate</span>
                                    <span>→</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-start pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setCurrentStep(1)}
                                className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                            >
                                ← Back to Scope Setup
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 3: QUESTION SELECTION / AUTO GENERATION
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 3 && (
                    <div className="space-y-6 animate-fade-in">
                        {method === 'auto' ? (
                            /* ── AUTO FETCH CONFIGURATION SCREEN ── */
                            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-200 space-y-6 max-w-3xl mx-auto">
                                <div className="border-b border-gray-100 pb-4">
                                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Auto Engine</span>
                                    <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Auto Fetch Configuration</h2>
                                    <p className="text-xs text-gray-500 font-medium mt-1">
                                        Assembling from {scopedQuestionPool.length} available questions across {selectedChapters.length || 'All'} chapters and {selectedConcepts.length || 'All'} concepts.
                                    </p>
                                </div>

                                <div className="space-y-5">
                                    {/* Quantity */}
                                    <div>
                                        <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Question Quantity</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min={1}
                                                max={scopedQuestionPool.length || 100}
                                                value={autoQty}
                                                onChange={e => setAutoQty(parseInt(e.target.value) || 0)}
                                                className="w-32 border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-lg font-black text-navy text-center outline-none"
                                            />
                                            {[15, 30, 45, 60].map(cnt => (
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

                                    {/* Difficulty Split */}
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
                            /* ── MANUAL SELECTION SCREEN ── */
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-200 space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                                    <div>
                                        <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                            Multi-Topic Question Pool
                                        </span>
                                        <h2 className="text-xl font-black text-navy mt-1 uppercase tracking-tight">
                                            Select Questions ({filteredQuestions.length} in Active Pool)
                                        </h2>
                                        <p className="text-xs text-gray-500 font-bold">
                                            {selectedQuestions.length} Questions Selected
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
                                            onClick={() => setShowReviewSelectedModal(true)}
                                            className="bg-slate-100 text-navy hover:bg-slate-200 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer border border-gray-300"
                                        >
                                            👁 Review Selected ({selectedQuestions.length})
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

                                {/* Quick Filters & Search within Active Multi-Selected Pool */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                    <input
                                        type="text"
                                        placeholder="🔍 Search in pool..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                                    />
                                    <select
                                        value={singleFilterChapter}
                                        onChange={e => setSingleFilterChapter(e.target.value)}
                                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                                    >
                                        <option value="">All Scoped Chapters ({selectedChapters.length || distinctChapters.length})</option>
                                        {(selectedChapters.length > 0 ? selectedChapters : distinctChapters).map(ch => (
                                            <option key={ch} value={ch}>{ch}</option>
                                        ))}
                                    </select>
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
                                    <select
                                        value={filterType}
                                        onChange={e => setFilterType(e.target.value)}
                                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                                    >
                                        <option value="">All Question Types</option>
                                        <option value="MCQ">MCQ</option>
                                        <option value="ASSERTION_REASON">Assertion & Reason</option>
                                        <option value="MATCH_FOLLOWING">Match the Column</option>
                                        <option value="STATEMENT_BASED">Statement Based</option>
                                    </select>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={selectAllMatching}
                                            className="flex-1 bg-navy text-gold text-[11px] font-bold py-2 rounded-xl cursor-pointer hover:bg-navy/90"
                                        >
                                            Select All ({filteredQuestions.length})
                                        </button>
                                        <button
                                            onClick={deselectAllMatching}
                                            className="bg-gray-200 text-gray-700 text-[11px] font-bold px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-300"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                {/* Questions List */}
                                {loadingQuestions ? (
                                    <div className="p-12 text-center text-xs font-bold text-gray-400">Loading questions pool...</div>
                                ) : filteredQuestions.length === 0 ? (
                                    <div className="p-12 text-center text-xs font-bold text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                                        No questions match the active filters in this pool.
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

                {/* ── MODAL: REVIEW SELECTED BASKET ── */}
                {showReviewSelectedModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50/80">
                                <div>
                                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                        Selected Basket
                                    </span>
                                    <h3 className="text-xl font-black text-navy mt-1 uppercase tracking-tight">
                                        Selected Questions ({selectedQuestions.length})
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setShowReviewSelectedModal(false)}
                                    className="text-slate/30 hover:text-red-500 bg-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border shadow transition"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-3">
                                {selectedQuestions.length === 0 ? (
                                    <div className="p-12 text-center text-xs font-bold text-gray-400">
                                        No questions selected yet.
                                    </div>
                                ) : (
                                    selectedQuestions.map((q, idx) => (
                                        <div key={idx} className="border border-gray-200 p-4 rounded-2xl bg-gray-50/40 flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="text-[10px] font-black bg-navy text-gold px-2 py-0.5 rounded">
                                                        Q.{startQNo + idx}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-navy bg-blue-50 px-2 py-0.5 rounded">
                                                        📖 {q.chapter || 'General'}
                                                    </span>
                                                    {(q.concept || q.topic) && (
                                                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                                                            💡 {q.concept || q.topic}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs font-bold text-navy line-clamp-2">
                                                    <MathRenderer inline text={q.questionText || q.question} />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleQuestion(q)}
                                                className="text-rose-500 hover:bg-rose-50 p-2 rounded-xl text-xs font-black transition cursor-pointer"
                                                title="Remove this question"
                                            >
                                                ✕ Remove
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-600">
                                    Total Selected: {selectedQuestions.length} of {targetLimit} Questions
                                </span>
                                <button
                                    onClick={() => setShowReviewSelectedModal(false)}
                                    className="bg-navy text-gold px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer"
                                >
                                    Close & Continue
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── MODAL: MAX QUESTIONS REACHED POPUP ── */}
                {showLimitReachedModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-xs p-4 animate-fade-in">
                        <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-center space-y-4 animate-scale-up">
                            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-3xl mx-auto font-black shadow-inner">
                                ⚠️
                            </div>
                            <h3 className="text-xl font-black text-navy uppercase tracking-tight">
                                Maximum Questions Reached!
                            </h3>
                            <p className="text-xs text-gray-600 leading-relaxed">
                                You have reached the maximum quota of <strong>{targetLimit} questions</strong> for this {paperCategory === 'assignment' ? 'assignment' : 'question paper'}. Extra questions cannot be added.
                            </p>
                            <p className="text-[11px] text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100 text-left">
                                💡 <strong>Tip:</strong> If you want to add a different question, please uncheck an already selected question first.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowLimitReachedModal(false)}
                                className="w-full bg-navy hover:bg-navy/90 text-gold py-3 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
                            >
                                Understood & Close
                            </button>
                        </div>
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
                                    <span>✓</span> {saving ? 'Saving...' : `Save ${paperCategory === 'assignment' ? 'Assignment' : 'Paper'}`}
                                </button>
                            </div>
                        </div>

                        {/* A4 Paper Renderer */}
                        <div className="w-full flex justify-center">
                            <PaperRenderer
                                paper={currentPaperObject}
                                isAssignment={paperCategory === 'assignment'}
                                activeTemplate={activeTemplate}
                                settings={{ ...settings, startQNo, endQNo }}
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
                                <span>✓</span> {saving ? 'Finalizing...' : `Save ${paperCategory === 'assignment' ? 'Assignment' : 'Paper'}`}
                            </button>
                        </div>

                        {/* Renderer with Alignment panel open */}
                        <div className="w-full flex justify-center">
                            <PaperRenderer
                                paper={currentPaperObject}
                                isAssignment={paperCategory === 'assignment'}
                                activeTemplate={activeTemplate}
                                settings={{ ...settings, startQNo, endQNo }}
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