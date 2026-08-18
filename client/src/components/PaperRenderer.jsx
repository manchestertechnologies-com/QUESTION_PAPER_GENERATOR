/**
 * PaperRenderer.jsx
 *
 * The central layout engine for question papers and assignments.
 * Shared between SavedPapers, AssignmentGenerator, and AdminPaperPreview.
 *
 * Features:
 *  - Proper 2-column layout using explicit flex divs (not CSS column-count)
 *  - No text overflow — word-break + overflow-wrap everywhere
 *  - Smart question distribution across columns
 *  - All question types via QuestionBlock
 *  - Configurable start/end question numbers
 *  - Marks OFF by default
 *  - Full customization panel (font, size, spacing, columns, margins, visibility)
 *  - Print CSS for clean A4 PDF via window.print()
 */
import React, { useState, useMemo } from 'react';
import QuestionBlock from './QuestionBlock';
import { optionLabel } from '../utils/sanitize';

// ─── Marks helpers ────────────────────────────────────────────────────────────
export function formatMarks(type = '', classes = []) {
    const isNeet = Array.isArray(classes) && classes.some(c => String(c).toUpperCase() === 'NEET');
    const t = (type || '').toUpperCase();
    if (t === 'MCQ' || t === '1M' || t === 'DIAGRAM_BASED' || t === 'IMAGE_BASED' || t === 'ASSERTION_REASON') {
        return isNeet ? '4 Marks' : '1 Mark';
    }
    if (t === '2M') return '2 Marks';
    if (t === '3M') return '3 Marks';
    if (t === '4M' || t === 'NUMERICAL') return '4 Marks';
    if (t === '5M') return '5 Marks';
    if (t === 'MATCH_FOLLOWING') return '4 Marks';
    return '1 Mark';
}

export function calcTotal(questions = [], classes = []) {
    return questions.reduce((s, q) => {
        const t = (q.type || '').toUpperCase();
        const isNeet = Array.isArray(classes) && classes.some(c => String(c).toUpperCase() === 'NEET');
        if (t === 'MCQ' || t === '1M' || t === 'DIAGRAM_BASED' || t === 'ASSERTION_REASON') return s + (isNeet ? 4 : 1);
        if (t === '2M') return s + 2;
        if (t === '3M') return s + 3;
        if (t === 'NUMERICAL' || t === '4M' || t === 'MATCH_FOLLOWING') return s + 4;
        if (t === '5M') return s + 5;
        return s + 1;
    }, 0);
}

// ─── Default settings ─────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '13px',
    lineHeight: '1.5',
    columns: 1,
    columnGap: '28px',
    showMarks: false,         // OFF by default per requirements
    showAnswerKey: false,
    showDifficulty: false,
    startQNo: 1,
    endQNo: null,             // null = use all questions
    pageSize: 'A4',
    orientation: 'portrait',
    marginTop: '15mm',
    marginBottom: '15mm',
    marginLeft: '18mm',
    marginRight: '18mm',
    questionSpacing: '14px',
    optionSpacing: '3px',
    paragraphSpacing: '6px',
    diagramMaxHeight: '170px',
    diagramMaxWidthPct: 90,
};

