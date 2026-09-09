import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

const CreateTeacher = () => {
    const navigate = useNavigate();
    const [institutionName, setInstitutionName] = useState('Manchester PU College');
    const [institutionEmail, setInstitutionEmail] = useState('');
    
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        subject: 'Physics',
        institutionName: 'Manchester PU College',
        institutionEmail: '',
        status: 'active',
        isTrial: true
    });

    const [teachers, setTeachers] = useState([]);
    const [loadingTeachers, setLoadingTeachers] = useState(true);
    const [activeTab, setActiveTab] = useState('create'); // 'create' | 'manage'
    const [searchQuery, setSearchQuery] = useState('');

    const subjects = [
        'Physics',
        'Chemistry',
        'Botany',
        'Zoology',
        'Biology',
        'Mathematics',
        'Computer Science',
        'English',
        'Kannada',
        'Hindi'
    ];

    const fetchTeachers = async () => {
        try {
            setLoadingTeachers(true);
            const res = await api.get('/api/admin/teachers');
            setTeachers(res.data || []);
        } catch (err) {
            console.error('Failed to fetch teachers:', err);
        } finally {
            setLoadingTeachers(false);
        }
    };

    useEffect(() => {
        fetchTeachers();
    }, []);

    const handleInstitutionApply = () => {
        if (!institutionName.trim()) return alert('Please enter an Institution / College Name');
        setFormData(prev => ({
            ...prev,
            institutionName: institutionName.trim(),
            institutionEmail: institutionEmail.trim()
        }));
        alert(`Institution set to "${institutionName.trim()}". New teachers created will have this College Name automatically printed on their Question Papers and Assessments.`);
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                institutionName: formData.institutionName || institutionName || 'Manchester PU College',
                institutionEmail: formData.institutionEmail || institutionEmail || ''
            };
            await api.post('/api/admin/teachers', payload);
            alert(`Teacher account created successfully for ${formData.name} (${formData.email}) under ${payload.institutionName}!`);
            setFormData({
                name: '',
                email: '',
                password: '',
                subject: 'Physics',
                institutionName: institutionName || 'Manchester PU College',
                institutionEmail: institutionEmail || '',
                status: 'active',
                isTrial: true
            });
            setActiveTab('manage');
            fetchTeachers();
        } catch (err) {
            alert(err.response?.data?.msg || 'Error creating teacher account');
        }
    };

    const handleToggleStatus = async (teacher) => {
        const teacherId = teacher._id || teacher.id;
        const currentStatus = teacher.status || 'active';
        const nextStatus = currentStatus === 'active' ? 'disabled' : 'active';
        
        try {
            await api.patch(`/api/admin/teachers/${teacherId}/status`, { status: nextStatus });
            setTeachers(prev => prev.map(t => {
                if ((t._id || t.id) === teacherId) {
                    return { ...t, status: nextStatus };
                }
                return t;
            }));
        } catch (err) {
            alert(err.response?.data?.msg || 'Failed to update teacher status');
        }
    };

    const handleResetQuotas = async (teacher) => {
        const teacherId = teacher._id || teacher.id;
        if (!window.confirm(`Reset trial generation quotas for ${teacher.name}? This will reset Assessment, JEE, NEET, and CET paper usage back to 0/2.`)) return;

        try {
            await api.patch(`/api/admin/teachers/${teacherId}/quotas/reset`);
            alert(`Trial quotas successfully reset to 0/2 for ${teacher.name}!`);
            fetchTeachers();
        } catch (err) {
            alert(err.response?.data?.msg || 'Failed to reset quotas');
        }
    };

    const handleResetPassword = async (teacher) => {
        const newPass = window.prompt(`Enter new password for ${teacher.name} (${teacher.email}):`);
        if (!newPass || !newPass.trim()) return;
        const teacherId = teacher._id || teacher.id;
        try {
            await api.put(`/api/admin/teachers/${teacherId}/password`, { newPassword: newPass.trim() });
            alert(`Password updated successfully for ${teacher.name}!\nNew password: ${newPass.trim()}`);
        } catch (err) {
            alert(err.response?.data?.msg || 'Error resetting password');
        }
    };

    const handleRevoke = async (teacher) => {
        const teacherId = teacher._id || teacher.id;
        if (!window.confirm(`Are you sure you want to permanently delete ${teacher.name}? All login access will be removed.`)) return;
        try {
            await api.delete(`/api/admin/teachers/${teacherId}`);
            alert(`${teacher.name}'s account has been deleted.`);
            fetchTeachers();
        } catch (err) {
            alert(err.response?.data?.msg || 'Error deleting teacher');
        }
    };

    const handleToggleOmrAccess = async (teacher) => {
        const teacherId = teacher._id || teacher.id;
        const currentAccess = !!(teacher.omrAccess || teacher.omr_access);
        const target = !currentAccess;
        try {
            await api.patch(`/api/admin/teachers/${teacherId}/omr-access`, { enabled: target });
            setTeachers(prev => prev.map(t => {
                if ((t._id || t.id) === teacherId) {
                    return { ...t, omrAccess: target, omr_access: target };
                }
                return t;
            }));
        } catch (err) {
            alert(err.response?.data?.msg || 'Failed to update OMR permission.');
        }
    };

    const filteredTeachers = teachers.filter(t => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (t.name || '').toLowerCase().includes(q) ||
            (t.email || '').toLowerCase().includes(q) ||
            (t.subject || '').toLowerCase().includes(q) ||
            (t.institutionName || '').toLowerCase().includes(q)
        );
    });

    return (
        <div className="animate-fade-in-up max-w-6xl mx-auto space-y-8 px-4 py-8 font-sans">
            
            {/* Top Navigation & Header */}
            <div className="bg-navy p-8 rounded-[2.5rem] shadow-xl border-b-4 border-gold text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-gold text-navy text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-widest">Master Admin</span>
                        <span className="text-white/60 text-xs font-bold">Manchester Technologies Portal</span>
                    </div>
                    <h2 className="font-black text-2xl md:text-3xl uppercase tracking-tight text-white">
                        Institution &amp; Teacher Management
                    </h2>
                    <p className="text-xs text-white/70 font-medium mt-1">
                        Create institution profiles, manage trial quotas, and configure teacher access credentials.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="bg-white/10 hover:bg-white/20 text-gold border border-gold/40 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition cursor-pointer"
                    >
                        ← Back to Admin Console
                    </button>
                </div>
            </div>

            {/* Sub Tabs */}
            <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
                <button
                    onClick={() => setActiveTab('create')}
                    className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                        activeTab === 'create'
                            ? 'bg-navy text-gold shadow-md ring-2 ring-gold/40'
                            : 'bg-white text-navy/70 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <span>➕</span>
                    <span>Onboard Teacher &amp; Institution</span>
                </button>
                <button
                    onClick={() => setActiveTab('manage')}
                    className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                        activeTab === 'manage'
                            ? 'bg-navy text-gold shadow-md ring-2 ring-gold/40'
                            : 'bg-white text-navy/70 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <span>👥</span>
                    <span>Manage Teachers &amp; Quotas ({teachers.length})</span>
                </button>
            </div>

            {/* TAB 1: CREATE & ONBOARD */}
            {activeTab === 'create' && (
                <div className="space-y-8 animate-fade-in">
                    
                    {/* Section 1: Institution Setup */}
                    <div className="bg-gradient-to-r from-slate-50 to-blue-50/40 p-8 rounded-[2.5rem] shadow-sm border-2 border-slate-200 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div>
                                <h3 className="text-sm font-black text-navy uppercase tracking-wider flex items-center gap-2">
                                    <span>🏛️</span> Target Institution / College Profile
                                </h3>
                                <p className="text-[11px] text-gray-500 font-medium">
                                    Specify the Institution / College Name that will appear on all generated Assessment and Question Paper headers.
                                </p>
                            </div>
                            <span className="text-[10px] font-black text-navy bg-gold px-3 py-1 rounded-full uppercase tracking-widest">
                                Dynamic Header Branding
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            <div>
                                <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-2">
                                    College / Institution Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Manchester PU College, Sapthagiri PU College, Apex Academy"
                                    value={institutionName}
                                    onChange={e => setInstitutionName(e.target.value)}
                                    className="w-full border-2 border-gray-200 p-3.5 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none text-sm shadow-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-2">
                                    Institution Official Email ID (Optional)
                                </label>
                                <input
                                    type="email"
                                    placeholder="e.g. principal@manchestercollege.edu.in"
                                    value={institutionEmail}
                                    onChange={e => setInstitutionEmail(e.target.value)}
                                    className="w-full border-2 border-gray-200 p-3.5 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none text-sm shadow-xs"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={handleInstitutionApply}
                                className="bg-navy text-gold hover:scale-105 transition px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-md"
                            >
                                ✓ Apply Institution to New Teachers
                            </button>
                        </div>
                    </div>

                    {/* Section 2: Create Teacher Form */}
                    <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-100 space-y-6">
                        <div className="border-b border-gray-100 pb-4">
                            <h3 className="text-sm font-black text-navy uppercase tracking-[0.2em] flex items-center gap-3">
                                <span className="bg-gold text-navy w-8 h-8 rounded-xl flex items-center justify-center text-lg font-bold shadow-md">+</span>
                                Teacher Account Credentials &amp; Department
                            </h3>
                            <p className="text-xs text-gray-500 font-medium mt-1">
                                Create a new faculty account with automatic trial quotas (2 Assessments, 2 JEE, 2 NEET, 2 CET).
                            </p>
                        </div>

                        <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-2">Teacher Full Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. Prof. Ramesh Sharma"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full border-2 border-gray-200 p-3.5 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none text-sm shadow-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-2">Teacher Email ID (Login Username) <span className="text-red-500">*</span></label>
                                <input
                                    type="email"
                                    placeholder="e.g. physics.faculty@institution.com"
                                    required
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full border-2 border-gray-200 p-3.5 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none text-sm shadow-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-2">Teacher Password <span className="text-red-500">*</span></label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full border-2 border-gray-200 p-3.5 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none text-sm shadow-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-2">Academic Department / Subject <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    value={formData.subject}
                                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                    className="w-full border-2 border-gray-200 p-3.5 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none text-sm shadow-xs cursor-pointer"
                                >
                                    {subjects.map(sub => (
                                        <option key={sub} value={sub}>{sub}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-2">Assigned College / Institution</label>
                                <input
                                    type="text"
                                    value={formData.institutionName || institutionName}
                                    onChange={e => setFormData({ ...formData, institutionName: e.target.value })}
                                    className="w-full border-2 border-gray-200 p-3.5 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none text-sm shadow-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-2">Initial Account Status</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full border-2 border-gray-200 p-3.5 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none text-sm shadow-xs cursor-pointer"
                                >
                                    <option value="active">Active (Access Enabled)</option>
                                    <option value="disabled">Disabled (Access Blocked)</option>
                                </select>
                            </div>

                            {/* Trial Quota Notice */}
                            <div className="col-span-1 md:col-span-2 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                                <span className="text-xl">ℹ️</span>
                                <div className="text-xs text-amber-900 leading-relaxed font-medium">
                                    <strong>Default Trial Quotas Assigned:</strong> 2 Assessments (max 60 Qs), 2 JEE Papers (max 240 Qs), 2 NEET Papers (max 240 Qs), 2 CET Papers (max 240 Qs).
                                    Export is restricted to PDF only (Word/DOCX export disabled for trial). All usage is tracked persistently in the database.
                                </div>
                            </div>

                            <div className="col-span-1 md:col-span-2">
                                <button
                                    type="submit"
                                    className="w-full bg-gold text-navy hover:scale-[1.01] transition-all py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl cursor-pointer"
                                >
                                    Authorize &amp; Create Teacher Account →
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TAB 2: MANAGE & MONITOR QUOTAS */}
            {activeTab === 'manage' && (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 space-y-6 animate-fade-in">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-4">
                        <div>
                            <h3 className="text-base font-black text-navy uppercase tracking-tight flex items-center gap-2">
                                <span>👥</span> Registered Faculty Accounts &amp; Trial Status
                            </h3>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">
                                Enable/disable accounts, inspect live generation quota usage, and reset quotas.
                            </p>
                        </div>
                        <div className="w-full md:w-72">
                            <input
                                type="text"
                                placeholder="Search by name, email, subject, or college..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full border-2 border-gray-200 px-4 py-2 rounded-xl text-xs font-bold text-navy outline-none focus:border-navy"
                            />
                        </div>
                    </div>

                    {loadingTeachers ? (
                        <div className="p-12 text-center text-sm font-bold text-gray-400">Loading teacher directory...</div>
                    ) : filteredTeachers.length === 0 ? (
                        <div className="p-12 text-center text-sm font-bold text-gray-400">No matching faculty accounts found.</div>
                    ) : (
                        <div className="space-y-4">
                            {filteredTeachers.map(teacher => {
                                const tId = teacher._id || teacher.id;
                                const isActive = (teacher.status || 'active') === 'active';
                                const quotas = teacher.quotas || {
                                    assessment: { used: 0, max: 2 },
                                    jee: { used: 0, max: 2 },
                                    neet: { used: 0, max: 2 },
                                    cet: { used: 0, max: 2 }
                                };

                                return (
                                    <div
                                        key={tId}
                                        className={`p-6 rounded-3xl border-2 transition-all space-y-4 ${
                                            isActive
                                                ? 'bg-slate-50/80 border-slate-200 hover:border-navy/40 shadow-xs'
                                                : 'bg-red-50/40 border-red-200 opacity-75'
                                        }`}
                                    >
                                        {/* Top Row: Teacher Details + Quick Actions */}
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                                                    isActive ? 'bg-navy text-gold shadow-md' : 'bg-red-200 text-red-700'
                                                }`}>
                                                    {(teacher.name || 'T').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-black text-base text-navy">{teacher.name}</h4>
                                                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                                            isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                        }`}>
                                                            {isActive ? '● Active' : '✕ Disabled'}
                                                        </span>
                                                        <span className="text-[10px] font-black bg-gold/20 text-navy px-2.5 py-0.5 rounded-full uppercase">
                                                            {teacher.subject || 'General'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500 font-medium mt-0.5">
                                                        <span>📧 {teacher.email}</span>
                                                        <span>•</span>
                                                        <span>🏛️ <strong>{teacher.institutionName || 'Manchester College'}</strong></span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                {/* Enable / Disable Button */}
                                                <button
                                                    onClick={() => handleToggleStatus(teacher)}
                                                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer border ${
                                                        isActive
                                                            ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                                                            : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                                                    }`}
                                                >
                                                    {isActive ? '⏸ Disable Access' : '▶ Enable Access'}
                                                </button>

                                                {/* Reset Trial Quotas */}
                                                <button
                                                    onClick={() => handleResetQuotas(teacher)}
                                                    className="bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                                                    title="Reset all 4 paper quotas back to 0/2"
                                                >
                                                    🔄 Reset Quotas
                                                </button>

                                                {/* Reset Password */}
                                                <button
                                                    onClick={() => handleResetPassword(teacher)}
                                                    className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                                                >
                                                    🔑 Password
                                                </button>

                                                {/* OMR Permission */}
                                                <button
                                                    onClick={() => handleToggleOmrAccess(teacher)}
                                                    className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                                                        teacher.omrAccess !== false
                                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                                            : 'bg-gray-100 border-gray-200 text-gray-500'
                                                    }`}
                                                >
                                                    OMR {teacher.omrAccess !== false ? '✓' : '✕'}
                                                </button>

                                                {/* Delete */}
                                                <button
                                                    onClick={() => handleRevoke(teacher)}
                                                    className="bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-600 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                                                >
                                                    ✕ Delete
                                                </button>
                                            </div>
                                        </div>

                                        {/* Bottom Row: Trial Quotas Grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-200/60">
                                            {/* Assessment Quota */}
                                            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
                                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-gray-500">
                                                    <span>📝 Assessment</span>
                                                    <span className={quotas.assessment.used >= quotas.assessment.max ? 'text-red-600' : 'text-emerald-700'}>
                                                        {quotas.assessment.used >= quotas.assessment.max ? 'Maxed' : 'Available'}
                                                    </span>
                                                </div>
                                                <div className="text-base font-black text-navy mt-1">
                                                    {quotas.assessment.used} / {quotas.assessment.max} <span className="text-[10px] text-gray-400 font-bold">Papers (Max 60 Qs)</span>
                                                </div>
                                            </div>

                                            {/* JEE Quota */}
                                            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
                                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-gray-500">
                                                    <span>⚡ JEE Standard</span>
                                                    <span className={quotas.jee.used >= quotas.jee.max ? 'text-red-600' : 'text-emerald-700'}>
                                                        {quotas.jee.used >= quotas.jee.max ? 'Maxed' : 'Available'}
                                                    </span>
                                                </div>
                                                <div className="text-base font-black text-navy mt-1">
                                                    {quotas.jee.used} / {quotas.jee.max} <span className="text-[10px] text-gray-400 font-bold">Papers (Max 240 Qs)</span>
                                                </div>
                                            </div>

                                            {/* NEET Quota */}
                                            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
                                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-gray-500">
                                                    <span>🧬 NEET Standard</span>
                                                    <span className={quotas.neet.used >= quotas.neet.max ? 'text-red-600' : 'text-emerald-700'}>
                                                        {quotas.neet.used >= quotas.neet.max ? 'Maxed' : 'Available'}
                                                    </span>
                                                </div>
                                                <div className="text-base font-black text-navy mt-1">
                                                    {quotas.neet.used} / {quotas.neet.max} <span className="text-[10px] text-gray-400 font-bold">Papers (Max 240 Qs)</span>
                                                </div>
                                            </div>

                                            {/* CET Quota */}
                                            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
                                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-gray-500">
                                                    <span>🎯 CET Standard</span>
                                                    <span className={quotas.cet.used >= quotas.cet.max ? 'text-red-600' : 'text-emerald-700'}>
                                                        {quotas.cet.used >= quotas.cet.max ? 'Maxed' : 'Available'}
                                                    </span>
                                                </div>
                                                <div className="text-base font-black text-navy mt-1">
                                                    {quotas.cet.used} / {quotas.cet.max} <span className="text-[10px] text-gray-400 font-bold">Papers (Max 240 Qs)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CreateTeacher;
