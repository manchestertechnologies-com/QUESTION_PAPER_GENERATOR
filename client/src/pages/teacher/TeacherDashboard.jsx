/**
 * TeacherDashboard.jsx
 *
 * Streamlined Teacher Workspace
 * Features:
 * - Teacher Notification Bell with live unread counts & assignment pre-fill
 * - Simplified clean top navigation (Grand Test Papers, Previous Year Papers, Template cart)
 * - Direct assignment continuation
 * - Academic modules
 */
import React, { useContext, useState, useEffect, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import AddQuestion from './AddQuestion';
import SavedPapers from './SavedPapers';
import TemplateCart from './TemplateCart';
import GrandTestList from '../admin/GrandTestList';
import PreviousYearPapers from '../admin/PreviousYearPapers';
import AssignmentGenerator from './AssignmentGenerator';
import OMREvaluation from './OMREvaluation';
import api from '../../api';

// ── Teacher Notification Bell Component ──────────────────────────────────────
const TeacherNotificationBell = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/api/notifications');
            if (Array.isArray(res.data)) {
                setNotifications(res.data);
            }
        } catch (err) {
            console.error('Error fetching teacher notifications:', err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 20000);
        return () => clearInterval(interval);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const handleMarkAllRead = async () => {
        try {
            await api.put('/api/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (err) {
            console.error('Error marking read:', err);
        }
    };

    const handleNotificationClick = async (notif) => {
        try {
            if (!notif.is_read) {
                await api.put(`/api/notifications/${notif.id}/read`);
                setNotifications(prev => prev.map(n => (n.id === notif.id ? { ...n, is_read: true } : n)));
            }
            setIsOpen(false);

            // If it's an exam assignment notification, navigate with metadata pre-filled
            const meta = typeof notif.metadata === 'string' ? JSON.parse(notif.metadata || '{}') : (notif.metadata || {});
            if (meta.examId) {
                navigate(`/teacher/create-paper?examId=${meta.examId}`);
            } else if (notif.related_paper_id) {
                navigate(`/teacher/create-paper?paperId=${notif.related_paper_id}`);
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative bg-white/10 hover:bg-white/20 text-gold w-10 h-10 rounded-xl flex items-center justify-center transition border border-gold/30 cursor-pointer"
                title="Notifications from Admin"
            >
                <span className="text-lg">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border-2 border-navy/20 z-[100] overflow-hidden animate-fade-in-up text-left">
                    <div className="p-4 bg-navy text-white flex justify-between items-center border-b border-gold/30">
                        <div className="flex items-center gap-2">
                            <span className="text-gold font-bold">🔔</span>
                            <span className="font-black text-xs uppercase tracking-wider">Admin Notifications</span>
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-[10px] text-gold hover:underline font-bold"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-xs text-gray-400 font-bold">
                                No notifications yet.
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => handleNotificationClick(n)}
                                    className={`p-3.5 hover:bg-gray-50 transition cursor-pointer ${
                                        !n.is_read ? 'bg-blue-50/60 border-l-4 border-gold' : ''
                                    }`}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <h4 className="font-bold text-xs text-navy leading-snug">{n.title}</h4>
                                        <span className="text-[9px] text-gray-400 font-semibold whitespace-nowrap">
                                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                                        {n.message}
                                    </p>
                                    <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-100/60">
                                        <span className="text-[9px] font-bold text-gray-400">
                                            From: {n.sender_name || 'Admin'}
                                        </span>
                                        <span className="text-[10px] font-black text-navy uppercase tracking-wider">
                                            Open →
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Teacher Active Assignments Section ────────────────────────────────────────
const TeacherAssignmentsSection = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAssignments = async () => {
        try {
            const res = await api.get('/api/exams/my-assignments');
            const examList = Array.isArray(res.data) ? res.data : [];

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
                            classes: exam.classes || ['12'],
                            subject: sa.subject,
                            targetQuestions: sa.targetQuestions || 60,
                            difficultyDistribution: sa.difficultyDistribution || { easy: 40, medium: 40, hard: 20 },
                            status: sa.status || 'Not Started',
                            submittedPaperId: sa.submittedPaperId?._id || sa.submittedPaperId,
                            assignedDate: sa.assignedDate || exam.createdAt,
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
            <div className="mb-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-xs flex items-center justify-center gap-2.5">
                <div className="w-4 h-4 border-2 border-navy border-t-gold rounded-full animate-spin"></div>
                <span className="text-xs font-bold text-slate-500">Checking assignments...</span>
            </div>
        );
    }

    if (assignments.length === 0) return null;

    return (
        <div className="mb-4 animate-fade-in-up">
            <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-gold animate-ping"></span>
                    <h2 className="text-xs font-black text-navy uppercase tracking-[0.15em]">
                        Commissioned Paper Requests ({assignments.length})
                    </h2>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Action Required by Faculty
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {assignments.map((item, idx) => {
                    const statusColor =
                        item.status === 'Completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                        item.status === 'In Progress' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                        'bg-blue-50 text-blue-800 border-blue-300';

                    return (
                        <div
                            key={idx}
                            className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 hover:border-gold transition-all relative overflow-hidden flex flex-col justify-between"
                        >
                            <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-navy text-gold text-[9px] font-black rounded-bl-lg uppercase tracking-wider">
                                {item.examType}
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${statusColor} uppercase tracking-wider`}>
                                        {item.status}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {item.subject}
                                    </span>
                                </div>

                                <h3 className="text-sm font-black text-navy mb-1.5 line-clamp-1">
                                    {item.examTitle}
                                </h3>

                                <div className="space-y-1 mb-3 text-xs font-semibold text-slate-600">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 text-[11px]">Target Questions:</span>
                                        <span className="font-bold text-navy text-[11px]">{item.targetQuestions} Qs</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 text-[11px]">Target Split:</span>
                                        <span className="font-bold text-slate-700 text-[11px]">
                                            {item.difficultyDistribution?.easy || 40}%E / {item.difficultyDistribution?.medium || 40}%M / {item.difficultyDistribution?.hard || 20}%H
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    const targetUrl = item.submittedPaperId
                                        ? `/teacher/create-paper?examId=${item.examId}&paperId=${item.submittedPaperId}`
                                        : `/teacher/create-paper?examId=${item.examId}`;
                                    navigate(targetUrl);
                                }}
                                className="w-full mt-1 bg-navy text-gold hover:bg-gold hover:text-navy py-2 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer group"
                            >
                                <span>{item.status === 'In Progress' ? '⚡ Continue Creation' : '✍️ Create Paper'}</span>
                                <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ── Teacher Dashboard Home ────────────────────────────────────────────────────
const TeacherDashboardHome = () => {
    return (
        <div className="animate-fade-in-up">
            {/* Welcome Banner - Compact, Controlled Height */}
            <div className="mb-4 bg-white p-5 sm:p-6 rounded-2xl shadow-xs border-l-4 border-navy relative overflow-hidden">
                <div className="absolute top-0 right-0 w-28 h-28 bg-gold/5 rounded-full -mr-12 -mt-12 pointer-events-none"></div>
                <h3 className="font-black text-xl sm:text-2xl text-navy mb-1">Welcome to your Workspace</h3>
                <p className="text-slate-600 font-medium text-xs sm:text-sm max-w-2xl leading-normal">
                    Access your subject's question bank, generate standardized institutional papers, and complete assigned exam papers for your department.
                </p>
            </div>

            {/* ── ASSIGNMENTS & NOTIFICATIONS SECTION ── */}
            <TeacherAssignmentsSection />

            {/* Section Heading - Close to Content */}
            <div className="flex items-center gap-3 mb-3.5">
                <h2 className="text-xs font-black text-navy uppercase tracking-[0.18em]">Academic Modules</h2>
                <div className="h-px flex-1 bg-slate-200"></div>
            </div>

            {/* Module Grid - Responsive, Compact, Consistent */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
                {/* Question Bank */}
                <Link
                    to="/teacher/dashboard/add-question"
                    className="bg-white p-5 rounded-2xl shadow-xs text-center border border-slate-200/80 hover:shadow-md hover:border-gold hover:text-navy transform hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 group min-h-[160px]"
                >
                    <div className="bg-slate-50 text-gold w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-inner group-hover:bg-navy group-hover:text-gold transition-colors duration-200">
                        Q
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-navy group-hover:text-navy">Question Bank</h2>
                        <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">Repository</p>
                    </div>
                </Link>

                {/* Create Paper */}
                <Link
                    to="/teacher/create-paper"
                    className="bg-navy p-5 rounded-2xl shadow-md text-center border-2 border-gold hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-3 group min-h-[160px]"
                >
                    <div className="bg-gold text-navy w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-black shadow-md group-hover:rotate-12 transition-transform duration-200">
                        +
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white">Create Paper</h2>
                        <p className="text-[10px] text-gold/70 mt-1 font-bold uppercase tracking-wider">Paper Wizard</p>
                    </div>
                </Link>

                {/* Assignments Generator */}
                <Link
                    to="/teacher/dashboard/assignments"
                    className="bg-white p-5 rounded-2xl shadow-xs text-center border border-slate-200/80 hover:shadow-md hover:border-navy hover:text-navy transform hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 group min-h-[160px]"
                >
                    <div className="bg-amber-50 text-navy w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-inner group-hover:bg-gold group-hover:text-navy transition-colors duration-200">
                        📝
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-navy group-hover:text-navy">Assignments</h2>
                        <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">Practice & Keys</p>
                    </div>
                </Link>

                {/* Saved Papers */}
                <Link
                    to="/teacher/dashboard/saved-papers"
                    className="bg-white p-5 rounded-2xl shadow-xs text-center border border-slate-200/80 hover:shadow-md hover:border-gold hover:text-navy transform hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 group min-h-[160px]"
                >
                    <div className="bg-slate-50 text-gold w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-inner group-hover:bg-navy group-hover:text-gold transition-colors duration-200">
                        P
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-navy group-hover:text-navy">Saved Papers</h2>
                        <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">Archives</p>
                    </div>
                </Link>

                {/* Grand Tests */}
                <Link
                    to="/teacher/dashboard/grand-tests"
                    className="bg-white p-5 rounded-2xl shadow-xs text-center border border-slate-200/80 hover:shadow-md hover:border-gold hover:text-navy transform hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 group min-h-[160px]"
                >
                    <div className="bg-slate-50 text-gold w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-inner group-hover:bg-navy group-hover:text-gold transition-colors duration-200">
                        GT
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-navy group-hover:text-navy">Grand Tests</h2>
                        <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">GT Archives</p>
                    </div>
                </Link>

                {/* OMR Evaluation (Visible if Admin granted omrAccess) */}
                {user?.omrAccess !== false && (
                    <Link
                        to="/teacher/dashboard/omr-evaluation"
                        className="bg-white p-5 rounded-2xl shadow-xs text-center border border-slate-200/80 hover:shadow-md hover:border-teal-500 hover:text-navy transform hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 group min-h-[160px]"
                    >
                        <div className="bg-teal-50 text-teal-700 w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-inner group-hover:bg-teal-700 group-hover:text-white transition-colors duration-200">
                            📋
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-navy group-hover:text-navy">OMR Evaluation</h2>
                            <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">Sheets &amp; Scanner</p>
                        </div>
                    </Link>
                )}
            </div>
        </div>
    );
};

const TeacherDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [showTemplateCart, setShowTemplateCart] = useState(false);
    const [isLeftMenuOpen, setIsLeftMenuOpen] = useState(false);

    const logoMap = {
        'Physics': '/physicslogo.jpeg',
        'Chemistry': '/chemistrylogo.jpeg',
        'Biology': '/biologylogo.jpeg',
        'Maths': '/mathslogo.jpeg',
        'Mathematics': '/mathslogo.jpeg',
    };

    return (
        <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
            {/* Top Navigation Bar - Compact padding (px-6 py-3.5), Dashboard Menu at RIGHT Corner */}
            <nav className="bg-navy py-3.5 px-6 text-white flex justify-between items-center relative z-50 shadow-md border-b-2 border-gold">
                {/* Left Side: Institutional Logo & Title */}
                <div
                    className="flex items-center cursor-pointer hover:opacity-90 transition gap-3"
                    onClick={() => navigate('/teacher/dashboard')}
                >
                    <div className="w-10 h-10 flex items-center justify-center shadow-md">
                        <img src="/ManchesterLogo.jpeg" alt="Logo" className="w-full h-full object-contain rounded-lg border border-gold/40" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-base font-black tracking-tight uppercase leading-none">
                            Faculty Portal
                        </h1>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {user?.subject && logoMap[user.subject] && (
                                <img src={logoMap[user.subject]} alt={user.subject} className="w-4 h-4 object-contain rounded-xs" />
                            )}
                            <span className="text-[9px] font-black text-gold uppercase tracking-[0.18em]">
                                {user?.subject || 'Faculty'} Department
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Back (if not on home), Notification Bell, Right-Corner Menu & Logout */}
                <div className="space-x-3 flex items-center">
                    {location.pathname !== '/teacher/dashboard' && (
                        <button
                            onClick={() => navigate('/teacher/dashboard')}
                            className="bg-white/5 border border-gold/30 text-gold px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <span>←</span> Back to Workspace
                        </button>
                    )}

                    {/* Teacher Notification Bell */}
                    <TeacherNotificationBell />

                    {/* Right Corner Menu Button (☰) */}
                    <button
                        onClick={() => setIsLeftMenuOpen(true)}
                        className="text-gold hover:text-white text-2xl font-black p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer flex items-center justify-center leading-none"
                        title="Open Dashboard Menu"
                    >
                        ☰
                    </button>

                    <div className="w-px h-6 bg-gold/20 mx-0.5"></div>
                    <button
                        onClick={() => { logout(); navigate('/'); }}
                        className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-500 hover:text-white transition-all shadow-2xs cursor-pointer"
                    >
                        Logout
                    </button>
                </div>
            </nav>

            {/* ── Right Slide-Over Menu (right-0, border-l-4 border-gold) ── */}
            {isLeftMenuOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs transition-opacity"
                        onClick={() => setIsLeftMenuOpen(false)}
                    />
                    <div className="fixed inset-y-0 right-0 w-80 bg-navy text-white z-50 shadow-2xl border-l-4 border-gold flex flex-col animate-slide-left overflow-y-auto">
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-gold/20 flex justify-between items-start bg-navy/90">
                            <div className="flex items-center gap-3">
                                <img src="/ManchesterLogo.jpeg" alt="Logo" className="w-10 h-10 object-contain rounded-lg border border-gold/40" />
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-wide text-white">Manchester Portal</h3>
                                    <p className="text-[10px] text-gold font-bold uppercase tracking-widest">{user?.subject || 'Faculty'} Department</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsLeftMenuOpen(false)}
                                className="text-gold hover:text-white text-xl font-bold w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Faculty Profile Card in Drawer */}
                        <div className="p-5 border-b border-gold/15 bg-white/5 mx-4 my-4 rounded-2xl">
                            <div className="text-[10px] font-black text-gold uppercase tracking-widest mb-1">Faculty Account</div>
                            <div className="text-sm font-black text-white">{user?.name || 'Prof. Faculty'}</div>
                            <div className="text-xs text-slate-300 font-medium">{user?.email || 'faculty@manchester.edu'}</div>
                        </div>

                        {/* Drawer Navigation Links */}
                        <div className="px-4 py-2 space-y-1.5 flex-1">
                            <button
                                onClick={() => { setIsLeftMenuOpen(false); navigate('/teacher/dashboard'); }}
                                className="w-full text-left px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-200 hover:bg-white/10 hover:text-gold transition flex items-center gap-3 cursor-pointer"
                            >
                                <span>🏛️</span> Workspace Home
                            </button>
                            <button
                                onClick={() => { setIsLeftMenuOpen(false); navigate('/teacher/dashboard/previous-year-papers'); }}
                                className="w-full text-left px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-200 hover:bg-white/10 hover:text-gold transition flex items-center gap-3 cursor-pointer"
                            >
                                <span>📚</span> PYQ Archives &amp; Papers
                            </button>
                            {user?.omrAccess !== false && (
                                <button
                                    onClick={() => { setIsLeftMenuOpen(false); navigate('/teacher/dashboard/omr-evaluation'); }}
                                    className="w-full text-left px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-200 hover:bg-white/10 hover:text-teal-400 transition flex items-center gap-3 cursor-pointer"
                                >
                                    <span>📋</span> OMR Evaluation &amp; Scanner
                                </button>
                            )}
                            <button
                                onClick={() => { setIsLeftMenuOpen(false); setShowTemplateCart(true); }}
                                className="w-full text-left px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-200 hover:bg-white/10 hover:text-gold transition flex items-center gap-3 cursor-pointer"
                            >
                                <span>🏛️</span> Institutional Templates
                            </button>
                        </div>

                        {/* Drawer Footer */}
                        <div className="p-5 border-t border-gold/20">
                            <button
                                onClick={() => { logout(); navigate('/'); }}
                                className="w-full py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer text-center"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Main Content Area - Controlled Padding & Balanced Width */}
            <div className="flex-1 py-5 px-4 sm:px-6 max-w-6xl mx-auto w-full">
                <Routes>
                    <Route path="/" element={<TeacherDashboardHome />} />
                    <Route path="add-question" element={<AddQuestion />} />
                    <Route path="saved-papers" element={<SavedPapers />} />
                    <Route path="grand-tests" element={<GrandTestList />} />
                    <Route path="previous-year-papers" element={<PreviousYearPapers />} />
                    <Route path="assignments" element={<AssignmentGenerator onBack={() => navigate('/teacher/dashboard')} />} />
                    <Route path="omr-evaluation" element={<OMREvaluation />} />
                    <Route path="omr" element={<OMREvaluation />} />
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