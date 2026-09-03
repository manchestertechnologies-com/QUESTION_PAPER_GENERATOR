/**
 * TestModule.jsx
 * 
 * Admin-Only Private Automated Test Module for Manchester Assessment Platform.
 * Supports natural-language test commands, automated change detection,
 * regression tracking, multi-feature verification, and visual health checks.
 */

import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

const TestModule = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [statusData, setStatusData] = useState(null);
    const [history, setHistory] = useState([]);
    const [currentReport, setCurrentReport] = useState(null);
    const [commandInput, setCommandInput] = useState('');
    const [running, setRunning] = useState(false);
    const [activeTab, setActiveTab] = useState('report'); // 'report', 'features', 'history'
    const [selectedFeatureFilter, setSelectedFeatureFilter] = useState('All');
    const [errorMsg, setErrorMsg] = useState(null);

    // Initial load
    useEffect(() => {
        fetchStatus();
        fetchHistory();
        runTest('Test everything');
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await api.get('/api/test-module/status');
            setStatusData(res.data);
        } catch (err) {
            console.error('Status fetch error:', err);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await api.get('/api/test-module/history');
            setHistory(res.data || []);
        } catch (err) {
            console.error('History fetch error:', err);
        }
    };

    const runTest = async (cmd) => {
        const commandToRun = (cmd || commandInput || 'Test everything').trim();
        setRunning(true);
        setErrorMsg(null);

        try {
            const res = await api.post('/api/test-module/run', { command: commandToRun });
            setCurrentReport(res.data);
            setActiveTab('report');
            fetchStatus();
            fetchHistory();
        } catch (err) {
            console.error('Test execution failed:', err);
            setErrorMsg(err.response?.data?.msg || err.message || 'Failed to execute test suite');
        } finally {
            setRunning(false);
        }
    };

    const quickActions = [
        { label: '⚡ Test Everything', cmd: 'Test everything', color: 'bg-navy text-gold border-gold' },
        { label: '🔍 Test Changes', cmd: 'Test whatever I changed', color: 'bg-indigo-900 text-white border-indigo-500' },
        { label: '📄 Test Paper Generator', cmd: 'Test paper generator', color: 'bg-slate-800 text-white border-slate-600' },
        { label: '🖨️ Test PDF / A4', cmd: 'Test PDF generation and A4 layout', color: 'bg-slate-800 text-white border-slate-600' },
        { label: '🔀 Test PQRS', cmd: 'Test PQRS', color: 'bg-slate-800 text-white border-slate-600' },
        { label: '💻 Test CBT', cmd: 'Test CBT completely', color: 'bg-slate-800 text-white border-slate-600' },
        { label: '❓ Test Questions', cmd: 'Test question editor and formatting', color: 'bg-slate-800 text-white border-slate-600' },
        { label: '👁️ Test Visual / Layout', cmd: 'Test visual and layout boundaries', color: 'bg-slate-800 text-white border-slate-600' },
        { label: '🎯 Test Scoring', cmd: 'Test scoring and results', color: 'bg-slate-800 text-white border-slate-600' }
    ];

    const filteredTests = currentReport?.tests?.filter(t => {
        if (selectedFeatureFilter === 'All') return true;
        if (selectedFeatureFilter === 'Failed Only') return !t.passed;
        return t.feature === selectedFeatureFilter;
    }) || [];

    return (
        <div className="space-y-8 animate-fade-in-up pb-16">
            {/* Top Header Card */}
            <div className="bg-gradient-to-r from-navy via-slate-900 to-navy text-white p-8 rounded-3xl border-4 border-gold shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">🔒</span>
                        <span className="bg-gold text-navy text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-widest">
                            Private Admin QA Automation Suite
                        </span>
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase px-3 py-1 rounded-full">
                            Zero Cost • Self-Updating
                        </span>
                    </div>
                    <h2 className="text-3xl font-black tracking-tight text-white uppercase">
                        Manchester Automated Test Module
                    </h2>
                    <p className="text-xs text-slate-300 font-medium max-w-2xl mt-1">
                        Continuous validation engine covering Question Bank, In-Place Editor, Subject Merge, PQRS 4-Sets, True A4 PDF, CBT Engine, and Scoring.
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl">
                    <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Health</div>
                        <div className="text-lg font-black text-emerald-400 flex items-center gap-1.5 justify-end">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            {currentReport?.summary?.status === 'PASSED' ? '100% OPERATIONAL' : 'REQUIRES ATTENTION'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Action Shortcuts Bar */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-navy uppercase tracking-widest">
                        ⚡ Quick Action Shortcuts
                    </h3>
                    <span className="text-[11px] text-gray-500 font-bold">
                        1-Click Test Execution
                    </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {quickActions.map((qa, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                setCommandInput(qa.cmd);
                                runTest(qa.cmd);
                            }}
                            disabled={running}
                            className={'p-3 rounded-xl border-2 font-black text-xs uppercase tracking-wider transition-all shadow-sm hover:scale-[1.02] flex items-center justify-center text-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ' + qa.color}
                        >
                            {qa.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Natural Language Test Command Bar */}
            <div className="bg-slate-900 text-white p-6 rounded-3xl border-2 border-gold shadow-xl space-y-3">
                <label className="block text-xs font-black text-gold uppercase tracking-widest">
                    💬 Natural-Language Test Command
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                        type="text"
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !running) runTest(commandInput);
                        }}
                        placeholder="Type any test command: 'Test whatever I changed', 'Test PQRS', 'Test PDF and A4'..."
                        disabled={running}
                        className="w-full bg-white/10 border-2 border-white/20 focus:border-gold rounded-2xl px-5 py-3.5 text-sm text-white placeholder:text-slate-400 font-medium outline-none transition"
                    />
                    <button
                        onClick={() => runTest(commandInput)}
                        disabled={running}
                        className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gold hover:bg-yellow-400 text-navy font-black text-xs uppercase tracking-widest shadow-xl transition-all hover:scale-105 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {running ? (
                            <>
                                <span className="animate-spin text-base">🔄</span>
                                <span>Running Tests...</span>
                            </>
                        ) : (
                            <>
                                <span className="text-base">▶</span>
                                <span>Run Test</span>
                            </>
                        )}
                    </button>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                    <span className="font-bold text-gold">Examples:</span>
                    <button onClick={() => { setCommandInput('Test everything'); runTest('Test everything'); }} className="hover:text-white underline cursor-pointer">Test everything</button>
                    <span>•</span>
                    <button onClick={() => { setCommandInput('Test whatever I changed'); runTest('Test whatever I changed'); }} className="hover:text-white underline cursor-pointer">Test whatever I changed</button>
                    <span>•</span>
                    <button onClick={() => { setCommandInput('Test PQRS'); runTest('Test PQRS'); }} className="hover:text-white underline cursor-pointer">Test PQRS</button>
                    <span>•</span>
                    <button onClick={() => { setCommandInput('Test CBT'); runTest('Test CBT'); }} className="hover:text-white underline cursor-pointer">Test CBT</button>
                    <span>•</span>
                    <button onClick={() => { setCommandInput('Test PDF and A4'); runTest('Test PDF and A4'); }} className="hover:text-white underline cursor-pointer">Test PDF & A4</button>
                </div>
            </div>

            {/* Error Message if any */}
            {errorMsg && (
                <div className="bg-rose-50 border-2 border-rose-300 text-rose-800 p-5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">⚠️</span>
                        <span className="text-xs font-black">{errorMsg}</span>
                    </div>
                    <button onClick={() => setErrorMsg(null)} className="text-rose-500 font-black text-sm cursor-pointer">✕</button>
                </div>
            )}

            {/* Current Test Report View */}
            {currentReport && (
                <div className="space-y-6">
                    {/* Executive Summary Counters */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm text-center">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Total Tests</span>
                            <span className="text-3xl font-black text-navy">{currentReport.summary.total}</span>
                        </div>
                        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-sm text-center">
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest block">Passed</span>
                            <span className="text-3xl font-black text-emerald-600">{currentReport.summary.passed}</span>
                        </div>
                        <div className={'p-5 rounded-2xl border shadow-sm text-center ' + (currentReport.summary.failed > 0 ? 'bg-rose-50 border-rose-300 text-rose-600' : 'bg-gray-50 border-gray-200 text-gray-400')}>
                            <span className="text-[10px] font-bold uppercase tracking-widest block">Failed</span>
                            <span className="text-3xl font-black">{currentReport.summary.failed}</span>
                        </div>
                        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-sm text-center">
                            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest block">Warnings</span>
                            <span className="text-3xl font-black text-amber-600">{currentReport.summary.warnings}</span>
                        </div>
                        <div className="bg-slate-50 p-5 rounded-2xl border border-gray-200 shadow-sm text-center">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Duration</span>
                            <span className="text-3xl font-black text-navy">{currentReport.durationMs}ms</span>
                        </div>
                        <div className={'p-5 rounded-2xl border shadow-sm text-center ' + (currentReport.summary.status === 'PASSED' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white')}>
                            <span className="text-[10px] font-black uppercase tracking-widest block opacity-80">Final Result</span>
                            <span className="text-2xl font-black">{currentReport.summary.status}</span>
                        </div>
                    </div>

                    {/* Regressions Alert */}
                    {currentReport.regressions && currentReport.regressions.length > 0 && (
                        <div className="bg-rose-100 border-2 border-rose-500 text-rose-950 p-6 rounded-3xl shadow-lg space-y-2 animate-pulse">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🚨</span>
                                <h4 className="font-black text-sm uppercase tracking-wider">Regression Detected!</h4>
                            </div>
                            <p className="text-xs font-medium">
                                The following test passed in previous executions but failed in the current run:
                            </p>
                            <div className="space-y-1">
                                {currentReport.regressions.map((reg, rIdx) => (
                                    <div key={rIdx} className="text-xs font-mono font-bold bg-white/70 p-2 rounded-lg">
                                        [{reg.testId}] {reg.feature} - {reg.title}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* New Features Detected Banner */}
                    {currentReport.newFeatures && currentReport.newFeatures.length > 0 && (
                        <div className="bg-blue-50 border-2 border-blue-400 text-blue-950 p-6 rounded-3xl shadow space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🆕</span>
                                <h4 className="font-black text-sm uppercase tracking-wider">New Code Elements Detected</h4>
                            </div>
                            <p className="text-xs font-medium">
                                The Test Module detected new routes/components and automatically registered test coverage:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {currentReport.newFeatures.map((nf, nIdx) => (
                                    <div key={nIdx} className="bg-white p-3 rounded-xl border border-blue-200 text-xs">
                                        <span className="font-black text-navy">{nf.name}</span> ({nf.type}): <span className="font-mono text-gray-500">{nf.path}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tab Navigation */}
                    <div className="flex items-center gap-2 border-b border-gray-200 pb-3 flex-wrap">
                        <button
                            onClick={() => setActiveTab('report')}
                            className={'px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer ' + (activeTab === 'report' ? 'bg-navy text-gold shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                        >
                            📋 Test Cases ({currentReport.tests.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('features')}
                            className={'px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer ' + (activeTab === 'features' ? 'bg-navy text-gold shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                        >
                            📊 Feature Breakdown ({currentReport.features.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={'px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer ' + (activeTab === 'history' ? 'bg-navy text-gold shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                        >
                            🕒 Run History ({history.length})
                        </button>
                    </div>

                    {/* Tab 1: Detailed Test List */}
                    {activeTab === 'report' && (
                        <div className="space-y-4">
                            {/* Filter by Feature */}
                            <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-4 rounded-2xl border border-gray-200">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-black text-navy uppercase tracking-wider">Filter:</span>
                                    {['All', 'Failed Only', ...new Set(currentReport.tests.map(t => t.feature))].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setSelectedFeatureFilter(f)}
                                            className={'px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ' + (selectedFeatureFilter === f ? 'bg-navy text-gold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                                <span className="text-xs text-gray-500 font-bold">
                                    Showing {filteredTests.length} of {currentReport.tests.length} Tests
                                </span>
                            </div>

                            {/* Test Cards */}
                            <div className="space-y-3">
                                {filteredTests.map((test, tIdx) => (
                                    <div
                                        key={test.id || tIdx}
                                        className={'p-5 rounded-2xl border-2 transition shadow-sm bg-white space-y-2 ' + (test.passed ? 'border-emerald-200 hover:border-emerald-400' : 'border-rose-300 bg-rose-50/40')}
                                    >
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                            <div className="flex items-center gap-2.5">
                                                <span className={'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ' + (test.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}>
                                                    {test.passed ? '✓' : '✕'}
                                                </span>
                                                <span className="font-mono text-xs font-black text-navy bg-slate-100 px-2 py-0.5 rounded">
                                                    {test.id}
                                                </span>
                                                <span className="text-xs font-black text-navy uppercase bg-gold/20 px-2 py-0.5 rounded">
                                                    {test.feature}
                                                </span>
                                                <h4 className="text-sm font-bold text-gray-900">
                                                    {test.title}
                                                </h4>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={'text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ' + (test.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : test.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800')}>
                                                    {test.priority}
                                                </span>
                                                <span className={'text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ' + (test.passed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white')}>
                                                    {test.passed ? 'PASS' : 'FAIL'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-xs text-gray-600 grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                                            <div>
                                                <span className="font-bold text-gray-500">Expected: </span>
                                                <span>{test.expected}</span>
                                            </div>
                                            <div>
                                                <span className="font-bold text-gray-500">Actual: </span>
                                                <span className={test.passed ? 'text-emerald-800 font-medium' : 'text-rose-800 font-bold'}>
                                                    {test.actual}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Feature Matrix */}
                    {activeTab === 'features' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {currentReport.features.map((feat, fIdx) => (
                                <div key={fIdx} className="bg-white p-5 rounded-2xl border-2 border-gray-200 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-black text-sm text-navy uppercase">{feat.name}</h4>
                                        <span className={'text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ' + (feat.failed === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}>
                                            {feat.status}
                                        </span>
                                    </div>
                                    <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            style={{ width: feat.percentage + '%' }}
                                            className={'h-full rounded-full ' + (feat.percentage === 100 ? 'bg-emerald-500' : 'bg-rose-500')}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 font-bold">
                                        <span>Passed: {feat.passed} / {feat.total}</span>
                                        <span>{feat.percentage}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tab 3: History */}
                    {activeTab === 'history' && (
                        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                            <h3 className="text-xs font-black text-navy uppercase tracking-widest">
                                Previous Automated Test Execution Runs
                            </h3>
                            <div className="divide-y divide-gray-100">
                                {history.map((run, rIdx) => (
                                    <div key={run.id || rIdx} className="py-3.5 flex items-center justify-between flex-wrap gap-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-bold text-navy">{run.id}</span>
                                                <span className="text-xs text-gray-500">
                                                    {new Date(run.timestamp).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="text-xs text-slate-700 font-medium">"{run.command}"</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-emerald-700">{run.passed} Passed</span>
                                            {run.failed > 0 && <span className="text-xs font-bold text-rose-600">{run.failed} Failed</span>}
                                            <span className={'text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ' + (run.status === 'PASSED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}>
                                                {run.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TestModule;
