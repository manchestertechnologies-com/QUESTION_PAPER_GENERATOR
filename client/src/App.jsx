import React, { useEffect, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { LoadingProvider, useLoading } from './context/LoadingContext';
import { setLoadingCallback } from './api';
import UnifiedLogin from './pages/auth/UnifiedLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import CreatePaper from './pages/teacher/CreatePaper';

// New exam & lab pages
import LabLogin from './pages/lab/LabLogin';
import LabExamList from './pages/lab/LabExamList';
import StudentLabPortal from './pages/exam/StudentLabPortal';
import StaticExamPortal from './pages/exam/StaticExamPortal';
import ExamInstructions from './pages/exam/ExamInstructions';
import ExamEngine from './pages/exam/ExamEngine';
import Scorecard from './pages/exam/Scorecard';
import Disqualified from './pages/exam/Disqualified';
import BridgeApp from './pages/admin/BridgeApp';

// ── App Loader Linker ────────────────────────────────────────────────────────
const ApiLoaderLinker = ({ children }) => {
    const { showLoader, hideLoader } = useLoading();

    useEffect(() => {
        setLoadingCallback((isLoading) => {
            if (isLoading) showLoader();
            else hideLoader();
        });
        return () => setLoadingCallback(() => {});
    }, [showLoader, hideLoader]);

    return children;
};

const AppLoadingSpinner = () => (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 font-sans animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center p-2.5 mb-5 border-2 border-gold/30">
            <img src="/ManchesterLogo.jpeg" alt="Manchester College" className="w-full h-full object-contain" />
        </div>
        <div className="w-8 h-8 border-4 border-navy border-t-gold rounded-full animate-spin mb-3"></div>
        <h3 className="text-sm font-black text-navy uppercase tracking-widest">Manchester College</h3>
        <p className="text-[10px] text-slate/40 font-bold uppercase tracking-wider mt-1">Connecting to Secure Assessment Network...</p>
    </div>
);

const ProtectedRoute = ({ children, role }) => {
    const { user, loading } = useContext(AuthContext);
    if (loading) return <AppLoadingSpinner />;
    if (!user) return <Navigate to="/" />;
    if (role) {
        const allowedRoles = Array.isArray(role) ? role : [role];
        if (!allowedRoles.includes(user.role)) return <Navigate to="/" />;
    }
    return children;
};

function App() {
  return (
    <LoadingProvider>
        <AuthProvider>
            <ApiLoaderLinker>
                <Router>
                    <Routes>
                        {/* Unified Public Login */}
                        <Route path="/" element={<UnifiedLogin />} />

                        {/* Admin Routes */}
                        <Route path="/admin/dashboard/*" element={
                            <ProtectedRoute role="admin">
                                <AdminDashboard />
                            </ProtectedRoute>
                        } />

                        {/* Teacher Routes */}
                        <Route path="/teacher/dashboard/*" element={
                            <ProtectedRoute role="teacher">
                                <TeacherDashboard />
                            </ProtectedRoute>
                        } />
                        <Route path="/teacher/create-paper" element={
                            <ProtectedRoute role={['teacher', 'admin']}>
                                <CreatePaper />
                            </ProtectedRoute>
                        } />

                        {/* ── Dedicated Student Lab Examination Portal ── */}
                        <Route path="/lab-exam" element={<StudentLabPortal />} />
                        <Route path="/student-exam" element={<Navigate to="/lab-exam" replace />} />
                        <Route path="/student/exam" element={<Navigate to="/lab-exam" replace />} />
                        <Route path="/lab" element={<StudentLabPortal />} />
                        <Route path="/lab-login" element={<LabLogin />} />
                        <Route path="/lab/exams" element={<LabExamList />} />

                        {/* ── Teacher OMR Route ── */}
                        <Route path="/teacher/omr" element={<Navigate to="/teacher/dashboard/omr" replace />} />

                        {/* ── Static Universal Exam Portal ── */}
                        <Route path="/exam" element={<StaticExamPortal />} />
                        <Route path="/online-exam" element={<StaticExamPortal />} />
                        <Route path="/exam-portal" element={<StaticExamPortal />} />
                        <Route path="/exam/portal" element={<StaticExamPortal />} />

                        {/* ── Exam Flow (Public — accessible via shared link or lab) ── */}
                        <Route path="/exam/:examId/instructions" element={<ExamInstructions />} />
                        <Route path="/exam/:examId" element={<ExamEngine />} />
                        <Route path="/exam/:examId/scorecard/:sessionId" element={<Scorecard />} />
                        <Route path="/exam/disqualified" element={<Disqualified />} />

                        {/* ── Admin Bridge App ── */}
                        <Route path="/admin/bridge" element={
                            <ProtectedRoute role="admin">
                                <BridgeApp />
                            </ProtectedRoute>
                        } />
                        <Route path="/bridge-app" element={<BridgeApp />} />

                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </Router>
            </ApiLoaderLinker>
        </AuthProvider>
    </LoadingProvider>
  );
}

export default App;
