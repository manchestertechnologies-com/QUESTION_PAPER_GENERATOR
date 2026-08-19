import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';

const SubjectDetails = () => {
    const { subject } = useParams();
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const [teachers, setTeachers] = useState([]);
    const [allTeachers, setAllTeachers] = useState([]);
    const [papers, setPapers] = useState([]);
    const [commissionedExams, setCommissionedExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('teachers');
    const [selectedViewPaper, setSelectedViewPaper] = useState(null);
    const [showCommissionModal, setShowCommissionModal] = useState(false);

    // Commission Form State
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

    const fetchData = async () => {
        try {
            const [teachersRes, papersRes] = await Promise.all([
                api.get('/api/admin/teachers'),
                api.get('/api/papers/admin/all')
            ]);
            const allT = teachersRes.data || [];
            setAllTeachers(allT);
            setTeachers(allT.filter(t => t.subject === subject));
            setPapers(papersRes.data.filter(p => p.subject === subject));

            // Fetch commissioned exams if endpoint available
            try {
                const commRes = await api.get('/api/exams/commissioned');
                setCommissionedExams(commRes.data || []);
            } catch {
                // optional fallback
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

    useEffect(() => {
        fetchData();
    }, [subject]);

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
                subjectsNeeded = [subject];
            }

            const subjectAssignments = subjectsNeeded.map(subName => {
                const assignedTeacherId = commissionForm.assignedTeachers[subName];
                const teacherObj = allTeachers.find(t => t._id === assignedTeacherId) || allTeachers.find(t => t.subject?.toLowerCase() === subName.toLowerCase());
                return {
                    subject: subName,
                    teacherId: teacherObj ? teacherObj._id : undefined,
                    teacherName: teacherObj ? teacherObj.name : `Prof. ${subName} Faculty`,
                    teacherEmail: teacherObj ? teacherObj.email : `${subName.toLowerCase()}@manchester.edu`,
                    targetQuestions: commissionForm.targetPerSubject || 60,
                    status: 'Pending'
                };
            });

            await api.post('/api/exams/commission', {
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
            fetchData();
        } catch (err) {
            console.error(err);
            alert('Failed to commission exam. Please try again.');
        }
    };

    const handleDeleteTeacher = async (id) => {
        if(window.confirm('Are you sure you want to delete this teacher?')) {
            try {
                await api.delete(`/api/admin/teachers/${id}`);
                fetchData();
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await api.put(`/api/papers/admin/${id}/status`, { status });
            fetchData();
        } catch (err) {
            console.error(err);
            alert('Failed to update status');
        }
    };

    if (loading) return <div className="text-center p-10 text-lg">Loading Directory Data...</div>;

    return (
        <div className="space-y-8 animate-fade-in-up px-4 py-8">
            <div className="bg-surface p-10 rounded-[2.5rem] shadow-sm border border-gray-100 border-l-8 border-navy flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-6">
                    {logoMap[subject] && (
                        <div className="w-20 h-20 bg-white p-3 rounded-3xl shadow-xl border border-gray-50 flex items-center justify-center transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                            <img src={logoMap[subject]} alt={subject} className="w-full h-full object-contain" />
                        </div>
                    )}
                    <div>
                        <h3 className="font-black text-3xl text-navy mb-2 uppercase tracking-tight">{subject} Division</h3>
                        <p className="text-[10px] font-black text-slate/40 uppercase tracking-[0.2em] ml-1">Departmental Asset & Faculty Control</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowCommissionModal(true)} 
                        className="bg-navy text-gold px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg flex items-center gap-2 border-2 border-gold"
                    >
                        <span>⚡</span> Commission Exam to Faculty
                    </button>
                    <button onClick={() => navigate('/admin/dashboard')} className="bg-white border-2 border-gray-100 text-slate/40 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-navy hover:text-navy transition shadow-sm">← Back</button>
                </div>
            </div>
            
            {/* Tabs for switching views */}
            <div className="flex gap-4 p-2 bg-gray-100 rounded-3xl w-fit">
                <button 
                    onClick={() => setActiveTab('teachers')}
                    className={`px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'teachers' ? 'bg-navy text-gold shadow-lg' : 'text-slate/40 hover:text-navy'}`}
                >
                    Faculty List
                </button>
                <button 
                    onClick={() => setActiveTab('papers')}
                    className={`px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'papers' ? 'bg-navy text-gold shadow-lg' : 'text-slate/40 hover:text-navy'}`}
                >
                    Question Papers
                </button>
            </div>

            {/* Teachers List */}
            {activeTab === 'teachers' && (
                <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100 animate-fade-in-up">
                    <h3 className="text-sm font-black mb-8 text-navy flex items-center gap-4 uppercase tracking-widest">
                        <span className="bg-gold text-navy w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg rotate-3">{teachers.length}</span>
                        Authorized Staff
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="text-navy/40 text-[10px] uppercase tracking-widest border-b-2 border-gray-100">
                                    <th className="p-5 text-left w-16">ID</th>
                                    <th className="p-5 text-left">Faculty Name</th>
                                    <th className="p-5 text-left">Digital Identity</th>
                                    <th className="p-5 text-center w-32">Administrative</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teachers.map((t, index) => (
                                    <tr key={t._id} className="border-b border-gray-50 hover:bg-navy/[0.02] transition">
                                        <td className="p-5 text-navy font-black opacity-30">{String(index + 1).padStart(2, '0')}</td>
                                        <td className="p-5 font-black text-navy">{t.name}</td>
                                        <td className="p-5 text-navy/60 font-medium">{t.email}</td>
                                        <td className="p-5 text-center">
                                            <button onClick={() => handleDeleteTeacher(t._id)} className="bg-red-50 text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl transition shadow-sm">Revoke</button>
                                        </td>
                                    </tr>
                                ))}
                                {teachers.length === 0 && <tr><td colSpan="4" className="text-center p-12 text-slate/30 font-bold uppercase tracking-widest text-xs italic">No faculty currently assigned to this division.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Generated Papers */}
            {activeTab === 'papers' && (
                <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100 animate-fade-in-up">
                    <h3 className="text-sm font-black mb-10 text-navy flex items-center gap-4 uppercase tracking-widest">
                        <span className="bg-gold text-navy w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg rotate-3">{papers.length}</span>
                        Departmental Archives
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {papers.map(p => {
                            const creator = teachers.find(t => t._id === p.teacherId) || allTeachers.find(t => t._id === p.teacherId);
                            const creatorName = creator ? creator.name : 'Institutional Engine';

                            return (
                                <div key={p._id} className="border-2 border-gray-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:border-navy/10 transition-all bg-white flex flex-col justify-between h-full relative group overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-navy/5 -mr-12 -mt-12 rounded-full group-hover:scale-150 transition-all duration-500"></div>
                                    <div className="mb-6 relative">
                                        <h4 className="font-black text-navy text-xl mb-4 leading-tight tracking-tight uppercase">{p.title}</h4>
                                        <div className="space-y-3 text-[10px] font-black text-slate/50 uppercase tracking-widest">
                                            <p className="flex justify-between border-b border-gray-50 pb-2"><span>Archivist</span> <span className="text-navy">{creatorName}</span></p>
                                            <p className="flex justify-between border-b border-gray-50 pb-2"><span>Target Class</span> <span className="text-navy">{p.classes.join(', ')}</span></p>
                                            <p className="flex justify-between border-b border-gray-50 pb-2"><span>Volume</span> <span className="text-navy">{p.questions.length} Qs</span></p>
                                            <p className="flex justify-between border-b border-gray-50 pb-2"><span>Timestamp</span> <span className="text-navy">{new Date(p.createdAt).toLocaleDateString()}</span></p>
                                            <div className="pt-4">
                                                <p className="flex items-center gap-3">
                                                    <span>Protocol Status:</span>
                                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest ${p.status === 'Approved' ? 'bg-navy text-gold' : p.status === 'Rejected' ? 'bg-red-500 text-white' : 'bg-gray-100 text-slate/40'}`}>
                                                        {p.status || 'Pending'}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mt-auto relative">
                                        <button onClick={() => handleStatusUpdate(p._id, 'Rejected')} className="bg-gray-50 text-red-500 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition shadow-sm">Reject</button>
                                        <button onClick={() => handleStatusUpdate(p._id, 'Approved')} className="bg-navy text-gold py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition shadow-lg">Approve</button>
                                        <button onClick={() => setSelectedViewPaper(p)} className="col-span-2 bg-white border-2 border-navy/20 text-navy hover:bg-navy hover:text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition shadow-sm flex items-center justify-center gap-2">
                                            <span>👁</span> View
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {papers.length === 0 && <div className="col-span-full p-16 text-center text-slate/30 font-black uppercase tracking-widest text-sm border-2 border-dashed border-gray-100 rounded-[3rem] bg-gray-50/50">Zero assessment records found for this department.</div>}
                    </div>
                </div>
            )}

            {/* Commission Exam Modal (Admin creates title, selects exam type, and assigns dedicated teachers) */}
            {showCommissionModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                        <div className="flex justify-between items-center p-8 border-b border-gray-100 bg-gray-50/60">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Admin Commissioning Engine</span>
                                <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Create & Delegate Exam Assignment</h2>
                                <p className="text-xs text-gray-500 font-medium mt-1">Set the exam title and assign authorized teachers for each subject.</p>
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
                                    placeholder="e.g. CET MOCK TEST 1 or NEET GRAND TEST 2026"
                                    value={commissionForm.title}
                                    onChange={e => setCommissionForm({ ...commissionForm, title: e.target.value })}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-5 py-3.5 text-base font-bold text-navy outline-none bg-gray-50/50"
                                />
                            </div>

                            {/* Exam Type & Class */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Exam Preset</label>
                                    <select
                                        value={commissionForm.examType}
                                        onChange={e => {
                                            const val = e.target.value;
                                            const defaultTarget = val === 'JEE' ? 30 : val === 'NEET' ? 50 : 60;
                                            setCommissionForm({ ...commissionForm, examType: val, targetPerSubject: defaultTarget });
                                        }}
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white cursor-pointer"
                                    >
                                        <option value="CET">CET (4 Subjects: Physics, Chemistry, Maths, Biology)</option>
                                        <option value="NEET">NEET (4 Subjects: Physics, Chemistry, Botany, Zoology)</option>
                                        <option value="JEE">JEE (3 Subjects: Physics, Chemistry, Mathematics)</option>
                                        <option value="SINGLE">Single Subject ({subject})</option>
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

                            {/* Per-Subject Teacher Delegation */}
                            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
                                <h4 className="text-xs font-black text-navy uppercase tracking-widest flex items-center gap-2">
                                    <span>👥</span> Assign Subject Faculty (Only Authorized Subject Teachers)
                                </h4>

                                {(() => {
                                    let subs = [];
                                    if (commissionForm.examType === 'NEET') subs = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
                                    else if (commissionForm.examType === 'CET') subs = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
                                    else if (commissionForm.examType === 'JEE') subs = ['Physics', 'Chemistry', 'Mathematics'];
                                    else subs = [subject];

                                    return subs.map(subName => {
                                        // Filter teachers of this exact subject
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
                                                        <option value="">-- Choose {subName} Teacher --</option>
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

            {/* Exam / Subject Progress Monitor Modal */}
            {selectedViewPaper && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                        
                        {/* Header */}
                        <div className="flex justify-between items-center p-8 border-b border-gray-100 bg-gray-50/60">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Assessment Architecture</span>
                                <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">
                                    Type of Exam: <span className="text-blue-900">{selectedViewPaper.title}</span>
                                </h2>
                                <p className="text-xs text-slate/50 font-bold mt-1">
                                    Target Class: {selectedViewPaper.classes?.join(', ')} • Created: {new Date(selectedViewPaper.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <button onClick={() => setSelectedViewPaper(null)} className="text-slate/30 hover:text-red-500 bg-white rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold border border-gray-100 shadow transition">✕</button>
                        </div>

                        {/* Subject Progress Cards (NEET: 4 boxes, CET: 4 boxes, JEE: 3 boxes, or Department) */}
                        <div className="p-8 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {(() => {
                                    const titleUpper = (selectedViewPaper.title || '').toUpperCase();
                                    const isNeet = titleUpper.includes('NEET');
                                    const isCet = titleUpper.includes('CET') || titleUpper.includes('KCET');
                                    const isJee = titleUpper.includes('JEE');

                                    let subjectsList = [];
                                    if (isNeet) {
                                        subjectsList = [
                                            { name: 'Physics', target: 50, icon: '⚛️' },
                                            { name: 'Chemistry', target: 50, icon: '🧪' },
                                            { name: 'Botany', target: 50, icon: '🌿' },
                                            { name: 'Zoology', target: 50, icon: '🐾' }
                                        ];
                                    } else if (isCet) {
                                        subjectsList = [
                                            { name: 'Physics', target: 60, icon: '⚛️' },
                                            { name: 'Chemistry', target: 60, icon: '🧪' },
                                            { name: 'Mathematics', target: 60, icon: '📐' },
                                            { name: 'Biology', target: 60, icon: '🧬' }
                                        ];
                                    } else if (isJee) {
                                        subjectsList = [
                                            { name: 'Physics', target: 30, icon: '⚛️' },
                                            { name: 'Chemistry', target: 30, icon: '🧪' },
                                            { name: 'Mathematics', target: 30, icon: '📐' }
                                        ];
                                    } else {
                                        subjectsList = [
                                            { name: selectedViewPaper.subject || subject, target: selectedViewPaper.questions?.length || 60, icon: '📄' }
                                        ];
                                    }

                                    return subjectsList.map((subItem, idx) => {
                                        // Match distinct faculty for this specific subject
                                        const creator = allTeachers.find(t => {
                                            const tSub = (t.subject || '').toLowerCase();
                                            const sName = subItem.name.toLowerCase();
                                            if (sName === 'mathematics' && tSub.includes('math')) return true;
                                            if ((sName === 'botany' || sName === 'zoology') && (tSub.includes('bio') || tSub.includes(sName))) return true;
                                            return tSub.includes(sName);
                                        }) || (subItem.name.toLowerCase() === (selectedViewPaper.subject || '').toLowerCase() ? teachers.find(t => t._id === selectedViewPaper.teacherId) : null);

                                        const creatorName = creator ? creator.name : `Prof. ${subItem.name} Lead`;
                                        const creatorEmail = creator ? creator.email : `${subItem.name.toLowerCase()}.faculty@manchester.edu`;
                                        
                                        // Count questions matching subject
                                        const isCurrentSub = (selectedViewPaper.subject || '').toLowerCase().includes(subItem.name.toLowerCase()) || subItem.name.toLowerCase().includes((selectedViewPaper.subject || '').toLowerCase());
                                        const count = isCurrentSub ? (selectedViewPaper.questions?.length || 0) : 0;
                                        const pct = Math.min(100, Math.round((count / subItem.target) * 100));

                                        return (
                                            <div key={idx} className="border-2 border-navy/10 p-6 rounded-3xl bg-slate-50/50 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-navy transition">
                                                <div>
                                                    <div className="flex justify-between items-center mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-2xl">{subItem.icon}</span>
                                                            <h4 className="text-lg font-black text-navy uppercase tracking-tight">{subItem.name}</h4>
                                                        </div>
                                                        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${pct >= 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                                            {pct >= 100 ? 'Completed' : 'In Progress'}
                                                        </span>
                                                    </div>

                                                    {/* Teacher Info with Email */}
                                                    <div className="bg-white p-3 rounded-2xl border border-gray-200 mb-4 space-y-1">
                                                        <div className="flex justify-between text-xs font-bold text-navy">
                                                            <span>Archivist:</span>
                                                            <span>{creatorName}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[11px] text-gray-500 font-medium">
                                                            <span>Email:</span>
                                                            <span className="text-blue-600 underline font-mono">{creatorEmail}</span>
                                                        </div>
                                                    </div>

                                                    {/* Loading / Progress Line */}
                                                    <div className="mb-2">
                                                        <div className="flex justify-between text-xs font-black text-navy mb-1.5">
                                                            <span>Question Progress</span>
                                                            <span>{count} / {subItem.target} Qs ({pct}%)</span>
                                                        </div>
                                                        <div className="w-full h-3.5 bg-gray-200 rounded-full overflow-hidden border border-gray-300 p-0.5 shadow-inner">
                                                            <div 
                                                                style={{ width: `${pct}%` }} 
                                                                className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-600' : 'bg-amber-500'}`}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                                    <span>Standard NCERT Coverage</span>
                                                    <span className="text-navy">{subItem.target} Target Qs</span>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-between items-center p-6 border-t border-gray-100 bg-gray-50/50">
                            <div className="text-xs text-navy font-black">
                                Total Questions in This Subject Paper: <span className="text-blue-700">{selectedViewPaper.questions?.length} Questions</span>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setSelectedViewPaper(null)} className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-xs hover:bg-gray-100 transition">
                                    Close
                                </button>
                                <button onClick={() => navigate(`/admin/dashboard/preview/${selectedViewPaper._id}`)} className="px-8 py-2.5 rounded-xl bg-navy text-gold font-black text-xs uppercase tracking-widest hover:shadow-lg transition">
                                    Preview Full Paper
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubjectDetails;
