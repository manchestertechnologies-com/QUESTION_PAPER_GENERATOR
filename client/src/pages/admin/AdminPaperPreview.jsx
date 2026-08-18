import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import { sanitize } from '../../utils/sanitize';
import MathRenderer from '../../components/MathRenderer';

const AdminPaperPreview = () => {
    const { paperId } = useParams();
    const navigate = useNavigate();
    const { logout } = useContext(AuthContext);
    const [selectedPaper, setSelectedPaper] = useState(null);
    const [activeTemplate, setActiveTemplate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAnswerKey, setShowAnswerKey] = useState(false);
    const [printSolutionsBooklet, setPrintSolutionsBooklet] = useState(false);
    const [generatingSolutions, setGeneratingSolutions] = useState({});
    const [numSets, setNumSets] = useState(4);
    const [activeSet, setActiveSet] = useState('Standard');
    const [printOMRSheet, setPrintOMRSheet] = useState(false);
    const [bilingualMode, setBilingualMode] = useState(false);

    const handleGenerateSolution = async (qId) => {
        setGeneratingSolutions(prev => ({ ...prev, [qId]: true }));
        try {
            const res = await api.post(`/api/questions/${qId}/solve`);
            setSelectedPaper(prev => {
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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [papersRes, templatesRes] = await Promise.all([
                    api.get('/api/papers/admin/all'),
                    api.get('/api/templates')
                ]);
                
                const paper = papersRes.data.find(p => p._id === paperId);
                setSelectedPaper(paper);
                
                if (templatesRes.data.length > 0) {
                    setActiveTemplate(templatesRes.data[0]);
                }
                
                setLoading(false);
            } catch (err) {
                console.error(err);
                if (err.response && [400, 401, 403].includes(err.response.status)) {
                    logout();
                    navigate('/');
                }
            }
        };
        fetchData();
    }, [paperId]);

    const handlePrint = () => {
        window.print();
    };

    const handleWordExport = () => {
        const token = localStorage.getItem('token');
        const downloadUrl = `${api.defaults.baseURL || ''}/api/papers/${selectedPaper._id}/export-word?token=${token}`;
        window.open(downloadUrl, '_blank');
    };

    const formatMarks = (type) => {
        if (type === 'MCQ' || type === '1m') return '1 Mark';
        if (type === '2m') return '2 Marks';
        if (type === '3m') return '3 Marks';
        if (type === '4m') return '4 Marks';
        if (type === '5m') return '5 Marks';
        return type;
    };

    const getOptionsGridClass = (options) => {
        if (!options || options.length === 0) return 'grid-cols-1 gap-y-2';
        
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
        
        if (maxLength <= 15 && totalLength <= 60) {
            return 'grid-cols-4 gap-x-4 gap-y-2';
        } else if (maxLength <= 35 && totalLength <= 110) {
            return 'grid-cols-2 gap-x-8 gap-y-3';
        } else {
            return 'grid-cols-1 gap-y-2.5';
        }
    };

    if (loading) return <div className="p-8 text-center text-xl font-bold">Loading Paper Format...</div>;
    if (!selectedPaper) return <div className="p-8 text-center text-red-500 font-bold text-xl">Paper not found.</div>;

    let totalMarks = 0;
    if (selectedPaper.pattern && selectedPaper.pattern.length > 0) {
        totalMarks = selectedPaper.pattern.reduce((sum, sec) => sum + (sec.marks || 0), 0);
    } else {
        totalMarks = selectedPaper.questions.reduce((sum, q) => {
            if (q.type === 'MCQ' || q.type === '1m') return sum + 1;
            if (q.type === '2m') return sum + 2;
            if (q.type === '3m') return sum + 3;
            if (q.type === '4m') return sum + 4;
            if (q.type === '5m') return sum + 5;
            return sum;
        }, 0);
    }

    const getSetNames = (count) => {
        if (count === 4) return ['P', 'Q', 'R', 'S'];
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        return alphabet.split('').slice(0, count);
    };

    const seededShuffle = (arr, seed) => {
        let m = arr.length, t, i;
        let seedNum = 0;
        for (let charIdx = 0; charIdx < seed.length; charIdx++) {
            seedNum += seed.charCodeAt(charIdx);
        }
        const random = () => {
            let x = Math.sin(seedNum++) * 10000;
            return x - Math.floor(x);
        };
        const shuffled = [...arr];
        while (m) {
            i = Math.floor(random() * m--);
            t = shuffled[m];
            shuffled[m] = shuffled[i];
            shuffled[i] = t;
        }
        return shuffled;
    };

    const getProcessedQuestions = () => {
        if (!selectedPaper) return [];
        
        if (!selectedPaper.pattern || selectedPaper.pattern.length === 0) {
            return activeSet !== 'Standard' 
                ? seededShuffle(selectedPaper.questions, `${activeSet}-${selectedPaper._id}`) 
                : selectedPaper.questions;
        }

        let availableQuestions = [...selectedPaper.questions];
        let processed = [];

        selectedPaper.pattern.forEach(sec => {
            const numQuestions = sec.numQuestions || 0;
            const sectionType = sec.type;
            
            let sectionQuestions = [];
            if (sectionType) {
                const matchedQuestions = availableQuestions.filter(q => q.type === sectionType);
                sectionQuestions = matchedQuestions.slice(0, numQuestions);
                const usedIds = new Set(sectionQuestions.map(q => q._id));
                availableQuestions = availableQuestions.filter(q => !usedIds.has(q._id));
            } else {
                sectionQuestions = availableQuestions.slice(0, numQuestions);
                availableQuestions = availableQuestions.slice(numQuestions);
            }
            
            const shuffled = activeSet !== 'Standard'
                ? seededShuffle(sectionQuestions, `${activeSet}-${selectedPaper._id}-${sec.sectionName}`)
                : sectionQuestions;
                
            processed.push({
                section: sec,
                questions: shuffled
            });
        });

        return processed;
    };

    const processedSections = getProcessedQuestions();
    const flatProcessedQuestions = selectedPaper.pattern && selectedPaper.pattern.length > 0
        ? processedSections.flatMap(s => s.questions)
        : processedSections;

    return (
        <div className="animate-fade-in-up px-4 py-8">
            <div className="flex justify-between items-center mb-10 no-print p-6 bg-white border border-gray-100 shadow-xl rounded-[2rem] max-w-5xl mx-auto flex-wrap gap-4 font-sans">
                <div className="flex gap-4 items-center">
                    <button onClick={() => navigate(-1)} className="bg-gray-100 text-slate/50 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition">← Back</button>
                    
                    <div className="flex gap-2 items-center">
                        <label className="text-[10px] font-black text-navy uppercase tracking-widest">Shuffling Sets:</label>
                        <select 
                            value={numSets} 
                            onChange={e => {
                                const val = parseInt(e.target.value);
                                setNumSets(val);
                                setActiveSet('Standard');
                            }}
                            className="border border-gray-200 p-2 rounded-xl text-xs bg-white font-bold"
                        >
                            <option value={2}>2 Sets (A, B)</option>
                            <option value={3}>3 Sets (A, B, C)</option>
                            <option value={4}>4 Sets (P, Q, R, S)</option>
                            <option value={5}>5 Sets (A, B, C, D, E)</option>
                        </select>

                        <select 
                            value={activeSet} 
                            onChange={e => setActiveSet(e.target.value)}
                            className="border border-gray-200 p-2 rounded-xl text-xs bg-white font-bold"
                        >
                            <option value="Standard">Standard (Unshuffled)</option>
                            {getSetNames(numSets).map(setLetter => (
                                <option key={setLetter} value={setLetter}>Set {setLetter}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={() => {
                            setPrintOMRSheet(!printOMRSheet);
                            if (!printOMRSheet) {
                                setShowAnswerKey(false);
                                setPrintSolutionsBooklet(false);
                            }
                        }} 
                        className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg ${printOMRSheet ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}
                    >
                        {printOMRSheet ? 'Show Paper' : 'OMR Sheet'}
                    </button>
                    <button 
                        onClick={() => setBilingualMode(!bilingualMode)} 
                        className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg ${bilingualMode ? 'bg-sky-600 text-white' : 'bg-sky-100 text-sky-700'}`}
                    >
                        {bilingualMode ? 'English Only' : 'Bilingual Mode'}
                    </button>
                    <button 
                        onClick={() => {
                            setPrintSolutionsBooklet(!printSolutionsBooklet);
                            if (!printSolutionsBooklet) setPrintOMRSheet(false);
                        }} 
                        className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg ${printSolutionsBooklet ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700'}`}
                    >
                        {printSolutionsBooklet ? 'Show Paper' : 'Solutions Booklet'}
                    </button>
                    <button 
                        onClick={() => {
                            setShowAnswerKey(!showAnswerKey);
                            if (!showAnswerKey) setPrintOMRSheet(false);
                        }} 
                        className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg ${showAnswerKey ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700'}`}
                    >
                        {showAnswerKey ? 'Hide Answers' : 'Show Answers'}
                    </button>
                    <button onClick={handlePrint} className="bg-navy text-gold px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg">🖨 Print / Save PDF</button>
                    <button onClick={handleWordExport} className="bg-purple-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg">⬇️ Export Word</button>
                </div>
            </div>

            <div className="bg-white p-20 shadow-2xl max-w-4xl mx-auto print-area border-t-8 border-navy font-serif text-sm mb-20 min-h-[1100px] rounded-b-[3rem]" style={{ position: 'relative' }}>
                {/* Watermark */}
                {activeTemplate?.watermarkText && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%) rotate(-45deg)',
                        fontSize: '5rem',
                        fontWeight: 'bold',
                        color: 'rgba(0, 0, 0, 0.04)',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        zIndex: 0,
                        whiteSpace: 'nowrap'
                    }}>
                        {activeTemplate.watermarkText}
                    </div>
                )}

                {/* Custom Institutional Header Layout */}
                {activeTemplate && (activeTemplate.institutionName || activeTemplate.headerText) ? (
                    <div className="mb-8 border-b-4 border-double border-black pb-4 text-center font-serif relative z-10">
                        {activeTemplate.fileUrl && (
                            <img src={activeTemplate.fileUrl} alt="Logo" className="max-h-20 object-contain mx-auto mb-2 block" />
                        )}
                        {activeTemplate.institutionName && (
                            <h2 className="text-2xl font-black tracking-tight text-black uppercase leading-tight">{activeTemplate.institutionName}</h2>
                        )}
                        {activeTemplate.address && (
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-widest mt-0.5">{activeTemplate.address}</p>
                        )}
                        {activeTemplate.headerText && (
                            <h3 className="text-lg font-bold text-gray-800 uppercase mt-2 tracking-wide border-t border-gray-300 pt-1">{activeTemplate.headerText}</h3>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-bold text-left mt-4 border-t-2 border-black pt-3">
                            <div>Subject: <span className="font-medium">{selectedPaper.subject}</span></div>
                            <div>Class: <span className="font-medium">{selectedPaper.classes?.join(', ')}</span></div>
                            <div>Time Allowed: <span className="font-medium">3 Hours</span></div>
                            <div>Max Marks: <span className="font-medium">{totalMarks}</span></div>
                        </div>
                    </div>
                ) : (
                    /* Fallback to simple title/image logo header */
                    <>
                        {activeTemplate && activeTemplate.fileUrl && activeTemplate.fileUrl.match(/\.(jpeg|jpg|gif|png)$/i) && (
                            <div className="mb-6 border-b-2 border-black pb-4 text-center flex justify-center w-full relative z-10">
                                <img src={activeTemplate.fileUrl} alt="College Template Header" className="max-w-full h-auto mx-auto max-h-40 object-contain block" style={{ margin: '0 auto' }} />
                            </div>
                        )}
                        <div className="mb-8 relative z-10">
                            <div className="text-center">
                                <h1 className="text-2xl font-bold uppercase tracking-wide">{selectedPaper.title}</h1>
                                <p className="text-gray-800 mt-2 font-medium text-lg">Subject: {selectedPaper.subject} | Class: {selectedPaper.classes?.join(', ')}</p>
                            </div>
                            <div className="flex justify-between items-end mt-8 font-bold border-b-2 border-black pb-3 text-base">
                                <span>Time: 3 Hours</span>
                                <span>Max. Marks: {totalMarks}</span>
                            </div>
                        </div>
                    </>
                )}

                {/* Instructions */}
                {(activeTemplate?.instructions || selectedPaper.instructions) && (
                    <div className="mb-6 text-xs border-b border-gray-300 pb-4 relative z-10 font-sans">
                        <h4 className="font-bold uppercase tracking-wider mb-2 text-[11px] text-black">General Instructions:</h4>
                        <div className="whitespace-pre-line leading-relaxed text-gray-700 pl-2">
                            {activeTemplate?.instructions || selectedPaper.instructions}
                        </div>
                    </div>
                )}
                {printOMRSheet ? (
                    <div className="relative z-10 mt-8 text-black" style={{ fontFamily: 'Inter, sans-serif' }}>
                        <div style={{ textAlign: 'center', borderBottom: '3px double #000', paddingBottom: '12px', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                                {activeTemplate?.institutionName || 'OMR ANSWER RESPONSE SHEET'}
                            </h3>
                            <p style={{ fontSize: '13px', fontWeight: 700, margin: '4px 0 0' }}>
                                EXAM: {selectedPaper.title.toUpperCase()} {activeSet !== 'Standard' && `— SET ${activeSet}`}
                            </p>
                        </div>

                        {/* Candidate Info Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                            {/* Left Box: Name & Details */}
                            <div style={{ border: '2px solid #000', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Candidate Name (In Block Letters)</label>
                                    <div style={{ borderBottom: '1.5px solid #000', height: '24px' }}></div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Student Email / Roll Number</label>
                                    <div style={{ borderBottom: '1.5px solid #000', height: '24px' }}></div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                                    <div>
                                        <label style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Candidate Signature</label>
                                        <div style={{ border: '1.5px solid #000', height: '40px', borderRadius: '6px' }}></div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Invigilator Signature</label>
                                        <div style={{ border: '1.5px solid #000', height: '40px', borderRadius: '6px' }}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Box: Roll Number Bubbles (standard 10-digit bubble grid) */}
                            <div style={{ border: '2px solid #000', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>Roll Number Bubbling Grid</span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {Array.from({ length: 10 }).map((_, colIdx) => (
                                        <div key={colIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ width: '16px', height: '16px', border: '1.5px solid #000', borderBottomWidth: '3px', textAlign: 'center', fontSize: '9px', fontWeight: 900, marginBottom: '2px' }}></div>
                                            {Array.from({ length: 10 }).map((_, val) => (
                                                <span key={val} style={{
                                                    width: '18px', height: '18px', border: '1px solid #000', borderRadius: '50%',
                                                    display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center',
                                                    fontSize: '8px', fontWeight: 900, cursor: 'pointer'
                                                }}>{val}</span>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* OMR Question Circles Grid */}
                        <div style={{ border: '2px solid #000', borderRadius: '12px', padding: '20px', background: '#fff' }}>
                            <div style={{ fontSize: '12px', fontWeight: 900, textAlign: 'center', borderBottom: '1.5px solid #000', paddingBottom: '8px', marginBottom: '16px', textTransform: 'uppercase' }}>
                                Mark your answers by filling the bubbles completely. Use blue/black ballpoint pen only.
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 24px' }}>
                                {(() => {
                                    const items = flatProcessedQuestions || [];
                                    const colSize = Math.ceil(items.length / 4) || 1;
                                    return Array.from({ length: 4 }).map((_, colIdx) => (
                                        <div key={colIdx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {items.slice(colIdx * colSize, (colIdx + 1) * colSize).map((q, localIdx) => {
                                                const qNum = colIdx * colSize + localIdx + 1;
                                                return (
                                                    <div key={qNum} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 700 }}>
                                                        <span style={{ minWidth: '24px', textAlign: 'right' }}>{qNum}.</span>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            {['A', 'B', 'C', 'D'].map(opt => (
                                                                <span key={opt} style={{
                                                                    width: '20px', height: '20px', border: '1px solid #000', borderRadius: '50%',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '9px', fontWeight: 900
                                                                }}>{opt}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                ) : printSolutionsBooklet ? (
                    <div className="relative z-10 font-sans mt-8 text-black">
                        {/* Compact Answer Grid */}
                        <h4 className="font-bold text-base uppercase tracking-wider mb-4 pb-1 border-b-2 border-black">I. Answer Key Matrix</h4>
                        <table className="w-full mb-8 border border-collapse border-gray-400">
                            <tbody>
                                <tr className="bg-gray-100">
                                    <td className="border border-gray-400 p-2 font-bold text-center text-xs">Question</td>
                                    {flatProcessedQuestions?.map((_, idx) => (
                                        <td key={idx} className="border border-gray-400 p-2 font-bold text-center text-xs">{idx + 1}</td>
                                    ))}
                                </tr>
                                <tr>
                                    <td className="border border-gray-400 p-2 font-bold text-center text-xs">Key</td>
                                    {flatProcessedQuestions?.map((q, idx) => (
                                        <td key={idx} className="border border-gray-400 p-2 font-black text-center text-sm text-green-700"><MathRenderer inline={true} text={q.answer} /></td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>

                        {/* Step by Step Solutions */}
                        <h4 className="font-bold text-base uppercase tracking-wider mb-6 pb-1 border-b-2 border-black">II. Detailed Step-by-Step Solutions</h4>
                        <div className="space-y-8">
                            {flatProcessedQuestions?.map((q, idx) => (
                                <div key={idx} className="pb-6 border-b border-gray-200">
                                    <div className="font-bold text-base text-gray-900 mb-2">Q.{idx + 1} Solution:</div>
                                    <MathRenderer className="font-medium text-gray-700 mb-2 text-sm" text={q.questionText} />
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-800 leading-relaxed whitespace-pre-wrap font-sans">
                                        <strong>Explanation:</strong><br />
                                        {q.solutionText ? (
                                            <MathRenderer text={q.solutionText} />
                                        ) : (
                                            <span className="italic text-gray-400">No explanation provided.</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2 relative z-10">
                        {selectedPaper.pattern && selectedPaper.pattern.length > 0 ? (
                            processedSections.map((secData, secIdx) => {
                                const sec = secData.section;
                                const sectionQuestions = secData.questions;
                                if (sectionQuestions.length === 0) return null;

                                return (
                                    <div key={secIdx} className="mb-10">
                                        <div className="border-b-2 border-black pb-2 mb-6 text-base font-bold flex justify-between uppercase tracking-wide">
                                            <span>{sec.sectionName} ({sec.type || 'MCQ'})</span>
                                            <span>{sec.description || 'Answer all questions'}</span>
                                        </div>
                                        <div className="space-y-8">
                                            {sectionQuestions.map((q, idx) => (
                                                <div key={q._id} className="text-gray-900 relative">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-start flex-1 pr-4">
                                                            <span className="font-bold mr-3 whitespace-nowrap text-base">{idx + 1}.</span>
                                                            <div className="flex-1">
                                                                <div style={{ display: 'grid', gridTemplateColumns: bilingualMode ? '1fr 1fr' : '1fr', gap: '20px' }}>
                                                                    <div>
                                                                        <MathRenderer className="whitespace-pre-wrap text-justify text-base leading-relaxed" text={q.questionText} />
                                                                    </div>
                                                                    {bilingualMode && (
                                                                        <div style={{ borderLeft: '1.5px dashed #ccc', paddingLeft: '20px' }}>
                                                                            <MathRenderer className="whitespace-pre-wrap text-justify text-base leading-relaxed text-slate-800 font-sans italic" text={q.questionTextTranslation || '<span class="text-xs text-slate-400 font-sans">[No Translation]</span>'} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {q.imageUrl && (
                                                                    <div className="mt-4 mb-3 flex justify-center w-full">
                                                                        <img src={q.imageUrl} alt="Diagram" className="max-w-full max-h-64 object-contain rounded-lg shadow-sm" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <span className="font-bold whitespace-nowrap text-base">[{formatMarks(q.type)}]</span>
                                                    </div>
                                                    {q.type === 'MCQ' && q.options && (
                                                        <div className={`grid ${getOptionsGridClass(q.options)} mt-5 ml-8 text-base`}>
                                                            {q.options.map((opt, i) => (
                                                                <div key={i} className="flex flex-wrap items-baseline">
                                                                    <span className="mr-3 font-semibold">{String.fromCharCode(65+i)})</span>
                                                                    <MathRenderer inline={true} text={opt} />
                                                                    {bilingualMode && q.optionsTranslation?.[i] && (
                                                                        <span className="text-gray-500 font-sans text-xs ml-2 italic">
                                                                            / {q.optionsTranslation[i]}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    {showAnswerKey && (
                                                        <QuestionSolution 
                                                            q={q} 
                                                            onGenerateSolution={handleGenerateSolution} 
                                                            isGenerating={generatingSolutions[q._id]} 
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            flatProcessedQuestions.map((q, idx) => (
                                <div key={q._id} className="text-gray-900 mb-8">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-start flex-1 pr-4">
                                            <span className="font-bold mr-3 whitespace-nowrap text-base">{idx + 1}.</span>
                                            <div className="flex-1">
                                                <div style={{ display: 'grid', gridTemplateColumns: bilingualMode ? '1fr 1fr' : '1fr', gap: '20px' }}>
                                                    <div>
                                                        <MathRenderer className="whitespace-pre-wrap text-justify text-base leading-relaxed" text={q.questionText} />
                                                    </div>
                                                    {bilingualMode && (
                                                        <div style={{ borderLeft: '1.5px dashed #ccc', paddingLeft: '20px' }}>
                                                            <MathRenderer className="whitespace-pre-wrap text-justify text-base leading-relaxed text-slate-800 font-sans italic" text={q.questionTextTranslation || '<span class="text-xs text-slate-400 font-sans">[No Translation]</span>'} />
                                                        </div>
                                                    )}
                                                </div>
                                                {q.imageUrl && (
                                                    <div className="mt-4 mb-3 flex justify-center w-full">
                                                        <img src={q.imageUrl} alt="Diagram" className="max-w-full max-h-64 object-contain rounded-lg shadow-sm" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <span className="font-bold whitespace-nowrap text-base">[{formatMarks(q.type)}]</span>
                                    </div>
                                    {q.type === 'MCQ' && q.options && (
                                        <div className={`grid ${getOptionsGridClass(q.options)} mt-5 ml-8 text-base`}>
                                            {q.options.map((opt, i) => (
                                                <div key={i} className="flex flex-wrap items-baseline">
                                                    <span className="mr-3 font-semibold">{String.fromCharCode(65+i)})</span>
                                                    <MathRenderer inline={true} text={opt} />
                                                    {bilingualMode && q.optionsTranslation?.[i] && (
                                                        <span className="text-gray-500 font-sans text-xs ml-2 italic">
                                                            / {q.optionsTranslation[i]}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {showAnswerKey && (
                                        <QuestionSolution 
                                            q={q} 
                                            onGenerateSolution={handleGenerateSolution} 
                                            isGenerating={generatingSolutions[q._id]} 
                                        />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
                
                <div className="text-center font-bold border-t-2 border-black pt-6 mt-16 text-base tracking-widest">
                    *** END OF PAPER ***
                    {activeTemplate?.footerText && (
                        <div className="mt-4 text-xs font-medium text-gray-500 tracking-normal uppercase">
                            {activeTemplate.footerText}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .print-area, .print-area * { visibility: visible; }
                    .print-area { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 100%; 
                        box-shadow: none !important; 
                        border: none !important; 
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .no-print { display: none !important; }
                    @page { margin: 20mm; }
                }
            `}</style>
        </div>
    );
};

const QuestionSolution = ({ q, onGenerateSolution, isGenerating }) => {
    return (
        <div className="mt-5 p-5 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-sm no-print font-sans">
            <div className="font-black text-indigo-900 mb-3 flex items-center gap-2 text-base">
                <span>💡</span> Scheme of Evaluation & Hint
            </div>
            {q.answer && (
                <div className="mb-3 text-base">
                    <strong className="text-gray-700">Correct Answer / Key:</strong> <MathRenderer inline={true} className="text-green-700 font-extrabold ml-1 bg-green-50 px-2 py-0.5 rounded border border-green-200" text={q.answer} />
                </div>
            )}
            {q.solutionText ? (
                <MathRenderer className="text-gray-800 text-base whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-xl border border-gray-100 shadow-sm" text={q.solutionText} />
            ) : (
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <span className="text-gray-500 italic block text-base">No detailed solution has been added for this question yet.</span>
                </div>
            )}
            {q.solutionImageUrl && (
                <div className="mt-4">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Diagrammatic Solution</div>
                    <img src={q.solutionImageUrl} alt="Solution Diagram" className="max-h-56 rounded-xl border border-gray-200 object-contain shadow-sm bg-white p-2" />
                </div>
            )}
        </div>
    );
};

export default AdminPaperPreview;
