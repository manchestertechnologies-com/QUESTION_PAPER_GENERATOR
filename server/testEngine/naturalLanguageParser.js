/**
 * naturalLanguageParser.js
 * Parses natural language commands and returns target features and execution mode.
 */

function parseTestCommand(commandStr = '', changedFeatures = []) {
    const cmd = (commandStr || '').toLowerCase().trim();

    // 1. Test everything / master command
    if (
        !cmd ||
        cmd === 'all' ||
        cmd.includes('everything') ||
        cmd.includes('entire') ||
        cmd.includes('complete') ||
        cmd.includes('full') ||
        cmd === 'test'
    ) {
        return {
            mode: 'ALL',
            features: null, // all
            intentDescription: 'Complete System Master Test Suite'
        };
    }

    // 2. Test whatever changed / recent modifications
    if (
        cmd.includes('change') ||
        cmd.includes('changed') ||
        cmd.includes('recent') ||
        cmd.includes('new') ||
        cmd.includes('modified') ||
        cmd.includes('today')
    ) {
        return {
            mode: 'CHANGES',
            features: changedFeatures.length > 0 ? changedFeatures : ['Admin', 'PQRS', 'PDF', 'CBT', 'Scoring', 'Merge'],
            intentDescription: 'Modified & Affected Features Test Suite'
        };
    }

    // 3. Keyword-based feature mapping
    const targetFeatures = new Set();

    if (cmd.includes('pqrs') || cmd.includes('set') || cmd.includes('sets') || cmd.includes('shuffle')) {
        targetFeatures.add('PQRS');
        targetFeatures.add('Answer Key');
        targetFeatures.add('Scoring');
    }
    if (cmd.includes('pdf') || cmd.includes('a4') || cmd.includes('print') || cmd.includes('page') || cmd.includes('layout')) {
        targetFeatures.add('PDF');
        targetFeatures.add('A4');
        targetFeatures.add('Diagrams');
        targetFeatures.add('LaTeX');
        targetFeatures.add('Visual/Layout');
    }
    if (cmd.includes('cbt') || cmd.includes('online') || cmd.includes('student') || cmd.includes('timer') || cmd.includes('palette')) {
        targetFeatures.add('CBT');
        targetFeatures.add('Timer');
        targetFeatures.add('Autosave');
        targetFeatures.add('Scoring');
        targetFeatures.add('Results');
    }
    if (cmd.includes('merge') || cmd.includes('cet') || cmd.includes('neet') || cmd.includes('jee') || cmd.includes('pcmb')) {
        targetFeatures.add('Merge');
        targetFeatures.add('Paper Builder');
        targetFeatures.add('Answer Key');
        targetFeatures.add('SOE');
        targetFeatures.add('Analysis');
    }
    if (cmd.includes('question') || cmd.includes('editor') || cmd.includes('edit') || cmd.includes('repo')) {
        targetFeatures.add('Question Bank');
        targetFeatures.add('Question Editor');
        targetFeatures.add('LaTeX');
        targetFeatures.add('Diagrams');
    }
    if (cmd.includes('score') || cmd.includes('scoring') || cmd.includes('marks') || cmd.includes('result') || cmd.includes('results')) {
        targetFeatures.add('Scoring');
        targetFeatures.add('Results');
    }
    if (cmd.includes('diagram') || cmd.includes('diagrams') || cmd.includes('image') || cmd.includes('math') || cmd.includes('latex') || cmd.includes('equation')) {
        targetFeatures.add('LaTeX');
        targetFeatures.add('Diagrams');
        targetFeatures.add('Visual/Layout');
    }
    if (cmd.includes('soe') || cmd.includes('solution') || cmd.includes('solutions') || cmd.includes('answer key') || cmd.includes('key')) {
        targetFeatures.add('Answer Key');
        targetFeatures.add('SOE');
    }
    if (cmd.includes('analysis') || cmd.includes('analytic') || cmd.includes('bloom') || cmd.includes('difficulty')) {
        targetFeatures.add('Analysis');
    }
    if (cmd.includes('admin') || cmd.includes('permission') || cmd.includes('security') || cmd.includes('auth')) {
        targetFeatures.add('Admin');
        targetFeatures.add('Permissions');
    }
    if (cmd.includes('visual') || cmd.includes('overflow') || cmd.includes('box') || cmd.includes('style')) {
        targetFeatures.add('Visual/Layout');
        targetFeatures.add('PDF');
        targetFeatures.add('A4');
    }

    if (targetFeatures.size > 0) {
        return {
            mode: 'TARGETED',
            features: Array.from(targetFeatures),
            intentDescription: `Targeted Test for: ${Array.from(targetFeatures).join(', ')}`
        };
    }

    // Default fallback to all tests
    return {
        mode: 'ALL',
        features: null,
        intentDescription: `Natural Command: "${commandStr}" (Full Test Suite)`
    };
}

module.exports = {
    parseTestCommand
};
