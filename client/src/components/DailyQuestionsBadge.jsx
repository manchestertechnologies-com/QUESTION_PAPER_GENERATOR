import React, { useState, useEffect } from 'react';
import api from '../api';

export default function DailyQuestionsBadge({ variant = 'header', className = '' }) {
    const [addedToday, setAddedToday] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchDailyStats = async () => {
        try {
            const res = await api.get('/api/questions/daily-stats', { skipLoader: true });
            if (res.data && typeof res.data.addedToday === 'number') {
                setAddedToday(res.data.addedToday);
            }
        } catch (err) {
            // Silently handle if network drops
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDailyStats();
        const interval = setInterval(fetchDailyStats, 30000);
        window.addEventListener('focus', fetchDailyStats);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', fetchDailyStats);
        };
    }, []);

    if (variant === 'sidebar') {
        return (
            <div className={`p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-400/20 to-amber-500/10 border border-amber-400/40 rounded-2xl ${className}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest">
                            Live Addition Tracker
                        </span>
                    </div>
                    <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider">
                        Today
                    </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                    <div className="text-xl font-black text-white tracking-tight">
                        {loading ? '...' : `+${addedToday}`} <span className="text-xs font-bold text-amber-400">Questions</span>
                    </div>
                    <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Added Today
                    </span>
                </div>
            </div>
        );
    }

    // Default 'header' variant (Left corner badge)
    return (
        <div
            className={`inline-flex items-center gap-2 bg-slate-900/90 hover:bg-slate-900 text-white px-3 py-1.5 rounded-xl border border-amber-400/40 shadow-sm transition-all duration-200 select-none ${className}`}
            title="Questions added to repository today"
        >
            <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="flex items-center gap-1.5 text-xs font-bold">
                <span className="text-slate-300 text-[11px] font-medium hidden sm:inline">Questions Added Today:</span>
                <span className="text-slate-300 text-[11px] font-medium sm:hidden">Today:</span>
                <span className="font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-md border border-amber-400/30">
                    {loading ? '...' : `+${addedToday}`}
                </span>
            </div>
        </div>
    );
}
