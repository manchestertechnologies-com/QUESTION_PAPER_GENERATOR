import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import AddQuestion from './AddQuestion';
import SavedPapers from './SavedPapers';
import TemplateCart from './TemplateCart';
import GrandTestList from '../admin/GrandTestList';
import AssignmentGenerator from './AssignmentGenerator';
import api from '../../api';

const TeacherAssignmentsSection = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAssignments = async () => {
        try {
            const res = await api.get('/api/exams/my-assignments');
            const examList = Array.isArray(res.data) ? res.data : [];
            
            // Flatten assignments specifically relevant for this teacher
            const myAssignedList = [];
            examList.forEach(exam => {
                const subAssignments = Array.isArray(exam.subjectAssignments) ? exam.subjectAssignments : [];
                subAssignments.forEach(sa => {
                    const isMySub = (sa.subject || '').toLowerCase().trim() === (user?.subject || '').toLowerCase().trim() ||
                                   (sa.teacherId && String(sa.teacherId) === String(user?._id || user?.id));
                    if (isMySub) {
                        myAssignedList.push({
                            examId: exam._id,
                            examTitle: exam.title,
                            examType: exam.examType || 'CET',
                            subject: sa.subject,
                            targetQuestions: sa.targetQuestions || 60,
                            difficultyDistribution: sa.difficultyDistribution || { easy: 40, medium: 40, hard: 20 },
                            status: sa.status || 'Not Started',
                            submittedPaperId: sa.submittedPaperId?._id || sa.submittedPaperId,
                            assignedDate: sa.assignedDate || exam.createdAt,
                            instructions: exam.instructions
                        });
                    }
                });
            });

            setAssignments(myAssignedList);
        } catch (err) {
            console.error('Error fetching teacher assignments:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAssignments();
    }, [user]);

    if (loading) {
        return (
            <div className="mb-8 p-6 bg-white rounded-3xl border border-gray-100 shadow-sm flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-navy border-t-gold rounded-full animate-spin"></div>
                <span className="text-xs font-bold text-slate/60">Checking assignments...</span>
            </div>
        );
    }

    if (assignments.length === 0) return null;

    return (
        <div className="mb-8 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-gold animate-ping"></span>
                    <h2 className="text-sm font-black text-navy uppercase tracking-[0.2em]">
                        Assignments & Commissioned Exams ({assignments.length})
                    </h2>
                </div>
                <span className="text-[10px] font-bold text-slate/50 uppercase tracking-widest">
                    Action Required by Faculty
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {assignments.map((item, idx) => {
                    const statusColor = 
                        item.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        item.status === 'In Progress' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                        'bg-blue-100 text-blue-800 border-blue-300';

                    return (
                        <div 
                            key={idx} 
                            className="bg-white p-6 rounded-3xl shadow-md border-2 border-gray-100 hover:border-gold transition-all relative overflow-hidden flex flex-col justify-between"
                        >
                            <div className="absolute top-0 right-0 px-3 py-1 bg-navy text-gold text-[10px] font-black rounded-bl-xl uppercase tracking-widest">
                                {item.examType}
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${statusColor} uppercase tracking-wider`}>
                                        {item.status}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate/50">
                                        {item.subject}
                                    </span>
                                </div>

                                <h3 className="text-base font-black text-navy mb-2 line-clamp-1">
                                    {item.examTitle}
                                </h3>

                                <div className="space-y-1.5 mb-4 text-xs font-semibold text-slate/70">
                                    <div className="flex justify-between">
                                        <span className="text-slate/50">Required Qs:</span>
                                        <span className="font-bold text-navy">{item.targetQuestions} Questions</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate/50">Difficulty Split:</span>
                                        <span className="font-bold text-slate/80">
                                            {item.difficultyDistribution?.easy || 40}%E / {item.difficultyDistribution?.medium || 40}%M / {item.difficultyDistribution?.hard || 20}%H
                                        </span>
                                    </div>
                                    {item.assignedDate && (
                                        <div className="flex justify-between text-[10px] text-slate/40">
                                            <span>Assigned:</span>
                                            <span>{new Date(item.assignedDate).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    const targetUrl = item.submittedPaperId 
                                        ? `/teacher/create-paper?examId=${item.examId}&paperId=${item.submittedPaperId}`
                                        : `/teacher/create-paper?examId=${item.examId}`;
                                    navigate(targetUrl);
                                }}
                                className="w-full mt-2 bg-navy text-gold hover:bg-gold hover:text-navy py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 group"
                            >
                                <span>{item.status === 'In Progress' ? '⚡ Continue Paper' : '✍️ Create Paper'}</span>
                                <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const TeacherDashboardHome = () => {
    return (
        <div className="animate-fade-in-up">
            <div className="mb-8 bg-surface p-8 rounded-3xl shadow-sm border-l-8 border-navy relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full -mr-16 -mt-16"></div>
                <h3 className="font-black text-2xl text-navy mb-2">Welcome to your Workspace</h3>
                <p className="text-slate/70 font-medium text-sm max-w-2xl leading-relaxed">
                    Access your subject's question bank, generate standardized institutional papers, and complete assigned exam papers for your department.
                </p>
            </div>

            {/* ── ASSIGNMENTS & NOTIFICATIONS SECTION ── */}
            <TeacherAssignmentsSection />

            <div className="flex items-center gap-4 mb-8">
                <h2 className="text-sm font-black text-navy uppercase tracking-[0.2em]">Academic Modules</h2>
                <div className="h-px flex-1 bg-gray-100"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Question Bank */}
                <Link
                    to="/teacher/dashboard/add-question"
                    className="bg-surface p-8 rounded-3xl shadow-sm text-center border border-gray-100 hover:shadow-xl hover:border-gold hover:text-navy transform hover:-translate-y-2 transition-all flex flex-col items-center justify-center gap-4 group"
                >
                    <div className="bg-gray-50 text-gold w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner group-hover:bg-navy group-hover:text-gold transition-colors duration-300">
                        Q
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-navy">Question Bank</h2>
                        <p className="text-xs text-slate/50 mt-2 font-bold uppercase tracking-widest">Repository Management</p>
                    </div>
                </Link>

                {/* Create Paper */}
                <Link
                    to="/teacher/create-paper"
                    className="bg-navy p-8 rounded-3xl shadow-2xl text-center border-4 border-gold hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-4 group"
                >
                    <div className="bg-gold text-navy w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg group-hover:rotate-12 transition-transform duration-300">
                        +
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white">Create Paper</h2>
                        <p className="text-xs text-gold/60 mt-2 font-bold uppercase tracking-widest">Generation Engine</p>
                    </div>
                </Link>

                {/* Saved Papers */}
                <Link
                    to="/teacher/dashboard/saved-papers"
                    className="bg-surface p-8 rounded-3xl shadow-sm text-center border border-gray-100 hover:shadow-xl hover:border-gold hover:text-navy transform hover:-translate-y-2 transition-all flex flex-col items-center justify-center gap-4 group"
                >
                    <div className="bg-gray-50 text-gold w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner group-hover:bg-navy group-hover:text-gold transition-colors duration-300">
                        P
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-navy">Saved Papers</h2>
                        <p className="text-xs text-slate/50 mt-2 font-bold uppercase tracking-widest">Document Archives</p>
                    </div>
                </Link>

                {/* Grand Test Papers */}
                <Link
                    to="/teacher/dashboard/grand-tests"
                    className="bg-surface p-8 rounded-3xl shadow-sm text-center border border-gray-100 hover:shadow-xl hover:border-gold hover:text-navy transform hover:-translate-y-2 transition-all flex flex-col items-center justify-center gap-4 group"
                >
                    <div className="bg-gray-50 text-gold w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner group-hover:bg-navy group-hover:text-gold transition-colors duration-300">
                        GT
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-navy">Grand Tests</h2>
                        <p className="text-xs text-slate/50 mt-2 font-bold uppercase tracking-widest">GT Paper Archives</p>
                    </div>
                </Link>
            </div>
        </div>
    );
};

const TeacherDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [showTemplateCart, setShowTemplateCart] = useState(false);

    const logoMap = {
        'Physics': '/physicslogo.jpeg',
        'Chemistry': '/chemistrylogo.jpeg',
        'Biology': '/biologylogo.jpeg',
        'Maths': '/mathslogo.jpeg',
        'Computer Science': '/computersciencelogo.png',
        'Kannada': '/kannadalogo.jpg',
        'English': '/englishlogo.jpg',
        'Hindi': '/hindilogo.jpg'
    };

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            {/* Top Navigation Bar - Manchester Navy */}
            <nav className="bg-navy p-4 text-white flex justify-between items-center z-10 shadow-2xl border-b-4 border-gold">
                <div
                    className="flex items-center cursor-pointer hover:opacity-80 transition gap-4 ml-4"
                    onClick={() => navigate('/teacher/dashboard')}
                >
                    <div className="w-12 h-12 flex items-center justify-center shadow-lg transform -rotate-2 hover:rotate-0 transition-transform duration-300">
                        <img src="/ManchesterLogo.jpeg" alt="Logo" className="w-full h-full object-contain rounded-lg border-2 border-gold/30" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black tracking-tight uppercase leading-none">
                            Teacher Portal
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            {user?.subject && logoMap[user.subject] && (
                                <img src={logoMap[user.subject]} alt={user.subject} className="w-5 h-5 object-contain rounded-sm" />
                            )}
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em]">
                                {user?.subject || 'Science'} Department
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-x-3 flex items-center mr-4">
                    {location.pathname !== '/teacher/dashboard' && (
                        <button
                            onClick={() => navigate('/teacher/dashboard')}
                            className="bg-white/5 border border-gold/30 text-gold px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition flex items-center gap-2"
                        >
                            <span>←</span> Back
                        </button>
                    )}
                    <Link 
                        to="/teacher/dashboard/grand-tests" 
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${location.pathname.includes('grand-tests') ? 'bg-gold text-navy shadow-lg' : 'bg-white/5 text-gold border border-gold/30 hover:bg-white/10'}`}
                    >
                        GT Papers
                    </Link>
                    {/* Templates Cart Button */}
                    <button
                        id="teacher-template-cart-btn"
                        onClick={() => setShowTemplateCart(true)}
                        title="Browse Templates"
                        className="relative bg-gold text-navy w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg hover:scale-110 transition-all shadow-lg"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">T</span>
                    </button>
                    <button
                        onClick={() => { logout(); navigate('/'); }}
                        className="bg-red-500/10 border border-red-500/30 text-red-500 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm"
                    >
                        Logout
                    </button>
                </div>
            </nav>

            <div className="flex-1 p-10 max-w-7xl mx-auto w-full">
                <Routes>
                    <Route path="/" element={<TeacherDashboardHome />} />
                    <Route path="add-question" element={<AddQuestion />} />
                    <Route path="saved-papers" element={<SavedPapers />} />
                    <Route path="grand-tests" element={<GrandTestList />} />
                    <Route path="assignments" element={<AssignmentGenerator onBack={() => navigate('/teacher/dashboard')} />} />
                </Routes>
            </div>

            {/* Template Cart Drawer */}
            {showTemplateCart && (
                <TemplateCart onClose={() => setShowTemplateCart(false)} />
            )}
        </div>
    );
};

export default TeacherDashboard;