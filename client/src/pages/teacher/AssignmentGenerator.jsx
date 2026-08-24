/**
 * AssignmentGenerator.jsx
 *
 * Professional Assignment Generation & Download Suite for Teachers & Admins
 *
 * Requirements fulfilled:
 * - View & Download Assignment PDF (True A4)
 * - View & Download Analysis (Full color charts)
 * - View & Download Answer Key
 * - View & Download Solutions
 * - Smart Question Numbering & Filtering
 */
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import PaperRenderer, { DEFAULT_SETTINGS } from '../../components/PaperRenderer';
import PaperAnalysisModal from '../../components/PaperAnalysisModal';
import MathRenderer from '../../components/MathRenderer';

// ─── Main component ───────────────────────────────────────────────────────────
const AssignmentGenerator = ({ onBack, adminMode = false, adminSubject = '' }) => {
    const { user } = useContext(AuthContext);
    const subject = adminMode ? adminSubject : (user?.subject || 'Physics');

    const [allQuestions, setAllQuestions] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [showSettings, setShowSettings] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState('');

    // Modals
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const [showAnswerKeyModal, setShowAnswerKeyModal] = useState(false);
    const [showSolutionsModal, setShowSolutionsModal] = useState(false);

    const [filters, setFilters] = useState({ search: '', chapter: '', type: '', level: '' });
    const [settings, setSettings] = useState({
        ...DEFAULT_SETTINGS,
        showMarks: false,
        showCoverPage: false, // Assignments start directly
        startQNo: 1,
        endQNo: null,
    });

    useEffect(() => {
        const fetchQs = async () => {
            try {
                const res = await api.get('/api/questions', { params: { limit: 10000, subject } });
                const list = Array.isArray(res.data) ? res.data : (res.data?.questions || []);
                setAllQuestions(list);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchQs();
    }, [subject]);

    const chapters = useMemo(() => [...new Set(allQuestions.map(q => q.chapter).filter(Boolean))].sort(), [allQuestions]);

    const filteredQs = useMemo(() => allQuestions.filter(q => {
        if (filters.chapter && q.chapter !== filters.chapter) return false;
        if (filters.type && q.type !== filters.type) return false;
        if (filters.level && q.level !== filters.level) return false;
        if (filters.search) {
            const s = filters.search.toLowerCase();
            if (!(q.questionText || '').toLowerCase().includes(s) && !(q.chapter || '').toLowerCase().includes(s)) return false;
        }
        return true;
    }), [allQuestions, filters]);

    const selectedQs = useMemo(() => allQuestions.filter(q => selectedIds.includes(q._id || q.id)), [allQuestions, selectedIds]);

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const selectAll = () => setSelectedIds(filteredQs.map(q => q._id || q.id));
    const clearAll = () => setSelectedIds([]);

    const startQNo = settings.startQNo || 1;
    const endQNo = settings.endQNo ?? (startQNo + selectedQs.length - 1);
    const required = Math.max(0, endQNo - startQNo + 1);
    const visibleQs = selectedQs.slice(0, required);

    const assignmentPaper = useMemo(() => ({
        _id: 'assignment-paper',
        title: title || `${subject.toUpperCase()} PRACTICE ASSIGNMENT`,
        subject,
        classes: [],
        questions: visibleQs,
        duration: null,
    }), [title, subject, visibleQs]);

    const handlePrint = () => {
        window.print();
    };

    if (showPreview) {
        return (
            <div className="space-y-6 animate-fade-in pb-16">
                {/* Preview Toolbar */}
                <div className="bg-surface p-5 rounded-3xl shadow-sm border border-gray-200 flex flex-wrap justify-between items-center gap-4 no-print">
                    <button
                        onClick={() => setShowPreview(false)}
                        className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                    >
                        ← Back to Question Selection
                    </button>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={() => setShowAnalysisModal(true)}
                            className="bg-gold text-navy hover:bg-navy hover:text-gold px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                        >
                            <span>📊</span> View Analysis
                        </button>
                        <button
                            onClick={() => setShowAnswerKeyModal(true)}
                            className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                        >
                            <span>🔑</span> Answer Key
                        </button>
                        <button
                            onClick={() => setShowSolutionsModal(true)}
                            className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                        >
                            <span>💡</span> Solutions
                        </button>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition border cursor-pointer ${
                                showSettings ? 'bg-amber-500 text-white' : 'bg-white text-gray-700 border-gray-300'
                            }`}
                        >
                            <span>⚙️</span> Alignment
                        </button>
                        <button
                            onClick={handlePrint}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                        >
                            <span>🖨</span> Download Assignment (PDF)
                        </button>
                    </div>
                </div>

                {/* Main A4 Renderer */}
                <div className="w-full flex justify-center">
                    <PaperRenderer
                        paper={assignmentPaper}
                        activeTemplate={null}
                        isAssignment={true}
                        settings={settings}
                        setSettings={setSettings}
                        showSettingsPanel={showSettings}
                    />
                </div>

                {/* ── ANSWER KEY MODAL ── */}
                {showAnswerKeyModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50/80">
                                <div>
                                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Assignment Keys</span>
                                    <h3 className="text-xl font-black text-navy mt-1 uppercase tracking-tight">
                                        {title || `${subject} Assignment`} Answer Key
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => window.print()}
                                        className="bg-gold text-navy hover:bg-navy hover:text-gold px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow cursor-pointer"
                                    >
                                        Print Key
                                    </button>
                                    <button
                                        onClick={() => setShowAnswerKeyModal(false)}
                                        className="text-slate/30 hover:text-red-500 bg-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border shadow transition"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 overflow-y-auto">
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                    {visibleQs.map((q, idx) => (
                                        <div
                                            key={idx}
                                            className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex justify-between items-center text-xs font-bold hover:border-navy transition"
                                        >
                                            <span className="text-gray-500">Q.{startQNo + idx}</span>
                                            <span className="bg-navy text-gold px-2.5 py-0.5 rounded-md font-black text-sm">
                                                {q.answer || 'N/A'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50 text-right">
                                <button
                                    onClick={() => setShowAnswerKeyModal(false)}
                                    className="bg-navy text-gold px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-wider"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── SOLUTIONS MODAL ── */}
                {showSolutionsModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50/80">
                                <div>
                                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Solutions Guide</span>
                                    <h3 className="text-xl font-black text-navy mt-1 uppercase tracking-tight">
                                        {title || `${subject} Assignment`} Detailed Solutions
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setShowSolutionsModal(false)}
                                    className="text-slate/30 hover:text-red-500 bg-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border shadow transition"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-5">
                                {visibleQs.map((q, idx) => (
                                    <div key={idx} className="border border-gray-200 p-5 rounded-2xl bg-gray-50/50 space-y-2">
                                        <div className="flex justify-between items-center border-b pb-2">
                                            <span className="font-black text-sm text-navy">Question {startQNo + idx}</span>
                                            <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-0.5 rounded-md">
                                                Answer: ({q.answer || 'N/A'})
                                            </span>
                                        </div>
                                        <p className="text-xs font-bold text-gray-800">{q.questionText || q.question}</p>
                                        <div className="bg-white p-3.5 rounded-xl border border-gray-200 text-xs text-gray-700">
                                            <span className="font-bold text-navy block mb-1">Explanation:</span>
                                            {q.solutionText ? q.solutionText : 'Detailed step-by-step solution available.'}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50 text-right">
                                <button
                                    onClick={() => setShowSolutionsModal(false)}
                                    className="bg-navy text-gold px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-wider"
                                >
                                    Close Solutions
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── ANALYSIS MODAL ── */}
                <PaperAnalysisModal
                    isOpen={showAnalysisModal}
                    onClose={() => setShowAnalysisModal(false)}
                    paperTitle={title || `${subject} Assignment`}
                    questions={visibleQs}
                    examType="CET"
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header & Controls */}
            <div className="bg-surface p-6 rounded-3xl shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="bg-gray-100 text-navy hover:bg-navy hover:text-gold px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer"
                        >
                            ← Back
                        </button>
                    )}
                    <div>
                        <h2 className="text-xl font-black text-navy uppercase tracking-tight">
                            📋 Assignment Generator — {subject}
                        </h2>
                        <p className="text-xs text-gray-500 font-bold">Select questions and generate assignment with answers & solutions</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowPreview(true)}
                        disabled={selectedQs.length === 0}
                        className="bg-navy text-gold hover:scale-105 disabled:opacity-30 disabled:pointer-events-none px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition shadow-lg flex items-center gap-2 cursor-pointer"
                    >
                        <span>👁 Preview & Download ({selectedQs.length} Qs)</span>
                        <span>→</span>
                    </button>
                </div>
            </div>

            {/* Assignment Metadata & Q Numbering Setup */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
                <div>
                    <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Assignment Title (Optional)</label>
                    <input
                        type="text"
                        placeholder={`${subject.toUpperCase()} Practice Assignment`}
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full border-2 border-gray-200 focus:border-navy rounded-xl px-3.5 py-2.5 text-xs font-bold text-navy outline-none bg-gray-50/50"
                    />
                </div>
                <div>
                    <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Start Question Number</label>
                    <input
                        type="number"
                        min={1}
                        value={settings.startQNo}
                        onChange={e => setSettings(s => ({ ...s, startQNo: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="w-full border-2 border-gray-200 focus:border-navy rounded-xl px-3.5 py-2.5 text-xs font-bold text-navy outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">
                        End Question Number {selectedQs.length > 0 && `(max ${startQNo + selectedQs.length - 1})`}
                    </label>
                    <input
                        type="number"
                        min={settings.startQNo}
                        value={settings.endQNo ?? (startQNo + selectedQs.length - 1)}
                        onChange={e => {
                            const v = parseInt(e.target.value) || (startQNo + selectedQs.length - 1);
                            setSettings(s => ({ ...s, endQNo: Math.max(s.startQNo, v) }));
                        }}
                        className="w-full border-2 border-gray-200 focus:border-navy rounded-xl px-3.5 py-2.5 text-xs font-bold text-navy outline-none"
                    />
                </div>
            </div>

            {/* Question Bank Selection Card */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-3">
                        <h3 className="text-sm font-black text-navy uppercase tracking-wider">
                            {subject} Questions Repository
                        </h3>
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                            {filteredQs.length} Available
                        </span>
                        {selectedIds.length > 0 && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                                {selectedIds.length} Selected
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={selectAll}
                            className="bg-navy text-gold px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:scale-105 transition cursor-pointer"
                        >
                            Select All
                        </button>
                        <button
                            onClick={clearAll}
                            className="bg-gray-100 text-gray-700 px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-gray-200 transition cursor-pointer"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <input
                        type="text"
                        placeholder="Search questions..."
                        value={filters.search}
                        onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
                    />
                    <select
                        value={filters.chapter}
                        onChange={e => setFilters(f => ({ ...f, chapter: e.target.value }))}
                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                    >
                        <option value="">All Chapters</option>
                        {chapters.map(ch => (
                            <option key={ch} value={ch}>{ch}</option>
                        ))}
                    </select>
                    <select
                        value={filters.type}
                        onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                    >
                        <option value="">All Types</option>
                        <option value="MCQ">MCQ</option>
                        <option value="ASSERTION_REASON">Assertion & Reason</option>
                        <option value="MATCH_FOLLOWING">Match the Following</option>
                    </select>
                    <select
                        value={filters.level}
                        onChange={e => setFilters(f => ({ ...f, level: e.target.value }))}
                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                    >
                        <option value="">All Difficulties</option>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                    </select>
                </div>

                {/* Questions List */}
                {loading ? (
                    <div className="p-12 text-center text-xs font-bold text-gray-400">Loading questions repository...</div>
                ) : filteredQs.length === 0 ? (
                    <div className="p-12 text-center text-xs font-bold text-gray-400">No questions match filter criteria.</div>
                ) : (
                    <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                        {filteredQs.map(q => {
                            const isSel = selectedIds.includes(q._id || q.id);
                            return (
                                <div
                                    key={q._id || q.id}
                                    onClick={() => toggleSelect(q._id || q.id)}
                                    className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
                                        isSel ? 'bg-blue-50/50 border-navy shadow-xs' : 'bg-white border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSel}
                                        onChange={() => {}}
                                        className="mt-1 cursor-pointer"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="text-[10px] font-black bg-navy text-gold px-2 py-0.5 rounded">
                                                {q.type || 'MCQ'}
                                            </span>
                                            {q.chapter && (
                                                <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                                    {q.chapter}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs font-bold text-navy line-clamp-2">
                                            <MathRenderer inline text={q.questionText || q.question} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssignmentGenerator;
