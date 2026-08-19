import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';

const UnifiedLogin = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const { login, user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [error, setError] = useState('');

    // If already logged in, redirect them
    if (user) {
        if (user.role === 'admin') return <Navigate to="/admin/dashboard" />;
        if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" />;
    }

    const onSubmit = async e => {
        e.preventDefault();
        try {
            const loggedInUser = await login(formData.email, formData.password);
            // Unified single-sign routing
            if (loggedInUser.role === 'admin') {
                navigate('/admin/dashboard');
            } else if (loggedInUser.role === 'teacher') {
                navigate('/teacher/dashboard');
            }
        } catch (err) {
            setError(err.msg || 'Login failed');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 font-sans">
            <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border-b-8 border-gold animate-fade-in-up">
                <div className="text-center mb-10">
                    <div className="w-24 h-24 rounded-3xl overflow-hidden mx-auto mb-6 shadow-xl hover:scale-110 transition-transform duration-300 bg-white p-1 border border-gray-100">
                        <img src="/ManchesterLogo.jpeg" alt="Manchester College" className="w-full h-full object-cover rounded-2xl" />
                    </div>
                    <h1 className="text-3xl font-black text-navy tracking-tight">Manchester College</h1>
                    <p className="text-slate/60 mt-1 font-bold uppercase tracking-widest text-[10px]">Institutional Assessment Portal</p>
                </div>
                
                {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-bold border border-red-100 text-center animate-pulse">{error}</div>}
                
                <form onSubmit={onSubmit} className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-2 ml-1">Official Email / ID</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate/30">@</span>
                            <input 
                                type="email" 
                                required 
                                placeholder="name@manchester.edu"
                                value={formData.email} 
                                onChange={e => setFormData({...formData, email: e.target.value})} 
                                className="w-full border-2 border-gray-100 p-4 pl-10 rounded-2xl bg-gray-50/50 focus:outline-none focus:border-navy focus:bg-white transition-all font-medium" 
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-navy uppercase tracking-widest mb-2 ml-1">Access Key</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate/30">🔒</span>
                            <input 
                                type="password" 
                                required 
                                placeholder="••••••••"
                                value={formData.password} 
                                onChange={e => setFormData({...formData, password: e.target.value})} 
                                className="w-full border-2 border-gray-100 p-4 pl-10 rounded-2xl bg-gray-50/50 focus:outline-none focus:border-navy focus:bg-white transition-all font-medium" 
                            />
                        </div>
                    </div>
                    <button 
                        type="submit" 
                        className="w-full bg-navy text-gold p-4 rounded-2xl font-black text-lg hover:bg-primary-hover shadow-xl transition-all transform hover:-translate-y-1 active:translate-y-0 active:shadow-inner"
                    >
                        Sign In
                    </button>
                </form>

                <div className="mt-10 pt-6 border-t border-gray-100 text-center">
                    <p className="text-[10px] font-bold text-slate/40 uppercase tracking-widest">
                        The Land of Opportunity
                    </p>
                </div>
            </div>
        </div>
    );
};

export default UnifiedLogin;
