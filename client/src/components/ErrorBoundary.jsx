import React from 'react';

class ErrorBaoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[CRITICAL ERROR CAUGHT BY BOUNDARY]', error, errorInfo);
    }

    handleReset = () => {
        try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.clear();
        } catch {}
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-background flex items-center justify-center p-6">
                    <div className="bg-surface p-10 rounded-3xl shadow-2xl w-full max-w-md border-b-8 border-gold text-center">
                        <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-inner">
                            <span>⚠️</span>
                        </div>
                        <h2 className="text-2xl font-black text-navy mb-2 uppercase tracking-tight">Manchester College</h2>
                        <p className="text-sm text-slate/70 font-medium mb-6 leading-relaxed">
                            A temporary rendering or connection issue occurred. A quick refresh will restore the portal.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button 
                                onClick=
{() => window.location.reload()} 
                                className="bg-navy text-gold px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg"
                            >
                                ↕ Understood & Refresh
                            </button>
                            <button 
                                onClick={this.handleReset} 
                                className="bg-gray-100 text-slate px-6 py-3 rounded-2xl font-bold text-xs hover:bg-gray-200 transition"
                            >
                                Return to Login
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
