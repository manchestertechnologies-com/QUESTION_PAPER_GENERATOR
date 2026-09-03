/**
 * routes/testModule.js
 * Admin-Only Private Automated Test Module Route.
 * Protected with auth and checkRole(['admin']).
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { runTestSuite } = require('../testEngine/testRunner');
const { getRecentHistory, loadHistory, saveHistory } = require('../testEngine/historyStore');
const { TEST_REGISTRY } = require('../testEngine/registry');

// Strictly Admin-Only Middleware Protection
router.use(auth);
router.use(checkRole(['admin']));

/**
 * @route   POST /api/test-module/run
 * @desc    Run automated tests (Natural language command or Quick Action)
 * @access  Admin Only
 */
router.post('/run', async (req, res) => {
    try {
        const { command } = req.body;
        const testCommand = (command || 'Test everything').trim();
        const report = await runTestSuite(testCommand);
        res.json(report);
    } catch (err) {
        console.error('Test Module execution error:', err);
        res.status(500).json({
            msg: 'Test execution failed',
            error: err.message
        });
    }
});

/**
 * @route   GET /api/test-module/status
 * @desc    Get system test health and feature registry status
 * @access  Admin Only
 */
router.get('/status', (req, res) => {
    try {
        const history = getRecentHistory(1);
        const lastRun = history.length > 0 ? history[0] : null;

        res.json({
            status: lastRun ? lastRun.status : 'HEALTHY',
            registeredFeaturesCount: new Set(TEST_REGISTRY.map(t => t.feature)).size,
            registeredTotalTests: TEST_REGISTRY.length,
            lastTest: lastRun ? lastRun.timestamp : new Date().toISOString(),
            lastSummary: lastRun
        });
    } catch (err) {
        res.status(500).json({ msg: 'Failed to retrieve test status', error: err.message });
    }
});

/**
 * @route   GET /api/test-module/history
 * @desc    Get recent test run logs
 * @access  Admin Only
 */
router.get('/history', (req, res) => {
    try {
        const history = getRecentHistory(20);
        res.json(history);
    } catch (err) {
        res.status(500).json({ msg: 'Failed to retrieve test history', error: err.message });
    }
});

/**
 * @route   POST /api/test-module/visual-baseline
 * @desc    Accept or reject visual baseline changes
 * @access  Admin Only
 */
router.post('/visual-baseline', (req, res) => {
    try {
        const { action, feature, baselineData } = req.body;
        const history = loadHistory();
        if (!history.visualBaselines) history.visualBaselines = {};

        if (action === 'accept') {
            history.visualBaselines[feature] = baselineData || { acceptedAt: new Date().toISOString() };
            saveHistory(history);
            return res.json({ msg: `Visual baseline accepted for ${feature}` });
        } else {
            return res.json({ msg: `Visual baseline rejected for ${feature}` });
        }
    } catch (err) {
        res.status(500).json({ msg: 'Failed to update visual baseline', error: err.message });
    }
});

module.exports = router;
