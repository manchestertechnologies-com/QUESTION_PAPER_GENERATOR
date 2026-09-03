/**
 * historyStore.js
 * In-memory & JSON file persistence for Test Run History, Regressions,
 * Code Hashes, and Visual Baselines.
 */

const fs = require('fs');
const path = require('path');

const historyFilePath = path.join(__dirname, 'test_history.json');

function loadHistory() {
    try {
        if (fs.existsSync(historyFilePath)) {
            const raw = fs.readFileSync(historyFilePath, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('⚠️ Could not load test history:', e.message);
    }
    return {
        runs: [],
        lastHashes: {},
        visualBaselines: {},
        passedHistory: {}
    };
}

function saveHistory(historyData) {
    try {
        // Keep max 50 recent runs
        if (historyData.runs && historyData.runs.length > 50) {
            historyData.runs = historyData.runs.slice(-50);
        }
        fs.writeFileSync(historyFilePath, JSON.stringify(historyData, null, 2), 'utf8');
    } catch (e) {
        console.warn('⚠️ Could not save test history:', e.message);
    }
}

function recordTestRun(report, currentHashes) {
    const history = loadHistory();
    const runSummary = {
        id: 'RUN-' + Date.now(),
        timestamp: new Date().toISOString(),
        command: report.command,
        mode: report.mode,
        total: report.summary.total,
        passed: report.summary.passed,
        failed: report.summary.failed,
        warnings: report.summary.warnings,
        criticalFailures: report.summary.critical,
        status: report.summary.status,
        durationMs: report.durationMs,
        failedTestIds: report.failures.map(f => f.id)
    };

    history.runs.unshift(runSummary);
    history.lastHashes = currentHashes || history.lastHashes;

    // Update passed status map
    if (!history.passedHistory) history.passedHistory = {};
    report.tests.forEach(t => {
        history.passedHistory[t.id] = t.passed;
    });

    saveHistory(history);
    return runSummary;
}

function getRecentHistory(limit = 10) {
    const history = loadHistory();
    return (history.runs || []).slice(0, limit);
}

function getPassedHistory() {
    const history = loadHistory();
    return history.passedHistory || {};
}

function getLastHashes() {
    const history = loadHistory();
    return history.lastHashes || {};
}

module.exports = {
    loadHistory,
    saveHistory,
    recordTestRun,
    getRecentHistory,
    getPassedHistory,
    getLastHashes
};
