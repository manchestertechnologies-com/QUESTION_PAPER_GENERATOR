import React, { useState } from 'react';
import api from '../api';

export default function GenerateAllFourModal({ isOpen, onClose, onSuccess }) {
    if (!isOpen) return null;

    const [title, setTitle] = useState('');
    const [pattern, setPattern] = useState('CET');
    const [targetClass, setTargetClass] = useState('12');
    const [targetPerSubject, setTargetPerSubject] = useState(60);
    const [durationMinutes, setDurationMinutes] = useState(180);
    const [startMode, setStartMode] = useState('live'); // 'live' or 'scheduled'
    const [startTime, setStartTime] = useState('');
    const [shuffleQuestions, setShuffleQuestions] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const getExamMeta = (pat) => {
        if (pat === 'NEET') {
            return {
                title: 'Auto-Generate NEET Grand Assessment (PCB)',
                subtitle: 'Physics (45 Qs) • Chemistry (45 Qs) • Biology (90 Qs) — Strictly PCB (180 Qs Total)',
                subjects: ['Physics', 'Chemistry', 'Biology'],
                papersCount: 3,
                defaultDuration: 200,
                pillBadge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                note: 'NEET is strictly PCB (Physics, Chemistry, Biology). No Mathematics is included.'
            };
        } else if (pat === 'JEE') {
            return {
                title: 'Auto-Generate JEE Main Grand Assessment (PCM)',
                subtitle: 'Physics (25 Qs) • Chemistry (25 Qs) • Mathematics (25 Qs) — Strictly PCM (75 Qs Total)',
                subjects: ['Physics', 'Chemistry', 'Mathematics'],
                papersCount: 3,
                defaultDuration: 180,
                pillBadge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
                note: 'JEE is strictly PCM (Physics, Chemistry, Mathematics). No Biology is included.'
            };
        } else {
            return {
                title: 'Auto-Generate KCET Grand Assessment (PCMB)',
                subtitle: 'Physics (60 Qs) • Chemistry (60 Qs) • Mathematics (60 Qs) • Biology (60 Qs) — PCMB (240 Qs Total)',
                subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
                papersCount: 4,
                defaultDuration: 180,
                pillBadge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                note: 'KCET includes all 4 subjects (PCMB: Physics, Chemistry, Mathematics, Biology).'
            };
        }
    };

    const meta = getExamMeta(pattern);

    const handlePatternChange = (newPattern) => {
        setPattern(newPattern);
        if (newPattern === 'CET') {
            setTargetPerSubject(60);
            setDurationMinutes(180);
        } else if (newPattern === 'NEET') {
            setTargetPerSubject(45);
            setDurationMinutes(200);
        } else if (newPattern === 'JEE') {
            setTargetPerSubject(25);
            setDurationMinutes(180);
        }
    };

    const handleGenerate = async (e) => {
        e.preventDefault();
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            setError('Please enter a title for the assessment.');
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const payload = {
                title: trimmedTitle,
                examType: pattern,
                targetClass: targetClass,
                targetPerSubject: Number(targetPerSubject) || (pattern === 'CET' ? 60 : pattern === 'NEET' ? 45 : 25),
                duration_minutes: Number(durationMinutes) || 180,
                start_time: startMode === 'scheduled' && startTime ? new Date(startTime).toISOString() : null,
                shuffleQuestions: Boolean(shuffleQuestions),
                createOnlineExam: true
            };

            const res = await api.post('/api/exams/generate-all-four', payload);
            setResult(res.data);
            if (onSuccess) onSuccess(res.data);
        } catch (err) {
            console.error('Failed to generate all 4 papers:', err);
            setError(err.response?.data?.msg || 'Failed to generate 4 papers. Please verify database connectivity.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative animate-scale-in text-slate-800 dark:text-slate-100">
                
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-xl font-black">
                            ⚡
                        </div>
                        <div>
                            <h3 className="text-lg font-black tracking-tight text-[#001f6d] dark:text-amber-400">
                                {meta.title}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                {meta.subtitle}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-sm font-bold"
                    >
                        ✕
                    </button>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                        ⚠️ {error}
                    </div>
                )}

                {/* Success View */}
                {result ? (
                    <div className="mt-6 space-y-4">
                        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                            <div className="flex items-center gap-2 font-black text-sm">
                                <span>🎉</span>
                                <span>Success! {result.papers?.length || meta.papersCount} Subject Papers & Online Exam Created</span>
                            </div>
                            <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-400">
                                {result.msg}
                            </p>
                        </div>

                        {/* Papers summary */}
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                {result.papers?.length || meta.papersCount} Generated Subject Papers (Saved in Papers Archive)
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                {(result.papers || []).map((p, i) => (
                                    <div key={i} className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold flex items-center justify-between">
                                        <span className="text-[#001f6d] dark:text-amber-400">{p.subject}</span>
                                        <span className="text-slate-500 font-mono text-[11px]">{p.questions?.length || 0} Qs</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Direct action buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            {result.onlineExam && (
                                <button
                                    onClick={() => {
                                        window.open(`/lab-exam`, '_blank');
                                    }}
                                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <span>🖥️</span>
                                    <span>Open Student CBT Portal</span>
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Form */
                    <form onSubmit={handleGenerate} className="mt-5 space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                Assessment Title
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Manchester PCMB Weekly Grand Assessment #1"
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Exam Pattern
                                </label>
                                <select
                                    value={pattern}
                                    onChange={(e) => handlePatternChange(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                >
                                    <option value="CET">KCET (PCMB: Physics, Chem, Math, Bio • 240 Qs)</option>
                                    <option value="NEET">NEET (PCB: Physics 45, Chem 45, Bio 90 • 180 Qs)</option>
                                    <option value="JEE">JEE Main (PCM: Physics 25, Chem 25, Math 25 • 75 Qs)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Target Class
                                </label>
                                <select
                                    value={targetClass}
                                    onChange={(e) => setTargetClass(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                >
                                    <option value="12">Class 12 (II-PUC)</option>
                                    <option value="11">Class 11 (I-PUC)</option>
                                </select>
                            </div>
                        </div>

                        {/* Pattern Subject Breakdown Badge */}
                        <div className={`p-3 rounded-xl border text-xs font-semibold ${meta.pillBadge}`}>
                            <div className="font-bold flex items-center gap-1.5 mb-1">
                                <span>📌</span>
                                <span>{meta.note}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {meta.subjects.map(s => (
                                    <span key={s} className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-850 border border-current text-[11px] font-bold">
                                        {s}: {pattern === 'NEET' && s === 'Biology' ? 90 : targetPerSubject} Qs
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Questions per Subject
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={targetPerSubject}
                                    onChange={(e) => setTargetPerSubject(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Total Duration (Mins)
                                </label>
                                <input
                                    type="number"
                                    min="15"
                                    max="360"
                                    value={durationMinutes}
                                    onChange={(e) => setDurationMinutes(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Start Mode: Live vs Scheduled */}
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                                Examination Availability Mode
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <label className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition ${
                                    startMode === 'live' 
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200' 
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                }`}>
                                    <input
                                        type="radio"
                                        name="startMode"
                                        checked={startMode === 'live'}
                                        onChange={() => setStartMode('live')}
                                        className="text-emerald-600"
                                    />
                                    <div>
                                        <div className="text-xs font-black flex items-center gap-1.5">
                                            <span>🟢</span>
                                            <span>Go Live Immediately</span>
                                        </div>
                                        <div className="text-[10px] text-slate-500">Students can take exam now</div>
                                    </div>
                                </label>

                                <label className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition ${
                                    startMode === 'scheduled' 
                                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-200' 
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                }`}>
                                    <input
                                        type="radio"
                                        name="startMode"
                                        checked={startMode === 'scheduled'}
                                        onChange={() => setStartMode('scheduled')}
                                        className="text-amber-600"
                                    />
                                    <div>
                                        <div className="text-xs font-black flex items-center gap-1.5">
                                            <span>📅</span>
                                            <span>Schedule For Later</span>
                                        </div>
                                        <div className="text-[10px] text-slate-500">Sets start lock timestamp</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {startMode === 'scheduled' && (
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Scheduled Start Date & Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                    required={startMode === 'scheduled'}
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                            <input
                                type="checkbox"
                                id="shuffleCheckbox"
                                checked={shuffleQuestions}
                                onChange={(e) => setShuffleQuestions(e.target.checked)}
                                className="w-4 h-4 text-amber-500 rounded cursor-pointer"
                            />
                            <label htmlFor="shuffleCheckbox" className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
                                🔀 Shuffle questions per student session (prevents screen peeking in lab)
                            </label>
                        </div>

                        {/* Submit Button */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                                        <span>Generating {meta.papersCount} Papers...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>🚀</span>
                                        <span>Generate {meta.papersCount} {pattern} Papers & Launch</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
