import React, { useState, useEffect } from 'react';
import api from '../../api';
import { sanitize, optionLabel } from '../../utils/sanitize';
import MathRenderer from '../../components/MathRenderer';

/* ─── Inline styles ─── */
const S = {
    page: { fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" },

    summaryGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '20px',
        marginBottom: '32px',
    },
    summaryCard: {
        background: '#fff',
        border: '1px solid #f1f5f9',
        borderRadius: '24px',
        padding: '24px 30px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
        borderLeft: '8px solid #001f6d',
    },
    summaryLabel: {
        fontSize: '10px',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        color: '#001f6d',
        opacity: 0.5,
        marginBottom: '8px',
    },
    summaryValue: {
        fontSize: '32px',
        fontWeight: 900,
        color: '#001f6d',
        fontFamily: "'Inter', sans-serif",
        lineHeight: 1.1,
    },
    summarySub: { fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginTop: '6px' },

    sectionLabel: {
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#94a3b8',
        marginBottom: '10px',
    },

    /* ── Filter bar ── */
    filterBar: {
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        marginBottom: '12px',
        flexWrap: 'wrap',
    },
    filterSelect: {
        height: '34px',
        padding: '0 12px',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: '7px',
        border: '1px solid #e2e8f0',
        background: '#fff',
        color: '#374151',
        fontFamily: 'inherit',
        cursor: 'pointer',
        outline: 'none',
        minWidth: '160px',
    },
    filterDate: {
        height: '34px',
        padding: '0 10px',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: '7px',
        border: '1px solid #e2e8f0',
        background: '#fff',
        color: '#374151',
        fontFamily: "'JetBrains Mono','Courier New',monospace",
        cursor: 'pointer',
        outline: 'none',
    },
    filterLabel: {
        fontSize: '12px',
        fontWeight: 600,
        color: '#64748b',
        whiteSpace: 'nowrap',
    },
    btnClearFilters: {
        height: '34px',
        padding: '0 14px',
        fontSize: '12px',
        fontWeight: 500,
        borderRadius: '7px',
        border: '1px solid #e2e8f0',
        background: '#f8fafc',
        color: '#64748b',
        fontFamily: 'inherit',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'all 0.14s',
    },

    tableWrap: {
        background: '#fff',
        border: '1px solid #f1f5f9',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
    },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: {
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: '#94a3b8',
        padding: '11px 18px',
        textAlign: 'left',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
    },
    thRight: { textAlign: 'right' },
    td: { padding: '14px 18px', verticalAlign: 'middle', borderBottom: '1px solid #f1f5f9' },
    tdLast: { padding: '14px 18px', verticalAlign: 'middle' },

    paperCell: { display: 'flex', alignItems: 'center', gap: '12px' },
    paperIcon: {
        width: '38px', height: '38px',
        background: '#dbeafe',
        borderRadius: '8px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '18px', flexShrink: 0,
    },
    paperTitle: { fontSize: '14px', fontWeight: 600, color: '#0f172a' },
    paperId: {
        fontSize: '11px', color: '#94a3b8',
        fontFamily: "'JetBrains Mono','Courier New',monospace",
        marginTop: '2px',
    },

    tagClass: {
        display: 'inline-flex', alignItems: 'center',
        fontSize: '11px', fontWeight: 800,
        padding: '4px 12px', borderRadius: '8px',
        background: '#f8fafc', color: '#001f6d', border: '1px solid #f1f5f9',
        textTransform: 'uppercase', letterSpacing: '0.05em',
    },
    tagQ: {
        display: 'inline-flex', alignItems: 'center',
        fontSize: '11.5px', fontWeight: 600,
        padding: '3px 10px', borderRadius: '5px',
        background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
        fontFamily: "'JetBrains Mono','Courier New',monospace",
    },
    dateCell: {
        fontSize: '12.5px', color: '#475569',
        fontFamily: "'JetBrains Mono','Courier New',monospace",
    },

    actionCell: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
    btnView: {
        height: '34px', padding: '0 18px',
        fontSize: '11px', fontWeight: 800,
        borderRadius: '10px', cursor: 'pointer',
        background: '#001f6d', color: '#c5a059',
        border: 'none',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        transition: 'all 0.2s',
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        boxShadow: '0 4px 10px rgba(0,31,109,0.15)',
    },
    btnDel: {
        height: '30px', padding: '0 14px',
        fontSize: '12px', fontWeight: 500,
        borderRadius: '6px', cursor: 'pointer',
        background: '#fff', color: '#dc2626',
        border: '1px solid #fecaca',
        fontFamily: 'inherit',
        transition: 'all 0.14s',
        display: 'inline-flex', alignItems: 'center', gap: '4px',
    },

    empty: {
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 0', gap: '8px',
    },
    emptyIcon: { fontSize: '36px', marginBottom: '6px' },
    emptyTitle: { fontSize: '14px', fontWeight: 600, color: '#475569' },
    emptySub: { fontSize: '12.5px', color: '#94a3b8' },

    viewToolbar: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '24px',
        padding: '12px 18px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
    },
    btnBack: {
        height: '38px', padding: '0 20px',
        fontSize: '11px', fontWeight: 800,
        borderRadius: '12px', cursor: 'pointer',
        background: '#f1f5f9', color: '#001f6d',
        border: 'none', textTransform: 'uppercase', letterSpacing: '0.1em',
        display: 'inline-flex', alignItems: 'center', gap: '8px',
    },
    btnPrint: {
        height: '38px', padding: '0 20px',
        fontSize: '11px', fontWeight: 800,
        borderRadius: '12px', cursor: 'pointer',
        background: '#001f6d', color: '#c5a059',
        border: 'none', textTransform: 'uppercase', letterSpacing: '0.1em',
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        boxShadow: '0 8px 20px rgba(0,31,109,0.2)',
    },
    btnPdf: {
        height: '38px', padding: '0 20px',
        fontSize: '11px', fontWeight: 800,
        borderRadius: '12px', cursor: 'pointer',
        background: '#c5a059', color: '#001f6d',
        border: 'none', textTransform: 'uppercase', letterSpacing: '0.1em',
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        boxShadow: '0 8px 20px rgba(197,160,89,0.2)',
    },
    viewBtns: { display: 'flex', gap: '10px' },
};

