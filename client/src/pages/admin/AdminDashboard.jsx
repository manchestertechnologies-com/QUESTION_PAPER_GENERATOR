import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import UploadTemplate from './UploadTemplate';
import CreateTeacher from './CreateTeacher';
import SubjectDetails from './SubjectDetails';
import AdminPaperPreview from './AdminPaperPreview';
import ExamManagement from './ExamManagement';
import AdminResults from './AdminResults';
import GrandTestList from './GrandTestList';
import PreviousYearPapers from './PreviousYearPapers';
import ExamBlueprints from './ExamBlueprints';
import TestModule from './TestModule';
import AssignmentGenerator from '../teacher/AssignmentGenerator';
import PaperAnalysisModal from '../../components/PaperAnalysisModal';
import MathRenderer from '../../components/MathRenderer';
import MatchTable, { parseMTFFromText } from '../../components/MatchTable';
import { generateAllPQRS, generatePaperSet } from '../../utils/pqrsGenerator';
import api from '../../api';

const DashboardHome = () => {
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();

    // Subject Directory strictly PCMB
    const subjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
    const logoMap = {
        'Physics': '/physicslogo.jpeg',
        'Chemistry': '/chemistrylogo.jpeg',
        'Biology': '/biologylogo.jpeg',
        'Mathematics': '/mathslogo.jpeg',
        'Maths': '/mathslogo.jpeg'
    };

    const [commissionedExams, setCommissionedExams] = useState([]);
    const [allTeachers, setAllTeachers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Merge & Action states
    const [mergingExamId, setMergingExamId] = useState(null);
    const [selectedAnswerKeyExam, setSelectedAnswerKeyExam] = useState(null);
    const [selectedOnlineLaunchExam, setSelectedOnlineLaunchExam] = useState(null);
    const [selectedPqrsExam, setSelectedPqrsExam] = useState(null);
    const [selectedAnalysisExam, setSelectedAnalysisExam] = useState(null);
    const [activePqrsSet, setActivePqrsSet] = useState('P');
    const [soeSubjectFilter, setSoeSubjectFilter] = useState('All');
    const [copiedLink, setCopiedLink] = useState(false);

    // Commission Exam Modal state
    const [showCommissionModal, setShowCommissionModal] = useState(false);
    const [commissionForm, setCommissionForm] = useState({
        title: '',
        examType: 'CET',
        classes: ['12'],
        targetPerSubject: 60,
        assignedTeachers: {
            'Physics': '',
            'Chemistry': '',
            'Mathematics': '',
            'Biology': '',
            'Botany': '',
            'Zoology': ''
        }
    });

    // Active selected exam ID (defaults to first exam when loaded)
    const [selectedExamId, setSelectedExamId] = useState(null);

    // Automatically set default selected exam when list loads
    useEffect(() => {
        if (commissionedExams.length > 0 && !selectedExamId) {
            setSelectedExamId(commissionedExams[0]._id);
        }
    }, [commissionedExams, selectedExamId]);

    // View Full Paper / Exam Preview Modal
    const [selectedViewExam, setSelectedViewExam] = useState(null);
    // Faculty Papers Management State
    const [facultyPapers, setFacultyPapers] = useState([]);
    const [paperSearch, setPaperSearch] = useState('');
    const [paperSubjectFilter, setPaperSubjectFilter] = useState('All');
    const [paperClassFilter, setPaperClassFilter] = useState('All');

    // Faculty & OMR Access Modal
    const [showTeacherModal, setShowTeacherModal] = useState(false);

    const handleToggleOmrAccess = async (teacherId, currentStatus) => {
        try {
            const nextStatus = !currentStatus;
            await api.put(`/api/admin/teachers/${teacherId}/omr-access`, { omrAccess: nextStatus });
            setAllTeachers(prev => prev.map(t => t._id === teacherId ? { ...t, omrAccess: nextStatus } : t));
        } catch (err) {
            console.error('Error toggling OMR access:', err);
            alert('Failed to update OMR permission: ' + (err.response?.data?.msg || err.message));
        }
    };

    const fetchData = async () => {
        try {
            const [teachersRes, examsRes, papersRes] = await Promise.all([
                api.get('/api/admin/teachers'),
                api.get('/api/exams/commissioned'),
                api.get('/api/papers/all').catch(() => api.get('/api/papers')).catch(() => ({ data: [] }))
            ]);
            setAllTeachers(teachersRes.data || []);
            const examsList = examsRes.data || [];
            setCommissionedExams(examsList);
            setFacultyPapers(Array.isArray(papersRes.data) ? papersRes.data : []);
            if (examsList.length > 0) {
                setSelectedExamId(prev => (prev && examsList.some(e => e._id === prev) ? prev : examsList[0]._id));
            }
            setLoading(false);
        } catch (err) {
            console.error('Error fetching admin dashboard data:', err);
            if (err.response && [400, 401, 403].includes(err.response.status)) {
                logout();
                navigate('/');
            }
            setLoading(false);
        }
    };

    const handleLaunchPaperForCbt = async (paper) => {
        try {
            const res = await api.post('/api/exams/from-single-paper', {
                paperId: paper._id,
                title: paper.title,
                examType: paper.examType || 'CET',
                action: 'launch'
            });
            alert(`Paper "${paper.title}" successfully approved & launched for Online Student CBT Mode!`);
            fetchData();
        } catch (err) {
            console.error('Error approving paper for CBT:', err);
            alert('Failed to launch for CBT: ' + (err.response?.data?.msg || err.message));
        }
    };

    const handleDeletePaper = async (paperId, paperTitle) => {
        if (!window.confirm(`Are you sure you want to delete paper "${paperTitle}"?`)) return;
        try {
            await api.delete(`/api/papers/${paperId}`);
            setFacultyPapers(prev => prev.filter(p => p._id !== paperId));
            alert('Paper deleted successfully.');
        } catch (err) {
            console.error('Error deleting paper:', err);
            alert('Failed to delete paper: ' + (err.response?.data?.msg || err.message));
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCommissionSubmit = async (e) => {
        e.preventDefault();
        if (!commissionForm.title) return alert('Please enter an Exam Title');

        try {
            let subjectsNeeded = [];
            if (commissionForm.examType === 'NEET') {
                subjectsNeeded = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
            } else if (commissionForm.examType === 'CET') {
                subjectsNeeded = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
            } else if (commissionForm.examType === 'JEE') {
                subjectsNeeded = ['Physics', 'Chemistry', 'Mathematics'];
            } else {
                subjectsNeeded = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
            }

            const subjectAssignments = subjectsNeeded.map(subName => {
                const assignedTeacherId = commissionForm.assignedTeachers[subName];
                const teacherObj = allTeachers.find(t => t._id === assignedTeacherId) || allTeachers.find(t => (t.subject || '').toLowerCase().includes(subName.toLowerCase()));
                return {
                    subject: subName,
                    teacherId: teacherObj ? teacherObj._id : undefined,
                    teacherName: teacherObj ? teacherObj.name : `Prof. ${subName} Faculty`,
                    teacherEmail: teacherObj ? teacherObj.email : `${subName.toLowerCase()}@manchester.edu`,
                    targetQuestions: commissionForm.targetPerSubject || 60,
                    status: 'Pending'
                };
            });

            const res = await api.post('/api/exams/commission', {
                title: commissionForm.title,
                examType: commissionForm.examType,
                classes: commissionForm.classes,
                subjectAssignments,
                duration_minutes: 180
            });

            alert(`✓ Exam "${commissionForm.title}" successfully commissioned! Access granted to assigned faculty.`);
            setShowCommissionModal(false);
            setCommissionForm({
                title: '',
                examType: 'CET',
                classes: ['12'],
                targetPerSubject: 60,
                assignedTeachers: {}
            });
            if (res.data?._id) setSelectedExamId(res.data._id);
            fetchData();
        } catch (err) {
            console.error(err);
            alert('Failed to commission exam. Please try again.');
        }
    };

    const handleMergeExam = async (exam) => {
        if (!exam) return;
        setMergingExamId(exam._id);
        try {
            const res = await api.post('/api/exams/merge', {
                examId: exam._id,
                examType: exam.examType,
                title: exam.title
            });
            alert(`✅ ${res.data.msg}`);
            await fetchData();
        } catch (err) {
            console.error('Merge error:', err);
            alert(`❌ Error merging papers: ${err.response?.data?.msg || err.message}`);
        } finally {
            setMergingExamId(null);
        }
    };

    const handleQuickLaunch = async (examId, action) => {
        try {
            const res = await api.post(`/api/exams/${examId}/quick-launch`, { action });
            alert(`✅ ${res.data.msg}`);
            await fetchData();
            if (selectedOnlineLaunchExam && selectedOnlineLaunchExam._id === examId) {
                setSelectedOnlineLaunchExam(res.data.exam);
            }
        } catch (err) {
            console.error('Launch error:', err);
            alert(`❌ Failed to update online exam status: ${err.response?.data?.msg || err.message}`);
        }
    };

    const handleDeleteExam = async (examId) => {
        if (window.confirm('Are you sure you want to delete this exam? This will remove all associated submissions.')) {
            try {
                await api.delete(`/api/exams/${examId}`);
                setSelectedExamId(null);
                fetchData();
            } catch (err) {
                console.error(err);
                alert('Failed to delete exam.');
            }
        }
    };

    const activeExam = commissionedExams.find(e => e._id === selectedExamId) || commissionedExams[0];

    return (
        <div className="animate-fade-in-up space-y-10">

            {/* Top Welcome Card with Action Bar */}
            <div className="bg-surface p-8 rounded-3xl shadow-sm border-l-8 border-navy relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full -mr-16 -mt-16"></div>
                <div>
                    <h3 className="font-black text-2xl text-navy mb-2">Welcome to the Administration</h3>
                    <p className="text-slate/70 font-medium text-sm max-w-2xl leading-relaxed">
                        Manage institutional examinations, track PCMB question delegation, and monitor faculty progress in real-time.
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={() => setShowTeacherModal(true)}
                        className="bg-white text-navy hover:bg-navy hover:text-gold border-2 border-navy px-5 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-md flex items-center gap-2 cursor-pointer"
                    >
                        <span>👥</span> Faculty &amp; OMR Access ({allTeachers.length})
                    </button>
                    <button
                        onClick={() => setShowCommissionModal(true)}
                        className="bg-navy text-gold px-7 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center gap-2.5 border-2 border-gold cursor-pointer"
                    >
                        <span className="text-base">⚡</span> Create &amp; Commission Exam
                    </button>
                </div>
            </div>

            {/* ── SECTION 1: SINGLE UNIFIED EXAMS CARD (LIST & 3/4 SUBJECT PROGRESS BOXES INSIDE) ── */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-200 relative overflow-hidden space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                        <h2 className="text-sm font-black text-navy uppercase tracking-[0.2em]">
                            EXAMS & DEPARTMENT PROGRESS
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate/40">{commissionedExams.length} Commissioned Assessments</span>
                        <button
                            onClick={() => setShowCommissionModal(true)}
                            className="bg-gold text-navy px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider hover:scale-105 transition shadow-sm cursor-pointer"
                        >
                            + New Exam
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate/40 font-bold text-sm">
                        Loading exam progress...
                    </div>
                ) : commissionedExams.length === 0 ? (
                    <div className="p-12 border-2 border-dashed border-gray-200 rounded-[2rem] text-center">
                        <div className="w-16 h-16 bg-navy/5 text-navy rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 font-black">🎓</div>
                        <h4 className="font-black text-navy text-lg mb-1">No Commissioned Exams Yet</h4>
                        <p className="text-xs text-gray-500 max-w-md mx-auto mb-6">Create your first exam (e.g. CET MOCK 1) and delegate question targets to PCMB faculty.</p>
                        <button
                            onClick={() => setShowCommissionModal(true)}
                            className="bg-gold text-navy px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg cursor-pointer"
                        >
                            + Create Exam
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* ── EXAM SELECTOR TABS (CLICK TO SWITCH BETWEEN EXAMS) ── */}
                        <div className="flex items-center gap-3 overflow-x-auto pb-2 border-b border-gray-100">
                            <span className="text-xs font-black text-navy uppercase tracking-wider whitespace-nowrap mr-1">
                                Select Exam:
                            </span>
                            {commissionedExams.map((exam) => {
                                const isSelected = (activeExam?._id === exam._id);
                                const subAssignments = exam.subjectAssignments || [];
                                const totalTarget = subAssignments.reduce((sum, sa) => sum + (sa.targetQuestions || 60), 0);
                                const totalAdded = exam.totalQuestionsAdded !== undefined
                                    ? exam.totalQuestionsAdded
                                    : subAssignments.reduce((sum, sa) => sum + (sa.questionsCount || (sa.submittedPaperId?.questions?.length || 0)), 0);
                                const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalAdded / totalTarget) * 100)) : 0;

                                return (
                                    <button
                                        key={exam._id}
                                        onClick={() => setSelectedExamId(exam._id)}
                                        className={`px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
                                            isSelected
                                                ? 'bg-navy text-gold shadow-md scale-105 border-2 border-gold'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                                        }`}
                                    >
                                        <span className="w-2 h-2 rounded-full bg-gold"></span>
                                        <span>{exam.title}</span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-md font-black ${
                                            isSelected ? 'bg-white/20 text-white' : 'bg-white text-navy'
                                        }`}>
                                            {overallPct}%
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* ── ACTIVE EXAM DETAILS & 3/4 PCMB SUBJECT PROGRESS BOXES ── */}
                        {activeExam && (() => {
                            const exam = activeExam;
                            const subAssignments = exam.subjectAssignments || [];
                            const totalTarget = subAssignments.reduce((sum, sa) => sum + (sa.targetQuestions || 60), 0);
                            const totalAdded = exam.totalQuestionsAdded !== undefined
                                ? exam.totalQuestionsAdded
                                : subAssignments.reduce((sum, sa) => sum + (sa.questionsCount || (sa.submittedPaperId?.questions?.length || 0)), 0);
                            const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalAdded / totalTarget) * 100)) : 0;

                            return (
                                <div className="space-y-6 animate-fade-in pt-2">
                                    {/* Active Exam Header Banner */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                                                <span className="bg-navy text-gold text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg shadow-sm">
                                                    {exam.examType || 'CET'}
                                                </span>
                                                <h3 className="font-black text-2xl text-navy uppercase tracking-tight">{exam.title}</h3>
                                                <span className="text-[10px] font-bold text-slate/50 bg-white px-2.5 py-1 rounded-md border border-gray-200">
                                                    Class {exam.classes?.join(', ') || '12'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 font-medium">
                                                Created: {new Date(exam.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>

                                        {/* Action Controls */}
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <button
                                                onClick={() => setSelectedViewExam(exam)}
                                                className="bg-navy text-gold px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-md flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <span>👁</span> View Full Paper ({totalAdded} Qs)
                                            </button>
                                            <button
                                                onClick={() => setSelectedAnalysisExam(exam)}
                                                className="bg-gold text-navy px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-md flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <span>📊</span> Paper Analysis
                                            </button>
                                            <button
                                                onClick={() => handleDeleteExam(exam._id)}
                                                className="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white px-3.5 py-2.5 rounded-xl font-black text-xs transition shadow-sm cursor-pointer"
                                                title="Delete this exam"
                                            >
                                                ✕ Delete
                                            </button>
                                        </div>
                                    </div>

                                    {/* Overall Assessment Progress Bar */}
                                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                                        <div className="flex justify-between items-center text-xs font-black text-navy mb-2">
                                            <span>Overall Assessment Compilation Progress</span>
                                            <span>{totalAdded} / {totalTarget} Questions ({overallPct}%)</span>
                                        </div>
                                        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden p-0.5 shadow-inner">
                                            <div
                                                style={{ width: `${overallPct}%` }}
                                                className={`h-full rounded-full transition-all duration-500 ${overallPct >= 100 ? 'bg-emerald-500' : overallPct >= 50 ? 'bg-blue-600' : 'bg-amber-500'}`}
                                            />
                                        </div>
                                    </div>

                                    {/* ── 3 OR 4 PCMB SUBJECT PROGRESS BOXES (INSIDE EXAM) ── */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                        {subAssignments.map((sa, idx) => {
                                            const subName = sa.subject;
                                            const target = sa.targetQuestions || 60;
                                            const count = sa.questionsCount !== undefined
                                                ? sa.questionsCount
                                                : (sa.submittedPaperId?.questions?.length || 0);
                                            const pct = Math.min(100, Math.round((count / target) * 100));

                                            const subIcon = subName.toLowerCase().includes('physic') ? '⚛️'
                                                : subName.toLowerCase().includes('chem') ? '🧪'
                                                : subName.toLowerCase().includes('math') ? '📐'
                                                : subName.toLowerCase().includes('botan') ? '🌿'
                                                : subName.toLowerCase().includes('zool') ? '🐾'
                                                : '🧬';

                                            return (
                                                <div key={idx} className="border-2 border-navy/10 p-5 rounded-2xl bg-white flex flex-col justify-between hover:border-navy/40 transition shadow-sm">
                                                    <div>
                                                        <div className="flex justify-between items-center mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xl">{subIcon}</span>
                                                                <h4 className="text-base font-black text-navy uppercase">{subName}</h4>
                                                            </div>
                                                            <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${pct >= 100 ? 'bg-emerald-100 text-emerald-800' : pct > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                                                                {pct >= 100 ? 'Completed' : pct > 0 ? 'In Progress' : 'Pending'}
                                                            </span>
                                                        </div>

                                                        {/* Archivist Teacher Name & Email */}
                                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-100 mb-3 text-left">
                                                            <div className="text-[11px] font-bold text-navy truncate">
                                                                👤 {sa.teacherName || `Prof. ${subName} Faculty`}
                                                            </div>
                                                            <div className="text-[10px] text-blue-600 font-mono truncate mt-0.5">
                                                                ✉ {sa.teacherEmail || `${subName.toLowerCase()}@manchester.edu`}
                                                            </div>
                                                        </div>

                                                        {/* Question Progress Bar */}
                                                        <div className="mb-2">
                                                            <div className="flex justify-between text-[11px] font-black text-navy mb-1">
                                                                <span>Questions</span>
                                                                <span>{count} / {target} Qs ({pct}%)</span>
                                                            </div>
                                                            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden p-0.5 shadow-inner">
                                                                <div
                                                                    style={{ width: `${pct}%` }}
                                                                    className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-600' : 'bg-gray-300'}`}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                                        <span>Target</span>
                                                        <span className="text-navy font-black">{target} Qs</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* ── EXAM PAPER MERGE & FULL SUITE CONTROLLER ── */}
                                    <div className="bg-gradient-to-br from-navy via-slate-900 to-navy text-white p-7 rounded-3xl border-2 border-gold shadow-xl space-y-5">
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gold/30">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="bg-gold text-navy text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                                                        {exam.examType === 'CET' ? 'PCMB Assessment Engine' : exam.examType === 'NEET' ? 'PCB Assessment Engine' : 'PCM Assessment Engine'}
                                                    </span>
                                                    <span className="text-emerald-400 text-xs font-black">
                                                        {exam.mergedPaperId ? '✓ Exam Merged & Compiled' : totalAdded > 0 ? `${totalAdded} Questions Ready to Merge` : 'Awaiting Faculty Submissions'}
                                                    </span>
                                                </div>
                                                <h4 className="text-xl font-black text-white tracking-tight">
                                                    ⚡ Unified {exam.examType} Assessment & Exam Distribution Hub
                                                </h4>
                                                <p className="text-xs text-slate-300 font-medium">
                                                    Merge all subject submissions into a single institutional assessment with full Answer Keys, Step-by-Step SOE, PQRS 4-Sets, and 1-Click Online CBT launch.
                                                </p>
                                            </div>

                                            {/* Primary 1-Click Merge Button */}
                                            <button
                                                onClick={() => handleMergeExam(exam)}
                                                disabled={mergingExamId === exam._id || totalAdded === 0}
                                                className={`px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap ${
                                                    mergingExamId === exam._id
                                                        ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                                                        : totalAdded === 0
                                                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-600'
                                                            : 'bg-gold hover:bg-yellow-400 text-navy hover:scale-105 border-2 border-white'
                                                }`}
                                            >
                                                {mergingExamId === exam._id ? (
                                                    <>
                                                        <span className="animate-spin text-base">🔄</span>
                                                        <span>Merging Papers...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-base">⚡</span>
                                                        <span>{exam.mergedPaperId ? 'Re-Merge & Update Exam' : `Merge & Compile ${exam.examType} Paper`}</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {/* All Features Unlocked when Merged or questions compiled */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
                                            {/* 1. View Merged Paper & Print A4 */}
                                            <button
                                                onClick={() => {
                                                    if (exam.mergedPaperId) {
                                                        navigate(`/admin/dashboard/preview/${exam.mergedPaperId}`);
                                                    } else {
                                                        setSelectedViewExam(exam);
                                                    }
                                                }}
                                                disabled={totalAdded === 0}
                                                className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-gold p-3.5 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition group cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <span className="text-xl group-hover:scale-110 transition-transform">📄</span>
                                                <span className="text-[11px] font-black text-gold uppercase tracking-wider">True A4 Paper</span>
                                                <span className="text-[9px] text-slate-300 font-bold">Print & PDF Export</span>
                                            </button>

                                            {/* 2. Paper Analysis */}
                                            <button
                                                onClick={() => setSelectedAnalysisExam(exam)}
                                                disabled={totalAdded === 0}
                                                className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-gold p-3.5 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition group cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <span className="text-xl group-hover:scale-110 transition-transform">📊</span>
                                                <span className="text-[11px] font-black text-gold uppercase tracking-wider">Paper Analysis</span>
                                                <span className="text-[9px] text-slate-300 font-bold">Difficulty & Bloom's</span>
                                            </button>

                                            {/* 3. Answer Key & SOE Guide */}
                                            <button
                                                onClick={() => setSelectedAnswerKeyExam(exam)}
                                                disabled={totalAdded === 0}
                                                className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-gold p-3.5 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition group cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <span className="text-xl group-hover:scale-110 transition-transform">🔑</span>
                                                <span className="text-[11px] font-black text-gold uppercase tracking-wider">Answer Key & SOE</span>
                                                <span className="text-[9px] text-slate-300 font-bold">Full Solutions Guide</span>
                                            </button>

                                            {/* 4. PQRS 4-Set Center */}
                                            <button
                                                onClick={() => setSelectedPqrsExam(exam)}
                                                disabled={totalAdded === 0}
                                                className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-gold p-3.5 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition group cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <span className="text-xl group-hover:scale-110 transition-transform">🔀</span>
                                                <span className="text-[11px] font-black text-gold uppercase tracking-wider">PQRS 4-Sets</span>
                                                <span className="text-[9px] text-slate-300 font-bold">Multi-Set Generator</span>
                                            </button>

                                            {/* 5. 1-Click Online CBT Launch */}
                                            <button
                                                onClick={() => setSelectedOnlineLaunchExam(exam)}
                                                disabled={totalAdded === 0}
                                                className="col-span-2 sm:col-span-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400 p-3.5 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition group cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <span className="text-xl group-hover:scale-110 transition-transform">🚀</span>
                                                <span className="text-[11px] font-black text-white uppercase tracking-wider">Online CBT Exam</span>
                                                <span className="text-[9px] text-emerald-100 font-bold">
                                                    {exam.status === 'live' ? '🟢 LIVE NOW' : '1-Click Launch'}
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* ── SECTION 2: SUBJECT DIRECTORY (STRICTLY PCMB) ── */}
            <div>
                <div className="flex items-center gap-4 mb-6">
                    <h2 className="text-sm font-black text-navy uppercase tracking-[0.2em]">Subject Directory (PCMB)</h2>
                    <div className="h-px flex-1 bg-gray-200"></div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {subjects.map(sub => (
                        <Link 
                            to={`/admin/dashboard/subject/${sub}`}
                            key={sub}
                            className="bg-surface p-8 rounded-3xl shadow-sm text-center font-black text-lg transition border border-gray-100 text-slate hover:shadow-xl hover:border-gold hover:text-navy transform hover:-translate-y-2 flex flex-col items-center justify-center gap-4 group"
                        >
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner group-hover:scale-110 transition-transform duration-300 bg-white p-2">
                                <img 
                                    src={logoMap[sub] || '/physicslogo.jpeg'} 
                                    alt={sub} 
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.parentNode.innerHTML = `<div class="bg-gray-50 text-gold w-full h-full flex items-center justify-center text-2xl font-black">${sub.charAt(0)}</div>`;
                                    }}
                                />
                            </div>
                            {sub}
                        </Link>
                    ))}
                </div>
            </div>

            {/* ── SECTION 3: FACULTY QUESTION PAPERS REPOSITORY & CBT APPROVAL ── */}
            <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="text-xl">📁</span>
                            <h2 className="text-lg font-black text-navy uppercase tracking-tight">
                                Faculty Question Papers Repository ({facultyPapers.length})
                            </h2>
                        </div>
                        <p className="text-xs text-gray-500 font-medium mt-1">
                            Review all papers generated by faculty members. Only papers explicitly approved here will appear in the Student Online CBT Exam Portal.
                        </p>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
                        <input
                            type="text"
                            placeholder="Search paper or faculty..."
                            value={paperSearch}
                            onChange={(e) => setPaperSearch(e.target.value)}
                            className="text-xs px-3.5 py-2 rounded-xl border border-gray-200 outline-none focus:border-navy bg-gray-50 min-w-[180px]"
                        />
                        <select
                            value={paperSubjectFilter}
                            onChange={(e) => setPaperSubjectFilter(e.target.value)}
                            className="text-xs px-3 py-2 rounded-xl border border-gray-200 outline-none bg-white font-bold text-gray-700 cursor-pointer"
                        >
                            <option value="All">All Subjects</option>
                            <option value="Physics">Physics</option>
                            <option value="Chemistry">Chemistry</option>
                            <option value="Mathematics">Mathematics</option>
                            <option value="Biology">Biology</option>
                        </select>
                        <select
                            value={paperClassFilter}
                            onChange={(e) => setPaperClassFilter(e.target.value)}
                            className="text-xs px-3 py-2 rounded-xl border border-gray-200 outline-none bg-white font-bold text-gray-700 cursor-pointer"
                        >
                            <option value="All">All Classes</option>
                            <option value="11">Class 11</option>
                            <option value="12">Class 12</option>
                        </select>
                    </div>
                </div>

                {/* Faculty Papers Table / Grid */}
                {(() => {
                    const filtered = facultyPapers.filter(p => {
                        const matchesSearch = !paperSearch.trim() || 
                            (p.title || '').toLowerCase().includes(paperSearch.toLowerCase()) ||
                            (p.subject || '').toLowerCase().includes(paperSearch.toLowerCase()) ||
                            (p.createdBy?.name || '').toLowerCase().includes(paperSearch.toLowerCase());
                        const matchesSubject = paperSubjectFilter === 'All' || (p.subject || '').toLowerCase().includes(paperSubjectFilter.toLowerCase());
                        const matchesClass = paperClassFilter === 'All' || (Array.isArray(p.classes) ? p.classes.includes(paperClassFilter) : String(p.classes || '').includes(paperClassFilter));
                        return matchesSearch && matchesSubject && matchesClass;
                    });

                    if (filtered.length === 0) {
                        return (
                            <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <span className="text-2xl block mb-2">📄</span>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">No faculty question papers match the selected criteria.</p>
                            </div>
                        );
                    }

                    return (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-400 bg-gray-50/50">
                                        <th className="py-3 px-4">Paper Details</th>
                                        <th className="py-3 px-3">Subject &amp; Class</th>
                                        <th className="py-3 px-3">Questions</th>
                                        <th className="py-3 px-3">Created By</th>
                                        <th className="py-3 px-3">Date</th>
                                        <th className="py-3 px-4 text-right">Actions &amp; CBT Launch</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-xs">
                                    {filtered.map((paper, pIdx) => {
                                        const qCount = Array.isArray(paper.questions) ? paper.questions.length : 0;
                                        const classDisplay = Array.isArray(paper.classes) ? paper.classes.join(', ') : (paper.classes || '12');

                                        return (
                                            <tr key={paper._id || pIdx} className="hover:bg-slate-50/60 transition">
                                                <td className="py-3.5 px-4">
                                                    <div className="font-bold text-navy text-sm">{paper.title || 'Untitled Paper'}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">{paper.examType || 'CET'} Format</div>
                                                </td>
                                                <td className="py-3.5 px-3">
                                                    <span className="font-semibold text-gray-800">{paper.subject || 'General'}</span>
                                                    <span className="block text-[10px] text-gray-400">Class {classDisplay}</span>
                                                </td>
                                                <td className="py-3.5 px-3 font-mono font-bold text-navy">
                                                    {qCount} Qs
                                                </td>
                                                <td className="py-3.5 px-3">
                                                    <span className="font-medium text-gray-700">{paper.createdBy?.name || paper.creatorName || 'Faculty Member'}</span>
                                                </td>
                                                <td className="py-3.5 px-3 text-[11px] text-gray-500">
                                                    {new Date(paper.createdAt || Date.now()).toLocaleDateString('en-GB')}
                                                </td>
                                                <td className="py-3.5 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => setSelectedViewExam(paper)}
                                                            className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-navy hover:text-white font-bold text-[10px] transition cursor-pointer"
                                                            title="Preview Full Paper"
                                                        >
                                                            👁️ View
                                                        </button>
                                                        <button
                                                            onClick={() => setSelectedAnswerKeyExam(paper)}
                                                            className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200 font-bold text-[10px] transition cursor-pointer"
                                                            title="Answer Key & SOE"
                                                        >
                                                            🔑 Key &amp; SOE
                                                        </button>
                                                        <button
                                                            onClick={() => handleLaunchPaperForCbt(paper)}
                                                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center gap-1"
                                                            title="Approve & Launch Live on Student Online CBT Portal"
                                                        >
                                                            <span>🚀</span> Approve for CBT
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePaper(paper._id, paper.title)}
                                                            className="px-2 py-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 text-xs transition cursor-pointer"
                                                            title="Delete Paper"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    );
                })()}
            </div>

            {/* ── MODAL: CREATE & COMMISSION EXAM ── */}
            {showCommissionModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                        <div className="flex justify-between items-center p-8 border-b border-gray-100 bg-gray-50/60">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Admin Commissioning Engine</span>
                                <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Create & Delegate Exam Assignment</h2>
                                <p className="text-xs text-gray-500 font-medium mt-1">Set the exam title and delegate question targets to authorized PCMB faculty.</p>
                            </div>
                            <button onClick={() => setShowCommissionModal(false)} className="text-slate/30 hover:text-red-500 bg-white rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold border border-gray-100 shadow transition">✕</button>
                        </div>

                        <form onSubmit={handleCommissionSubmit} className="p-8 overflow-y-auto space-y-6">
                            {/* Exam Title */}
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">
                                    Exam Title / Assessment Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. CET MOCK 1 or NEET GRAND TEST 2026"
                                    value={commissionForm.title}
                                    onChange={e => setCommissionForm({ ...commissionForm, title: e.target.value })}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-5 py-3.5 text-base font-bold text-navy outline-none bg-gray-50/50"
                                />
                            </div>

                            {/* Exam Preset & Target Class */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Exam Preset</label>
                                    <select
                                        value={commissionForm.examType}
                                        onChange={e => {
                                            const val = e.target.value;
                                            const defaultTarget = val === 'JEE' ? 25 : val === 'NEET' ? 45 : 60;
                                            setCommissionForm({ ...commissionForm, examType: val, targetPerSubject: defaultTarget });
                                        }}
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white cursor-pointer"
                                    >
                                        <option value="CET">CET (4 Subjects: Physics, Chemistry, Maths, Biology - 60 Qs each)</option>
                                        <option value="NEET">NEET (4 Subjects: Physics, Chemistry, Botany, Zoology - 45 Qs each)</option>
                                        <option value="JEE">JEE (3 Subjects: Physics, Chemistry, Mathematics - 25 Qs each [20 MCQs + 5 Numerical])</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Target Class</label>
                                    <select
                                        value={commissionForm.classes[0]}
                                        onChange={e => setCommissionForm({ ...commissionForm, classes: [e.target.value] })}
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white cursor-pointer"
                                    >
                                        <option value="12">Class 12</option>
                                        <option value="11">Class 11</option>
                                    </select>
                                </div>
                            </div>

                            {/* Per-Subject Faculty Assignment */}
                            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
                                <h4 className="text-xs font-black text-navy uppercase tracking-widest flex items-center gap-2">
                                    <span>👥</span> Assign Subject Faculty (PCMB Authorized Staff)
                                </h4>

                                {(() => {
                                    let subs = [];
                                    if (commissionForm.examType === 'NEET') subs = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
                                    else if (commissionForm.examType === 'JEE') subs = ['Physics', 'Chemistry', 'Mathematics'];
                                    else subs = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

                                    return subs.map(subName => {
                                        const subTeachers = allTeachers.filter(t => {
                                            const tSub = (t.subject || '').toLowerCase();
                                            const sName = subName.toLowerCase();
                                            if (sName === 'mathematics' && tSub.includes('math')) return true;
                                            if ((sName === 'botany' || sName === 'zoology') && (tSub.includes('bio') || tSub.includes(sName))) return true;
                                            return tSub.includes(sName);
                                        });

                                        return (
                                            <div key={subName} className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-center gap-3 min-w-[140px]">
                                                    <span className="w-8 h-8 bg-navy text-gold rounded-xl flex items-center justify-center font-black text-xs">
                                                        {subName.charAt(0)}
                                                    </span>
                                                    <span className="font-black text-sm text-navy uppercase">{subName}</span>
                                                </div>

                                                <div className="flex-1">
                                                    <select
                                                        value={commissionForm.assignedTeachers[subName] || ''}
                                                        onChange={e => setCommissionForm({
                                                            ...commissionForm,
                                                            assignedTeachers: { ...commissionForm.assignedTeachers, [subName]: e.target.value }
                                                        })}
                                                        className="w-full border border-gray-200 focus:border-navy rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-gray-50/50 cursor-pointer"
                                                    >
                                                        <option value="">-- Assign {subName} Teacher --</option>
                                                        {subTeachers.map(t => (
                                                            <option key={t._id} value={t._id}>
                                                                {t.name} ({t.email})
                                                            </option>
                                                        ))}
                                                        {subTeachers.length === 0 && (
                                                            <option value="" disabled>No registered {subName} faculty (will use department lead)</option>
                                                        )}
                                                    </select>
                                                </div>

                                                <div className="text-right text-[11px] font-bold text-slate/50">
                                                    Target: {commissionForm.targetPerSubject} Qs
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                            {/* Submit & Dispatch */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowCommissionModal(false)}
                                    className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-xs hover:bg-gray-100 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-3 rounded-xl bg-gold text-navy font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg"
                                >
                                    Proceed & Dispatch to Faculty
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODAL: VIEW FULL EXAM PAPER (PREVIEW QUESTIONS) ── */}
            {selectedViewExam && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                        <div className="flex justify-between items-center p-8 border-b border-gray-100 bg-gray-50/80">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Assessment Blueprint</span>
                                <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">{selectedViewExam.title}</h2>
                                <p className="text-xs text-gray-500 font-bold mt-1">
                                    Preset: {selectedViewExam.examType} • {selectedViewExam.allQuestions?.length || 0} Questions Compiled Across All Subjects
                                </p>
                            </div>
                            <button onClick={() => setSelectedViewExam(null)} className="text-slate/30 hover:text-red-500 bg-white rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold border border-gray-100 shadow transition">✕</button>
                        </div>

                        <div className="p-8 overflow-y-auto space-y-6 flex-1">
                            {(!selectedViewExam.allQuestions || selectedViewExam.allQuestions.length === 0) ? (
                                <div className="p-12 text-center text-slate/40 font-bold uppercase tracking-widest text-xs border-2 border-dashed border-gray-200 rounded-3xl">
                                    Zero questions added yet for this exam. Teachers will auto-fetch and submit questions for their assigned subjects.
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {selectedViewExam.allQuestions.map((q, qIdx) => {
                                        const isMTF = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0) || parseMTFFromText(q.questionText);
                                        const mtfData = parseMTFFromText(q.questionText);
                                        const diagramUrl = q.diagram || q.image || q.imageUrl || q.image_url;

                                        return (
                                            <div key={q._id || qIdx} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="font-black text-navy bg-gold/20 px-2.5 py-1 rounded">Q{qIdx + 1}. [{q.subject || 'Physics'}]</span>
                                                    <span className="text-gray-500 font-bold text-[10px] uppercase">
                                                        {isMTF ? 'Match the Columns' : q.statements?.length > 0 ? 'Statement-Based' : q.type || 'MCQ'} • {q.level || 'medium'}
                                                    </span>
                                                </div>

                                                {/* Question Stem */}
                                                <div className="text-sm font-semibold text-gray-800 leading-relaxed">
                                                    <MathRenderer text={mtfData ? mtfData.stem : (q.questionText || '')} />
                                                </div>

                                                {/* Sub-statements if present */}
                                                {q.statements && Array.isArray(q.statements) && q.statements.length > 0 && (
                                                    <div className="border-l-4 border-navy/40 pl-3 py-1 bg-slate-50 rounded-r-xl space-y-1 my-2">
                                                        {q.statements.map((stmt, si) => (
                                                            <div key={si} className="text-xs text-gray-700">
                                                                <span className="font-black text-navy mr-1.5">Statement {si + 1}:</span>
                                                                <MathRenderer inline text={stmt} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Assertion & Reason if present */}
                                                {q.assertion && (
                                                    <div className="bg-slate-50 p-3 rounded-xl border border-gray-200 space-y-1 text-xs">
                                                        <div>
                                                            <span className="font-black text-navy mr-1.5">Assertion (A):</span>
                                                            <MathRenderer inline text={q.assertion} />
                                                        </div>
                                                        {q.reason && (
                                                            <div>
                                                                <span className="font-black text-navy mr-1.5">Reason (R):</span>
                                                                <MathRenderer inline text={q.reason} />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* 2-Column Match the Columns Table if MTF */}
                                                {isMTF && (
                                                    <MatchTable question={q} />
                                                )}

                                                {/* Diagram / Image if present */}
                                                {diagramUrl && (
                                                    <div className="text-center my-3">
                                                        <img
                                                            src={diagramUrl}
                                                            alt="Question Diagram"
                                                            className="max-h-36 max-w-xs object-contain mx-auto rounded-lg border border-gray-200 shadow-sm"
                                                        />
                                                    </div>
                                                )}

                                                {/* Options */}
                                                {q.options && q.options.length > 0 && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                                                        {q.options.map((opt, oIdx) => (
                                                            <div key={oIdx} className="p-2.5 rounded-xl border border-gray-200 text-xs flex items-start gap-2 bg-gray-50/50">
                                                                <span className="font-bold text-navy">({String.fromCharCode(65 + oIdx)})</span>
                                                                <div className="min-w-0 flex-1">
                                                                    <MathRenderer inline text={opt || ''} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center p-6 border-t border-gray-100 bg-gray-50">
                            <div className="text-xs font-bold text-navy">
                                Total Questions: <span className="text-blue-700 font-black">{selectedViewExam.allQuestions?.length || 0}</span>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setSelectedAnalysisExam(selectedViewExam);
                                    }}
                                    className="px-6 py-2.5 rounded-xl bg-gold text-navy font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow"
                                >
                                    <span>📊</span> View Paper Analysis
                                </button>
                                <button
                                    onClick={() => setSelectedViewExam(null)}
                                    className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-xs hover:bg-gray-100 transition"
                                >
                                    Close Preview
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL: GENUINE PAPER ANALYSIS MODAL (NO FAKE DATA, CSV/PRINT EXPORT) ── */}
            {selectedAnalysisExam && (
                <PaperAnalysisModal
                    isOpen={!!selectedAnalysisExam}
                    onClose={() => setSelectedAnalysisExam(null)}
                    paperTitle={selectedAnalysisExam.title}
                    questions={selectedAnalysisExam.allQuestions || selectedAnalysisExam.questions || []}
                    examType={selectedAnalysisExam.examType || 'CET'}
                />
            )}

            {/* ── MODAL: COMPLETE ANSWER KEY & SOE (SOLUTIONS GUIDE) ── */}
            {selectedAnswerKeyExam && (() => {
                const exam = selectedAnswerKeyExam;
                const questions = exam.allQuestions || exam.questions || [];
                const filteredQuestions = soeSubjectFilter === 'All'
                    ? questions
                    : questions.filter(q => (q.subject || '').toLowerCase().includes(soeSubjectFilter.toLowerCase()));

                return (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 sm:p-8 border-b border-gray-200 bg-gray-50/90 gap-4">
                                <div>
                                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                        Answer Key &amp; SOE Solutions Suite
                                    </span>
                                    <h2 className="text-2xl font-black text-navy mt-1.5 uppercase tracking-tight">
                                        {exam.title}
                                    </h2>
                                    <p className="text-xs text-gray-500 font-bold">
                                        Official Answer Keys and Step-by-Step Explanations (SOE) for {questions.length} Questions
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => window.print()}
                                        className="bg-navy text-gold px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow cursor-pointer flex items-center gap-1.5"
                                    >
                                        <span>🖨️</span> Print SOE
                                    </button>
                                    <button
                                        onClick={() => setSelectedAnswerKeyExam(null)}
                                        className="text-slate/30 hover:text-red-500 bg-white rounded-full w-9 h-9 flex items-center justify-center text-xl font-bold border shadow transition cursor-pointer"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Filter Bar & Compact Answer Key Grid */}
                            <div className="p-6 bg-slate-50 border-b border-gray-200 space-y-4">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-navy uppercase tracking-wider">Filter Subject:</span>
                                        {['All', 'Physics', 'Chemistry', 'Mathematics', 'Biology'].map(sub => (
                                            <button
                                                key={sub}
                                                onClick={() => setSoeSubjectFilter(sub)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                                                    soeSubjectFilter === sub
                                                        ? 'bg-navy text-gold shadow-sm'
                                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                                }`}
                                            >
                                                {sub}
                                            </button>
                                        ))}
                                    </div>
                                    <span className="text-xs font-bold text-gray-500">
                                        Showing {filteredQuestions.length} of {questions.length} Questions
                                    </span>
                                </div>

                                {/* Compact Answer Key Strip */}
                                <div>
                                    <span className="text-[10px] font-black text-navy uppercase tracking-wider block mb-2">Quick Key Matrix:</span>
                                    <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-20 gap-1.5 max-h-36 overflow-y-auto p-2 bg-white rounded-xl border border-gray-200">
                                        {questions.map((q, idx) => (
                                            <div key={idx} className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-gray-50 border border-gray-200 text-center">
                                                <span className="text-[9px] font-bold text-gray-400">Q{idx + 1}</span>
                                                <span className="text-xs font-black text-navy">{q.answer || 'A'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Step-by-Step SOE List */}
                            <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 bg-white">
                                {filteredQuestions.map((q, idx) => {
                                    const origIdx = questions.findIndex(orig => (orig._id || orig.id) === (q._id || q.id));
                                    const qNo = origIdx >= 0 ? origIdx + 1 : idx + 1;

                                    return (
                                        <div key={idx} className="p-6 rounded-2xl border-2 border-gray-100 bg-white shadow-sm space-y-4 hover:border-navy/30 transition">
                                            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="w-8 h-8 rounded-xl bg-navy text-gold flex items-center justify-center text-xs font-black">
                                                        {qNo}
                                                    </span>
                                                    <span className="text-xs font-black text-navy uppercase bg-gold/20 px-2.5 py-1 rounded-md">
                                                        {q.subject || 'General'}
                                                    </span>
                                                    {q.chapter && (
                                                        <span className="text-[10px] text-gray-500 font-bold">
                                                            {q.chapter}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg">
                                                        Correct Answer: Option {q.answer || 'A'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Question Stem */}
                                            <div className="text-sm font-semibold text-gray-900 leading-relaxed">
                                                <MathRenderer text={q.questionText || ''} />
                                            </div>

                                            {/* Statements if any */}
                                            {q.statements && q.statements.length > 0 && (
                                                <div className="p-3 bg-gray-50 rounded-xl space-y-1.5 border border-gray-200 text-xs text-navy font-medium">
                                                    {q.statements.map((stmt, sIdx) => (
                                                        <div key={sIdx} className="flex gap-2">
                                                            <span className="font-bold">Statement {sIdx + 1}:</span>
                                                            <span><MathRenderer inline text={stmt} /></span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Options Grid */}
                                            {q.options && q.options.length > 0 && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                                    {q.options.map((opt, oIdx) => {
                                                        const optLetter = String.fromCharCode(65 + oIdx);
                                                        const isCorrect = (String(q.answer).toUpperCase() === optLetter);
                                                        const optText = typeof opt === 'object' ? (opt.text || opt.optionText || '') : String(opt || '');

                                                        return (
                                                            <div
                                                                key={oIdx}
                                                                className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                                                                    isCorrect
                                                                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                                                                        : 'bg-gray-50/70 border-gray-200 text-gray-700'
                                                                }`}
                                                            >
                                                                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black flex-shrink-0 ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-navy text-gold'}`}>
                                                                    {optLetter}
                                                                </span>
                                                                <div className="pt-0.5">
                                                                    <MathRenderer inline text={optText} />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Detailed Solution / SOE */}
                                            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 text-xs space-y-1">
                                                <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider block">
                                                    💡 Step-by-Step Solution &amp; Explanation (SOE):
                                                </span>
                                                <div className="text-gray-800 leading-relaxed font-medium">
                                                    {q.solutionText ? (
                                                        <MathRenderer text={q.solutionText} />
                                                    ) : (
                                                        <span className="text-gray-400 italic">No solution text provided for this question.</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end">
                                <button
                                    onClick={() => setSelectedAnswerKeyExam(null)}
                                    className="px-6 py-2 rounded-xl bg-navy text-gold font-bold text-xs uppercase tracking-wider cursor-pointer"
                                >
                                    Close Answer Key &amp; SOE
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── MODAL: 1-CLICK ONLINE CBT EXAM LAUNCH & DIRECT ACCESS ── */}
            {selectedOnlineLaunchExam && (() => {
                const exam = selectedOnlineLaunchExam;
                const staticPortalUrl = `${window.location.origin}/exam`;
                const studentUrl = `${window.location.origin}/exam/${exam._id}/instructions`;
                const examCode = exam._id.slice(-6).toUpperCase();
                const isLive = exam.status === 'live';

                return (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-navy text-white">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">🚀</span>
                                    <div>
                                        <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em]">
                                            Online CBT Exam Launcher
                                        </span>
                                        <h3 className="text-xl font-black uppercase tracking-tight">
                                            {exam.title}
                                        </h3>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedOnlineLaunchExam(null)}
                                    className="text-white/40 hover:text-white bg-white/10 rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border border-white/20 transition cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-6 sm:p-8 space-y-6">
                                {/* Current Status Card */}
                                <div className={`p-5 rounded-2xl border-2 flex items-center justify-between ${
                                    isLive
                                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                                        : 'bg-amber-50 border-amber-300 text-amber-900'
                                }`}>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-3 h-3 rounded-full ${isLive ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`}></span>
                                            <span className="text-xs font-black uppercase tracking-wider">
                                                Exam Status: {isLive ? 'LIVE FOR STUDENTS' : 'DRAFT / NOT STARTED'}
                                            </span>
                                        </div>
                                        <p className="text-xs font-medium mt-1">
                                            {isLive
                                                ? 'Students can currently access and submit their answers via the static portal.'
                                                : 'Click Start below to make this exam live for all students.'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleQuickLaunch(exam._id, isLive ? 'stop_now' : 'launch_now')}
                                        className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md cursor-pointer ${
                                            isLive
                                                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                        }`}
                                    >
                                        {isLive ? '⏹ Stop Exam' : '▶ Start Exam Now'}
                                    </button>
                                </div>

                                {/* PRIMARY: Static Universal Exam Portal Link */}
                                <div className="space-y-2 bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-black text-navy uppercase tracking-wider flex items-center gap-1.5">
                                            <span>🌟</span> Permanent Static Link (One Link For All Exams)
                                        </label>
                                        <span className="text-[10px] font-black bg-gold text-navy px-2 py-0.5 rounded uppercase">
                                            Recommended
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={staticPortalUrl}
                                            className="w-full bg-white border-2 border-amber-300 focus:border-navy rounded-xl p-3 text-xs font-mono text-navy outline-none font-bold shadow-inner"
                                        />
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(staticPortalUrl);
                                                setCopiedLink(true);
                                                setTimeout(() => setCopiedLink(false), 2500);
                                            }}
                                            className="bg-navy hover:bg-slate-800 text-gold px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider whitespace-nowrap shadow cursor-pointer transition flex items-center gap-1.5"
                                        >
                                            {copiedLink ? '✓ Copied!' : '📋 Copy Static Link'}
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-gray-600 font-medium">
                                        Share this permanent URL with all students once. It automatically displays whichever exam is currently active.
                                    </p>
                                </div>

                                {/* Direct Exam Access Code & Preview */}
                                <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Direct Exam Access Code</span>
                                        <span className="text-2xl font-black font-mono text-navy tracking-widest">{examCode}</span>
                                    </div>
                                    <a
                                        href={staticPortalUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-gold hover:bg-yellow-400 text-navy px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow transition cursor-pointer flex items-center gap-1.5"
                                    >
                                        <span>🌐</span> Open Portal ↗
                                    </a>
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                                <button
                                    onClick={() => setSelectedOnlineLaunchExam(null)}
                                    className="px-6 py-2 rounded-xl bg-gray-200 text-gray-700 font-bold text-xs uppercase tracking-wider hover:bg-gray-300 cursor-pointer"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── MODAL: MULTI-SET PQRS 4-SETS SUITE ── */}
            {selectedPqrsExam && (() => {
                const exam = selectedPqrsExam;
                const paperData = {
                    _id: exam.mergedPaperId || exam._id,
                    title: exam.title,
                    questions: exam.allQuestions || exam.questions || []
                };
                const allSets = generateAllPQRS(paperData);
                const currentSet = allSets[activePqrsSet] || paperData;
                const setQuestions = currentSet.questions || [];

                return (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-navy text-white">
                                <div>
                                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em]">
                                        Institutional Multi-Set Distribution
                                    </span>
                                    <h3 className="text-xl font-black uppercase tracking-tight mt-1">
                                        🔀 PQRS 4-Set Generation: {exam.title}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setSelectedPqrsExam(null)}
                                    className="text-white/40 hover:text-white bg-white/10 rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border border-white/20 transition cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-6 bg-slate-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-navy uppercase tracking-wider">Select Set:</span>
                                    {['P', 'Q', 'R', 'S'].map(setName => (
                                        <button
                                            key={setName}
                                            onClick={() => setActivePqrsSet(setName)}
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition cursor-pointer ${
                                                activePqrsSet === setName
                                                    ? 'bg-navy text-gold shadow-md border-2 border-gold scale-105'
                                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            Set {setName}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-3">
                                    {exam.mergedPaperId && (
                                        <button
                                            onClick={() => {
                                                navigate(`/admin/dashboard/preview/${exam.mergedPaperId}`);
                                            }}
                                            className="bg-navy text-gold px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow cursor-pointer flex items-center gap-1.5"
                                        >
                                            <span>🖨️</span> True A4 Preview &amp; Print
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-6 flex-1">
                                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 font-medium">
                                    {activePqrsSet === 'P' && '📄 Set P: Original question order & standard option alignment.'}
                                    {activePqrsSet === 'Q' && '🔀 Set Q: Deterministically randomized question sequence across all subjects.'}
                                    {activePqrsSet === 'R' && '🔀 Set R: Shuffled questions + shuffled options with mathematically recalculated answer keys.'}
                                    {activePqrsSet === 'S' && '🔀 Set S: Maximum permutation (double shuffle of both question stem and options).'}
                                </div>

                                {/* Answer Key Table for Current Set */}
                                <div>
                                    <span className="text-xs font-black text-navy uppercase tracking-wider block mb-3">
                                        Answer Key for Set {activePqrsSet} ({setQuestions.length} Questions):
                                    </span>
                                    <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-15 gap-2 max-h-72 overflow-y-auto p-3 bg-white rounded-2xl border border-gray-200">
                                        {setQuestions.map((q, idx) => (
                                            <div key={idx} className="flex flex-col items-center justify-center p-2 rounded-xl bg-gray-50 border border-gray-200 text-center">
                                                <span className="text-[10px] font-bold text-gray-400">Q{idx + 1}</span>
                                                <span className="text-sm font-black text-navy">{q.answer || 'A'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                                <button
                                    onClick={() => setSelectedPqrsExam(null)}
                                    className="px-6 py-2 rounded-xl bg-navy text-gold font-bold text-xs uppercase tracking-wider cursor-pointer"
                                >
                                    Close PQRS Center
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── MODAL: FACULTY ROSTER & OMR PERMISSION ACCESS CONTROL ── */}
            {showTeacherModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border-b-8 border-navy animate-fade-in-up overflow-hidden my-auto">
                        <div className="flex justify-between items-center p-6 sm:p-8 border-b border-gray-100 bg-gray-50/60">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">RBAC &amp; Permissions</span>
                                <h2 className="text-xl sm:text-2xl font-black text-navy mt-2 uppercase tracking-tight">Faculty Roster &amp; OMR Evaluation Access</h2>
                                <p className="text-xs text-gray-500 font-medium mt-1">
                                    Control which faculty members have access to the OMR Evaluation &amp; Optical Scanner Module in their portal.
                                </p>
                            </div>
                            <button onClick={() => setShowTeacherModal(false)} className="text-slate/30 hover:text-red-500 bg-white rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold border border-gray-100 shadow transition cursor-pointer">✕</button>
                        </div>

                        <div className="p-6 sm:p-8 overflow-y-auto space-y-4">
                            {allTeachers.length === 0 ? (
                                <div className="p-8 text-center bg-gray-50 rounded-2xl">
                                    <p className="text-xs font-bold text-gray-500">No faculty members found. Create faculty accounts in Teacher Management.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="border-b border-gray-200 text-[10px] font-black uppercase text-gray-400 bg-gray-50/50">
                                                <th className="py-3 px-4">Faculty Member</th>
                                                <th className="py-3 px-3">Subject</th>
                                                <th className="py-3 px-3">Email</th>
                                                <th className="py-3 px-4 text-center">OMR Evaluation Access</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                                            {allTeachers.map((teacher) => {
                                                const hasAccess = teacher.omrAccess !== false;
                                                return (
                                                    <tr key={teacher._id} className="hover:bg-slate-50/60 transition">
                                                        <td className="py-3.5 px-4 font-bold text-navy text-sm">
                                                            {teacher.name}
                                                        </td>
                                                        <td className="py-3.5 px-3">
                                                            <span className="font-semibold text-gray-800 bg-gray-100 px-2.5 py-1 rounded-md">
                                                                {teacher.subject || 'General'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-3 font-mono text-gray-500">
                                                            {teacher.email}
                                                        </td>
                                                        <td className="py-3.5 px-4 text-center">
                                                            <button
                                                                onClick={() => handleToggleOmrAccess(teacher._id, hasAccess)}
                                                                className={`px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-wider transition shadow-2xs cursor-pointer flex items-center gap-1.5 mx-auto ${
                                                                    hasAccess
                                                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                                        : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
                                                                }`}
                                                            >
                                                                <span>{hasAccess ? '✓' : '✕'}</span>
                                                                <span>{hasAccess ? 'OMR Enabled' : 'OMR Disabled'}</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                            <span className="text-xs text-gray-500 font-medium">Total Faculty: <strong>{allTeachers.length}</strong></span>
                            <button
                                onClick={() => setShowTeacherModal(false)}
                                className="px-6 py-2 rounded-xl bg-navy text-gold font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* Admin wrapper for AssignmentGenerator — gets subject from URL param */
const AdminAssignmentWrapper = () => {
    const navigate = useNavigate();
    const subjectParam = window.location.pathname.split('/').pop();
    const subject = decodeURIComponent(subjectParam || 'Physics');
    return (
        <AssignmentGenerator
            onBack={() => navigate('/admin/dashboard')}
            adminMode={true}
            adminSubject={subject}
        />
    );
};

const AdminNotificationBell = () => {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/api/notifications');
            setNotifications(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // 30s low-overhead polling
        return () => clearInterval(interval);
    }, []);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const handleMarkAsRead = async (id) => {
        try {
            await api.put(`/api/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (err) {
            console.error('Error marking notification read:', err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.put('/api/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (err) {
            console.error('Error marking all read:', err);
        }
    };

    const handleReview = async (notif) => {
        await handleMarkAsRead(notif.id);
        setIsOpen(false);
        if (notif.related_paper_id) {
            navigate(`/admin/dashboard/preview/${notif.related_paper_id}`);
        } else {
            navigate('/admin/dashboard/exams');
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-gold/30 text-gold transition flex items-center justify-center cursor-pointer"
                title="Notifications"
            >
                <span className="text-base">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse border border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border-2 border-gold/40 z-[100] text-gray-800 overflow-hidden animate-fade-in-up">
                    <div className="p-3.5 bg-navy text-white flex justify-between items-center border-b border-gold/20">
                        <div className="flex items-center gap-2">
                            <span className="text-gold text-sm font-black uppercase tracking-wider">Notifications</span>
                            {unreadCount > 0 && (
                                <span className="bg-gold text-navy text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                    {unreadCount} New
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-[10px] text-gold/80 hover:text-gold font-bold underline"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-xs font-medium">
                                No notifications yet.
                            </div>
                        ) : (
                            notifications.slice(0, 15).map(n => (
                                <div
                                    key={n.id}
                                    className={`p-3.5 transition flex flex-col gap-1.5 ${n.is_read ? 'bg-white hover:bg-gray-50/80' : 'bg-blue-50/70 hover:bg-blue-50 border-l-4 border-l-gold'}`}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <h4 className="font-bold text-xs text-navy leading-snug">
                                            {n.title}
                                        </h4>
                                        <span className="text-[9px] text-gray-400 font-semibold whitespace-nowrap">
                                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-600 leading-relaxed font-medium">
                                        {n.message}
                                    </p>
                                    <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-gray-100/60">
                                        <span className="text-[9px] text-gray-400 font-semibold">
                                            Teacher: {n.sender_name}
                                        </span>
                                        <button
                                            onClick={() => handleReview(n)}
                                            className="bg-navy hover:bg-gold hover:text-navy text-gold text-[10px] font-black px-3 py-1 rounded-lg transition shadow-xs uppercase tracking-wider flex items-center gap-1"
                                        >
                                            <span>Review Now</span>
                                            <span>→</span>
                                        </button>
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

const AdminDashboard = () => {

    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            {/* Top Navigation Bar - Manchester Navy with Right Corner Dashboard Menu */}
            <nav className="bg-navy p-4 text-white flex justify-between items-center relative z-50 shadow-2xl border-b-4 border-gold">
                <div 
                    className="flex items-center cursor-pointer hover:opacity-80 transition gap-4 ml-4"
                    onClick={() => navigate('/admin/dashboard')}
                >
                    <div className="w-12 h-12 flex items-center justify-center shadow-lg transform -rotate-2 hover:rotate-0 transition-transform duration-300">
                        <img src="/ManchesterLogo.jpeg" alt="Logo" className="w-full h-full object-contain rounded-lg border-2 border-gold/30" />
                    </div>
                    <h1 className="text-xl font-black tracking-tight uppercase">
                        Admin Portal
                    </h1>
                </div>
                
                <div className="space-x-3 flex items-center mr-4">
                    <Link 
                        to="/admin/dashboard/exams" 
                        className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-1.5 ${location.pathname.includes('/exams') ? 'bg-gold text-navy shadow-lg' : 'bg-white/5 text-gold border border-gold/30 hover:bg-white/10'}`}
                    >
                        Exams
                    </Link>
                    <Link 
                        to="/admin/dashboard/results" 
                        className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-1.5 ${location.pathname.includes('/results') ? 'bg-gold text-navy shadow-lg' : 'bg-white/5 text-gold border border-gold/30 hover:bg-white/10'}`}
                    >
                        Results
                    </Link>
                    <Link 
                        to="/admin/dashboard/grand-tests" 
                        className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${location.pathname.includes('grand-tests') ? 'bg-gold text-navy shadow-lg' : 'bg-white/5 text-gold border border-gold/30 hover:bg-white/10'}`}
                    >
                        GT Papers
                    </Link>
                    <Link 
                        to="/admin/dashboard/previous-year-papers" 
                        className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${location.pathname.includes('previous-year-papers') ? 'bg-gold text-navy shadow-lg' : 'bg-white/5 text-gold border border-gold/30 hover:bg-white/10'}`}
                    >
                        PYQs
                    </Link>

                    {/* Notification Center */}
                    <AdminNotificationBell />

                    {/* Right Corner Menu Button (☰) */}
                    <button
                        onClick={() => setIsAdminMenuOpen(true)}
                        className="text-gold hover:text-white text-2xl font-black p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer flex items-center justify-center leading-none"
                        title="Open Admin Menu"
                    >
                        ☰
                    </button>

                    <div className="w-px h-8 bg-gold/20 mx-1"></div>
                    <button 
                        onClick={() => { logout(); navigate('/'); }} 
                        className="bg-red-500/10 border border-red-500/30 text-red-500 px-5 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm cursor-pointer"
                    >
                        Logout
                    </button>
                </div>
            </nav>

            {/* ── Admin Right Slide-Over Menu (right-0, border-l-4 border-gold) ── */}
            {isAdminMenuOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs transition-opacity"
                        onClick={() => setIsAdminMenuOpen(false)}
                    />
                    <div className="fixed inset-y-0 right-0 w-80 bg-navy text-white z-50 shadow-2xl border-l-4 border-gold flex flex-col animate-slide-left overflow-y-auto">
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-gold/20 flex justify-between items-start bg-navy/90">
                            <div className="flex items-center gap-3">
                                <img src="/ManchesterLogo.jpeg" alt="Logo" className="w-10 h-10 object-contain rounded-lg border border-gold/40" />
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-wide text-white">Manchester Admin</h3>
                                    <p className="text-[10px] text-gold font-bold uppercase tracking-widest">Institutional Oversight</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAdminMenuOpen(false)}
                                className="text-gold hover:text-white text-xl font-bold w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Drawer Navigation Links */}
                        <div className="px-4 py-4 space-y-1.5 flex-1">
                            <button
                                onClick={() => { setIsAdminMenuOpen(false); navigate('/admin/dashboard'); }}
                                className="w-full text-left px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-200 hover:bg-white/10 hover:text-gold transition flex items-center gap-3 cursor-pointer"
                            >
                                <span>🏛️</span> Dashboard Home
                            </button>
                            <button
                                onClick={() => { setIsAdminMenuOpen(false); navigate('/admin/dashboard/exams'); }}
                                className="w-full text-left px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-200 hover:bg-white/10 hover:text-gold transition flex items-center gap-3 cursor-pointer"
                            >
                                <span>⚡</span> Exam Management
                            </button>
                            <button
                                onClick={() => { setIsAdminMenuOpen(false); navigate('/admin/dashboard/results'); }}
                                className="w-full text-left px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-200 hover:bg-white/10 hover:text-gold transition flex items-center gap-3 cursor-pointer"
                            >
                                <span>📊</span> Results &amp; Scorecards
                            </button>
                            <button
                                onClick={() => { setIsAdminMenuOpen(false); navigate('/admin/dashboard/grand-tests'); }}
                                className="w-full text-left px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-200 hover:bg-white/10 hover:text-gold transition flex items-center gap-3 cursor-pointer"
                            >
                                <span>🏆</span> Grand Test Papers
                            </button>
                            <button
                                onClick={() => { setIsAdminMenuOpen(false); navigate('/admin/dashboard/previous-year-papers'); }}
                                className="w-full text-left px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-200 hover:bg-white/10 hover:text-gold transition flex items-center gap-3 cursor-pointer"
                            >
                                <span>📚</span> PYQ Archives
                            </button>
                            <button
                                onClick={() => { setIsAdminMenuOpen(false); navigate('/admin/dashboard/exam-blueprints'); }}
                                className="w-full text-left px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-200 hover:bg-white/10 hover:text-gold transition flex items-center gap-3 cursor-pointer"
                            >
                                <span>📐</span> Exam Blueprints
                            </button>
                            <button
                                onClick={() => { setIsAdminMenuOpen(false); navigate('/admin/dashboard/upload-template'); }}
                                className="w-full text-left px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-200 hover:bg-white/10 hover:text-gold transition flex items-center gap-3 cursor-pointer"
                            >
                                <span>🖼️</span> Institutional Templates
                            </button>
                            <button
                                onClick={() => { setIsAdminMenuOpen(false); navigate('/admin/dashboard/create-teacher'); }}
                                className="w-full text-left px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-200 hover:bg-white/10 hover:text-gold transition flex items-center gap-3 cursor-pointer"
                            >
                                <span>👤</span> Teacher Management
                            </button>
                            <button
                                onClick={() => { setIsAdminMenuOpen(false); navigate('/admin/dashboard/test-module'); }}
                                className="w-full text-left px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-emerald-300 hover:bg-white/10 transition flex items-center gap-3 cursor-pointer"
                            >
                                <span>🔒</span> Security &amp; Test Module
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

            <div className="flex-1 p-10 max-w-7xl mx-auto w-full">
                <Routes>
                    <Route path="/" element={<DashboardHome />} />
                    <Route path="test-module" element={<TestModule />} />
                    <Route path="upload-template" element={<UploadTemplate />} />
                    <Route path="create-teacher" element={<CreateTeacher />} />
                    <Route path="subject/:subject" element={<SubjectDetails />} />
                    <Route path="preview/:paperId" element={<AdminPaperPreview />} />
                    <Route path="exams" element={<ExamManagement />} />
                    <Route path="results" element={<AdminResults />} />
                    <Route path="grand-tests" element={<GrandTestList />} />
                    <Route path="previous-year-papers" element={<PreviousYearPapers />} />
                    <Route path="exam-blueprints" element={<ExamBlueprints />} />
                    <Route path="assignments/:subject" element={<AdminAssignmentWrapper />} />
                </Routes>
            </div>
        </div>
    );
};

export default AdminDashboard;
