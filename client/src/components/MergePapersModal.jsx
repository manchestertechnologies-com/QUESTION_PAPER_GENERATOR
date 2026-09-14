import React, { useState, useMemo } from 'react';
import api from '../api';

export default function MergePapersModal({
    papers = [],
    onClose,
    onMergeSuccess,
    onOpenPrint,
    onOpenOnlineExam
}) {
    const [selectedPaperIds, setSelectedPaperIds] = useState([]);
    const [examTitle, setExamTitle] = useState('');
    const [examType, setExamType] = useState('PCMB');
    const [duration, setDuration] = useState('180 Minutes');
    const [classes, setClasses] = useState(['12']);
    const [instructions, setInstructions] = useState('Read questions carefully. Answer all sections within allotted time.');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const validPapers = useMemo(() => {
        return (papers || []).filter(p => {
            const count = Array.isArray(p.questions) ? p.questions.length : (Array.isArray(p.questionObjects) ? p.questionObjects.length : 0);
            return count > 0;
        });
    }, [papers]);

    const handleApplyPreset = (presetType) => {
        setExamType(presetType);
        let targetSubs = [];
        if (presetType === 'PCMB') {
            targetSubs = ['physics', 'chemistry', 'math', 'bio'];
            setExamTitle('PCMB Grand Assessment Examination');
        } else if (presetType === 'NEET') {
            targetSubs = ['physics', 'chemistry', 'botany', 'zoology', 'biology'];
            setExamTitle('NEET Full Length Mock Examination');
        } else if (presetType === 'JEE') {
            targetSubs = ['physics', 'chemistry', 'math'];
            setExamTitle('JEE Main Grand Examination');
        } else if (presetType === 'CET') {
            targetSubs = ['physics', 'chemistry', 'math', 'biology'];
            setExamTitle('KCET Unified Assessment');
        }

        const pickedIds = [];
        targetSubs.forEach(subKey => {
            const match = validPapers.find(p => {
                const s = (p.subject || '').toLowerCase();
                const t = (p.title || '').toLowerCase();
                return (s.includes(subKey) || t.includes(subKey)) && !pickedIds.includes(p._id || p.id);
            });
            if (match) pickedIds.push(match._id || match.id);
        });

        if (pickedIds.length > 0) {
            setSelectedPaperIds(pickedIds);
        }
    };

    const togglePaperSelection = (id) => {
        setSelectedPaperIds(prev => {
            if (prev.includes(id)) return prev.filter(item => item !== id);
            return [...prev, id];
        });
    };

    const orderedSelectedPapers = useMemo(() => {
        return selectedPaperIds
            .map(id => validPapers.find(p => (p._id || p.id) === id))
            .filter(Boolean);
    }, [selectedPaperIds, validPapers]);

    const totalQuestionsCount = useMemo(() => {
        return orderedSelectedPapers.reduce((sum, p) => {
            const qCount = Array.isArray(p.questions) ? p.questions.length : (p.questionObjects?.length || 0);
            return sum + qCount;
        }, 0);
    }, [orderedSelectedPapers]);

    const movePaper = (idx, direction) => {
        const newOrder = [...selectedPaperIds];
        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= newOrder.length) return;
        const temp = newOrder[idx];
        newOrder[idx] = newOrder[targetIdx];
        newOrder[targetIdx] = temp;
        setSelectedPaperIds(newOrder);
    };

    const handleMergeSubmit = async (targetAction = 'view') => {
        if (selectedPaperIds.length < 2) {
            setErrorMsg('Please select at least 2 subject papers to merge.');
            return;
        }

        setErrorMsg('');
        setIsSubmitting(true);

        try {
            const payload = {
                sourcePaperIds: selectedPaperIds,
                title: examTitle.trim() || (examType + ' Unified Grand Examination'),
                examType,
                classes,
                duration,
                instructions
            };

            const res = await api.post('/api/papers/merge', payload);
            const mergedPaper = res.data?.paper;

            if (onMergeSuccess) {
                onMergeSuccess(mergedPaper);
            }

            if (targetAction === 'print' && onOpenPrint) {
                onOpenPrint(mergedPaper);
            } else if (targetAction === 'online' && onOpenOnlineExam) {
                onOpenOnlineExam(mergedPaper);
            } else if (onClose) {
                onClose();
            }
        } catch (err) {
            console.error('Merge error:', err);
            setErrorMsg(err.response?.data?.msg || err.message || 'Failed to merge papers.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto border border-slate-200 animate-fade-in">
                
                {/* Header */}
                <div className="flex justify-between items-center px-8 py-5 bg-gradient-to-r from-navy via-slate-900 to-navy text-white border-b-2 border-gold">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-gold/20 text-gold flex items-center justify-center text-xl font-black border border-gold/40">
                            🔗
                        </span>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="bg-gold text-navy text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">
                                    Unified Examination Engine
                                </span>
                                <span className="text-[10px] text-emerald-400 font-bold">
                                    ✓ Non-Destructive (Source Papers Untouched)
                                </span>
                            </div>
                            <h2 className="text-xl font-black uppercase tracking-tight text-white mt-0.5">
                                Merge Exam Papers Into Common Exam
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/60 hover:text-white bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                    
                    {errorMsg && (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold flex items-center gap-2">
                            <span>⚠️</span>
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Step 1: Quick Presets */}
                    <div className="space-y-2">
                        <label className="block text-[11px] font-black text-navy uppercase tracking-widest">
                            1. Select Common Exam Preset or Build Custom
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {[
                                { type: 'PCMB', label: 'PCMB (Physics + Chem + Math + Bio)', icon: '🧬' },
                                { type: 'NEET', label: 'NEET (Physics + Chem + Biology)', icon: '🩺' },
                                { type: 'JEE', label: 'JEE Main (Physics + Chem + Maths)', icon: '⚡' },
                                { type: 'CET', label: 'KCET / State CET Pattern', icon: '🎯' }
                            ].map(preset => (
                                <button
                                    key={preset.type}
                                    type="button"
                                    onClick={() => handleApplyPreset(preset.type)}
                                    className={"p-3 rounded-2xl text-left border-2 transition-all cursor-pointer " + (
                                        examType === preset.type
                                            ? "bg-navy text-gold border-gold shadow-md"
                                            : "bg-slate-50 border-slate-200 text-slate-700 hover:border-navy/40 hover:bg-white"
                                    )}
                                >
                                    <div className="text-base mb-1">{preset.icon}</div>
                                    <div className="text-xs font-black uppercase">{preset.type} Preset</div>
                                    <div className="text-[10px] opacity-75 font-medium leading-tight mt-0.5">{preset.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Step 2: Exam Configuration */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <div className="sm:col-span-2">
                            <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-1.5">
                                Merged Exam Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={examTitle}
                                onChange={e => setExamTitle(e.target.value)}
                                placeholder="e.g. NEET Grand Mock Test - Full Syllabus 2026"
                                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-navy outline-none focus:border-navy"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-1.5">
                                Total Duration
                            </label>
                            <input
                                type="text"
                                value={duration}
                                onChange={e => setDuration(e.target.value)}
                                placeholder="e.g. 180 Minutes, 200 Minutes"
                                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-navy outline-none focus:border-navy"
                            />
                        </div>
                    </div>

                    {/* Step 3: Choose Source Papers */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <label className="block text-[11px] font-black text-navy uppercase tracking-widest">
                                    2. Choose Source Subject Papers to Merge ({selectedPaperIds.length} Selected • {totalQuestionsCount} Qs Total)
                                </label>
                                <p className="text-[11px] text-slate-500 font-medium">
                                    Select separate subject papers. They will be sequenced as Section A, Section B, Section C, etc.
                                </p>
                            </div>
                        </div>

                        {validPapers.length === 0 ? (
                            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-xs font-bold text-slate-400">
                                No saved papers found. Create and save individual subject papers first.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto p-1">
                                {validPapers.map(p => {
                                    const pId = p._id || p.id;
                                    const isSelected = selectedPaperIds.includes(pId);
                                    const qCount = Array.isArray(p.questions) ? p.questions.length : (p.questionObjects?.length || 0);

                                    return (
                                        <div
                                            key={pId}
                                            onClick={() => togglePaperSelection(pId)}
                                            className={"p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 " + (
                                                isSelected
                                                    ? "bg-amber-50/60 border-amber-500 shadow-xs ring-1 ring-amber-400"
                                                    : "bg-white border-slate-200 hover:border-slate-300"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {}}
                                                    className="w-4 h-4 text-navy rounded border-gray-300 cursor-pointer"
                                                />
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-navy">{p.title}</span>
                                                        <span className="text-[9px] font-bold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                                                            {p.subject}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                                        {qCount} Questions • {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Recent'}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-navy">
                                                {isSelected ? '✓ Added' : '+ Select'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Step 4: Preview and Reorder Section Sequencing */}
                    {orderedSelectedPapers.length > 0 && (
                        <div className="space-y-2 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                            <label className="block text-[10px] font-black text-navy uppercase tracking-widest">
                                3. Merged Section Order &amp; Question Sequencing
                            </label>
                            <div className="space-y-2">
                                {orderedSelectedPapers.map((p, idx) => {
                                    const sectionLetter = String.fromCharCode(65 + idx);
                                    const qCount = Array.isArray(p.questions) ? p.questions.length : (p.questionObjects?.length || 0);

                                    return (
                                        <div
                                            key={p._id || p.id}
                                            className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="w-7 h-7 rounded-lg bg-navy text-gold font-black text-xs flex items-center justify-center">
                                                    {sectionLetter}
                                                </span>
                                                <div>
                                                    <div className="text-xs font-black text-navy">
                                                        Section {sectionLetter}: {p.subject} ({p.title})
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-medium">
                                                        {qCount} Questions • Marks: {qCount * 4}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    disabled={idx === 0}
                                                    onClick={() => movePaper(idx, -1)}
                                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
                                                    title="Move Up"
                                                >
                                                    ↑
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={idx === orderedSelectedPapers.length - 1}
                                                    onClick={() => movePaper(idx, 1)}
                                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
                                                    title="Move Down"
                                                >
                                                    ↓
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Dual Actions: Print or Conduct Online Exam */}
                <div className="p-6 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                    >
                        Cancel
                    </button>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <button
                            type="button"
                            disabled={isSubmitting || selectedPaperIds.length < 2}
                            onClick={() => handleMergeSubmit('print')}
                            className="flex-1 sm:flex-none bg-navy text-gold hover:bg-slate-900 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 border-2 border-gold"
                        >
                            <span>🖨️</span>
                            <span>{isSubmitting ? 'Merging...' : 'Merge & Print Exam Paper'}</span>
                        </button>

                        <button
                            type="button"
                            disabled={isSubmitting || selectedPaperIds.length < 2}
                            onClick={() => handleMergeSubmit('online')}
                            className="flex-1 sm:flex-none bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                        >
                            <span>💻</span>
                            <span>{isSubmitting ? 'Merging...' : 'Merge & Conduct Online Exam'}</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
