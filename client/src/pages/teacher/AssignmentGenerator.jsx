/**
 * AssignmentGenerator.jsx
 *
 * Allows teachers (and admins) to create and print/PDF assignments.
 * - Subject auto-populated from user.subject
 * - Start/End question number fields
 * - No Time / Max. Marks on assignment heading
 * - Full formatting controls via PaperRenderer
 */
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import PaperRenderer, { DEFAULT_SETTINGS } from '../../components/PaperRenderer';
import { SettingsPanel } from '../../components/PaperRenderer';
import MathRenderer from '../../components/MathRenderer';

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = {
    page: { fontFamily: "'Inter', system-ui, sans-serif", color: '#111' },
    toolbar: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 18px', background: '#fff', border: '1px solid #e2e8f0',
        borderRadius: '10px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px',
    },
    btnBack: {
        height: '36px', padding: '0 18px', fontSize: '11px', fontWeight: 800,
        borderRadius: '10px', cursor: 'pointer', background: '#f1f5f9', color: '#001f6d',
        border: 'none', textTransform: 'uppercase', letterSpacing: '0.1em',
        display: 'inline-flex', alignItems: 'center', gap: '6px',
    },
    btnPrint: {
        height: '36px', padding: '0 18px', fontSize: '11px', fontWeight: 800,
        borderRadius: '10px', cursor: 'pointer', background: '#001f6d', color: '#c5a059',
        border: 'none', textTransform: 'uppercase', letterSpacing: '0.1em',
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        boxShadow: '0 4px 12px rgba(0,31,109,0.18)',
    },
    btnToggle: (on) => ({
        height: '36px', padding: '0 14px', fontSize: '11px', fontWeight: 700,
        borderRadius: '10px', cursor: 'pointer',
        background: on ? '#001f6d' : '#f1f5f9',
        color: on ? '#fff' : '#001f6d',
        border: 'none', textTransform: 'uppercase', letterSpacing: '0.08em',
    }),
    card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '20px' },
    label: { fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' },
    input: { height: '36px', padding: '0 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
    select: { height: '36px', padding: '0 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', cursor: 'pointer' },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' },
    row: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' },
    error: { color: '#dc2626', fontSize: '12px', fontWeight: 600, marginTop: '4px' },
    qRow: { display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px', border: '1px solid #f1f5f9', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', transition: 'background 0.1s' },
    tag: { display: 'inline-flex', alignItems: 'center', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
};

// ─── Filters bar ─────────────────────────────────────────────────────────────
function FiltersBar({ filters, setFilters, chapters, concepts }) {
    return (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <input
                type="text"
                placeholder="Search questions..."
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                style={{ ...S.input, maxWidth: '220px' }}
            />
            <select style={{ ...S.select, maxWidth: '150px' }} value={filters.chapter} onChange={e => setFilters(f => ({ ...f, chapter: e.target.value }))}>
                <option value="">All Chapters</option>
                {chapters.map(ch => <option key={ch} value={ch}>{ch}</option>)}
            </select>
            <select style={{ ...S.select, maxWidth: '130px' }} value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
                <option value="">All Types</option>
                <option value="MCQ">MCQ</option>
                <option value="ASSERTION_REASON">Assertion-Reason</option>
                <option value="MATCH_FOLLOWING">Match Following</option>
                <option value="NUMERICAL">Numerical</option>
                <option value="TRUE_FALSE">True/False</option>
                <option value="STATEMENT_BASED">Statement Based</option>
            </select>
            <select style={{ ...S.select, maxWidth: '120px' }} value={filters.level} onChange={e => setFilters(f => ({ ...f, level: e.target.value }))}>
                <option value="">All Levels</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
            </select>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
const AssignmentGenerator = ({ onBack, adminMode = false, adminSubject = '' }) => {
    const { user } = useContext(AuthContext);
    const subject = adminMode ? adminSubject : (user?.subject || '');

    const [allQuestions, setAllQuestions] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [showSettings, setShowSettings] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState('');

    const [filters, setFilters] = useState({ search: '', chapter: '', type: '', level: '' });
    const [settings, setSettings] = useState({
        ...DEFAULT_SETTINGS,
        showMarks: false,    // assignments never show marks
        startQNo: 1,
        endQNo: null,
    });

    useEffect(() => {
        const fetchQs = async () => {
            try {
                const res = await api.get('/api/questions', { params: { limit: 10000, subject } });
                const list = Array.isArray(res.data) ? res.data : (res.data?.questions || []);
                setAllQuestions(list);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchQs();
    }, [subject]);

    const chapters = useMemo(() => [...new Set(allQuestions.map(q => q.chapter).filter(Boolean))].sort(), [allQuestions]);
    const concepts = useMemo(() => [...new Set(allQuestions.map(q => q.concept).filter(Boolean))].sort(), [allQuestions]);

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

    const selectedQs = useMemo(() => allQuestions.filter(q => selectedIds.includes(q._id)), [allQuestions, selectedIds]);

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const selectAll = () => setSelectedIds(filteredQs.map(q => q._id));
    const clearAll = () => setSelectedIds([]);

    // End Q no. validation
    const startQNo = settings.startQNo || 1;
    const endQNo = settings.endQNo ?? (startQNo + selectedQs.length - 1);
    const required = Math.max(0, endQNo - startQNo + 1);
    const hasEnough = selectedQs.length >= required;
    const visibleQs = selectedQs.slice(0, required);

    const assignmentPaper = useMemo(() => ({
        title: title || subject.toUpperCase(),
        subject,
        classes: [],
        questions: visibleQs,
        duration: null,
    }), [title, subject, visibleQs]);

    if (showPreview) {
        return (
            <div style={S.page}>
                <div style={S.toolbar} className="no-print">
                    <button style={S.btnBack} onClick={() => setShowPreview(false)}>← Back to Selection</button>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button style={S.btnToggle(showSettings)} onClick={() => setShowSettings(s => !s)}>⚙ Settings</button>
                        <button style={S.btnPrint} onClick={() => window.print()}>🖨 Print / Save PDF</button>
                    </div>
                </div>
                {showSettings && (
                    <div style={{ marginBottom: '20px' }} className="no-print">
                        <SettingsPanel settings={settings} setSettings={setSettings} totalQuestions={visibleQs.length} />
                    </div>
                )}
                <PaperRenderer
                    paper={assignmentPaper}
                    activeTemplate={null}
                    isAssignment={true}
                    settings={settings}
                    setSettings={setSettings}
                    showSettingsPanel={false}
                    printAreaId="assignment-print-area"
                />
                <style>{`@media print { .no-print { display: none !important; } }`}</style>
            </div>
        );
    }

    return (
        <div style={S.page}>
            <div style={S.toolbar}>
                <button style={S.btnBack} onClick={onBack}>← Back</button>
                <div style={{ fontWeight: 800, fontSize: '16px', color: '#001f6d' }}>
                    📋 Assignment Generator — {subject}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button style={S.btnToggle(showSettings)} onClick={() => setShowSettings(s => !s)}>⚙ Settings</button>
                    <button
                        style={{ ...S.btnPrint, opacity: selectedQs.length === 0 ? 0.5 : 1 }}
                        disabled={selectedQs.length === 0}
                        onClick={() => setShowPreview(true)}
                    >
                        👁 Preview & Print
                    </button>
                </div>
            </div>

            {/* Settings */}
            {showSettings && (
                <div style={{ marginBottom: '20px' }}>
                    <SettingsPanel settings={settings} setSettings={setSettings} totalQuestions={selectedQs.length} />
                </div>
            )}

            {/* Assignment title (optional) */}
            <div style={{ ...S.card, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
                <div>
                    <label style={S.label}>Assignment Title (optional)</label>
                    <input style={S.input} type="text" placeholder={`${subject.toUpperCase()} Assignment`} value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div>
                    <label style={S.label}>Start Question Number</label>
                    <input style={S.input} type="number" min={1} value={settings.startQNo}
                        onChange={e => setSettings(s => ({ ...s, startQNo: Math.max(1, parseInt(e.target.value) || 1) }))} />
                </div>
                <div>
                    <label style={S.label}>End Question Number {selectedQs.length > 0 && `(max ${startQNo + selectedQs.length - 1})`}</label>
                    <input style={S.input} type="number" min={settings.startQNo}
                        value={settings.endQNo ?? (startQNo + selectedQs.length - 1)}
                        onChange={e => {
                            const v = parseInt(e.target.value) || (startQNo + selectedQs.length - 1);
                            setSettings(s => ({ ...s, endQNo: Math.max(s.startQNo, v) }));
                        }} />
                    {!hasEnough && selectedQs.length > 0 && (
                        <div style={S.error}>Need {required} questions, only {selectedQs.length} selected.</div>
                    )}
                </div>
            </div>

            {/* Question selection */}
            <div style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#001f6d' }}>
                        Question Bank — {subject}
                        <span style={{ ...S.tag, marginLeft: '10px', background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                            {filteredQs.length} available
                        </span>
                        {selectedIds.length > 0 && (
                            <span style={{ ...S.tag, marginLeft: '8px' }}>
                                {selectedIds.length} selected
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button style={{ ...S.btnBack, fontSize: '10px', height: '30px' }} onClick={selectAll}>Select All</button>
                        <button style={{ ...S.btnBack, fontSize: '10px', height: '30px' }} onClick={clearAll}>Clear</button>
                    </div>
                </div>

                <FiltersBar filters={filters} setFilters={setFilters} chapters={chapters} concepts={concepts} />

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Loading questions...</div>
                ) : filteredQs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No questions found for current filters.</div>
                ) : (
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {filteredQs.map(q => {
                            const sel = selectedIds.includes(q._id);
                            return (
                                <div
                                    key={q._id}
                                    style={{ ...S.qRow, background: sel ? '#f0fdf4' : '#fff', borderColor: sel ? '#bbf7d0' : '#f1f5f9' }}
                                    onClick={() => toggleSelect(q._id)}
                                >
                                    <input type="checkbox" checked={sel} onChange={() => toggleSelect(q._id)} style={{ marginTop: '3px', cursor: 'pointer' }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                            <span style={{ ...S.tag, background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>{q.type || 'MCQ'}</span>
                                            {q.chapter && <span style={{ ...S.tag, background: '#fef9c3', color: '#92400e', border: '1px solid #fde68a' }}>{q.chapter}</span>}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '600px' }}>
                                            <MathRenderer inline text={(q.questionText || '').substring(0, 120)} />
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
