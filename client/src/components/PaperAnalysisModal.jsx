import React, { useState, useMemo } from 'react';

/**
 * PaperAnalysisModal.jsx
 *
 * Professional academic analytics dashboard and printable report for question papers.
 * Renders:
 * 1. Subject-wise Difficulty Level Analysis (Table, Bar Chart, Donut Charts)
 * 2. Class-wise Question Distribution (Table, Grouped Bar Chart, Donut Charts)
 * 3. Question Type Analysis (Table, Multi-bar Chart, Donut Charts, Matrix)
 */

// Helper to draw clean SVG Donut Segments
const DonutChart = ({ data, size = 160, holeRadius = 45, title = '' }) => {
    const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
    if (total === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-4">
                <div className="w-24 h-24 rounded-full border-4 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 font-bold">
                    No Data
                </div>
                {title && <span className="text-xs font-bold text-gray-700 mt-2">{title}</span>}
            </div>
        );
    }

    const radius = size / 2 - 10;
    const center = size / 2;

    let cumulativeAngle = 0;
    const slices = data.map((d) => {
        const fraction = d.value / total;
        const angle = fraction * 360;
        const startAngle = cumulativeAngle;
        const endAngle = cumulativeAngle + angle;
        cumulativeAngle += angle;

        const startRad = ((startAngle - 90) * Math.PI) / 180;
        const endRad = ((endAngle - 90) * Math.PI) / 180;

        const x1 = center + radius * Math.cos(startRad);
        const y1 = center + radius * Math.sin(startRad);
        const x2 = center + radius * Math.cos(endRad);
        const y2 = center + radius * Math.sin(endRad);

        const x3 = center + holeRadius * Math.cos(endRad);
        const y3 = center + holeRadius * Math.sin(endRad);
        const x4 = center + holeRadius * Math.cos(startRad);
        const y4 = center + holeRadius * Math.sin(startRad);

        const largeArc = angle > 180 ? 1 : 0;

        const pathData = [
            `M ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            `L ${x3} ${y3}`,
            `A ${holeRadius} ${holeRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
            'Z'
        ].join(' ');

        const pct = Math.round(fraction * 1000) / 10;

        return {
            ...d,
            pathData,
            pct,
            midAngle: startAngle + angle / 2
        };
    });

    return (
        <div className="flex flex-col items-center">
            {title && <h5 className="text-base font-black text-gray-700 mb-2">{title}</h5>}
            <div className="relative flex items-center justify-center">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-md">
                    {slices.map((s, idx) => (
                        <path
                            key={idx}
                            d={s.pathData}
                            fill={s.color}
                            stroke="#ffffff"
                            strokeWidth="2"
                            className="transition-transform duration-300 hover:opacity-90 cursor-pointer"
                        >
                            <title>{`${s.label}: ${s.value} Qs (${s.pct}%)`}</title>
                        </path>
                    ))}
                    <circle cx={center} cy={center} r={holeRadius} fill="#ffffff" />
                </svg>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                {slices.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-[11px] font-bold text-gray-600">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: s.color }}></span>
                        <span>{s.label}: {s.pct}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Bar chart component
const GroupedBarChart = ({ categories, series, height = 180 }) => {
    let maxVal = 1;
    categories.forEach((_, cIdx) => {
        series.forEach((s) => {
            const v = s.data[cIdx] || 0;
            if (v > maxVal) maxVal = v;
        });
    });
    maxVal = Math.ceil(maxVal * 1.15);

    return (
        <div className="w-full bg-white p-4 rounded-2xl border border-gray-200">
            <div className="flex justify-center items-center gap-6 mb-4">
                {series.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: s.color }}></span>
                        <span>{s.name}</span>
                    </div>
                ))}
            </div>

            <div className="flex items-end justify-around gap-4" style={{ height: `${height}px` }}>
                {categories.map((cat, cIdx) => (
                    <div key={cIdx} className="flex-1 flex flex-col items-center h-full justify-end">
                        <div className="flex items-end justify-center gap-1.5 w-full h-[85%] border-b border-gray-300 pb-1">
                            {series.map((s, sIdx) => {
                                const val = s.data[cIdx] || 0;
                                const pctHeight = Math.max(4, Math.round((val / maxVal) * 100));
                                return (
                                    <div key={sIdx} className="flex-1 max-w-[22px] flex flex-col items-center h-full justify-end group relative">
                                        <span className="text-[9px] font-black text-gray-600 mb-0.5 opacity-0 group-hover:opacity-100 transition">{val}</span>
                                        <div
                                            style={{ height: `${pctHeight}%`, backgroundColor: s.color }}
                                            className="w-full rounded-t transition-all duration-500 shadow-sm"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <span className="text-[11px] font-bold text-gray-700 mt-2 truncate max-w-[70px] text-center">{cat}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PaperAnalysisModal = ({ isOpen, onClose, paperTitle = 'NEET 2025 Question Paper', questions = [], examType = 'NEET' }) => {
    const [activeTab, setActiveTab] = useState('difficulty');

    const subjects = useMemo(() => {
        if (examType === 'NEET') return ['Physics', 'Chemistry', 'Botany', 'Zoology'];
        if (examType === 'JEE') return ['Physics', 'Chemistry', 'Mathematics'];
        if (examType === 'CET') return ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
        return ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
    }, [examType]);

    const matchSubject = (qSubject) => {
        if (!qSubject) return subjects[0];
        const qs = qSubject.toLowerCase().trim();
        for (const s of subjects) {
            const sl = s.toLowerCase();
            if (qs.includes(sl) || sl.includes(qs)) return s;
            if (sl.includes('math') && qs.includes('math')) return s;
            if (sl.includes('bio') && (qs.includes('bio') || qs.includes('bot') || qs.includes('zoo'))) return s;
        }
        return subjects[0];
    };

    // 1. Difficulty Level Breakdown (100% genuine data, 0 fake fallback)
    const diffData = useMemo(() => {
        const result = {};
        subjects.forEach(s => {
            result[s] = { easy: 0, medium: 0, hard: 0, total: 0 };
        });

        questions.forEach(q => {
            const sub = matchSubject(q.subject);
            const lvl = (q.level || 'medium').toLowerCase();
            if (result[sub]) {
                if (lvl === 'easy') result[sub].easy += 1;
                else if (lvl === 'hard') result[sub].hard += 1;
                else result[sub].medium += 1;
                result[sub].total += 1;
            }
        });

        const grand = { easy: 0, medium: 0, hard: 0, total: 0 };
        subjects.forEach(s => {
            const subObj = result[s];
            grand.easy += subObj.easy;
            grand.medium += subObj.medium;
            grand.hard += subObj.hard;
            grand.total += subObj.total;
        });

        return { subjects: result, grand };
    }, [questions, subjects]);

    // 2. Class-Wise Question Distribution (100% genuine data)
    const classData = useMemo(() => {
        const result = {};
        subjects.forEach(s => {
            result[s] = { class11: 0, class12: 0, total: 0 };
        });

        questions.forEach(q => {
            const sub = matchSubject(q.subject);
            const cls = String(q.classes?.[0] || q.class || (Array.isArray(q.classes) ? q.classes.join(' ') : '') || '12');
            if (result[sub]) {
                if (cls.includes('11')) result[sub].class11 += 1;
                else result[sub].class12 += 1;
                result[sub].total += 1;
            }
        });

        const grand = { class11: 0, class12: 0, total: 0 };
        subjects.forEach(s => {
            const subObj = result[s];
            grand.class11 += subObj.class11;
            grand.class12 += subObj.class12;
            grand.total += subObj.total;
        });

        return { subjects: result, grand };
    }, [questions, subjects]);

    // 3. Question Type Breakdown (100% genuine data)
    const typeData = useMemo(() => {
        const result = {};
        subjects.forEach(s => {
            result[s] = { single: 0, stmt: 0, multi: 0, assertion: 0, match: 0, diagram: 0, total: 0 };
        });

        questions.forEach(q => {
            const sub = matchSubject(q.subject);
            const t = (q.type || 'MCQ').toUpperCase();
            if (result[sub]) {
                if (t.includes('ASSERTION')) result[sub].assertion += 1;
                else if (t.includes('MATCH')) result[sub].match += 1;
                else if (t.includes('DIAGRAM') || t.includes('IMAGE') || t.includes('NUMERICAL')) result[sub].diagram += 1;
                else if (t.includes('STATEMENT') || t.includes('STMT')) result[sub].stmt += 1;
                else result[sub].single += 1;
                result[sub].total += 1;
            }
        });

        const grand = { single: 0, stmt: 0, multi: 0, assertion: 0, match: 0, diagram: 0, total: 0 };
        subjects.forEach(s => {
            const subObj = result[s];
            grand.single += subObj.single;
            grand.stmt += subObj.stmt;
            grand.multi += subObj.multi;
            grand.assertion += subObj.assertion;
            grand.match += subObj.match;
            grand.diagram += subObj.diagram;
            grand.total += subObj.total;
        });

        return { subjects: result, grand };
    }, [questions, subjects]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-navy/80 flex items-center justify-center z-50 backdrop-blur-md p-4 overflow-y-auto print:p-0 print:bg-white animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col border-b-8 border-gold overflow-hidden my-auto print:border-none print:shadow-none print:max-h-full">
                
                {/* Modal Navigation Top Bar */}
                <div className="flex justify-between items-center px-8 py-5 border-b border-gray-200 bg-gray-50/80 no-print">
                    <div className="flex items-center gap-3">
                        <span className="bg-navy text-gold w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow">📊</span>
                        <div>
                            <h2 className="text-xl font-black text-navy uppercase tracking-tight">Institutional Paper Analysis</h2>
                            <p className="text-[11px] font-bold text-gray-500">{paperTitle} • {questions.length} Total Questions</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Section Tabs */}
                        <div className="flex bg-gray-200 p-1 rounded-xl">
                            <button
                                onClick={() => setActiveTab('difficulty')}
                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition ${activeTab === 'difficulty' ? 'bg-navy text-gold shadow' : 'text-gray-600 hover:text-navy'}`}
                            >
                                1. Difficulty Level
                            </button>
                            <button
                                onClick={() => setActiveTab('class')}
                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition ${activeTab === 'class' ? 'bg-navy text-gold shadow' : 'text-gray-600 hover:text-navy'}`}
                            >
                                2. Class Distribution
                            </button>
                            <button
                                onClick={() => setActiveTab('types')}
                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition ${activeTab === 'types' ? 'bg-navy text-gold shadow' : 'text-gray-600 hover:text-navy'}`}
                            >
                                3. Question Types
                            </button>
                        </div>

                        <button
                            onClick={() => window.print()}
                            className="bg-gold text-navy px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition shadow flex items-center gap-1.5 cursor-pointer"
                        >
                            <span>🖨</span> Download / Print PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="bg-gray-100 hover:bg-red-500 hover:text-white w-9 h-9 rounded-full flex items-center justify-center font-black transition"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Printable Content Body */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 print:p-0">

                    {/* Banner Title Box matching Reference Image 1 */}
                    <div className="bg-blue-100 border-2 border-blue-400 p-3 rounded-lg text-center shadow-sm">
                        <h1 className="text-2xl font-black text-navy uppercase tracking-wide">
                            Analysis of {paperTitle}
                        </h1>
                    </div>

                    {/* SECTION 1: DIFFICULTY LEVEL ANALYSIS */}
                    {(activeTab === 'difficulty' || window.matchMedia('print').matches) && (
                        <div className="space-y-6">
                            
                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse border border-gray-400 text-center text-xs font-bold">
                                    <thead>
                                        <tr className="bg-amber-100 border-b border-gray-400">
                                            <th colSpan="5" className="p-2 text-sm font-black text-navy uppercase tracking-wider">
                                                Subject-wise Difficulty Level Analysis
                                            </th>
                                        </tr>
                                        <tr className="bg-purple-200 border-b border-gray-400 text-purple-950 font-black">
                                            <th className="p-2 border-r border-gray-400 text-left pl-4">Subject</th>
                                            <th className="p-2 border-r border-gray-400">Easy</th>
                                            <th className="p-2 border-r border-gray-400">Medium</th>
                                            <th className="p-2 border-r border-gray-400">Hard</th>
                                            <th className="p-2">Grand Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subjects.map((sub, idx) => {
                                            const row = diffData.subjects[sub] || { easy: 0, medium: 0, hard: 0, total: 0 };
                                            return (
                                                <tr key={sub} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="p-2 border border-gray-300 text-left pl-4 font-black text-navy">{sub}</td>
                                                    <td className="p-2 border border-gray-300 text-emerald-700">{row.easy}</td>
                                                    <td className="p-2 border border-gray-300 text-amber-700">{row.medium}</td>
                                                    <td className="p-2 border border-gray-300 text-rose-700">{row.hard}</td>
                                                    <td className="p-2 border border-gray-300 font-black text-navy">{row.total}</td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="bg-purple-100 font-black text-navy border-t-2 border-gray-400">
                                            <td className="p-2 border border-gray-400 text-left pl-4">Overall Difficulty Level Analysis</td>
                                            <td className="p-2 border border-gray-400 text-emerald-800">{diffData.grand.easy}</td>
                                            <td className="p-2 border border-gray-400 text-amber-800">{diffData.grand.medium}</td>
                                            <td className="p-2 border border-gray-400 text-rose-800">{diffData.grand.hard}</td>
                                            <td className="p-2 border border-gray-400 font-black">{diffData.grand.total}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Top 2 Visuals */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                <div>
                                    <h4 className="text-center font-black text-gray-700 text-sm mb-2">Subject Wise Analysis</h4>
                                    <GroupedBarChart
                                        categories={subjects}
                                        series={[
                                            { name: 'Easy', color: '#16a34a', data: subjects.map(s => diffData.subjects[s]?.easy || 0) },
                                            { name: 'Medium', color: '#eab308', data: subjects.map(s => diffData.subjects[s]?.medium || 0) },
                                            { name: 'Hard', color: '#dc2626', data: subjects.map(s => diffData.subjects[s]?.hard || 0) },
                                        ]}
                                    />
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col items-center">
                                    <DonutChart
                                        title="Overall Difficulty Analysis"
                                        data={[
                                            { label: 'Easy', value: diffData.grand.easy, color: '#16a34a' },
                                            { label: 'Medium', value: diffData.grand.medium, color: '#eab308' },
                                            { label: 'Hard', value: diffData.grand.hard, color: '#dc2626' },
                                        ]}
                                    />
                                </div>
                            </div>

                            {/* Per-Subject 4 Donut Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                                {subjects.map(s => {
                                    const d = diffData.subjects[s] || { easy: 0, medium: 0, hard: 0 };
                                    return (
                                        <div key={s} className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200 flex flex-col items-center">
                                            <DonutChart
                                                title={s}
                                                size={140}
                                                holeRadius={38}
                                                data={[
                                                    { label: 'Easy', value: d.easy, color: '#16a34a' },
                                                    { label: 'Medium', value: d.medium, color: '#eab308' },
                                                    { label: 'Hard', value: d.hard, color: '#dc2626' },
                                                ]}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* SECTION 2: CLASS-WISE QUESTION DISTRIBUTION */}
                    {(activeTab === 'class' || window.matchMedia('print').matches) && (
                        <div className="space-y-6">
                            
                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse border border-gray-400 text-center text-xs font-bold">
                                    <thead>
                                        <tr className="bg-amber-100 border-b border-gray-400">
                                            <th colSpan="5" className="p-2 text-sm font-black text-navy uppercase tracking-wider">
                                                Class-wise Question Distribution
                                            </th>
                                        </tr>
                                        <tr className="bg-purple-200 border-b border-gray-400 text-purple-950 font-black">
                                            <th className="p-2 border-r border-gray-400 text-left pl-4">Subject</th>
                                            <th className="p-2 border-r border-gray-400">Class 11th</th>
                                            <th className="p-2 border-r border-gray-400">Class 12th</th>
                                            <th className="p-2 border-r border-gray-400">11th %age</th>
                                            <th className="p-2">12th %age</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subjects.map((sub, idx) => {
                                            const row = classData.subjects[sub] || { class11: 0, class12: 0, total: 1 };
                                            const pct11 = Math.round((row.class11 / (row.total || 1)) * 100);
                                            const pct12 = 100 - pct11;
                                            return (
                                                <tr key={sub} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="p-2 border border-gray-300 text-left pl-4 font-black text-navy">{sub}</td>
                                                    <td className="p-2 border border-gray-300 text-blue-700">{row.class11}</td>
                                                    <td className="p-2 border border-gray-300 text-red-700">{row.class12}</td>
                                                    <td className="p-2 border border-gray-300 font-bold">{pct11}%</td>
                                                    <td className="p-2 border border-gray-300 font-bold">{pct12}%</td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="bg-purple-100 font-black text-navy border-t-2 border-gray-400">
                                            <td className="p-2 border border-gray-400 text-left pl-4">Class-wise Question Distribution</td>
                                            <td className="p-2 border border-gray-400 text-blue-800">{classData.grand.class11}</td>
                                            <td className="p-2 border border-gray-400 text-red-800">{classData.grand.class12}</td>
                                            <td className="p-2 border border-gray-400">{Math.round((classData.grand.class11 / (classData.grand.total || 1)) * 100)}%</td>
                                            <td className="p-2 border border-gray-400">{Math.round((classData.grand.class12 / (classData.grand.total || 1)) * 100)}%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Top 2 Visuals */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                <div>
                                    <h4 className="text-center font-black text-gray-700 text-sm mb-2">Class-wise Analysis</h4>
                                    <GroupedBarChart
                                        categories={subjects}
                                        series={[
                                            { name: '11th', color: '#2563eb', data: subjects.map(s => classData.subjects[s]?.class11 || 0) },
                                            { name: '12th', color: '#dc2626', data: subjects.map(s => classData.subjects[s]?.class12 || 0) },
                                        ]}
                                    />
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col items-center">
                                    <DonutChart
                                        title="Overall Class-wise Analysis"
                                        data={[
                                            { label: '11th', value: classData.grand.class11, color: '#2563eb' },
                                            { label: '12th', value: classData.grand.class12, color: '#dc2626' },
                                        ]}
                                    />
                                </div>
                            </div>

                            {/* Per-Subject 4 Donut Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                                {subjects.map(s => {
                                    const d = classData.subjects[s] || { class11: 0, class12: 0 };
                                    return (
                                        <div key={s} className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200 flex flex-col items-center">
                                            <DonutChart
                                                title={s}
                                                size={140}
                                                holeRadius={38}
                                                data={[
                                                    { label: '11th', value: d.class11, color: '#2563eb' },
                                                    { label: '12th', value: d.class12, color: '#dc2626' },
                                                ]}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* SECTION 3: QUESTION TYPE ANALYSIS */}
                    {(activeTab === 'types' || window.matchMedia('print').matches) && (
                        <div className="space-y-6">
                            
                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse border border-gray-400 text-center text-[11px] font-bold">
                                    <thead>
                                        <tr className="bg-amber-100 border-b border-gray-400">
                                            <th colSpan="8" className="p-2 text-sm font-black text-navy uppercase tracking-wider">
                                                Question Type Analysis ({paperTitle})
                                            </th>
                                        </tr>
                                        <tr className="bg-blue-100 border-b border-gray-400 text-navy font-black">
                                            <th className="p-2 border-r border-gray-400 text-left pl-3">Subject</th>
                                            <th className="p-2 border-r border-gray-400">Single Choice (MCQ)</th>
                                            <th className="p-2 border-r border-gray-400">Statement I & II</th>
                                            <th className="p-2 border-r border-gray-400">Multi-Statement Based</th>
                                            <th className="p-2 border-r border-gray-400">Assertion & Reason</th>
                                            <th className="p-2 border-r border-gray-400">Match the column</th>
                                            <th className="p-2 border-r border-gray-400">Diagram Based</th>
                                            <th className="p-2">Grand Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subjects.map((sub, idx) => {
                                            const r = typeData.subjects[sub] || { single: 0, stmt: 0, multi: 0, assertion: 0, match: 0, diagram: 0, total: 0 };
                                            return (
                                                <tr key={sub} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="p-2 border border-gray-300 text-left pl-3 font-black text-navy">{sub}</td>
                                                    <td className="p-2 border border-gray-300">{r.single}</td>
                                                    <td className="p-2 border border-gray-300">{r.stmt}</td>
                                                    <td className="p-2 border border-gray-300">{r.multi}</td>
                                                    <td className="p-2 border border-gray-300">{r.assertion}</td>
                                                    <td className="p-2 border border-gray-300">{r.match}</td>
                                                    <td className="p-2 border border-gray-300">{r.diagram}</td>
                                                    <td className="p-2 border border-gray-300 font-black text-navy">{r.total}</td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="bg-blue-50 font-black text-navy border-t-2 border-gray-400">
                                            <td className="p-2 border border-gray-400 text-left pl-3">Total</td>
                                            <td className="p-2 border border-gray-400">{typeData.grand.single}</td>
                                            <td className="p-2 border border-gray-400">{typeData.grand.stmt}</td>
                                            <td className="p-2 border border-gray-400">{typeData.grand.multi}</td>
                                            <td className="p-2 border border-gray-400">{typeData.grand.assertion}</td>
                                            <td className="p-2 border border-gray-400">{typeData.grand.match}</td>
                                            <td className="p-2 border border-gray-400">{typeData.grand.diagram}</td>
                                            <td className="p-2 border border-gray-400 font-black">{typeData.grand.total}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Top Visuals */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                <div>
                                    <h4 className="text-center font-black text-gray-700 text-sm mb-2">Question Type Analysis</h4>
                                    <GroupedBarChart
                                        categories={subjects}
                                        series={[
                                            { name: 'MCQ', color: '#2563eb', data: subjects.map(s => typeData.subjects[s]?.single || 0) },
                                            { name: 'Statement', color: '#dc2626', data: subjects.map(s => typeData.subjects[s]?.stmt || 0) },
                                            { name: 'Match', color: '#eab308', data: subjects.map(s => typeData.subjects[s]?.match || 0) },
                                            { name: 'Assertion', color: '#16a34a', data: subjects.map(s => typeData.subjects[s]?.assertion || 0) },
                                        ]}
                                    />
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col items-center">
                                    <DonutChart
                                        title="Overall Question Type Analysis"
                                        data={[
                                            { label: 'MCQ', value: typeData.grand.single, color: '#2563eb' },
                                            { label: 'Statement', value: typeData.grand.stmt + typeData.grand.multi, color: '#ea580c' },
                                            { label: 'Assertion', value: typeData.grand.assertion, color: '#eab308' },
                                            { label: 'Match', value: typeData.grand.match, color: '#16a34a' },
                                            { label: 'Diagram', value: typeData.grand.diagram, color: '#06b6d4' },
                                        ]}
                                    />
                                </div>
                            </div>

                            {/* Per-Subject 4 Donut Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                                {subjects.map(s => {
                                    const d = typeData.subjects[s] || { single: 0, stmt: 0, assertion: 0, match: 0, diagram: 0 };
                                    return (
                                        <div key={s} className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200 flex flex-col items-center">
                                            <DonutChart
                                                title={s}
                                                size={140}
                                                holeRadius={38}
                                                data={[
                                                    { label: 'MCQ', value: d.single, color: '#2563eb' },
                                                    { label: 'Statement', value: d.stmt + d.multi, color: '#ea580c' },
                                                    { label: 'Assertion', value: d.assertion, color: '#eab308' },
                                                    { label: 'Match', value: d.match, color: '#16a34a' },
                                                    { label: 'Diagram', value: d.diagram, color: '#06b6d4' },
                                                ]}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50/80 no-print">
                    <div className="text-xs font-bold text-gray-500">
                        Academic Audit & Blueprint Compliance System • Manchester College
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="bg-navy text-gold px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow"
                        >
                            Close Analysis
                        </button>
                    </div>
                </div>
            </div>
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                }
            `}</style>
        </div>
    );
};

export default PaperAnalysisModal;