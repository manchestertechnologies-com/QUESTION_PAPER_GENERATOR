import React, { useState, useEffect, useContext, useRef, useMemo, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { sanitize, optionLabel } from '../../utils/sanitize';
import MathRenderer from '../../components/MathRenderer';
import PaperRenderer, { DEFAULT_SETTINGS, SettingsPanel } from '../../components/PaperRenderer';

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
    const [dist, setDist] = useState({ easy: 40, medium: 40, hard: 20 });
    const max = Math.max(1, filteredCount);

    const updatePct = (key, val) => {
        const num = Math.max(0, Math.min(100, parseInt(val) || 0));
        setDist(prev => {
            const keys = ['easy', 'medium', 'hard'];
            const otherKeys = keys.filter(k => k !== key);
            const remaining = 100 - num;
            const currentOtherTotal = prev[otherKeys[0]] + prev[otherKeys[1]];
            let newFirst = currentOtherTotal > 0 ? Math.round(remaining * (prev[otherKeys[0]] / currentOtherTotal)) : Math.floor(remaining / 2);
            let newSecond = remaining - newFirst;
            return { [key]: num, [otherKeys[0]]: newFirst, [otherKeys[1]]: newSecond };
        });
    };

    const applyPreset = (e, m, h) => {
        setDist({ easy: e, medium: m, hard: h });
    };

    const totalCount = parseInt(qty) || 0;
    const easyCount = Math.round(totalCount * (dist.easy / 100));
    const medCount = Math.round(totalCount * (dist.medium / 100));
    const hardCount = Math.max(0, totalCount - easyCount - medCount);

    const handleConfirm = () => {
        const n = parseInt(qty);
        if (!n || n < 1) return alert('Enter a valid number of questions.');
        onConfirm(n, dist);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-8 border-b-8 border-gold animate-fade-in-up">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-navy mb-1 tracking-tight">Auto Fetch</h2>
                        <p className="text-xs text-slate/40 font-bold uppercase tracking-widest">
                            {filteredCount} Questions Available in Pool
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate/30 hover:text-red-500 bg-gray-50 rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold border border-gray-100 transition">×</button>
                </div>

                {/* Quantity input */}
                <div className="mb-6">
                    <label className="block text-[10px] font-black text-navy uppercase tracking-[0.2em] mb-2 ml-1">
                        Question Quantity
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="number"
                            min={1}
                            max={max}
                            value={qty}
                            onChange={e => setQty(e.target.value)}
                            placeholder={`1 – ${max}`}
                            className="flex-1 border-2 border-gray-100 focus:border-navy rounded-2xl px-4 py-3 text-xl font-black text-navy outline-none text-center transition bg-gray-50/50"
                        />
                        <button onClick={() => setQty(String(Math.min(max, 30)))} className="text-[10px] bg-navy text-gold font-black px-3 py-3.5 rounded-xl shadow hover:scale-105 transition active:scale-95 uppercase tracking-widest">
                            30
                        </button>
                        <button onClick={() => setQty(String(Math.min(max, 50)))} className="text-[10px] bg-navy text-gold font-black px-3 py-3.5 rounded-xl shadow hover:scale-105 transition active:scale-95 uppercase tracking-widest">
                            50
                        </button>
                        <button onClick={() => setQty(String(Math.min(max, 60)))} className="text-[10px] bg-navy text-gold font-black px-3 py-3.5 rounded-xl shadow hover:scale-105 transition active:scale-95 uppercase tracking-widest">
                            60
                        </button>
                    </div>
                </div>

                {/* Difficulty Percentage Line */}
                <div className="mb-6 bg-slate-50 border border-slate-200 rounded-2xl p-5">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-[10px] font-black text-navy uppercase tracking-[0.15em]">
                            Difficulty Distribution (100% Total)
                        </label>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {dist.easy + dist.medium + dist.hard}% Total
                        </span>
                    </div>

                    {/* Segmented Percentage Visual Bar */}
                    <div className="w-full h-4 rounded-full overflow-hidden flex bg-gray-200 border border-gray-300 mb-4 shadow-inner">
                        <div style={{ width: `${dist.easy}%` }} className="bg-emerald-500 transition-all duration-200" title={`Easy: ${dist.easy}%`}></div>
                        <div style={{ width: `${dist.medium}%` }} className="bg-amber-400 transition-all duration-200" title={`Medium: ${dist.medium}%`}></div>
                        <div style={{ width: `${dist.hard}%` }} className="bg-rose-500 transition-all duration-200" title={`Hard: ${dist.hard}%`}></div>
                    </div>

                    {/* 3 percentage inputs */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-white p-3 rounded-xl border border-emerald-200 flex flex-col items-center">
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider mb-1">🟢 Easy</span>
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={dist.easy}
                                    onChange={e => updatePct('easy', e.target.value)}
                                    className="w-12 text-center font-black text-base text-emerald-800 border border-emerald-300 rounded p-1 outline-none"
                                />
                                <span className="font-bold text-xs text-gray-500">%</span>
                            </div>
                            {totalCount > 0 && <span className="text-[10px] font-bold text-emerald-600 mt-1">{easyCount} Qs</span>}
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-amber-200 flex flex-col items-center">
                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1">🟡 Medium</span>
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={dist.medium}
                                    onChange={e => updatePct('medium', e.target.value)}
                                    className="w-12 text-center font-black text-base text-amber-800 border border-amber-300 rounded p-1 outline-none"
                                />
                                <span className="font-bold text-xs text-gray-500">%</span>
                            </div>
                            {totalCount > 0 && <span className="text-[10px] font-bold text-amber-600 mt-1">{medCount} Qs</span>}
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-rose-200 flex flex-col items-center">
                            <span className="text-[10px] font-black text-rose-700 uppercase tracking-wider mb-1">🔴 Hard</span>
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={dist.hard}
                                    onChange={e => updatePct('hard', e.target.value)}
                                    className="w-12 text-center font-black text-base text-rose-800 border border-rose-300 rounded p-1 outline-none"
                                />
                                <span className="font-bold text-xs text-gray-500">%</span>
                            </div>
                            {totalCount > 0 && <span className="text-[10px] font-bold text-rose-600 mt-1">{hardCount} Qs</span>}
                        </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Presets:</span>
                        <button type="button" onClick={() => applyPreset(40, 40, 20)} className="text-[10px] font-bold bg-white border border-gray-200 px-2 py-1 rounded hover:bg-navy hover:text-white transition">40/40/20</button>
                        <button type="button" onClick={() => applyPreset(33, 34, 33)} className="text-[10px] font-bold bg-white border border-gray-200 px-2 py-1 rounded hover:bg-navy hover:text-white transition">Balanced</button>
                        <button type="button" onClick={() => applyPreset(60, 30, 10)} className="text-[10px] font-bold bg-white border border-gray-200 px-2 py-1 rounded hover:bg-navy hover:text-white transition">Easy 60%</button>
                        <button type="button" onClick={() => applyPreset(20, 40, 40)} className="text-[10px] font-bold bg-white border border-gray-200 px-2 py-1 rounded hover:bg-navy hover:text-white transition">Hard 40%</button>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                    <button onClick={onClose} className="flex-1 bg-gray-50 text-slate/60 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition">
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!qty || parseInt(qty) < 1}
                        className="flex-[2] bg-gold text-navy py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:shadow-xl transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-3 shadow-lg"
                    >
                        Confirm Fetch ({totalCount > 0 ? totalCount : 0} Qs)
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── MultiSelect Component ──────────────────────────────────────────────────
const MultiSelectCheckbox = ({ label, options, selectedValues, onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
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
        <div ref={containerRef} className={`relative inline-block text-left w-44 select-none ${isOpen ? 'z-50' : 'z-10'}`}>
            <div>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full border border-gray-300 p-2 rounded-lg text-sm text-gray-700 bg-white focus:border-blue-500 outline-none shadow-sm cursor-pointer flex justify-between items-center disabled:opacity-50 text-left font-medium"
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

// ─── Main CreatePaper Component ──────────────────────────────────────────────
const CreatePaper = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const urlPaperId = searchParams.get('paperId') || '';
    const urlExamId = searchParams.get('examId') || '';

    const subject = user?.subject || 'Chemistry';

    // Mode: 'assignment' or 'paper'
    const [mode, setMode] = useState(urlPaperId || urlExamId ? 'paper' : 'assignment');

    // Admin Commissioned Exam states
    const [assignedExams, setAssignedExams] = useState([]);
    const [selectedExamId, setSelectedExamId] = useState(urlExamId);
    const [currentPaperId, setCurrentPaperId] = useState(urlPaperId);

    // Filter states
    const [filters, setFilters] = useState({ class: '', level: [], type: [], chapter: [], concept: [], sourceType: '', sourcePaperId: '' });
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Pagination / Infinite Scroll states
    const [questions, setQuestions] = useState([]);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // Metadata
    const [metadata, setMetadata] = useState({ total: 0, chapters: [], concepts: [] });

    // Selections & Preview
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [previewQuestion, setPreviewQuestion] = useState(null);

    // Paper info
    const [paperTitle, setPaperTitle] = useState('');
    const [pattern, setPattern] = useState([{ sectionName: 'Section A', numQuestions: '', type: '', description: '', marks: 0 }]);
    const [showPatternModal, setShowPatternModal] = useState(false);

    // Assignment info
    const [assignmentTitle, setAssignmentTitle] = useState(`${subject.toUpperCase()} Assignment`);
    const [startQNo, setStartQNo] = useState(1);
    const [endQNo, setEndQNo] = useState(null);
    const [showAssignmentPreview, setShowAssignmentPreview] = useState(false);
    const [showAssignmentSettings, setShowAssignmentSettings] = useState(false);
    const [assignmentSettings, setAssignmentSettings] = useState({
        ...DEFAULT_SETTINGS,
        showMarks: false,
        startQNo: 1,
        endQNo: null,
    });

    // Modals
    const [showAutoGetModal, setShowAutoGetModal] = useState(false);
    const [toast, setToast] = useState(null);

    // Blueprints / GTs / PYQs
    const [blueprints, setBlueprints] = useState([]);
    const [grandTests, setGrandTests] = useState([]);
    const [previousYearPapers, setPreviousYearPapers] = useState([]);
    const [selectedBlueprintId, setSelectedBlueprintId] = useState('');

    const scrollContainerRef = useRef(null);

    const showToast = (msg, type = 'info') => setToast({ msg, type });

    // ── ISOLATED DRAFT PERSISTENCE KEY ──────────────────────────────────────────
    // Strictly scoped per paper / exam ID so paper questions NEVER collide or leak
    const DRAFT_KEY = useMemo(() => {
        const scope = currentPaperId || selectedExamId || 'standalone_paper';
        return `qpg_draft_${user?._id || user?.id || 'teacher'}_${subject}_${scope}`;
    }, [user, subject, currentPaperId, selectedExamId]);

    const [draftRestored, setDraftRestored] = useState(false);

    // 1. If opening an existing paper by URL paperId, load it directly from DB
    useEffect(() => {
        if (urlPaperId) {
            api.get(`/api/papers/${urlPaperId}`)
                .then(res => {
                    const p = res.data;
                    if (p) {
                        setCurrentPaperId(p._id);
                        if (p.examId) setSelectedExamId(p.examId._id || p.examId);
                        if (p.title) setPaperTitle(p.title);
                        if (Array.isArray(p.questions) && p.questions.length > 0) {
                            setSelectedQuestions(p.questions);
                        }
                        setMode('paper');
                        setDraftRestored(true);
                    }
                })
                .catch(err => console.error('Error fetching paper by ID:', err));
        }
    }, [urlPaperId]);

    // 2. Restore saved draft on mount (survives computer restarts, tab close, etc.)
    useEffect(() => {
        if (urlPaperId) return; // DB load takes priority when paperId is in URL
        try {
            const savedStr = localStorage.getItem(DRAFT_KEY);
            if (savedStr) {
                const saved = JSON.parse(savedStr);
                if (saved) {
                    if (saved.mode) setMode(saved.mode);
                    if (Array.isArray(saved.selectedQuestions) && saved.selectedQuestions.length > 0) {
                        setSelectedQuestions(saved.selectedQuestions);
                        setDraftRestored(true);
                    }
                    if (saved.paperTitle) setPaperTitle(saved.paperTitle);
                    if (saved.assignmentTitle) setAssignmentTitle(saved.assignmentTitle);
                    if (saved.startQNo) setStartQNo(saved.startQNo);
                    if (saved.assignmentSettings) setAssignmentSettings(saved.assignmentSettings);
                    if (saved.selectedExamId) setSelectedExamId(saved.selectedExamId);
                    if (saved.filters) setFilters(prev => ({ ...prev, ...saved.filters }));
                }
            }
        } catch (err) {
            console.error('Failed to restore draft from storage:', err);
        }
    }, [DRAFT_KEY, urlPaperId]);

    // 3. Real-time auto-save to localStorage scoped to this specific paper
    useEffect(() => {
        try {
            const draftData = {
                mode,
                selectedQuestions,
                paperTitle,
                assignmentTitle,
                startQNo,
                assignmentSettings,
                selectedExamId,
                currentPaperId,
                filters,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
        } catch (err) {
            console.error('Failed to auto-save draft to storage:', err);
        }
    }, [mode, selectedQuestions, paperTitle, assignmentTitle, startQNo, assignmentSettings, selectedExamId, currentPaperId, filters, DRAFT_KEY]);

    // Clear Draft / Start Fresh Handler
    const handleClearDraft = () => {
        if (window.confirm('Are you sure you want to clear your current progress and start fresh?')) {
            setSelectedQuestions([]);
            setPaperTitle('');
            setAssignmentTitle(`${subject.toUpperCase()} Assignment`);
            setStartQNo(1);
            setSelectedExamId('');
            try {
                localStorage.removeItem(DRAFT_KEY);
            } catch (err) {
                console.error(err);
            }
            setDraftRestored(false);
            showToast('✓ Draft cleared. Starting fresh.', 'info');
        }
    };

    // Debounce search query
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Fetch initial metadata, blueprints, and commissioned exams on mount
    useEffect(() => {
        api.get('/api/questions/meta').then(res => {
            if (res.data) setMetadata(res.data);
        }).catch(console.error);

        // Fetch commissioned assignments for current teacher
        api.get('/api/exams/my-assignments').then(res => {
            const list = Array.isArray(res.data) ? res.data : [];
            setAssignedExams(list);
            if (list.length === 0 && mode !== 'assignment') {
                setMode('assignment');
            }
        }).catch(console.error);

        api.get('/api/exam-blueprints').then(res => setBlueprints(Array.isArray(res.data) ? res.data : [])).catch(console.error);
        api.get('/api/grand-tests').then(res => setGrandTests(Array.isArray(res.data) ? res.data : [])).catch(console.error);
        api.get('/api/previous-year-papers').then(res => setPreviousYearPapers(Array.isArray(res.data) ? res.data : [])).catch(console.error);
    }, [subject]);

    const handleExamSelect = (examId) => {
        setSelectedExamId(examId);
        if (!examId) {
            setMode('assignment');
            return;
        }
        const ex = assignedExams.find(e => e._id === examId);
        if (ex) {
            setMode('paper');
            setPaperTitle(`${ex.title} - ${subject}`);
            if (ex.classes && ex.classes[0]) {
                setFilters(f => ({ ...f, class: ex.classes[0] }));
            }
            showToast(`✓ Linked to Commissioned Exam: ${ex.title} (${ex.examType})`, 'success');
        }
    };

    // Build query params from filters and search
    const buildQueryParams = useCallback((pageNum, limitNum = 50) => {
        const params = new URLSearchParams();
        params.append('page', String(pageNum));
        params.append('limit', String(limitNum));
        params.append('paginated', 'true');

        if (debouncedSearch) params.append('search', debouncedSearch);
        if (filters.class) params.append('classes', filters.class);
        if (filters.sourceType) params.append('sourceType', filters.sourceType);
        if (filters.sourcePaperId) params.append('sourcePaperId', filters.sourcePaperId);

        if (filters.chapter && filters.chapter.length > 0) params.append('chapter', filters.chapter.join(','));
        if (filters.concept && filters.concept.length > 0) params.append('concept', filters.concept.join(','));
        if (filters.type && filters.type.length > 0) params.append('type', filters.type.join(','));
        if (filters.level && filters.level.length > 0) params.append('level', filters.level.join(','));

        return params.toString();
    }, [debouncedSearch, filters]);

    // Load first page of questions when filters or debouncedSearch changes
    useEffect(() => {
        let isCurrent = true;
        setLoadingInitial(true);
        setPage(1);

        const fetchFirstPage = async () => {
            try {
                const qs = buildQueryParams(1, 50);
                const res = await api.get(`/api/questions?${qs}`);
                if (!isCurrent) return;

                const list = res.data?.questions || [];
                const total = res.data?.pagination?.total || 0;
                setQuestions(list);
                setTotalCount(total);
                setHasMore(list.length < total);
            } catch (err) {
                console.error('Error fetching questions:', err);
                if (isCurrent) showToast('Error loading questions from database', 'error');
            } finally {
                if (isCurrent) setLoadingInitial(false);
            }
        };

        fetchFirstPage();
        return () => { isCurrent = false; };
    }, [buildQueryParams]);

    // Load next page on scroll
    const loadNextPage = async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const nextPage = page + 1;

        try {
            const qs = buildQueryParams(nextPage, 50);
            const res = await api.get(`/api/questions?${qs}`);
            const list = res.data?.questions || [];
            const total = res.data?.pagination?.total || totalCount;

            setQuestions(prev => {
                const existingIds = new Set(prev.map(q => q._id));
                const newItems = list.filter(q => !existingIds.has(q._id));
                const combined = [...prev, ...newItems];
                setHasMore(combined.length < total);
                return combined;
            });
            setPage(nextPage);
        } catch (err) {
            console.error('Error loading next page:', err);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleQuestionsScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 200 && hasMore && !loadingMore && !loadingInitial) {
            loadNextPage();
        }
    };

    // Chapters & Concepts from metadata or loaded questions
    const uniqueChapters = useMemo(() => {
        if (metadata.chapters && metadata.chapters.length > 0) return metadata.chapters;
        return [...new Set(questions.map(q => q.chapter))].filter(Boolean);
    }, [metadata.chapters, questions]);

    const uniqueConcepts = useMemo(() => {
        if (metadata.concepts && metadata.concepts.length > 0) return metadata.concepts;
        return [...new Set(questions.map(q => q.concept))].filter(Boolean);
    }, [metadata.concepts, questions]);

    // Selection handlers
    const handleSelect = (q) => {
        const qId = (q._id || q.id)?.toString();
        if (!selectedQuestions.some(sq => (sq._id || sq.id)?.toString() === qId)) {
            setSelectedQuestions(prev => [...prev, q]);
        }
    };

    const handleDeselect = (id) => {
        const targetId = id?.toString();
        setSelectedQuestions(prev => prev.filter(q => (q._id || q.id)?.toString() !== targetId));
    };

    const handleSelectAllLoaded = () => {
        setSelectedQuestions(prev => {
            const currentIds = new Set(prev.map(q => (q._id || q.id)?.toString()));
            const toAdd = questions.filter(q => !currentIds.has((q._id || q.id)?.toString()));
            return [...prev, ...toAdd];
        });
        showToast(`✓ Added loaded questions to selected list`, 'success');
    };

    const handleClearSelected = () => {
        setSelectedQuestions([]);
        showToast('Cleared all selected questions', 'info');
    };

    // Blueprint handler
    const handleBlueprintChange = (blueprintId) => {
        setSelectedBlueprintId(blueprintId);
        if (!blueprintId) return;
        const bp = blueprints.find(b => b._id === blueprintId);
        if (bp) {
            const userSub = (subject || '').toLowerCase();
            const matchingSub = bp.subjects?.find(s => s.subjectName?.toLowerCase().includes(userSub) || userSub.includes(s.subjectName?.toLowerCase()));
            const targetSubject = matchingSub || bp.subjects?.[0];
            if (targetSubject && targetSubject.sections) {
                const mappedPattern = targetSubject.sections.map((sec, idx) => ({
                    sectionName: sec.sectionName || `Section ${String.fromCharCode(65 + idx)}`,
                    numQuestions: sec.numQuestions || '',
                    type: sec.questionTypes?.[0] || 'MCQ',
                    description: sec.allowedToAnswer ? `Answer any ${sec.allowedToAnswer} questions` : '',
                    marks: (sec.numQuestions || 0) * (sec.markingRules?.correct || 4)
                }));
                setPattern(mappedPattern);
                showToast(`✓ Applied Blueprint: ${bp.name} (${bp.examType})`, 'success');
            }
        }
    };

    // Auto Fetch handler (fetches exact proportions of easy, medium, hard from backend)
    const handleAutoGet = async (qty, dist = { easy: 40, medium: 40, hard: 20 }) => {
        try {
            showToast(`Fetching ${qty} questions with custom difficulty split...`, 'info');
            const qs = buildQueryParams(1, Math.max(qty * 5, 300));
            const res = await api.get(`/api/questions?${qs}`);
            let pool = res.data?.questions || (Array.isArray(res.data) ? res.data : questions);

            if (!pool || pool.length === 0) {
                const fallbackRes = await api.get(`/api/questions?subject=${encodeURIComponent(subject)}&limit=500&paginated=true`);
                pool = fallbackRes.data?.questions || (Array.isArray(fallbackRes.data) ? fallbackRes.data : []);
            }

            const currentSelectedIds = new Set(selectedQuestions.map(sq => (sq._id || sq.id)?.toString()));
            pool = pool.filter(q => !currentSelectedIds.has((q._id || q.id)?.toString()));

            if (pool.length === 0) {
                showToast('No available questions remaining in the pool.', 'error');
                return;
            }

            const targetQty = Math.min(qty, pool.length);
            const easyTarget = Math.round(targetQty * ((dist.easy || 40) / 100));
            const medTarget = Math.round(targetQty * ((dist.medium || 40) / 100));
            const hardTarget = Math.max(0, targetQty - easyTarget - medTarget);

            const easyPool = pool.filter(q => (q.level || '').toLowerCase() === 'easy').sort(() => Math.random() - 0.5);
            const medPool = pool.filter(q => (q.level || '').toLowerCase() === 'medium' || !q.level).sort(() => Math.random() - 0.5);
            const hardPool = pool.filter(q => (q.level || '').toLowerCase() === 'hard').sort(() => Math.random() - 0.5);

            let pickedEasy = easyPool.slice(0, easyTarget);
            let pickedMed = medPool.slice(0, medTarget);
            let pickedHard = hardPool.slice(0, hardTarget);

            let picked = [...pickedEasy, ...pickedMed, ...pickedHard];
            const pickedIds = new Set(picked.map(q => (q._id || q.id)?.toString()));

            // If not enough in specific difficulty buckets, top up from remainder of pool
            if (picked.length < targetQty) {
                const remainingPool = pool.filter(q => !pickedIds.has((q._id || q.id)?.toString())).sort(() => Math.random() - 0.5);
                picked = [...picked, ...remainingPool.slice(0, targetQty - picked.length)];
            }

            setSelectedQuestions(prev => {
                const curIds = new Set(prev.map(s => (s._id || s.id)?.toString()));
                const newOnes = picked.filter(p => !curIds.has((p._id || p.id)?.toString()));
                return [...prev, ...newOnes];
            });
            setShowAutoGetModal(false);
            showToast(`✓ Added ${picked.length} questions! (Total: ${selectedQuestions.length + picked.length} Qs)`, 'success');
        } catch (err) {
            console.error('Auto fetch error:', err);
            showToast('Error auto-fetching questions', 'error');
        }
    };

    // Save Paper handler
    const handleSavePaper = async () => {
        const effectiveTitle = (paperTitle || assignmentTitle || `${subject} Assessment ${new Date().toLocaleDateString()}`).trim();
        if (selectedQuestions.length === 0) {
            alert('Please select at least one question to create a paper.');
            return;
        }
        try {
            showToast('Saving paper to repository...', 'info');
            const payload = {
                title: effectiveTitle,
                subject: subject,
                classes: filters.class ? [filters.class] : ['12'],
                questions: selectedQuestions.map(q => q._id || q.id),
                pattern: (filters.class === '11' || filters.class === '12') ? pattern : [],
                examId: selectedExamId || undefined
            };

            let savedPaper;
            if (currentPaperId) {
                const res = await api.put(`/api/papers/${currentPaperId}`, payload);
                savedPaper = res.data;
            } else {
                const res = await api.post('/api/papers', payload);
                savedPaper = res.data;
                if (savedPaper?._id) setCurrentPaperId(savedPaper._id);
            }

            try {
                localStorage.removeItem(DRAFT_KEY);
            } catch {
                // ignore
            }
            showToast('✓ Paper successfully saved & synced to repository!', 'success');
            setTimeout(() => navigate('/teacher/dashboard/saved-papers'), 1200);
        } catch (err) {
            console.error('Save paper error:', err);
            showToast('Failed to save paper. Please try again.', 'error');
        }
    };

    // Assignment details - ending question number is completely autodetected from starting number + total selected questions
    const actualStartQNo = startQNo || 1;
    const actualEndQNo = selectedQuestions.length > 0 ? (actualStartQNo + selectedQuestions.length - 1) : actualStartQNo;
    const visibleAssignmentQuestions = selectedQuestions;

    const assignmentPaper = useMemo(() => ({
        title: assignmentTitle || `${subject.toUpperCase()} Assignment`,
        subject: subject,
        classes: filters.class ? [filters.class] : [],
        questions: visibleAssignmentQuestions,
        duration: null
    }), [assignmentTitle, subject, filters.class, visibleAssignmentQuestions]);

    return (
        <div className="h-screen bg-gray-50 flex flex-col font-sans animate-fade-in-up">

            {/* Toast Notification */}
            {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

            {/* ── Top Navigation Bar (Manchester Navy & Gold Header) ── */}
            <nav className="bg-navy p-4 text-white flex flex-wrap justify-between items-center z-10 border-b-4 border-gold mx-4 mt-4 shadow-2xl rounded-t-3xl gap-4">
                
                {/* Left Side: Brand, Title, Subject, and Paper Type Dropdown */}
                <div className="flex items-center gap-4 ml-4">
                    <div className="bg-gold text-navy font-black rounded-xl w-10 h-10 flex items-center justify-center text-xl shadow-lg rotate-3">
                        {mode === 'assignment' ? 'A' : 'P'}
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight uppercase leading-none">
                            {mode === 'assignment' ? 'Assignment Builder' : 'Paper Builder'}
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gold font-bold uppercase tracking-widest">
                                {subject} Department
                            </span>
                            {selectedQuestions.length > 0 && (
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <span>💾</span> Auto-Saved
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Paper Type Dropdown (Standard Paper vs Assignment) */}
                    <div className="ml-4 flex items-center gap-2 bg-navy-950/90 border-2 border-gold/60 px-3 py-1.5 rounded-2xl shadow-lg">
                        <span className="text-gold text-[10px] font-black uppercase tracking-wider">Format:</span>
                        <select
                            value={mode}
                            onChange={e => {
                                if (e.target.value === 'paper' && assignedExams.length === 0) {
                                    showToast('⚠️ Standard Exam Papers require an active Exam Commissioned by Admin.', 'error');
                                    return;
                                }
                                setMode(e.target.value);
                            }}
                            className="bg-navy text-gold font-bold text-xs outline-none cursor-pointer pr-2 py-0.5"
                        >
                            <option value="assignment" className="bg-navy text-white">📋 Assignment</option>
                            <option value="paper" disabled={assignedExams.length === 0} className="bg-navy text-white">
                                {assignedExams.length > 0 ? '📄 Standard Paper' : '🔒 Standard Paper (Admin Locked)'}
                            </option>
                        </select>
                    </div>
                </div>

                {/* Right Side: Golden Action Area */}
                <div className="flex items-center flex-wrap gap-3 mr-4">
                    
                    {/* ── Type of Exam Selector (Replaced Blueprint) ── */}
                    <div className="flex items-center gap-2 bg-gold/10 border-2 border-gold/50 px-3 py-2 rounded-xl shadow-md">
                        <span className="text-gold font-black uppercase tracking-wider text-[10px] flex items-center gap-1">
                            <span>🎓</span> Type of Exam:
                        </span>
                        <select
                            value={selectedExamId}
                            onChange={e => handleExamSelect(e.target.value)}
                            className="bg-navy text-gold font-bold text-xs outline-none cursor-pointer rounded-lg px-2 py-1 border border-gold/30 hover:border-gold transition"
                        >
                            <option value="" className="bg-navy text-white">-- Select Commissioned Exam --</option>
                            {assignedExams.map(ex => (
                                <option key={ex._id} value={ex._id} className="bg-navy text-white">
                                    {ex.title} ({ex.examType})
                                </option>
                            ))}
                            {assignedExams.length === 0 && (
                                <option value="" disabled className="bg-navy text-gray-400">No Admin Commissioned Exams</option>
                            )}
                        </select>
                    </div>

                    {/* Auto Fetch Button */}
                    <button
                        onClick={() => setShowAutoGetModal(true)}
                        className="flex items-center gap-2 bg-white/5 border border-gold/40 text-gold px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition shadow-sm"
                        title="Auto fetch questions by quantity and strategy"
                    >
                        Auto Fetch
                    </button>

                    {/* Clear / Start Fresh Button */}
                    {selectedQuestions.length > 0 && (
                        <button
                            onClick={handleClearDraft}
                            className="bg-white/5 border border-rose-400/40 text-rose-300 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition shadow-sm"
                            title="Reset all selections and start fresh"
                        >
                            Start Fresh
                        </button>
                    )}

                    <div className="w-px h-8 bg-gold/20 mx-1"></div>

                    {/* Preview & Print Action */}
                    <button
                        onClick={() => setShowAssignmentPreview(true)}
                        disabled={selectedQuestions.length === 0}
                        className="bg-white/10 text-gold border border-gold/40 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all shadow-md disabled:opacity-40 flex items-center gap-1.5"
                    >
                        <span>🖨</span> Preview & Print
                    </button>

                    {/* Finalize & Save Action */}
                    <button
                        onClick={handleSavePaper}
                        disabled={selectedQuestions.length === 0}
                        className="bg-gold text-navy px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg disabled:opacity-40 flex items-center gap-1.5"
                    >
                        <span>💾</span> Finalize & Save
                    </button>

                    <button
                        onClick={() => navigate(-1)}
                        className="bg-white/5 border border-gold/30 text-gold px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition"
                    >
                        Back
                    </button>
                </div>
            </nav>

            {/* ── Filter Bar ── */}
            <div className="px-6 py-3 bg-white border-b border-gray-200 flex flex-wrap gap-3 items-center relative z-30 mx-4 border-x shadow-sm">
                
                {/* Title and Question Numbering Configuration */}
                {mode === 'paper' ? (
                    <input
                        type="text"
                        placeholder="Paper Title..."
                        value={paperTitle}
                        onChange={e => setPaperTitle(e.target.value)}
                        className="border border-gray-300 p-2 rounded-lg font-medium w-48 text-sm focus:border-blue-500 outline-none"
                    />
                ) : (
                    <>
                        <input
                            type="text"
                            placeholder="Assignment Title..."
                            value={assignmentTitle}
                            onChange={e => setAssignmentTitle(e.target.value)}
                            className="border border-gray-300 p-2 rounded-lg font-medium w-52 text-sm focus:border-blue-500 outline-none"
                        />
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                            <span className="text-[10px] font-black text-navy uppercase tracking-wider">Q. Start:</span>
                            <input
                                type="number"
                                min={1}
                                value={startQNo}
                                onChange={e => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    setStartQNo(val);
                                    setAssignmentSettings(s => ({ ...s, startQNo: val }));
                                }}
                                className="w-14 text-xs font-black text-navy border border-gray-300 rounded-lg p-1 text-center bg-white"
                            />
                        </div>
                        <div className="flex items-center gap-1.5 bg-blue-50/80 border border-blue-200 px-3 py-1.5 rounded-xl">
                            <span className="text-[10px] font-black text-blue-900 uppercase tracking-wider">Q. End (Auto):</span>
                            <span className="text-xs font-black text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                                {selectedQuestions.length > 0 ? `Q${actualStartQNo + selectedQuestions.length - 1}` : '—'}
                            </span>
                        </div>
                    </>
                )}

                {/* Source Selector */}
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Source</div>
                <select
                    value={filters.sourceType}
                    onChange={e => setFilters({ ...filters, sourceType: e.target.value, sourcePaperId: '' })}
                    className="border border-gray-300 p-2 rounded-lg text-sm text-gray-700 bg-white focus:border-blue-500 outline-none shadow-sm cursor-pointer"
                >
                    <option value="">All Sources</option>
                    <option value="REGULAR">Repository (Regular)</option>
                    <option value="GT">Grand Tests (GT)</option>
                    <option value="PYQ">Previous Years (PYQ)</option>
                </select>

                {filters.sourceType === 'GT' && (
                    <select
                        value={filters.sourcePaperId}
                        onChange={e => setFilters({ ...filters, sourcePaperId: e.target.value })}
                        className="border border-gray-300 p-2 rounded-lg text-sm text-gray-700 bg-white focus:border-blue-500 outline-none shadow-sm cursor-pointer w-40"
                    >
                        <option value="">-- Choose GT --</option>
                        {grandTests.map(gt => <option key={gt._id} value={gt._id}>{gt.title}</option>)}
                    </select>
                )}

                {filters.sourceType === 'PYQ' && (
                    <select
                        value={filters.sourcePaperId}
                        onChange={e => setFilters({ ...filters, sourcePaperId: e.target.value })}
                        className="border border-gray-300 p-2 rounded-lg text-sm text-gray-700 bg-white focus:border-blue-500 outline-none shadow-sm cursor-pointer w-40"
                    >
                        <option value="">-- Choose PYQ --</option>
                        {previousYearPapers.map(pyq => <option key={pyq._id} value={pyq._id}>{pyq.title} ({pyq.year})</option>)}
                    </select>
                )}

                {/* Class Filter */}
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Filter</div>
                <select
                    value={filters.class}
                    onChange={e => setFilters({ ...filters, class: e.target.value })}
                    className="border border-gray-300 p-2 rounded-lg text-sm text-gray-700 bg-white focus:border-blue-500 outline-none shadow-sm cursor-pointer"
                >
                    <option value="">All Classes</option>
                    <option value="11">Class 11</option>
                    <option value="12">Class 12</option>
                </select>

                <MultiSelectCheckbox 
                    label="All Levels" 
                    options={["easy", "medium", "hard"]} 
                    selectedValues={filters.level} 
                    onChange={vals => setFilters(f => ({ ...f, level: vals }))} 
                />
                
                <MultiSelectCheckbox 
                    label="All Types" 
                    options={["MCQ", "ASSERTION_REASON", "STATEMENT_BASED", "MATCH_FOLLOWING", "NUMERICAL", "TRUE_FALSE"]} 
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
                    disabled={filters.chapter.length === 0 && uniqueConcepts.length === 0}
                />
            </div>

            {/* ── Three Columns Workspace ── */}
            <div className="flex-1 flex gap-6 overflow-hidden p-6 mx-4 mb-4 border-x border-b border-gray-200 bg-[#f8fafc] rounded-b-lg relative z-0">

                {/* Left Column: Available Questions with Infinite Scroll */}
                <div className="w-1/3 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
                    <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
                        <div>
                            <h3 className="font-bold text-navy text-xs tracking-widest uppercase">Available Questions</h3>
                            <span className="text-[10px] text-gray-400 font-semibold">
                                {totalCount.toLocaleString()} in repository ({questions.length} loaded)
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSelectAllLoaded}
                                className="text-[10px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition"
                                title="Select all currently loaded questions"
                            >
                                Select Loaded
                            </button>
                            <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-xs font-black">
                                {totalCount.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="px-4 py-3 border-b border-gray-100 bg-white">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                            <input
                                type="text"
                                placeholder={`Search all ${totalCount.toLocaleString()} questions...`}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full border border-gray-200 pl-9 pr-3 py-2 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-gray-50/50 focus:bg-white transition"
                            />
                        </div>
                    </div>

                    {/* Scrollable Questions List */}
                    <div
                        ref={scrollContainerRef}
                        onScroll={handleQuestionsScroll}
                        className="flex-1 overflow-y-auto p-4 space-y-3"
                    >
                        {loadingInitial ? (
                            <div className="text-center py-12 text-gray-400 text-sm flex flex-col items-center gap-2">
                                <div className="w-6 h-6 border-2 border-navy border-t-transparent rounded-full animate-spin"></div>
                                Loading question bank...
                            </div>
                        ) : questions.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 text-sm">
                                No questions found matching current filters.
                            </div>
                        ) : (
                            questions.map(q => {
                                const qId = (q._id || q.id)?.toString();
                                const isSelected = selectedQuestions.some(sq => (sq._id || sq.id)?.toString() === qId);
                                return (
                                    <div
                                        key={qId}
                                        onClick={() => setPreviewQuestion(q)}
                                        className={`border p-3.5 rounded-xl cursor-pointer transition flex items-start gap-3 ${isSelected ? 'border-blue-400 bg-blue-50/60 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                    >
                                        <div className="mt-1">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                checked={isSelected}
                                                onChange={e => {
                                                    e.stopPropagation();
                                                    if (e.target.checked) handleSelect(q);
                                                    else handleDeselect(qId);
                                                }}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                                <span className="font-semibold text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                                    {q.questionId}
                                                </span>
                                                <span className="font-semibold text-[9px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">
                                                    {q.type}
                                                </span>
                                                {q.chapter && (
                                                    <span className="font-semibold text-[9px] bg-yellow-50 text-yellow-800 px-1.5 py-0.5 rounded border border-yellow-200 truncate max-w-[150px]">
                                                        {q.chapter}
                                                    </span>
                                                )}
                                                <span className={`font-semibold text-[9px] px-1.5 py-0.5 rounded border ${q.level === 'hard' ? 'bg-orange-50 text-orange-700 border-orange-100' : q.level === 'medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                                    {q.level || 'medium'}
                                                </span>
                                            </div>
                                            <MathRenderer className="text-xs text-gray-700 line-clamp-3 font-medium leading-relaxed" text={q.questionText || q.question} />
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {/* Loading More Indicator */}
                        {loadingMore && (
                            <div className="text-center py-3 text-xs text-gray-500 flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin"></div>
                                Loading more questions...
                            </div>
                        )}

                        {!hasMore && questions.length > 0 && (
                            <div className="text-center py-3 text-[11px] text-gray-400 font-medium">
                                ✓ All {totalCount} matching questions loaded
                            </div>
                        )}
                    </div>
                </div>

                {/* Middle Column: Question Preview */}
                <div className="w-1/3 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-500 text-xs tracking-widest uppercase">Question Preview</h3>
                        {previewQuestion && (() => {
                            const pId = (previewQuestion._id || previewQuestion.id)?.toString();
                            const isPrevSelected = selectedQuestions.some(sq => (sq._id || sq.id)?.toString() === pId);
                            return (
                                <button
                                    onClick={() => {
                                        if (isPrevSelected) {
                                            handleDeselect(pId);
                                        } else {
                                            handleSelect(previewQuestion);
                                        }
                                    }}
                                    className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-lg transition ${isPrevSelected ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-gold text-navy shadow-sm'}`}
                                >
                                    {isPrevSelected ? 'Remove Question' : '+ Add Question'}
                                </button>
                            );
                        })()}
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col">
                        {previewQuestion ? (
                            <div className="animate-fade-in-up space-y-4">
                                <div className="flex flex-wrap gap-2">
                                    <span className="font-bold text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md border border-blue-100">{previewQuestion.questionId}</span>
                                    <span className="font-bold text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-200">Class: {previewQuestion.classes?.join(', ')}</span>
                                    <span className="font-bold text-xs bg-green-50 text-green-700 px-2 py-1 rounded-md border border-green-100">{previewQuestion.type}</span>
                                    {previewQuestion.chapter && <span className="font-bold text-xs bg-amber-50 text-amber-800 px-2 py-1 rounded-md border border-amber-200">{previewQuestion.chapter}</span>}
                                </div>
                                <MathRenderer 
                                    className="text-gray-800 font-medium whitespace-pre-wrap text-sm leading-relaxed"
                                    text={previewQuestion.questionText}
                                />
                                {previewQuestion.imageUrl && (
                                    <div className="my-4">
                                        <img src={previewQuestion.imageUrl} alt="Question Reference" className="max-w-full rounded-lg border border-gray-200" />
                                    </div>
                                )}
                                {previewQuestion.type === 'MCQ' && previewQuestion.options && (
                                    <ul className="space-y-2.5 text-sm text-gray-700 my-4">
                                        {previewQuestion.options.map((opt, i) => (
                                            <li key={i} className="flex items-center gap-3 font-medium bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
                                                <span className="bg-navy text-gold w-6 h-6 flex items-center justify-center rounded-full font-bold text-xs flex-shrink-0">
                                                    {String.fromCharCode(65 + i)}
                                                </span>
                                                <MathRenderer inline={true} text={opt} />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {previewQuestion.answer && (
                                    <div className="mt-auto pt-4 border-t border-gray-100 text-sm bg-gray-50 p-4 rounded-xl">
                                        <span className="font-bold text-navy block mb-1">Answer / Marking Scheme:</span>
                                        <span className="text-gray-700 font-semibold">{previewQuestion.answer}</span>
                                    </div>
                                )}
                                {previewQuestion.solutionText && (
                                    <div className="mt-2 text-xs bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
                                        <span className="font-bold text-blue-900 block mb-1">Explanation / Solution:</span>
                                        <MathRenderer text={previewQuestion.solutionText} />
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
                                <p className="text-gray-400 font-medium text-sm">Select any question to preview details</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Selected Questions (Unlimited selection) */}
                <div className="w-1/3 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
                    <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
                        <div>
                            <h3 className="font-bold text-navy text-xs tracking-widest uppercase">
                                {mode === 'assignment' ? 'Assignment Questions' : 'Selected Questions'}
                            </h3>
                            <span className="text-[10px] text-gray-400 font-semibold">
                                {mode === 'assignment' ? (selectedQuestions.length > 0 ? `Numbering: Q${actualStartQNo} – Q${actualStartQNo + selectedQuestions.length - 1} (${selectedQuestions.length} Questions)` : `Starting from Q${actualStartQNo}`) : 'No limit on selection'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedQuestions.length > 0 && (
                                <button
                                    onClick={handleClearSelected}
                                    className="text-[10px] font-bold text-red-500 hover:text-red-700 border border-red-100 hover:border-red-300 px-2 py-1 rounded-lg transition"
                                >
                                    Clear All
                                </button>
                            )}
                            <span className="bg-gold text-navy px-3 py-1 rounded-full text-xs font-black shadow-sm">
                                {selectedQuestions.length} Selected
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {selectedQuestions.map((q, idx) => (
                            <div key={q._id} className="border border-gray-200 p-3.5 rounded-xl bg-gray-50 relative group flex gap-3 hover:border-gray-300 transition">
                                <div className="font-black text-navy text-xs mt-0.5 min-w-[24px]">
                                    {mode === 'assignment' ? `Q${actualStartQNo + idx}.` : `${idx + 1}.`}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-700 font-medium leading-relaxed pr-6 line-clamp-3" dangerouslySetInnerHTML={{ __html: sanitize(q.questionText) }}></p>
                                    {q.imageUrl && (
                                        <div className="mt-2">
                                            <img src={q.imageUrl} alt="Question Reference" className="max-w-full rounded border border-gray-200 max-h-24 object-contain" />
                                        </div>
                                    )}
                                </div>
                                <button
                                    className="absolute top-3 right-3 text-red-400 hover:text-red-600 cursor-pointer hidden group-hover:block transition p-1"
                                    onClick={() => handleDeselect(q._id)}
                                    title="Remove from selection"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))}

                        {selectedQuestions.length === 0 && (
                            <div className="flex-1 h-full flex flex-col items-center justify-center text-gray-300 min-h-[300px]">
                                <svg className="w-12 h-12 mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                <p className="text-gray-400 font-medium text-sm">No questions selected yet</p>
                                <p className="text-gray-300 text-xs mt-1">Select questions or use Auto Fetch / Generate</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Assignment Preview Modal ── */}
            {showAssignmentPreview && (
                <div className="fixed inset-0 bg-black/80 flex flex-col z-50 backdrop-blur-sm overflow-hidden animate-fade-in-up">
                    <div className="bg-navy px-8 py-4 text-white flex justify-between items-center border-b-4 border-gold shadow-xl no-print">
                        <div className="flex items-center gap-4">
                            <span className="bg-gold text-navy font-black w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow">A</span>
                            <h2 className="text-lg font-black uppercase tracking-wide">
                                Assignment Print & PDF Preview ({visibleAssignmentQuestions.length} Questions)
                            </h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowAssignmentSettings(s => !s)}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${showAssignmentSettings ? 'bg-gold text-navy' : 'bg-white/10 text-gold border border-gold/30 hover:bg-white/20'}`}
                            >
                                ⚙ Settings
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="bg-gold text-navy px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg flex items-center gap-2"
                            >
                                <span>🖨</span> Print / Save PDF
                            </button>
                            <button
                                onClick={() => setShowAssignmentPreview(false)}
                                className="bg-white/10 text-white hover:bg-red-500 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition"
                            >
                                ✕ Close
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 bg-gray-100">
                        {showAssignmentSettings && (
                            <div className="max-w-4xl mx-auto mb-6 bg-white p-6 rounded-2xl shadow-lg border border-gray-200 no-print">
                                <SettingsPanel
                                    settings={assignmentSettings}
                                    setSettings={setAssignmentSettings}
                                    totalQuestions={visibleAssignmentQuestions.length}
                                />
                            </div>
                        )}
                        <div className="max-w-4xl mx-auto shadow-2xl bg-white rounded-2xl overflow-hidden">
                            <PaperRenderer
                                paper={assignmentPaper}
                                activeTemplate={null}
                                isAssignment={true}
                                settings={assignmentSettings}
                                setSettings={setAssignmentSettings}
                                showSettingsPanel={false}
                                printAreaId="paper-builder-assignment-print"
                            />
                        </div>
                    </div>
                    <style>{`@media print { .no-print { display: none !important; } }`}</style>
                </div>
            )}

            {/* ── Auto Fetch Modal ── */}
            {showAutoGetModal && (
                <AutoGetModal
                    onClose={() => setShowAutoGetModal(false)}
                    onConfirm={handleAutoGet}
                    filteredCount={totalCount}
                />
            )}


        </div>
    );
};

export default CreatePaper;