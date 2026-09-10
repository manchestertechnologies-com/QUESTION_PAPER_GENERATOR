import React from 'react';

const FourDotLoader = ({ size = 'md', text = '', fullPage = false, className = '' }) => {
    const dotSize = size === 'sm' ? 'w-2 h-2' : size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';
    const gapSize = size === 'sm' ? 'gap-1.5' : size === 'lg' ? 'gap-3' : 'gap-2.5';

    const content = (
        <div className={`flex flex-col items-center justify-center p-4 ${className}`}>
            <div className={`flex items-center justify-center ${gapSize}`}>
                <span 
                    className={`${dotSize} rounded-full bg-navy`} 
                    style={{ animation: 'bounceDot 0.85s ease-in-out infinite 0ms' }} 
                />
                <span 
                    className={`${dotSize} rounded-full bg-gold`} 
                    style={{ animation: 'bounceDot 0.85s ease-in-out infinite 150ms' }} 
                />
                <span 
                    className={`${dotSize} rounded-full bg-navy`} 
                    style={{ animation: 'bounceDot 0.85s ease-in-out infinite 300ms' }} 
                />
                <span 
                    className={`${dotSize} rounded-full bg-gold`} 
                    style={{ animation: 'bounceDot 0.85s ease-in-out infinite 450ms' }} 
                />
            </div>
            {text && (
                <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500 animate-pulse text-center">
                    {text}
                </p>
            )}
        </div>
    );

    if (fullPage) {
        return (
            <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[99999] flex items-center justify-center flex-col transition-all duration-200">
                {content}
            </div>
        );
    }

    return content;
};

export default FourDotLoader;
