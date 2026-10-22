import React from 'react';

const Loader = ({ fullPage = false }) => {
    if (fullPage) {
        return null; // NEVER block full page with a modal loader
    }

    return (
        <div className="flex items-center justify-center p-4">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin"></div>
        </div>
    );
};

export default Loader;
