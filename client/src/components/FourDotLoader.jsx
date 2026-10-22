import React from 'react';

const FourDotLoader = ({ size = 'md', text = '', fullPage = false, className = '' }) => {
    const spinnerSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';

    const content = (
        <div className={`flex flex-col items-center justify-center p-3 ${className}`}>
            <div className={`${spinnerSize} border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin`} />
            {text && (
                <p className="mt-2 text-xs font-semibold tracking-wider text-slate-500 text-center">
                    {text}
                </p>
            )}
        </div>
    );

    if (fullPage) {
        return (
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-[99999] flex items-center justify-center">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-xl flex flex-col items-center">
                    <div className="w-8 h-8 border-3 border-slate-200 border-t-amber-500 rounded-full animate-spin mb-2" />
                    {text && <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">{text}</p>}
                </div>
            </div>
        );
    }

    return content;
};

export default FourDotLoader;
