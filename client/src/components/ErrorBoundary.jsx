import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[CRITICAL ERROR CAUGHT BY BOUNDARY]', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleGoHome = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.href = '/teacher/dashboard';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6 font-sans">
                    <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl w-full max-w-xl border-b-8 border-gold text-center">
                        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
                            <span>⚠️</span>
                        </div>
                        <h2 className="text-xl font-black text-navy mb-1 uppercase tracking-tight">Manchester College</h2>
                        <p className="text-xs text-slate-600 font-medium mb-4 leading-relaxed">
                            A display or state sync error occurred in this view.
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center mb-4">
                            <button 
                                onClick={this.handleGoHome} 
                                className="bg-navy text-gold px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg cursor-pointer"
                            >
                                🏠 Back to Dashboard
                            </button>
                            <button 
                                onClick={() => window.location.reload()} 
                                className="bg-gray-100 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-gray-200 transition border border-gray-200 cursor-pointer"
                            >
                                🔄 Refresh Page
                            </button>
                        </div>

                        {/* Error info */}
                        {this.state.error && (
                            <div className="text-left mt-4 pt-3 border-t border-gray-100">
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-mono font-bold text-red-700 break-words whitespace-pre-wrap">
                                    {this.state.error.toString()}
                                </div>
                                {this.state.errorInfo && (
                                    <pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-[10px] text-gray-700 font-mono overflow-x-auto whitespace-pre-wrap max-h-48">
                                        {this.state.errorInfo.componentStack}
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
