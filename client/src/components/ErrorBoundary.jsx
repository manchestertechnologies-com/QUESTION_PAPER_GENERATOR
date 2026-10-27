import React from 'react';
import safeStorage from '../utils/safeStorage';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null, 
            errorInfo: null, 
            showDetails: true,
            copied: false
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[CRITICAL ERROR CAUGHT BY BOUNDARY]', error, errorInfo);
        // Automatically prune old cached exam sessions if quota was exceeded
        if (error?.name === 'QuotaExceededError' || String(error?.message || '').toLowerCase().includes('quota')) {
            try {
                safeStorage.clearOldExamCaches();
            } catch (_) {}
        }
        this.setState({ errorInfo });
    }

    handleGoHome = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user?.role === 'admin') {
                    window.location.href = '/admin/dashboard';
                    return;
                }
                if (user?.role === 'teacher') {
                    window.location.href = '/teacher/dashboard';
                    return;
                }
            }
            if (localStorage.getItem('student_info')) {
                window.location.href = '/lab-exam';
                return;
            }
        } catch {}
        window.location.href = '/';
    };

    handleReset = () => {
        try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('student_info');
            sessionStorage.clear();
        } catch {}
        window.location.href = '/';
    };

    copyError = () => {
        const text = `Error: ${this.state.error?.message || this.state.error}\nStack:\n${this.state.error?.stack || ''}\nComponent Stack:\n${this.state.errorInfo?.componentStack || ''}`;
        navigator.clipboard?.writeText(text).then(() => {
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        }).catch(() => {});
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6 font-sans">
                    <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl w-full max-w-xl border-b-8 border-gold text-center">
                        <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-inner">
                            <span>⚠️</span>
                        </div>
                        <h2 className="text-2xl font-black text-[#081B3B] mb-2 uppercase tracking-tight">Manchester Technologies</h2>
                        <p className="text-sm text-slate-600 font-medium mb-6 leading-relaxed">
                            A display or state sync error occurred in this view. You can return to your dashboard or refresh the page.
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center mb-4">
                            <button 
                                onClick={this.handleGoHome} 
                                className="bg-navy text-gold px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg cursor-pointer"
                            >
                                🏠 Back to Dashboard
                            </button>
                            <button 
                                onClick={() => window.location.reload()} 
                                className="bg-gray-100 text-slate-700 px-6 py-3 rounded-2xl font-bold text-xs hover:bg-gray-200 transition border border-gray-200 cursor-pointer"
                            >
                                🔄 Refresh Page
                            </button>
                            <button 
                                onClick={this.handleReset} 
                                className="bg-red-50 text-red-600 px-4 py-3 rounded-2xl font-bold text-xs hover:bg-red-100 transition border border-red-200 cursor-pointer"
                                title="Clear cached user session and reload clean portal"
                            >
                                🧹 Clear Session & Home
                            </button>
                        </div>

                        {/* Error info display */}
                        {this.state.error && (
                            <div className="text-left mt-4 pt-4 border-t border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <button
                                        onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                                        className="text-[11px] font-bold text-gray-500 hover:text-navy underline cursor-pointer"
                                    >
                                        {this.state.showDetails ? 'Hide details' : 'Show error details'}
                                    </button>
                                    <button
                                        onClick={this.copyError}
                                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 cursor-pointer"
                                    >
                                        {this.state.copied ? '✓ Copied to clipboard!' : '📋 Copy Error Details'}
                                    </button>
                                </div>
                                {this.state.showDetails && (
                                    <pre className="mt-2 p-3 bg-gray-900 text-red-300 border border-gray-800 rounded-xl text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto selection:bg-red-900">
                                        {this.state.error?.message || this.state.error.toString()}
                                        {this.state.error?.stack && `\n\n${this.state.error.stack}`}
                                    </pre>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
