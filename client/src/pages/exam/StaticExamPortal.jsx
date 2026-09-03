import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';

export default function StaticExamPortal() {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Student Candidate Profile
    const savedStudent = JSON.parse(localStorage.getItem('student_info') || '{}');
    const [candidateName, setCandidateName] = useState(savedStudent.studentName || '');
    const [candidateRoll, setCandidateRoll] = useState(savedStudent.rollNumber || '');
    const [candidateSection, setCandidateSection] = useState(savedStudent.section || 'A');
    const [showProfileEdit, setShowProfileEdit] = useState(!savedStudent.studentName);

    // Filter & Search state
    const [filterType, setFilterType] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [directCode, setDirectCode] = useState('');

    const fetchLiveExams = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/api/exams/public/live');
            setExams(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching live exams:', err);
            setError('Failed to connect to the online examination server. Please check your internet connection.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLiveExams();
        const timer = setInterval(fetchLiveExams, 30000);
        return () => clearInterval(timer);
    }, []);

    const saveCandidateInfo = () => {
        const name = candidateName.trim() || 'Candidate';
        const roll = candidateRoll.trim() || `STU-${Math.floor(1000 + Math.random() * 9000)}`;
        const section = candidateSection.trim() || 'A';

        const info = {
            studentName: name,
            rollNumber: roll,
            section: section
        };
        localStorage.setItem('student_info', JSON.stringify(info));
        setShowProfileEdit(false);
        return info;
    };

    const handleLaunchExam = (examId) => {
        if (!candidateName.trim() || !candidateRoll.trim()) {
            setShowProfileEdit(true);
            alert('Please enter your Name and Roll Number before entering the examination.');
            return;
        }
        saveCandidateInfo();
        navigate(`/exam/${examId}/instructions`);
    };

    const handleDirectCodeSubmit = (e) => {
        e.preventDefault();
        const code = directCode.trim();
        if (!code) return;

        const matched = exams.find(e => 
            e._id === code || 
            e._id.slice(-6).toLowerCase() === code.toLowerCase() ||
            e.title.toLowerCase().includes(code.toLowerCase())
        );

        if (matched) {
            handleLaunchExam(matched._id);
        } else {
            handleLaunchExam(code);
        }
    };

    const liveExams = exams.filter(e => e.status === 'live');
    const scheduledExams = exams.filter(e => e.status === 'scheduled');

    const filteredExams = exams.filter(e => {
        if (filterType !== 'ALL' && e.examType !== filterType) return false;
        if (searchTerm.trim() && !e.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    const activeFeaturedExam = liveExams[0] || scheduledExams[0];

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col selection:bg-gold selection:text-navy">
            {/* Top Bar */}
            <header className="bg-navy text-white shadow-xl border-b-4 border-gold sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center border-2 border-gold/40">
                            <img src="/ManchesterLogo.jpeg" alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black bg-gold text-navy px-2 py-0.5 rounded tracking-wider uppercase">
                                    Official CBT Hub
                                </span>
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                    Live Portal
                                </span>
                            </div>
                            <h1 className="text-lg font-black tracking-tight text-white uppercase mt-0.5">
                                Manchester College Examination Portal
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 hover:bg-white/15 transition border border-white/20 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-inner">
                            <div className="w-8 h-8 rounded-xl bg-gold text-navy font-black flex items-center justify-center text-sm shadow">
                                {(candidateName || 'S')[0].toUpperCase()}
                            </div>
                            <div className="text-left">
                                <div className="text-xs font-black text-white leading-tight flex items-center gap-2">
                                    {candidateName || 'Guest Candidate'}
                                    <button
                                        onClick={() => setShowProfileEdit(!showProfileEdit)}
                                        className="text-[10px] text-gold hover:underline font-bold cursor-pointer"
                                    >
                                        [Edit]
                                    </button>
                                </div>
                                <div className="text-[10px] text-slate-300 font-mono">
                                    Roll: {candidateRoll || 'Not Set'} • Sec: {candidateSection}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={fetchLiveExams}
                            title="Refresh active exam list"
                            className="bg-white/10 hover:bg-gold hover:text-navy text-white p-2.5 rounded-xl transition border border-white/20 text-sm cursor-pointer"
                        >
                            🔄
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8 animate-fade-in">
                {showProfileEdit && (
                    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-l-8 border-gold border border-gray-200">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <span className="text-[10px] font-black text-navy uppercase tracking-widest bg-amber-100 px-3 py-1 rounded-full">
                                    Candidate Identification
                                </span>
                                <h2 className="text-xl font-black text-navy mt-1">Enter Your Student Credentials</h2>
                                <p className="text-xs text-gray-500 font-medium">
                                    Your Name and Roll Number will be attached to your examination scorecard and assessment records.
                                </p>
                            </div>
                            {candidateName && candidateRoll && (
                                <button
                                    onClick={() => setShowProfileEdit(false)}
                                    className="text-gray-400 hover:text-gray-600 font-black text-sm cursor-pointer"
                                >
                                    ✕ Close
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[11px] font-black text-navy uppercase tracking-wider mb-1.5">
                                    Full Name *
                                </label>
                                <input
                                    type="text"
                                    value={candidateName}
                                    onChange={e => setCandidateName(e.target.value)}
                                    placeholder="e.g. Rahul Sharma"
                                    className="w-full bg-slate-50 border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-xs font-bold text-navy outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-navy uppercase tracking-wider mb-1.5">
                                    Roll Number / Student ID *
                                </label>
                                <input
                                    type="text"
                                    value={candidateRoll}
                                    onChange={e => setCandidateRoll(e.target.value)}
                                    placeholder="e.g. 2026-PCMB-042"
                                    className="w-full bg-slate-50 border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-xs font-mono font-bold text-navy outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-navy uppercase tracking-wider mb-1.5">
                                    Section / Batch
                                </label>
                                <input
                                    type="text"
                                    value={candidateSection}
                                    onChange={e => setCandidateSection(e.target.value)}
                                    placeholder="e.g. A, B, PUC-2"
                                    className="w-full bg-slate-50 border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-xs font-bold text-navy outline-none"
                                />
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end gap-3">
                            <button
                                onClick={saveCandidateInfo}
                                className="bg-navy text-gold px-7 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg cursor-pointer"
                            >
                                ✓ Save & Continue to Exams
                            </button>
                        </div>
                    </div>
                )}

                {activeFeaturedExam && (
                    <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-navy via-slate-900 to-navy text-white p-8 sm:p-10 shadow-2xl border-4 border-gold">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-gold/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className="bg-gold text-navy text-[11px] font-black uppercase px-3 py-1 rounded-full shadow">
                                        {activeFeaturedExam.status === 'live' ? '🔥 Active Examination' : '⏳ Scheduled Examination'}
                                    </span>
                                    <span className="bg-white/15 text-white text-[11px] font-black uppercase px-3 py-1 rounded-full border border-white/20">
                                        {activeFeaturedExam.examType} Standard
                                    </span>
                                    {activeFeaturedExam.classes?.length > 0 && (
                                        <span className="text-slate-300 text-xs font-bold">
                                            Class: {activeFeaturedExam.classes.join(', ')}
                                        </span>
                                    )}
                                </div>

                                <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white">
                                    {activeFeaturedExam.title}
                                </h2>

                                <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-2xl leading-relaxed">
                                    {activeFeaturedExam.instructions || 'Standard computerized assessment with automatic evaluation, multi-subject sections, negative marking, and detailed analytics report.'}
                                </p>

                                <div className="flex items-center gap-6 pt-2 text-xs font-bold text-slate-300 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <span className="text-gold text-base">⏱️</span>
                                        <span>Duration: <strong className="text-white">{activeFeaturedExam.duration_minutes} Mins</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gold text-base">📝</span>
                                        <span>Questions: <strong className="text-white">{activeFeaturedExam.questionsCount} Qs</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gold text-base">🛡️</span>
                                        <span>Security: <strong className="text-emerald-400">Proctored CBT</strong></span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-3 shrink-0">
                                <button
                                    onClick={() => handleLaunchExam(activeFeaturedExam._id)}
                                    className="bg-gold hover:bg-yellow-400 text-navy px-9 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all hover:scale-105 shadow-2xl flex items-center justify-center gap-3 border-2 border-white cursor-pointer"
                                >
                                    <span className="text-lg">⚡</span>
                                    <span>Enter Assessment Now</span>
                                </button>
                                <span className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-wider">
                                    Permanent Link • No Code Needed
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                        {['ALL', 'NEET', 'JEE', 'CET'].map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                                    filterType === type
                                        ? 'bg-navy text-gold shadow-md scale-105 border-2 border-gold'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {type === 'ALL' ? 'All Assessments' : type}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleDirectCodeSubmit} className="flex items-center gap-2 w-full md:w-auto">
                        <input
                            type="text"
                            value={directCode}
                            onChange={e => setDirectCode(e.target.value)}
                            placeholder="Enter Exam Code (e.g. 52B5)..."
                            className="bg-slate-50 border-2 border-gray-200 focus:border-navy rounded-xl px-4 py-2 text-xs font-bold text-navy outline-none w-full md:w-56"
                        />
                        <button
                            type="submit"
                            className="bg-navy text-gold px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:scale-105 transition shadow cursor-pointer whitespace-nowrap"
                        >
                            Go →
                        </button>
                    </form>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-black text-navy uppercase tracking-[0.2em] flex items-center gap-2">
                            <span>📚</span> Active &amp; Upcoming Examinations ({filteredExams.length})
                        </h3>
                        <span className="text-xs font-bold text-gray-400">
                            Updated real-time
                        </span>
                    </div>

                    {loading ? (
                        <div className="p-16 text-center text-gray-400 font-bold bg-white rounded-3xl border border-gray-200 space-y-3">
                            <div className="w-8 h-8 border-4 border-navy border-t-gold rounded-full animate-spin mx-auto"></div>
                            <p className="text-xs">Fetching active online examinations...</p>
                        </div>
                    ) : filteredExams.length === 0 ? (
                        <div className="p-12 text-center bg-white rounded-3xl border-2 border-dashed border-gray-200 space-y-3">
                            <div className="text-4xl">🎓</div>
                            <h4 className="font-black text-navy text-base">No Examinations Available Right Now</h4>
                            <p className="text-xs text-gray-500 max-w-md mx-auto">
                                There are no live assessments currently active for this filter. Please check your schedule or enter an Exam Access Code.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredExams.map(exam => {
                                const isLive = exam.status === 'live';
                                const isScheduled = exam.status === 'scheduled';

                                return (
                                    <div
                                        key={exam._id}
                                        className="bg-white rounded-3xl p-6 shadow-sm border-2 border-gray-100 hover:border-gold hover:shadow-xl transition-all flex flex-col justify-between group relative overflow-hidden"
                                    >
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                                                    isLive ? 'bg-emerald-100 text-emerald-800' : isScheduled ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {isLive ? '● Live Now' : isScheduled ? '⏳ Scheduled' : 'Completed'}
                                                </span>
                                                <span className="bg-navy text-gold text-[10px] font-black uppercase px-2.5 py-1 rounded-lg">
                                                    {exam.examType}
                                                </span>
                                            </div>

                                            <h4 className="text-lg font-black text-navy uppercase tracking-tight group-hover:text-gold transition">
                                                {exam.title}
                                            </h4>

                                            <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-gray-600 bg-slate-50 p-3 rounded-2xl border border-gray-100">
                                                <div>
                                                    <span className="text-gray-400 block text-[9px] uppercase">Duration</span>
                                                    <span>{exam.duration_minutes} Mins</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400 block text-[9px] uppercase">Questions</span>
                                                    <span>{exam.questionsCount} Questions</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                                            <span className="text-[10px] font-mono text-gray-400 uppercase">
                                                ID: {exam._id.slice(-6).toUpperCase()}
                                            </span>

                                            <button
                                                onClick={() => handleLaunchExam(exam._id)}
                                                className="bg-navy hover:bg-gold text-gold hover:text-navy px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                                            >
                                                <span>Enter</span>
                                                <span>→</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            <footer className="bg-navy text-white border-t-2 border-gold/30 p-6 text-center text-xs font-bold">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-slate-400">
                    <p>© {new Date().getFullYear()} Manchester College Examination System. All rights reserved.</p>
                    <p className="text-gold font-mono text-[11px]">Static Examination Hub • Universal Access</p>
                </div>
            </footer>
        </div>
    );
}

