import React, { useContext, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import UploadTemplate from './UploadTemplate';
import CreateTeacher from './CreateTeacher';
import SubjectDetails from './SubjectDetails';
import AdminPaperPreview from './AdminPaperPreview';
import ExamManagement from './ExamManagement';
import AdminResults from './AdminResults';
import AdminQuestionBank from './AdminQuestionBank';
import GrandTestList from './GrandTestList';
import PreviousYearPapers from './PreviousYearPapers';
import ExamBlueprints from './ExamBlueprints';
import AssignmentGenerator from '../teacher/AssignmentGenerator';

const DashboardHome = () => {
    const subjects = ['Physics', 'Chemistry', 'Biology', 'Maths', 'Computer Science', 'Kannada', 'English', 'Hindi'];
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
        <div className="animate-fade-in-up">
            <div className="mb-8 bg-surface p-8 rounded-3xl shadow-sm border-l-8 border-navy relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full -mr-16 -mt-16"></div>
                <h3 className="font-black text-2xl text-navy mb-2">Welcome to the Administration</h3>
                <p className="text-slate/70 font-medium text-sm max-w-2xl leading-relaxed">
                    Manage the official college assessment system. Upload institutional paper templates, onboard teaching staff, and monitor academic progress across all departments.
                </p>
            </div>

            <div className="flex items-center gap-4 mb-8">
                <h2 className="text-sm font-black text-navy uppercase tracking-[0.2em]">Subject Directory</h2>
                <div className="h-px flex-1 bg-gray-100"></div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {subjects.map(sub => (
                    <Link 
                        to={`/admin/dashboard/subject/${sub}`}
                        key={sub}
                        className="bg-surface p-8 rounded-3xl shadow-sm text-center font-black text-lg transition border border-gray-100 text-slate hover:shadow-xl hover:border-gold hover:text-navy transform hover:-translate-y-2 flex flex-col items-center justify-center gap-4 group"
                    >
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner group-hover:scale-110 transition-transform duration-300">
                            <img 
                                src={logoMap[sub]} 
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

const AdminDashboard = () => {

    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            {/* Top Navigation Bar - Manchester Navy */}
            <nav className="bg-navy p-4 text-white flex justify-between items-center z-10 shadow-2xl border-b-4 border-gold">
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
                
                <div className="space-x-4 flex items-center mr-4">
                    <Link 
                        to="/admin/dashboard/exams" 
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2 ${location.pathname.includes('/exams') ? 'bg-gold text-navy shadow-lg' : 'bg-white/5 text-gold border border-gold/30 hover:bg-white/10'}`}
                    >
                        Exams
                    </Link>
                    <Link 
                        to="/admin/dashboard/results" 
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2 ${location.pathname.includes('/results') ? 'bg-gold text-navy shadow-lg' : 'bg-white/5 text-gold border border-gold/30 hover:bg-white/10'}`}
                    >
                        Results
                    </Link>
                    <Link 
                        to="/admin/dashboard/grand-tests" 
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${location.pathname.includes('grand-tests') ? 'bg-gold text-navy shadow-lg' : 'bg-white/5 text-gold border border-gold/30 hover:bg-white/10'}`}
                    >
                        GT Papers
                    </Link>
                    <Link 
                        to="/admin/dashboard/previous-year-papers" 
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${location.pathname.includes('previous-year-papers') ? 'bg-gold text-navy shadow-lg' : 'bg-white/5 text-gold border border-gold/30 hover:bg-white/10'}`}
                    >
                        PYQs
                    </Link>
                    <Link 
                        to="/admin/dashboard/exam-blueprints" 
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${location.pathname.includes('exam-blueprints') ? 'bg-gold text-navy shadow-lg' : 'bg-white/5 text-gold border border-gold/30 hover:bg-white/10'}`}
                    >
                        Blueprints
                    </Link>
                    <Link 
                        to="/admin/dashboard/upload-template" 
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2 ${location.pathname.includes('upload-template') ? 'bg-gold text-navy shadow-lg' : 'bg-white/5 text-gold border border-gold/30 hover:bg-white/10'}`}
                    >
                        Templates
                    </Link>
                    <Link 
                        to="/admin/dashboard/create-teacher" 
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2 ${location.pathname.includes('create-teacher') ? 'bg-gold text-navy shadow-lg' : 'bg-white/5 text-gold border border-gold/30 hover:bg-white/10'}`}
                    >
                        + Teacher
                    </Link>
                    <div className="w-px h-8 bg-gold/20 mx-2"></div>
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

                    <Route path="/" element={<DashboardHome />} />
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
