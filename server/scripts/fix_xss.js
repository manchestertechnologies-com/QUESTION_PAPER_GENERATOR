/**
 * Automated XSS fix script: Adds DOMPurify sanitization to all dangerouslySetInnerHTML usages
 * Run: node scripts/fix_xss.js
 */
const fs = require('fs');
const path = require('path');

// Project root is 3 levels up from server/scripts/
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const SRC = path.join(PROJECT_ROOT, 'client', 'src');

const FILES_TO_FIX = [
    'pages/admin/AdminPaperPreview.jsx',
    'pages/admin/AdminQuestionBank.jsx',
    'pages/admin/ExamManagement.jsx',
    'pages/exam/ExamEngine.jsx',
    'pages/exam/Scorecard.jsx',
    'pages/teacher/AddQuestion.jsx',
    'pages/teacher/CreatePaper.jsx',
    'pages/teacher/SavedPapers.jsx',
];

const SANITIZE_IMPORT = "import { sanitize } from '../../utils/sanitize';\n";
const SANITIZE_IMPORT_SHALLOW = "import { sanitize } from '../utils/sanitize';\n";

let totalFixed = 0;

FILES_TO_FIX.forEach(relPath => {
    const fullPath = path.join(SRC, relPath);
    if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  File not found: ${relPath}`);
        return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    const original = content;

    // Determine correct import depth
    const depth = relPath.split('/').length - 1;
    const importLine = depth === 2
        ? SANITIZE_IMPORT
        : SANITIZE_IMPORT_SHALLOW;

    // Check if sanitize is already imported
    if (!content.includes("from '../../utils/sanitize'") && !content.includes("from '../utils/sanitize'")) {
        // Add import after the last import line
        const lastImportIndex = content.lastIndexOf('\nimport ');
        if (lastImportIndex !== -1) {
            const insertPos = content.indexOf('\n', lastImportIndex + 1) + 1;
            content = content.slice(0, insertPos) + importLine + content.slice(insertPos);
        }
    }

    // Replace all: dangerouslySetInnerHTML={{ __html: X }} → dangerouslySetInnerHTML={{ __html: sanitize(X) }}
    // Also: dangerouslySetInnerHTML={{ __html: X }}/> patterns
    let fixCount = 0;
    content = content.replace(
        /dangerouslySetInnerHTML=\{\{ __html: ((?!sanitize\()[^}]+?) \}\}/g,
        (match, innerExpr) => {
            // Skip if already sanitized
            if (innerExpr.startsWith('sanitize(')) return match;
            fixCount++;
            return `dangerouslySetInnerHTML={{ __html: sanitize(${innerExpr.trim()}) }}`;
        }
    );

    if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ Fixed ${relPath} — ${fixCount} dangerouslySetInnerHTML instances sanitized`);
        totalFixed += fixCount;
    } else {
        console.log(`ℹ️  No changes needed in ${relPath}`);
    }
});

console.log(`\n🎉 Total XSS fixes applied: ${totalFixed} instances across ${FILES_TO_FIX.length} files`);
