/**
 * changeDetector.js
 * Scans codebase files, identifies modified components/routes/models,
 * and automatically maps changes to affected feature test suites.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '../../../');
const serverDir = path.join(rootDir, 'server');
const clientDir = path.join(rootDir, 'client', 'src');

const FEATURE_FILE_MAP = {
    'Admin': [
        'server/routes/admin.js',
        'server/routes/exams.js',
        'client/src/pages/admin/AdminDashboard.jsx',
        'client/src/pages/admin/ExamManagement.jsx'
    ],
    'Permissions': [
        'server/middleware/auth.js',
        'server/middleware/role.js',
        'server/routes/auth.js'
    ],
    'Question Bank': [
        'server/routes/questions.js',
        'server/models/Question.js',
        'client/src/pages/teacher/QuestionRepository.jsx'
    ],
    'Question Editor': [
        'client/src/pages/teacher/CreatePaper.jsx',
        'client/src/components/QuestionBlock.jsx'
    ],
    'Paper Builder': [
        'server/routes/papers.js',
        'server/models/Paper.js',
        'client/src/pages/teacher/CreatePaper.jsx'
    ],
    'Merge': [
        'server/routes/exams.js',
        'client/src/pages/admin/AdminDashboard.jsx'
    ],
    'Analysis': [
        'client/src/components/PaperAnalysisModal.jsx',
        'server/routes/exams.js'
    ],
    'Answer Key': [
        'client/src/pages/admin/AdminDashboard.jsx',
        'client/src/utils/pqrsGenerator.js'
    ],
    'SOE': [
        'client/src/pages/admin/AdminDashboard.jsx',
        'client/src/components/MathRenderer.jsx'
    ],
    'PQRS': [
        'client/src/utils/pqrsGenerator.js',
        'client/src/pages/admin/AdminPaperPreview.jsx'
    ],
    'PDF': [
        'client/src/components/PaperRenderer.jsx',
        'client/src/components/A4PaperEngine.jsx',
        'client/src/pages/admin/AdminPaperPreview.jsx'
    ],
    'A4': [
        'client/src/components/PaperRenderer.jsx',
        'client/src/components/A4PaperEngine.jsx'
    ],
    'LaTeX': [
        'client/src/components/MathRenderer.jsx'
    ],
    'Diagrams': [
        'client/src/components/QuestionBlock.jsx',
        'client/src/components/PaperRenderer.jsx'
    ],
    'CBT': [
        'client/src/pages/exam/ExamEngine.jsx',
        'client/src/pages/exam/ExamInstructions.jsx',
        'server/routes/exams.js'
    ],
    'Timer': [
        'client/src/pages/exam/ExamEngine.jsx'
    ],
    'Autosave': [
        'client/src/pages/exam/ExamEngine.jsx',
        'server/routes/exams.js'
    ],
    'Scoring': [
        'server/routes/exams.js',
        'client/src/pages/exam/ExamEngine.jsx'
    ],
    'Results': [
        'client/src/pages/admin/AdminResults.jsx',
        'server/routes/exams.js'
    ],
    'Visual/Layout': [
        'client/src/components/MathRenderer.jsx',
        'client/src/components/PaperRenderer.jsx',
        'client/src/pages/admin/AdminDashboard.jsx'
    ]
};

function getFileHash(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const data = fs.readFileSync(filePath);
        return crypto.createHash('md5').update(data).digest('hex');
    } catch (e) {
        return null;
    }
}

function scanCodebaseChanges(previousHashes = {}) {
    const currentHashes = {};
    const changedFiles = [];
    const affectedFeatures = new Set();
    const newFeatures = [];

    // Scan all mapped files
    Object.entries(FEATURE_FILE_MAP).forEach(([feature, files]) => {
        files.forEach(relPath => {
            const fullPath = path.join(rootDir, relPath);
            const hash = getFileHash(fullPath);
            if (hash) {
                currentHashes[relPath] = hash;
                if (previousHashes[relPath] && previousHashes[relPath] !== hash) {
                    changedFiles.push(relPath);
                    affectedFeatures.add(feature);
                } else if (!previousHashes[relPath] && Object.keys(previousHashes).length > 0) {
                    changedFiles.push(relPath);
                    affectedFeatures.add(feature);
                }
            }
        });
    });

    // Detect newly created files in client/src/pages or server/routes
    const routesDir = path.join(serverDir, 'routes');
    if (fs.existsSync(routesDir)) {
        const routeFiles = fs.readdirSync(routesDir);
        routeFiles.forEach(rf => {
            const rel = 'server/routes/' + rf;
            const full = path.join(routesDir, rf);
            const hash = getFileHash(full);
            if (hash) {
                currentHashes[rel] = hash;
                if (!previousHashes[rel] && Object.keys(previousHashes).length > 0) {
                    const featureName = rf.replace('.js', '').toUpperCase();
                    newFeatures.push({
                        name: featureName,
                        path: rel,
                        type: 'Route Endpoint'
                    });
                }
            }
        });
    }

    return {
        currentHashes,
        changedFiles,
        affectedFeatures: Array.from(affectedFeatures),
        newFeatures
    };
}

module.exports = {
    scanCodebaseChanges,
    FEATURE_FILE_MAP
};