// ─── Settings Panel ───────────────────────────────────────────────────────────
const labelStyle = { fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' };
const selectStyle = { height: '32px', padding: '0 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', width: '100%' };
const inputStyle = { height: '32px', padding: '0 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };

function SettingField({ label, children }) {
    return (
        <div>
            <label style={labelStyle}>{label}</label>
            {children}
        </div>
    );
}

export function SettingsPanel({ settings, setSettings, totalQuestions = 0 }) {
    const update = (key, val) => setSettings(s => ({ ...s, [key]: val }));
    const endMax = settings.startQNo + totalQuestions - 1;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>

            {/* ── Numbering ── */}
            <div style={{ gridColumn: '1 / -1', fontSize: '10px', fontWeight: 800, color: '#001f6d', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                📐 Numbering
            </div>
            <SettingField label="Start Q. No">
                <input type="number" min={1} style={inputStyle} value={settings.startQNo}
                    onChange={e => {
                        const v = Math.max(1, parseInt(e.target.value) || 1);
                        update('startQNo', v);
                    }} />
            </SettingField>
            <SettingField label={`End Q. No (max ${endMax})`}>
                <input type="number" min={settings.startQNo} style={inputStyle}
                    value={settings.endQNo ?? endMax}
                    onChange={e => {
                        const v = parseInt(e.target.value) || endMax;
                        update('endQNo', Math.max(settings.startQNo, Math.min(v, endMax)));
                    }} />
            </SettingField>

            {/* ── Layout ── */}
            <div style={{ gridColumn: '1 / -1', fontSize: '10px', fontWeight: 800, color: '#001f6d', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginTop: '6px' }}>
                📄 Layout
            </div>
            <SettingField label="Columns">
                <select style={selectStyle} value={settings.columns} onChange={e => update('columns', parseInt(e.target.value))}>
                    <option value={1}>Single Column</option>
                    <option value={2}>Two Columns</option>
                </select>
            </SettingField>
            <SettingField label="Page Size">
                <select style={selectStyle} value={settings.pageSize} onChange={e => update('pageSize', e.target.value)}>
                    <option value="A4">A4</option>
                    <option value="A3">A3</option>
                    <option value="letter">US Letter</option>
                </select>
            </SettingField>
            <SettingField label="Orientation">
                <select style={selectStyle} value={settings.orientation} onChange={e => update('orientation', e.target.value)}>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                </select>
            </SettingField>

            {/* ── Font ── */}
            <div style={{ gridColumn: '1 / -1', fontSize: '10px', fontWeight: 800, color: '#001f6d', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginTop: '6px' }}>
                🔤 Font
            </div>
            <SettingField label="Font Style">
                <select style={selectStyle} value={settings.fontFamily} onChange={e => update('fontFamily', e.target.value)}>
                    <option value='Georgia, "Times New Roman", serif'>Georgia (Classic)</option>
                    <option value='"Times New Roman", Times, serif'>Times New Roman</option>
                    <option value='Cambria, Georgia, serif'>Cambria</option>
                    <option value='Calibri, Candara, Segoe, sans-serif'>Calibri</option>
                    <option value='Arial, Helvetica, sans-serif'>Arial</option>
                    <option value="'Inter', system-ui, sans-serif">Inter (Modern)</option>
                </select>
            </SettingField>
            <SettingField label="Font Size">
                <select style={selectStyle} value={settings.fontSize} onChange={e => update('fontSize', e.target.value)}>
                    <option value="11px">Small (11px)</option>
                    <option value="12px">Compact (12px)</option>
                    <option value="13px">Standard (13px)</option>
                    <option value="14px">Large (14px)</option>
                    <option value="15px">X-Large (15px)</option>
                </select>
            </SettingField>
            <SettingField label="Line Spacing">
                <select style={selectStyle} value={settings.lineHeight} onChange={e => update('lineHeight', e.target.value)}>
                    <option value="1.2">Compact (1.2)</option>
                    <option value="1.4">Tight (1.4)</option>
                    <option value="1.5">Standard (1.5)</option>
                    <option value="1.8">Relaxed (1.8)</option>
                    <option value="2.0">Double (2.0)</option>
                </select>
            </SettingField>
            <SettingField label="Q. Spacing">
                <select style={selectStyle} value={settings.questionSpacing} onChange={e => update('questionSpacing', e.target.value)}>
                    <option value="8px">Compact (8px)</option>
                    <option value="12px">Tight (12px)</option>
                    <option value="14px">Standard (14px)</option>
                    <option value="20px">Relaxed (20px)</option>
                    <option value="28px">Wide (28px)</option>
                </select>
            </SettingField>

            {/* ── Visibility ── */}
            <div style={{ gridColumn: '1 / -1', fontSize: '10px', fontWeight: 800, color: '#001f6d', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginTop: '6px' }}>
                👁 Visibility
            </div>
            <SettingField label="Show Marks">
                <select style={selectStyle} value={settings.showMarks ? 'yes' : 'no'} onChange={e => update('showMarks', e.target.value === 'yes')}>
                    <option value="no">Hidden (Default)</option>
                    <option value="yes">Show Marks</option>
                </select>
            </SettingField>
            <SettingField label="Show Answer Key">
                <select style={selectStyle} value={settings.showAnswerKey ? 'yes' : 'no'} onChange={e => update('showAnswerKey', e.target.value === 'yes')}>
                    <option value="no">Hidden (Default)</option>
                    <option value="yes">Show Answers</option>
                </select>
            </SettingField>
        </div>
    );
}

// ─── Paper Header ─────────────────────────────────────────────────────────────

export function PaperHeader({ title, subject, classes, duration, totalMarks, templateUrl, isAssignment = false }) {
    return (
        <div style={{ marginBottom: '10px' }}>
            {templateUrl && templateUrl.match(/\.(jpeg|jpg|gif|png)$/i) && (
                <div style={{ textAlign: 'center', marginBottom: '6px', borderBottom: '2px solid #000', paddingBottom: '6px' }}>
                    <img src={templateUrl} alt="Header" style={{ maxWidth: '100%', maxHeight: '88px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                </div>
            )}
            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px 0' }}>
                    {title || subject || 'Question Paper'}
                </div>
                {!isAssignment && (
                    <div style={{ fontSize: '12px', color: '#333', fontWeight: 500 }}>
                        Subject: {subject}{classes && classes.length > 0 ? ` | Class: ${classes.join(', ')}` : ''}
                    </div>
                )}
            </div>
            {!isAssignment && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', borderBottom: '2px solid #000', padding: '3px 0', fontWeight: 700, fontSize: '13px', marginTop: '4px' }}>
                    <span>Time: {duration || '3 Hours'}</span>
                    <span>Max. Marks: {totalMarks}</span>
                </div>
            )}
            {isAssignment && (
                <div style={{ borderBottom: '2px solid #000', paddingBottom: '2px', marginTop: '2px' }} />
            )}
        </div>
    );
}

// ─── Section header (for blueprint-based sections) ───────────────────────────
function SectionHeader({ name, description }) {
    return (
        <div style={{ textAlign: 'center', margin: '16px 0 10px', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', textDecoration: 'underline' }}>{name}</div>
            {description && <div style={{ fontSize: '11px', color: '#555', fontStyle: 'italic', marginTop: '2px' }}>{description}</div>}
        </div>
    );
}

// ─── Two-column distributor ───────────────────────────────────────────────────
/**
 * Splits a flat list of questions into two roughly equal halves.
 * Unlike CSS column-count, this gives us explicit control so we
 * can prevent overflow and control break points per column.
 */
function splitIntoColumns(items) {
    const half = Math.ceil(items.length / 2);
    return [items.slice(0, half), items.slice(half)];
}

// ─── Question renderer helper ─────────────────────────────────────────────────
function renderQList(qs, startNum, classes, settings, singleColMode = false) {
    return qs.map((q, i) => (
        <QuestionBlock
            key={q._id || i}
            q={q}
            displayNum={startNum + i}
            classes={classes}
            showMarks={settings.showMarks}
            singleColMode={singleColMode}
            fontSize={settings.fontSize}
            lineHeight={settings.lineHeight}
            formatMarks={formatMarks}
            extraStyle={{ marginBottom: settings.questionSpacing }}
        />
    ));
}

// ─── Main PaperRenderer ───────────────────────────────────────────────────────
/**
 * Props:
 *   paper              - full paper object {title, subject, classes, questions, pattern, duration}
 *   activeTemplate     - template object {fileUrl}
 *   isAssignment       - boolean: hides time/marks header row
 *   settings           - settings state object
 *   setSettings        - settings setter
 *   showSettingsPanel  - boolean
 *   printAreaId        - id for the print area div (default "qp-print-area")
 */
const PaperRenderer = ({
    paper,
    activeTemplate,
    isAssignment = false,
    settings: externalSettings,
    setSettings: externalSetSettings,
    showSettingsPanel = false,
    printAreaId = 'qp-print-area',
}) => {
    // Use internal state if no external state provided
    const [internalSettings, setInternalSettings] = useState(DEFAULT_SETTINGS);
    const settings = externalSettings || internalSettings;
    const setSettings = externalSetSettings || setInternalSettings;

    const questions = useMemo(() => paper?.questions || [], [paper]);
    const classes = useMemo(() => paper?.classes || [], [paper]);
    const totalMarks = useMemo(() => {
        if (paper?.pattern?.length) return paper.pattern.reduce((s, sec) => s + (sec.marks || 0), 0);
        return calcTotal(questions, classes);
    }, [paper, questions, classes]);

    // Slice questions by start/end Q no.
    const startQNo = settings.startQNo || 1;
    const endQNo = settings.endQNo ?? (startQNo + questions.length - 1);
    const count = Math.max(0, endQNo - startQNo + 1);
    const visibleQuestions = questions.slice(0, count);

    // Compute display questions grouped by section if pattern exists
    const sections = useMemo(() => {
        if (!paper?.pattern?.length) return null;
        let pool = [...visibleQuestions];
        return paper.pattern.map(sec => {
            const num = sec.numQuestions || 0;
            let secQs = sec.type ? pool.filter(q => q.type === sec.type).slice(0, num) : pool.slice(0, num);
            const usedIds = new Set(secQs.map(q => q._id));
            pool = pool.filter(q => !usedIds.has(q._id));
            return { ...sec, questions: secQs };
        }).filter(s => s.questions.length > 0);
    }, [paper, visibleQuestions]);

    const pageStyle = {
        background: '#fff',
        padding: '40px 44px',
        maxWidth: settings.columns === 2 ? '1000px' : '840px',
        margin: '0 auto',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        fontFamily: settings.fontFamily,
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        boxSizing: 'border-box',
        color: '#111',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
    };

    const twoColContainerStyle = {
        display: 'flex',
        gap: settings.columnGap || '28px',
        alignItems: 'flex-start',
    };

    const colStyle = {
        flex: 1,
        minWidth: 0,
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        overflow: 'hidden',
    };

    // Render all questions as a flat list, then split if 2-col
    const renderAllQuestions = () => {
        if (sections) {
            // Pattern-based sections
            let runningNum = startQNo;
            return sections.map((sec, si) => {
                const secStart = runningNum;
                runningNum += sec.questions.length;
                return (
                    <div key={si} style={{ breakInside: 'avoid-page' }}>
                        <SectionHeader name={sec.sectionName} description={sec.description} />
                        {renderQList(sec.questions, secStart, classes, settings, settings.columns === 2)}
                    </div>
                );
            });
        }
        return renderQList(visibleQuestions, startQNo, classes, settings, settings.columns === 2);
    };

    const questionsContent = renderAllQuestions();

    const renderColumns = () => {
        if (settings.columns === 2) {
            if (sections) {
                // Split sections between columns
                const [left, right] = splitIntoColumns(sections);
                let leftNum = startQNo;
                let rightNum = startQNo + left.reduce((s, sec) => s + sec.questions.length, 0);
                return (
                    <div style={twoColContainerStyle}>
                        <div style={{ ...colStyle, borderRight: '1px solid #ddd', paddingRight: settings.columnGap || '28px' }}>
                            {left.map((sec, si) => {
                                const n = leftNum;
                                leftNum += sec.questions.length;
                                return (
                                    <div key={si}>
                                        <SectionHeader name={sec.sectionName} description={sec.description} />
                                        {renderQList(sec.questions, n, classes, settings, true)}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={colStyle}>
                            {right.map((sec, si) => {
                                const n = rightNum;
                                rightNum += sec.questions.length;
                                return (
                                    <div key={si}>
                                        <SectionHeader name={sec.sectionName} description={sec.description} />
                                        {renderQList(sec.questions, n, classes, settings, true)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            }
            const [leftQs, rightQs] = splitIntoColumns(visibleQuestions);
            const rightStart = startQNo + leftQs.length;
            return (
                <div style={twoColContainerStyle}>
                    <div style={{ ...colStyle, borderRight: '1px solid #ddd', paddingRight: settings.columnGap || '28px' }}>
                        {renderQList(leftQs, startQNo, classes, settings, true)}
                    </div>
                    <div style={colStyle}>
                        {renderQList(rightQs, rightStart, classes, settings, true)}
                    </div>
                </div>
            );
        }
        return <div style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{questionsContent}</div>;
    };

    return (
        <>
            {/* Print CSS */}
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #${printAreaId}, #${printAreaId} * { visibility: visible; }
                    #${printAreaId} {
                        position: fixed !important;
                        top: 0; left: 0; right: 0;
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        max-width: 100% !important;
                        width: 100% !important;
                        background: #fff !important;
                    }
                    .no-print { display: none !important; }
                    @page {
                        size: ${settings.pageSize} ${settings.orientation};
                        margin: ${settings.marginTop} ${settings.marginRight} ${settings.marginBottom} ${settings.marginLeft};
                    }
                }
            `}</style>

            {/* Settings panel */}
            {showSettingsPanel && (
                <SettingsPanel settings={settings} setSettings={setSettings} totalQuestions={questions.length} />
            )}

            {/* Paper body */}
            <div id={printAreaId} style={pageStyle}>
                <PaperHeader
                    title={paper?.title}
                    subject={paper?.subject}
                    classes={classes}
                    duration={paper?.duration}
                    totalMarks={totalMarks}
                    templateUrl={activeTemplate?.fileUrl}
                    isAssignment={isAssignment}
                />

                {renderColumns()}

                <div style={{ textAlign: 'center', fontWeight: 700, borderTop: '2px solid #000', paddingTop: '12px', marginTop: '32px', fontSize: '12px' }}>
                    *** End of Paper ***
                </div>
            </div>
        </>
    );
};

export { DEFAULT_SETTINGS };
export default PaperRenderer;
