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
        grantTrial: false,
        trialDurationDays: 15
    });

    const [teachers, setTeachers] = useState([]);
    const [loadingTeachers, setLoadingTeachers] = useState(true);
    const [activeTab, setActiveTab] = useState('create'); // 'create' | 'manage'
    const [searchQuery, setSearchQuery] = useState('');

    // Trial Management Modal State
    const [trialModal, setTrialModal] = useState({
        isOpen: false,
        mode: 'grant', // 'grant' | 'extend'
        teacher: null,
        durationDays: 15,
        customDays: 15,
        startDate: new Date().toISOString().split('T')[0],
        expiryDate: '',
        resetQuotas: true,
        reason: ''
    });

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
            alert(`Teacher account created successfully for ${formData.name} (${formData.email})!`);
            setFormData({
                name: '',
                email: '',
                password: '',
                subject: 'Physics',
                institutionName: institutionName || 'Manchester PU College',
                institutionEmail: institutionEmail || '',
                status: 'active',
                grantTrial: false,
                trialDurationDays: 15
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

    // Open Grant Trial Modal
    const openGrantTrialModal = (teacher) => {
        const today = new Date();
        const defaultExpiry = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        setTrialModal({
            isOpen: true,
            mode: 'grant',
            teacher,
            durationDays: 15,
            customDays: 15,
            startDate: today.toISOString().split('T')[0],
            expiryDate: defaultExpiry,
            resetQuotas: true,
            reason: ''
        });
    };

    // Open Extend Trial Modal
    const openExtendTrialModal = (teacher) => {
        const baseDate = teacher.trialExpiryDate ? new Date(teacher.trialExpiryDate) : new Date();
        const defaultExpiry = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        setTrialModal({
            isOpen: true,
            mode: 'extend',
            teacher,
            durationDays: 7,
            customDays: 7,
            startDate: new Date().toISOString().split('T')[0],
            expiryDate: defaultExpiry,
            resetQuotas: false,
            reason: ''
        });
    };

    const handleTrialModalSubmit = async (e) => {
        e.preventDefault();
        const teacherId = trialModal.teacher?._id || trialModal.teacher?.id;
        if (!teacherId) return;

        try {
            if (trialModal.mode === 'grant') {
                const effectiveDays = trialModal.durationDays === 'custom' ? Number(trialModal.customDays) : Number(trialModal.durationDays);
                const res = await api.post(`/api/admin/teachers/${teacherId}/trial`, {
                    durationDays: effectiveDays,
                    startDate: trialModal.startDate,
                    expiryDate: trialModal.expiryDate,
                    resetQuotas: trialModal.resetQuotas,
                    reason: trialModal.reason
                });
                alert(res.data?.msg || 'Trial access granted successfully!');
            } else {
                const effectiveDays = trialModal.durationDays === 'custom' ? Number(trialModal.customDays) : Number(trialModal.durationDays);
                const res = await api.patch(`/api/admin/teachers/${teacherId}/trial/extend`, {
                    extendDays: effectiveDays,
                    newExpiryDate: trialModal.expiryDate,
                    resetQuotas: trialModal.resetQuotas
                });
                alert(res.data?.msg || 'Trial access extended successfully!');
            }

            setTrialModal(prev => ({ ...prev, isOpen: false }));
            fetchTeachers();
        } catch (err) {
            alert(err.response?.data?.msg || 'Failed to update trial access.');
        }
    };

    const handleRevokeTrial = async (teacher) => {
        const teacherId = teacher._id || teacher.id;
        if (!window.confirm(`Revoke trial access immediately for ${teacher.name}? They will no longer be able to generate new papers.`)) return;

        try {
            const res = await api.patch(`/api/admin/teachers/${teacherId}/trial/revoke`);
            alert(res.data?.msg || 'Trial access revoked.');
            fetchTeachers();
        } catch (err) {
            alert(err.response?.data?.msg || 'Failed to revoke trial access.');
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
            alert(`Password updated successfully for ${teacher.name}!
New password: ${newPass.trim()}`);
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
                        Institution &amp; Trial Access Management
                    </h2>
                    <p className="text-xs text-white/70 font-medium mt-1">
                        Control individual trial durations (7, 15, 30 days, Custom), manage teacher permissions, and configure institution profiles.
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
                    <span>Onboard Faculty Account</span>
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
                    <span>Manage Faculty &amp; Trial Access (${teachers.length})</span>
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
                                Create a faculty account. Trial access is not assigned automatically and can be enabled below or assigned individually by Admin.
                            </p>
                        </div>

                        <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-2">Teacher Full Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Dr. Ramesh Kumar"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full border-2 border-gray-200 p-3.5 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none text-sm shadow-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-2">Teacher Email Address <span className="text-red-500">*</span></label>
                                <input
                                    type="email"
                                    required
                                    placeholder="e.g. ramesh.physics@manchestercollege.edu.in"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full border-2 border-gray-200 p-3.5 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none text-sm shadow-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-2">Login Password <span className="text-red-500">*</span></label>
                                <input
                                    type="password"
                                    required
                                    placeholder="Enter secure initial password"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full border-2 border-gray-200 p-3.5 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none text-sm shadow-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-2">Subject Department <span className="text-red-500">*</span></label>
                                <select
                                    value={formData.subject}
                                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                    className="w-full border-2 border-gray-200 p-3.5 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none text-sm shadow-xs"
                                >
                                    {subjects.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Trial Access Opt-in */}
                            <div className="col-span-1 md:col-span-2 p-5 bg-amber-50/50 rounded-2xl border border-amber-200 space-y-3">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="grantTrialCheck"
                                        checked={formData.grantTrial}
                                        onChange={e => setFormData({ ...formData, grantTrial: e.target.checked })}
                                        className="w-4 h-4 text-navy rounded border-gray-300 cursor-pointer"
                                    />
                                    <label htmlFor="grantTrialCheck" className="text-xs font-black text-navy uppercase tracking-wider cursor-pointer">
                                        Grant Initial Trial Access on Creation
                                    </label>
                                </div>
                                {formData.grantTrial && (
                                    <div className="flex items-center gap-3 pt-2">
                                        <span className="text-[11px] font-bold text-slate-700">Trial Duration:</span>
                                        {[7, 15, 30].map(days => (
                                            <button
                                                key={days}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, trialDurationDays: days })}
                                                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                                                    formData.trialDurationDays === days
                                                        ? 'bg-navy text-gold shadow-xs'
                                                        : 'bg-white text-slate-700 border border-slate-300'
                                                }`}
                                            >
                                                ${days} Days
                                            </button>
                                        ))}
                                    </div>
                                )}
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

            {/* TAB 2: MANAGE & MONITOR TRIAL ACCESS */}
            {activeTab === 'manage' && (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 space-y-6 animate-fade-in">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-4">
                        <div>
                            <h3 className="text-base font-black text-navy uppercase tracking-tight flex items-center gap-2">
                                <span>👥</span> Registered Faculty Accounts &amp; Admin Trial Controls
                            </h3>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">
                                Grant, extend, or revoke trial access for individual teachers. Monitor days remaining and paper generation quotas.
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
                                const trialStatus = teacher.trialStatus || (teacher.isTrial ? 'active' : 'none');
                                const isTrialActive = teacher.isTrialActive || (trialStatus === 'active');
                                const daysRemaining = teacher.trialDaysRemaining !== undefined ? teacher.trialDaysRemaining : 0;
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
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="font-black text-base text-navy">{teacher.name}</h4>
                                                        
                                                        {/* Status */}
                                                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                                            isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                        }`}>
                                                            {isActive ? '● Active' : '✕ Disabled'}
                                                        </span>

                                                        {/* Trial Status Badge */}
                                                        {isTrialActive ? (
                                                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
                                                                <span>⚡ Trial Active:</span>
                                                                <strong>{daysRemaining} Days Left</strong>
                                                            </span>
                                                        ) : trialStatus === 'expired' ? (
                                                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                                                ⚠️ Trial Expired
                                                            </span>
                                                        ) : trialStatus === 'revoked' ? (
                                                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                                                ✕ Trial Revoked
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                                                No Trial Access
                                                            </span>
                                                        )}

                                                        <span className="text-[10px] font-black bg-gold/20 text-navy px-2.5 py-0.5 rounded-full uppercase">
                                                            {teacher.subject || 'General'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500 font-medium mt-0.5 flex-wrap">
                                                        <span>📧 {teacher.email}</span>
                                                        <span>•</span>
                                                        <span>🏛️ <strong>{teacher.institutionName || 'Manchester College'}</strong></span>
                                                        {teacher.trialExpiryDate && (
                                                            <>
                                                                <span>•</span>
                                                                <span>Expiry: <strong>{new Date(teacher.trialExpiryDate).toLocaleDateString()}</strong></span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons: Trial Controls + Admin Controls */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                
                                                {/* Grant / Extend Trial */}
                                                {!isTrialActive ? (
                                                    <button
                                                        onClick={() => openGrantTrialModal(teacher)}
                                                        className="bg-navy text-gold hover:bg-slate-900 border border-gold px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center gap-1"
                                                    >
                                                        <span>🎁</span> Grant Trial
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => openExtendTrialModal(teacher)}
                                                        className="bg-blue-600 text-white hover:bg-blue-700 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center gap-1"
                                                    >
                                                        <span>⏳</span> Extend Trial
                                                    </button>
                                                )}

                                                {/* Revoke Trial (if active) */}
                                                {isTrialActive && (
                                                    <button
                                                        onClick={() => handleRevokeTrial(teacher)}
                                                        className="bg-rose-50 border border-rose-300 text-rose-800 hover:bg-rose-100 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                                                        title="Revoke trial access immediately"
                                                    >
                                                        Revoke Trial
                                                    </button>
                                                )}

                                                {/* Enable / Disable Account */}
                                                <button
                                                    onClick={() => handleToggleStatus(teacher)}
                                                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer border ${
                                                        isActive
                                                            ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                                                            : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                                                    }`}
                                                >
                                                    {isActive ? '⏸ Disable' : '▶ Enable'}
                                                </button>

                                                {/* Reset Quotas */}
                                                <button
                                                    onClick={() => handleResetQuotas(teacher)}
                                                    className="bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                                                    title="Reset quotas to 0/2"
                                                >
                                                    🔄 Quotas
                                                </button>

                                                {/* Password */}
                                                <button
                                                    onClick={() => handleResetPassword(teacher)}
                                                    className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                                                >
                                                    🔑
                                                </button>

                                                {/* Delete */}
                                                <button
                                                    onClick={() => handleRevoke(teacher)}
                                                    className="bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-600 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                                                >
                                                    ✕
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

            {/* TRIAL ACCESS MODAL (GRANT / EXTEND) */}
            {trialModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-fade-in">
                        <div className="p-6 bg-navy text-white flex justify-between items-center border-b-2 border-gold">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-gold bg-white/10 px-2 py-0.5 rounded-md">
                                    Admin Access Portal
                                </span>
                                <h3 className="text-lg font-black uppercase tracking-tight mt-1">
                                    {trialModal.mode === 'grant' ? '🎁 Grant Trial Access' : '⏳ Extend Trial Access'}
                                </h3>
                                <p className="text-xs text-white/70">
                                    Target Faculty: <strong>{trialModal.teacher?.name}</strong> ({trialModal.teacher?.email})
                                </p>
                            </div>
                            <button
                                onClick={() => setTrialModal(prev => ({ ...prev, isOpen: false }))}
                                className="text-white/60 hover:text-white bg-white/10 w-8 h-8 rounded-full flex items-center justify-center font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleTrialModalSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-1.5">
                                    Select Duration
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[7, 15, 30, 'custom'].map(d => (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => setTrialModal(prev => ({ ...prev, durationDays: d }))}
                                            className={`py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                                                trialModal.durationDays === d
                                                    ? 'bg-navy text-gold border-2 border-gold shadow-xs'
                                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                        >
                                            {d === 'custom' ? 'Custom' : `${d} Days`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {trialModal.durationDays === 'custom' && (
                                <div>
                                    <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-1">
                                        Custom Number of Days
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="365"
                                        value={trialModal.customDays}
                                        onChange={e => setTrialModal(prev => ({ ...prev, customDays: e.target.value }))}
                                        className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-bold text-navy outline-none focus:border-navy"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-1">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={trialModal.startDate}
                                        onChange={e => setTrialModal(prev => ({ ...prev, startDate: e.target.value }))}
                                        className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-bold text-navy outline-none focus:border-navy"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-1">
                                        Expiry Date (Optional Override)
                                    </label>
                                    <input
                                        type="date"
                                        value={trialModal.expiryDate}
                                        onChange={e => setTrialModal(prev => ({ ...prev, expiryDate: e.target.value }))}
                                        className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-bold text-navy outline-none focus:border-navy"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="modalResetQuotas"
                                    checked={trialModal.resetQuotas}
                                    onChange={e => setTrialModal(prev => ({ ...prev, resetQuotas: e.target.checked }))}
                                    className="w-4 h-4 text-navy rounded border-gray-300 cursor-pointer"
                                />
                                <label htmlFor="modalResetQuotas" className="text-xs font-bold text-slate-700 cursor-pointer">
                                    Reset paper generation quotas to 0/2
                                </label>
                            </div>

                            <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setTrialModal(prev => ({ ...prev, isOpen: false }))}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-navy text-gold hover:bg-slate-900 border-2 border-gold px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md cursor-pointer"
                                >
                                    {trialModal.mode === 'grant' ? 'Confirm & Grant Trial' : 'Confirm & Extend Trial'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreateTeacher;