/* ─── Helpers ─── */
const formatMarks = (type, classes = []) => {
    const isNeet = classes.includes('NEET');
    if (type === 'MCQ' || type === '1m') return isNeet ? '4 Marks' : '1 Mark';
    if (type === '2m') return '2 Marks';
    if (type === '3m') return '3 Marks';
    if (type === '4m') return '4 Marks';
    if (type === '5m') return '5 Marks';
    return type;
};

const calcTotal = (paper) => {
    if (paper.pattern?.length) return paper.pattern.reduce((s, sec) => s + (sec.marks || 0), 0);
    const isNeet = paper.classes?.includes('NEET');
    return paper.questions.reduce((s, q) => {
        if (q.type === 'MCQ' || q.type === '1m') return s + (isNeet ? 4 : 1);
        if (q.type === '2m') return s + 2;
        if (q.type === '3m') return s + 3;
        if (q.type === '4m') return s + 4;
        if (q.type === '5m') return s + 5;
        return s;
    }, 0);
};

/* ─── toDateStr: returns "YYYY-MM-DD" from a Date ─── */
const toDateStr = (date) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
};

/* ═══════════════════════════════════════════════════════════════════════ */
/*  PAPER VIEW                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */
const PaperView = ({ paper, activeTemplate, onBack }) => {
    const totalMarks = calcTotal(paper);
    const [paperData, setPaperData] = useState(paper);
    const [showAnswerKey, setShowAnswerKey] = useState(false);
    const [generatingSolutions, setGeneratingSolutions] = useState({});

    useEffect(() => {
        setPaperData(paper);
    }, [paper]);

    const handleGenerateSolution = async (qId) => {
        setGeneratingSolutions(prev => ({ ...prev, [qId]: true }));
        try {
            const res = await api.post(`/api/questions/${qId}/solve`);
            setPaperData(prev => {
                const updatedQuestions = prev.questions.map(q => {
                    if (q._id === qId) {
                        return { ...q, solutionText: res.data.solutionText };
                    }
                    return q;
                });
                return { ...prev, questions: updatedQuestions };
            });
        } catch (err) {
            console.error('Failed to generate solution:', err);
            alert('Error generating solution. Please try again.');
        } finally {
            setGeneratingSolutions(prev => ({ ...prev, [qId]: false }));
        }
    };

    const handleWordExport = () => {
        const token = localStorage.getItem('token');
        const downloadUrl = `${api.defaults.baseURL || ''}/api/papers/${paperData._id}/export-word?token=${token}`;
        window.open(downloadUrl, '_blank');
    };
    
    // Paper Settings State
    const [settings, setSettings] = useState({
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '14px',
        lineHeight: '1.5',
        columns: 1,
        showMarks: true,
        showSettings: false,
        viewMode: 'qp' // 'qp', 'side-by-side', 'key'
    });

    const renderQuestions = () => {
        if (paperData.pattern?.length) {
            let pool = [...paperData.questions];
            return paperData.pattern.map((sec, secIdx) => {
                const num = sec.numQuestions || 0;
                let secQs = sec.type
                    ? pool.filter(q => q.type === sec.type).slice(0, num)
                    : pool.slice(0, num);
                const usedIds = new Set(secQs.map(q => q._id));
                pool = pool.filter(q => !usedIds.has(q._id));
                if (!secQs.length) return null;
                return (
                    <div key={secIdx} style={{ marginBottom: '28px', breakInside: 'avoid-column' }}>
                        <div style={{ textAlign: 'center', margin: '28px 0 16px' }}>
                            <div style={{ fontWeight: 700, fontSize: '17px', textDecoration: 'underline' }}>{sec.sectionName}</div>
                            {sec.description && <div style={{ fontSize: '13px', color: '#555', fontStyle: 'italic', marginTop: '4px' }}>{sec.description}</div>}
                        </div>
                        <QuestionList 
                            questions={secQs} 
                            fontSize={settings.fontSize} 
                            showMarks={settings.showMarks} 
                            classes={paperData.classes} 
                            showAnswerKey={showAnswerKey}
                            onGenerateSolution={handleGenerateSolution}
                            generatingSolutions={generatingSolutions}
                        />
                    </div>
                );
            });
        }
        return (
            <QuestionList 
                questions={paperData.questions} 
                fontSize={settings.fontSize} 
                showMarks={settings.showMarks} 
                classes={paperData.classes} 
                showAnswerKey={showAnswerKey}
                onGenerateSolution={handleGenerateSolution}
                generatingSolutions={generatingSolutions}
            />
        );
    };

    return (
        <div style={S.page}>
            <div style={{ ...S.viewToolbar, flexDirection: 'column', gap: '16px', alignItems: 'stretch' }} className="no-print">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button style={S.btnBack} onClick={onBack}>← Back to Papers</button>
                    <div style={S.viewBtns}>
                        <button 
                            style={{ ...S.btnBack, background: showAnswerKey ? '#4f46e5' : '#f1f5f9', color: showAnswerKey ? '#fff' : '#001f6d' }} 
                            onClick={() => setShowAnswerKey(!showAnswerKey)}
                        >
                            💡 {showAnswerKey ? 'Hide Answer Key' : 'Show Answer Key'}
                        </button>
                        <button 
                            style={{ ...S.btnBack, background: settings.showSettings ? '#001f6d' : '#f1f5f9', color: settings.showSettings ? '#fff' : '#001f6d' }} 
                            onClick={() => setSettings(s => ({ ...s, showSettings: !s.showSettings }))}
                        >
                            ⚙️ Paper Settings
                        </button>
                        {paperData.status?.toLowerCase() === 'approved' ? (
                            <>
                                <button style={S.btnPrint} onClick={() => window.print()}>🖨 Print / Save PDF</button>
                                <button style={{ ...S.btnPrint, background: '#7c3aed', marginLeft: '10px' }} onClick={handleWordExport}>⬇️ Export Word</button>
                            </>
                        ) : (
                            <span style={{ color: '#dc2626', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', padding: '0 10px' }}>
                                Paper must be approved by admin to print or export.
                            </span>
                        )}
                    </div>
                </div>

                {settings.showSettings && (
                    <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                        <div>
                            <label style={{ ...S.filterLabel, display: 'block', marginBottom: '8px' }}>Font Style</label>
                            <select 
                                style={S.filterSelect} 
                                value={settings.fontFamily}
                                onChange={e => setSettings(s => ({ ...s, fontFamily: e.target.value }))}
                            >
                                <option value='Georgia, serif'>Classic Serif (Georgia)</option>
                                <option value='"Times New Roman", Times, serif'>Times New Roman</option>
                                <option value='Cambria, Georgia, serif'>Cambria</option>
                                <option value='Calibri, Candara, Segoe, sans-serif'>Calibri</option>
                                <option value='Arial, Helvetica, sans-serif'>Arial</option>
                                <option value="'Inter', sans-serif">Modern Sans (Inter)</option>
                                <option value="'JetBrains Mono', monospace">Technical Mono</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ ...S.filterLabel, display: 'block', marginBottom: '8px' }}>Font Size</label>
                            <select 
                                style={S.filterSelect} 
                                value={settings.fontSize}
                                onChange={e => setSettings(s => ({ ...s, fontSize: e.target.value }))}
                            >
                                <option value="12px">Small (12px)</option>
                                <option value="14px">Standard (14px)</option>
                                <option value="16px">Large (16px)</option>
                                <option value="18px">X-Large (18px)</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ ...S.filterLabel, display: 'block', marginBottom: '8px' }}>Line Spacing</label>
                            <select 
                                style={S.filterSelect} 
                                value={settings.lineHeight}
                                onChange={e => setSettings(s => ({ ...s, lineHeight: e.target.value }))}
                            >
                                <option value="1.2">Compact (1.2)</option>
                                <option value="1.5">Standard (1.5)</option>
                                <option value="2.0">Double (2.0)</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ ...S.filterLabel, display: 'block', marginBottom: '8px' }}>Page Layout</label>
                            <select 
                                style={S.filterSelect} 
                                value={settings.columns}
                                onChange={e => setSettings(s => ({ ...s, columns: parseInt(e.target.value) }))}
                            >
                                <option value={1}>Single Column</option>
                                <option value={2}>Two Columns (1x2)</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ ...S.filterLabel, display: 'block', marginBottom: '8px' }}>Show Marks</label>
                            <select 
                                style={S.filterSelect} 
                                value={settings.showMarks ? 'yes' : 'no'}
                                onChange={e => setSettings(s => ({ ...s, showMarks: e.target.value === 'yes' }))}
                            >
                                <option value="yes">Yes (Show)</option>
                                <option value="no">No (Hide)</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ ...S.filterLabel, display: 'block', marginBottom: '8px' }}>View Mode</label>
                            <select 
                                style={S.filterSelect} 
                                value={settings.viewMode}
                                onChange={e => setSettings(s => ({ ...s, viewMode: e.target.value }))}
                            >
                                <option value="qp">Question Paper Only</option>
                                <option value="side-by-side">Side-by-Side (QP + Key)</option>
                                <option value="key">Answer Key Sheet Only</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Print View Renderers depending on View Mode */}
            {settings.viewMode === 'qp' && (
                <div id="qp-print-area" className="print-area" style={{
                    background: '#fff', padding: '48px 56px',
                    maxWidth: '1000px', margin: '0 auto',
                    border: '1px solid #e2e8f0', borderRadius: '12px',
                    fontFamily: settings.fontFamily, fontSize: settings.fontSize,
                    lineHeight: settings.lineHeight,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                    boxSizing: 'border-box'
                }}>
                    {activeTemplate?.fileUrl?.match(/\.(jpeg|jpg|gif|png)$/i) && (
                        <div style={{ marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '16px', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                            <img src={activeTemplate.fileUrl} alt="Header" style={{ maxWidth: '100%', maxHeight: '140px', objectFit: 'contain', margin: '0 auto', display: 'block' }} />
                        </div>
                    )}

                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <h1 style={{ fontSize: '22px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{paper.title}</h1>
                            <p style={{ marginTop: '6px', color: '#333', fontWeight: 500 }}>Subject: {paper.subject} &nbsp;|&nbsp; Class: {paper.classes?.join(', ')}</p>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', borderBottom: '2px solid #000', paddingBottom: '8px', fontWeight: 700, fontSize: '15px' }}>
                            <span>Time: 3 Hours</span>
                            <span>Max. Marks: {totalMarks}</span>
                        </div>
                    </div>

                    <div style={{ 
                        columnCount: settings.columns, 
                        columnGap: '40px', 
                        columnRule: settings.columns > 1 ? '1px solid #eee' : 'none' 
                    }}>
                        {renderQuestions()}
                    </div>

                    <div style={{ textAlign: 'center', fontWeight: 700, borderTop: '2px solid #000', paddingTop: '16px', marginTop: '48px', fontSize: '13px' }}>
                        *** End of Paper ***
                    </div>
                </div>
            )}

            {settings.viewMode === 'key' && (
                <AnswerKeySheet paper={paperData} settings={settings} onGenerateSolution={handleGenerateSolution} generatingSolutions={generatingSolutions} />
            )}

            {settings.viewMode === 'side-by-side' && (
                <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap', width: '100%', maxWidth: '2100px', margin: '0 auto' }}>
                    <div style={{ flex: '1', minWidth: '450px', maxWidth: '1000px' }}>
                        <div id="qp-print-area" className="print-area" style={{
                            background: '#fff', padding: '48px 56px',
                            border: '1px solid #e2e8f0', borderRadius: '12px',
                            fontFamily: settings.fontFamily, fontSize: settings.fontSize,
                            lineHeight: settings.lineHeight,
                            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                            boxSizing: 'border-box'
                        }}>
                            {activeTemplate?.fileUrl?.match(/\.(jpeg|jpg|gif|png)$/i) && (
                                <div style={{ marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '16px', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                                    <img src={activeTemplate.fileUrl} alt="Header" style={{ maxWidth: '100%', maxHeight: '140px', objectFit: 'contain', margin: '0 auto', display: 'block' }} />
                                </div>
                            )}

                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <h1 style={{ fontSize: '22px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{paper.title}</h1>
                                    <p style={{ marginTop: '6px', color: '#333', fontWeight: 500 }}>Subject: {paper.subject} &nbsp;|&nbsp; Class: {paper.classes?.join(', ')}</p>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', borderBottom: '2px solid #000', paddingBottom: '8px', fontWeight: 700, fontSize: '15px' }}>
                                    <span>Time: 3 Hours</span>
                                    <span>Max. Marks: {totalMarks}</span>
                                </div>
                            </div>

                            <div style={{ 
                                columnCount: settings.columns, 
                                columnGap: '40px', 
                                columnRule: settings.columns > 1 ? '1px solid #eee' : 'none' 
                            }}>
                                {renderQuestions()}
                            </div>

                            <div style={{ textAlign: 'center', fontWeight: 700, borderTop: '2px solid #000', paddingTop: '16px', marginTop: '48px', fontSize: '13px' }}>
                                *** End of Paper ***
                            </div>
                        </div>
                    </div>
                    <div style={{ flex: '1', minWidth: '450px', maxWidth: '1000px' }}>
                        <AnswerKeySheet paper={paperData} settings={settings} onGenerateSolution={handleGenerateSolution} generatingSolutions={generatingSolutions} />
                    </div>
                </div>
            )}

            <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area *, .print-area-key, .print-area-key * { visibility: visible; }
          .print-area { 
            position: relative !important; 
            width: 100% !important; 
            box-shadow: none !important; 
            border: none !important; 
            border-radius: 0 !important; 
            padding: 0 !important; 
            margin: 0 0 50px 0 !important; 
            page-break-after: always;
            break-after: page;
          }
          .print-area-key { 
            position: relative !important; 
            width: 100% !important; 
            box-shadow: none !important; 
            border: none !important; 
            border-radius: 0 !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            page-break-before: always;
            break-before: page;
          }
          .no-print { display: none !important; }
          @page { margin: 15mm; size: A4; }
        }
      `}</style>
        </div>
    );
};

const getOptionsGridStyle = (options) => {
    if (!options || options.length === 0) {
        return {
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '8px 24px',
            marginTop: '8px',
            marginLeft: '24px',
            fontSize: '0.95em'
        };
    }
    
    // Estimate clean text length of options (ignoring LaTeX commands for a better text length estimation)
    const cleanLengths = options.map(opt => {
        const cleanText = (opt || '')
            .replace(/\\(text|mathrm|ce|begin|end){[^}]*}/g, '')
            .replace(/\$\$?[^$]+\$\$?/g, '')
            .replace(/[{}$_^[\]]/g, '')
            .trim();
        return cleanText.length;
    });
    
    const maxLength = Math.max(...cleanLengths);
    const totalLength = cleanLengths.reduce((a, b) => a + b, 0);
    
    let columns = '1fr';
    let gap = '10px 24px';
    
    if (maxLength <= 15 && totalLength <= 60) {
        columns = '1fr 1fr 1fr 1fr';
        gap = '8px 16px';
    } else if (maxLength <= 35 && totalLength <= 110) {
        columns = '1fr 1fr';
        gap = '8px 24px';
    }
    
    return {
        display: 'grid',
        gridTemplateColumns: columns,
        gap: gap,
        marginTop: '8px',
        marginLeft: '24px',
        fontSize: '0.95em'
    };
};

const QuestionList = ({ questions, fontSize, showMarks, classes, showAnswerKey, onGenerateSolution, generatingSolutions }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {questions.map((q, idx) => (
            <div key={q._id} style={{ color: '#111', breakInside: 'avoid-column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', flex: 1, paddingRight: '16px' }}>
                        <span style={{ fontWeight: 700, marginRight: '8px', whiteSpace: 'nowrap', fontSize: '1.1em' }}>{idx + 1}.</span>
                        <div style={{ flex: 1 }}>
                            <MathRenderer style={{ whiteSpace: 'pre-wrap', textAlign: 'justify', fontSize: '1em', margin: 0 }} text={q.questionText} />
                            {q.imageUrl && (
                                <div style={{ marginTop: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
                                    <img src={q.imageUrl} alt="Diagram" style={{ maxWidth: '70%', maxHeight: '130px', objectFit: 'contain' }} />
                                </div>
                            )}
                        </div>
                    </div>
                    {showMarks && <span style={{ fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.9em' }}>[{formatMarks(q.type, classes)}]</span>}
                </div>
                {q.type === 'MCQ' && q.options && (
                    <div style={getOptionsGridStyle(q.options)}>
                        {q.options.map((opt, i) => (
                            <div key={i} style={{ display: 'flex' }}>
                                <span style={{ marginRight: '6px', fontWeight: 600 }}>{optionLabel(i, classes)})</span>
                                <MathRenderer inline={true} text={opt} />
                            </div>
                        ))}
                    </div>
                )}
                {showAnswerKey && (
                    <div className="no-print" style={{
                        marginTop: '16px',
                        padding: '16px',
                        background: '#f5f7ff',
                        border: '1px solid #c7d2fe',
                        borderRadius: '12px',
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: '13px'
                    }}>
                        <div style={{ fontWeight: 800, color: '#312e81', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>💡</span> Scheme of Evaluation & Hint
                        </div>
                        {q.answer && (
                            <div style={{ marginBottom: '10px', fontSize: '14px' }}>
                                <strong style={{ color: '#4b5563' }}>Correct Answer / Key:</strong>{' '}
                                <MathRenderer inline={true} style={{ color: '#15803d', fontWeight: 800, background: '#f0fdf4', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bbf7d0', display: 'inline-block' }} text={q.answer} />
                            </div>
                        )}
                        {q.solutionText ? (
                            <MathRenderer 
                                style={{ 
                                    color: '#1e1b4b', 
                                    whiteSpace: 'pre-wrap', 
                                    lineHeight: '1.6', 
                                    background: '#fff', 
                                    padding: '12px', 
                                    borderRadius: '8px', 
                                    border: '1px solid #e0e7ff',
                                    fontSize: '13px'
                                }} 
                                text={q.solutionText}
                            />
                        ) : (
                            <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e0e7ff' }}>
                                <span style={{ color: '#6b7280', fontStyle: 'italic', display: 'block', fontSize: '13px' }}>
                                    No detailed solution has been added for this question yet.
                                </span>
                            </div>
                        )}
                        {q.solutionImageUrl && (
                            <div style={{ marginTop: '12px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                    Diagrammatic Solution
                                </div>
                                <img 
                                    src={q.solutionImageUrl} 
                                    alt="Solution Diagram" 
                                    style={{ maxHeight: '180px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', padding: '6px', objectFit: 'contain' }} 
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        ))}
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */

const AnswerKeySheet = ({ paper, settings, onGenerateSolution, generatingSolutions }) => {
    return (
        <div id="key-print-area" className="print-area-key" style={{
            background: '#fff', padding: '48px 56px',
            maxWidth: '1000px', margin: '0 auto',
            border: '1px solid #e2e8f0', borderRadius: '12px',
            fontFamily: settings.fontFamily, fontSize: settings.fontSize,
            lineHeight: settings.lineHeight,
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            boxSizing: 'border-box'
        }}>
            <div style={{ marginBottom: '24px', textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '16px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 800, textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>SCHEME OF EVALUATION & ANSWER KEY</h1>
                <h2 style={{ fontSize: '15px', fontWeight: 600, marginTop: '6px', color: '#4b5563' }}>{paper.title}</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>Subject: {paper.subject} &nbsp;|&nbsp; Class: {paper.classes?.join(', ')}</p>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #111' }}>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700, width: '10%', fontSize: '13px' }}>Q.No</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700, width: '20%', fontSize: '13px' }}>Type</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700, width: '25%', fontSize: '13px' }}>Correct Key</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700, width: '45%', fontSize: '13px' }}>Detailed Solution</th>
                    </tr>
                </thead>
                <tbody>
                    {paper.questions?.map((q, idx) => (
                        <tr key={q._id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '12px 8px', fontWeight: 700, verticalAlign: 'top', fontSize: '13px' }}>{idx + 1}</td>
                            <td style={{ padding: '12px 8px', verticalAlign: 'top', textTransform: 'uppercase', fontSize: '11px', fontWeight: 700, color: '#4f46e5' }}>{q.type || 'MCQ'}</td>
                            <td style={{ padding: '12px 8px', verticalAlign: 'top' }}>
                                <MathRenderer inline={true} style={{ color: '#15803d', fontWeight: 800, background: '#f0fdf4', padding: '3px 8px', borderRadius: '4px', border: '1px solid #bbf7d0', fontSize: '12px', display: 'inline-block' }} text={q.answer || '—'} />
                            </td>
                            <td style={{ padding: '12px 8px', verticalAlign: 'top', fontSize: '13px', color: '#1f2937' }}>
                                {q.solutionText ? (
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{q.solutionText}</div>
                                ) : (
                                    <span style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '12px' }}>No detailed solution has been added for this question yet.</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const SavedPapers = () => {
    const [papers, setPapers] = useState([]);
    const [selectedPaper, setSelectedPaper] = useState(null);
    const [activeTemplate, setActiveTemplate] = useState(null);
    const [hoveredRow, setHoveredRow] = useState(null);

    /* ── Filter state ── */
    const [filterClass, setFilterClass] = useState('');
    const [filterDate, setFilterDate] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [papersRes, templatesRes] = await Promise.all([
                    api.get('/api/papers'),
                    api.get('/api/templates'),
                ]);
                setPapers(papersRes.data);
                if (templatesRes.data.length > 0) setActiveTemplate(templatesRes.data[0]);
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    }, []);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Delete this paper? This cannot be undone.')) return;
        try {
            await api.delete(`/api/papers/${id}`);
            setPapers(prev => prev.filter(p => p._id !== id));
        } catch {
            alert('Failed to delete paper.');
        }
    };

    /* ── Unique class options from all papers ── */
    const classOptions = [...new Set(
        papers.flatMap(p => p.classes || [])
    )].sort();

    /* ── Filtered papers ── */
    const filteredPapers = papers.filter(p => {
        const matchClass = filterClass
            ? (p.classes || []).includes(filterClass)
            : true;
        const matchDate = filterDate
            ? toDateStr(p.createdAt) === filterDate
            : true;
        return matchClass && matchDate;
    });

    const hasActiveFilters = filterClass || filterDate;

    const clearFilters = () => {
        setFilterClass('');
        setFilterDate('');
    };

    /* ── Paper view ── */
    if (selectedPaper) {
        return (
            <PaperView
                paper={selectedPaper}
                activeTemplate={activeTemplate}
                onBack={() => setSelectedPaper(null)}
            />
        );
    }

    /* ── Summary values (based on ALL papers, not filtered) ── */
    const lastDate = papers.length
        ? new Date(Math.max(...papers.map(p => new Date(p.createdAt)))).toLocaleDateString()
        : '—';

    /* ── List view ── */
    return (
        <div style={S.page}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#001f6d', letterSpacing: '-0.03em', margin: 0, textTransform: 'uppercase' }}>Department Archives</h3>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Managed Institutional Paper Repository</p>
                </div>
                <div style={{
                    fontSize: '11px', color: '#c5a059',
                    background: '#001f6d', border: 'none',
                    borderRadius: '10px', padding: '8px 18px',
                    fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
                    boxShadow: '0 4px 12px rgba(0,31,109,0.2)',
                }}>
                    {papers.length} RECORD{papers.length !== 1 ? 'S' : ''}
                </div>
            </div>

            {/* Summary cards — 2 cards only (Total Questions removed) */}
            <div style={S.summaryGrid}>
                <div style={S.summaryCard}>
                    <div style={S.summaryLabel}>Total Papers</div>
                    <div style={S.summaryValue}>{papers.length}</div>
                    <div style={S.summarySub}>All saved question papers</div>
                </div>
                <div style={S.summaryCard}>
                    <div style={S.summaryLabel}>Last Created</div>
                    <div style={{ ...S.summaryValue, fontSize: '16px', paddingTop: '5px' }}>{lastDate}</div>
                    <div style={S.summarySub}>Most recent paper</div>
                </div>
            </div>

            {/* Section label + filter bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={S.sectionLabel}>All Papers</div>

                {/* ── Filters ── */}
                <div style={S.filterBar}>
                    {/* Class filter */}
                    <span style={S.filterLabel}>Class:</span>
                    <select
                        style={S.filterSelect}
                        value={filterClass}
                        onChange={e => setFilterClass(e.target.value)}
                    >
                        <option value="">All Classes</option>
                        {classOptions.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                        ))}
                    </select>

                    {/* Date filter */}
                    <span style={S.filterLabel}>Created:</span>
                    <input
                        type="date"
                        style={S.filterDate}
                        value={filterDate}
                        onChange={e => setFilterDate(e.target.value)}
                    />

                    {/* Clear button — only shown when filters are active */}
                    {hasActiveFilters && (
                        <button
                            style={S.btnClearFilters}
                            onClick={clearFilters}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#374151'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
                        >
                            ✕ Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div style={S.tableWrap}>
                {filteredPapers.length === 0 ? (
                    <div style={S.empty}>
                        <div style={S.emptyIcon}>{papers.length === 0 ? '📄' : '🔍'}</div>
                        <div style={S.emptyTitle}>{papers.length === 0 ? 'No saved papers yet' : 'No papers match your filters'}</div>
                        <div style={S.emptySub}>
                            {papers.length === 0
                                ? 'Create a paper from the Paper Builder to see it here.'
                                : 'Try changing or clearing the filters above.'}
                        </div>
                    </div>
                ) : (
                    <table style={S.table}>
                        <thead>
                            <tr>
                                <th style={S.th}>Paper</th>
                                <th style={S.th}>Class</th>
                                <th style={S.th}>Questions</th>
                                <th style={S.th}>Created</th>
                                <th style={S.th}>Status</th>
                                <th style={{ ...S.th, ...S.thRight }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPapers.map((p, i) => (
                                <tr
                                    key={p._id}
                                    style={{
                                        background: hoveredRow === p._id ? '#f8fafc' : '#fff',
                                        cursor: 'default',
                                        transition: 'background 0.12s',
                                    }}
                                    onMouseEnter={() => setHoveredRow(p._id)}
                                    onMouseLeave={() => setHoveredRow(null)}
                                >
                                    {/* Paper */}
                                    <td style={{ ...S.td, borderBottom: i === filteredPapers.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <div style={S.paperCell}>
                                            <div style={S.paperIcon}>📝</div>
                                            <div>
                                                <div style={S.paperTitle}>{p.title}</div>
                                                <div style={S.paperId}>#{String(i + 1).padStart(4, '0')}</div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Class */}
                                    <td style={{ ...S.td, borderBottom: i === filteredPapers.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <span style={S.tagClass}>Class {p.classes?.join(', ')}</span>
                                    </td>

                                    {/* Questions */}
                                    <td style={{ ...S.td, borderBottom: i === filteredPapers.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <span style={S.tagQ}>{p.questions?.length} Qs</span>
                                    </td>

                                    {/* Date */}
                                    <td style={{ ...S.td, borderBottom: i === filteredPapers.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <span style={S.dateCell}>{new Date(p.createdAt).toLocaleDateString()}</span>
                                    </td>

                                    {/* Status */}
                                    <td style={{ ...S.td, borderBottom: i === filteredPapers.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <span style={{
                                            ...S.tagClass, 
                                            background: p.status === 'Approved' ? '#dcfce7' : p.status === 'Rejected' ? '#fee2e2' : '#fef9c3',
                                            color: p.status === 'Approved' ? '#166534' : p.status === 'Rejected' ? '#991b1b' : '#854d0e',
                                            border: 'none'
                                        }}>
                                            {p.status || 'Pending Approval'}
                                        </span>
                                    </td>

                                    {/* Actions */}
                                    <td style={{ ...S.tdLast, borderBottom: i === filteredPapers.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <div style={S.actionCell}>
                                            <button
                                                style={S.btnView}
                                                onClick={() => setSelectedPaper(p)}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#fff'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#2563eb'; }}
                                            >
                                                View
                                            </button>
                                            <button
                                                style={S.btnDel}
                                                onClick={e => handleDelete(e, p._id)}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#dc2626'; }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default SavedPapers;