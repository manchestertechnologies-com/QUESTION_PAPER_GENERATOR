/**
 * goldenData.js
 * Permanent Canonical Golden Test Dataset for Manchester Assessment Platform.
 */

const GOLDEN_QUESTIONS = [
    {
        id: 'GOLDEN-PHY-001',
        _id: 'golden_phy_001',
        subject: 'Physics',
        class: '12',
        chapter: 'Current Electricity',
        concept: 'Kirchhoff Rules & DC Circuits',
        examType: 'CET',
        type: 'MCQ',
        level: 'easy',
        bloomLevel: 'Knowledge',
        marks: 1,
        negativeMarks: 0,
        questionText: 'According to Kirchhoff\'s junction rule, the algebraic sum of currents meeting at a junction in an electrical network is zero: $\\sum_{k=1}^n I_k = 0$. This rule is a direct consequence of the conservation of:',
        options: [
            'Electric charge ($Q$)',
            'Total electrical energy ($E$)',
            'Linear momentum ($p$)',
            'Magnetic flux ($\\Phi_B$)'
        ],
        answer: 'A',
        solutionText: 'Kirchhoff\'s Current Law (junction rule) states $\\sum I = 0$. Because electric charge cannot accumulate indefinitely at a junction in a steady state, the rate of charge entering equals the rate of charge leaving: $\\frac{dQ_{in}}{dt} = \\frac{dQ_{out}}{dt}$. Hence, it follows the law of conservation of charge.',
        diagram: null,
        statements: []
    },
    {
        id: 'GOLDEN-PHY-002',
        _id: 'golden_phy_002',
        subject: 'Physics',
        class: '11',
        chapter: 'Work, Energy and Power',
        concept: 'Work-Energy Theorem',
        examType: 'JEE',
        type: 'AssertionReason',
        level: 'medium',
        bloomLevel: 'Analysis',
        marks: 4,
        negativeMarks: 1,
        questionText: 'Read the following Assertion (A) and Reason (R) and choose the correct option:',
        assertion: 'The work done by the net force acting on a particle equals the change in its kinetic energy, i.e., $W_{net} = \\Delta K = \\frac{1}{2}mv_f^2 - \\frac{1}{2}mv_i^2$.',
        reason: 'The work-energy theorem is valid for non-inertial frames of reference only when pseudo-forces are excluded.',
        options: [
            'Both (A) and (R) are true, and (R) is the correct explanation of (A)',
            'Both (A) and (R) are true, but (R) is NOT the correct explanation of (A)',
            '(A) is true, but (R) is false',
            '(A) is false, but (R) is true'
        ],
        answer: 'C',
        solutionText: 'Assertion (A) is the standard Work-Energy theorem ($W_{net} = \\Delta K$). Reason (R) is false because in a non-inertial frame of reference, the work done by pseudo-forces MUST be included for the theorem to hold: $W_{real} + W_{pseudo} = \\Delta K$.',
        diagram: null
    },
    {
        id: 'GOLDEN-CHM-001',
        _id: 'golden_chm_001',
        subject: 'Chemistry',
        class: '12',
        chapter: 'Chemical Kinetics',
        concept: 'First Order Reactions & Half Life',
        examType: 'NEET',
        type: 'MultiStatement',
        level: 'medium',
        bloomLevel: 'Application',
        marks: 4,
        negativeMarks: 1,
        questionText: 'Consider the following statements regarding a first-order chemical reaction $A \\rightarrow B$ with rate constant $k$:',
        statements: [
            'Statement I: The half-life period $t_{1/2} = \\frac{\\ln 2}{k} = \\frac{0.693}{k}$ is strictly independent of the initial concentration $[A]_0$.',
            'Statement II: The time required for $99.9\\%$ completion of a first-order reaction is approximately equal to $10 \\times t_{1/2}$.',
            'Statement III: A plot of $\\ln[A]$ versus time $t$ yields a straight line with slope $+k$.'
        ],
        options: [
            'Only Statement I is correct',
            'Statements I and II are correct, but Statement III is incorrect',
            'Statements II and III are correct, but Statement I is incorrect',
            'All Statements I, II, and III are correct'
        ],
        answer: 'B',
        solutionText: 'Statement I is correct: $t_{1/2} = \\frac{0.693}{k}$. Statement II is correct: $t_{99.9\\%} = \\frac{\\ln(1000)}{k} = \\frac{6.908}{k} \\approx 10 \\times \\frac{0.693}{k} = 10 \\, t_{1/2}$. Statement III is incorrect because $\\ln[A] = \\ln[A]_0 - kt$, so the slope is negative ($-k$), not $+k$.',
        diagram: null
    },
    {
        id: 'GOLDEN-CHM-002',
        _id: 'golden_chm_002',
        subject: 'Chemistry',
        class: '12',
        chapter: 'Coordination Compounds',
        concept: 'Hybridization and Geometry of Complexes',
        examType: 'NEET',
        type: 'MatchPairs',
        level: 'hard',
        bloomLevel: 'Analysis',
        marks: 4,
        negativeMarks: 1,
        questionText: 'Match the coordination species in Column-I with the corresponding hybridization and geometry in Column-II:',
        matchPairs: [
            { left: '(A) $[Ni(CO)_4]$', right: '(p) $dsp^2$, Square planar' },
            { left: '(B) $[Ni(CN)_4]^{2-}$', right: '(q) $sp^3$, Tetrahedral' },
            { left: '(C) $[Fe(CN)_6]^{3-}$', right: '(r) $d^2sp^3$, Inner orbital octahedral' },
            { left: '(D) $[Fe(H_2O)_6]^{3+}$', right: '(s) $sp^3d^2$, Outer orbital octahedral' }
        ],
        options: [
            '(A)-(q), (B)-(p), (C)-(r), (D)-(s)',
            '(A)-(p), (B)-(q), (C)-(s), (D)-(r)',
            '(A)-(q), (B)-(r), (C)-(p), (D)-(s)',
            '(A)-(s), (B)-(p), (C)-(r), (D)-(q)'
        ],
        answer: 'A',
        solutionText: '$[Ni(CO)_4]$ has $Ni(0): 3d^{10}$ resulting in $sp^3$ tetrahedral. $[Ni(CN)_4]^{2-}$ has $Ni(II): 3d^8$ with strong ligand $CN^-$ pairing electrons to give $dsp^2$ square planar. $[Fe(CN)_6]^{3-}$ is $d^2sp^3$ (inner). $[Fe(H_2O)_6]^{3+}$ with weak field $H_2O$ is $sp^3d^2$ (outer). Hence (A)-(q), (B)-(p), (C)-(r), (D)-(s).',
        diagram: null
    },
    {
        id: 'GOLDEN-MTH-001',
        _id: 'golden_mth_001',
        subject: 'Mathematics',
        class: '12',
        chapter: 'Definite Integrals',
        concept: 'Properties of Definite Integrals',
        examType: 'JEE',
        type: 'Numerical',
        level: 'hard',
        bloomLevel: 'Application',
        marks: 4,
        negativeMarks: 0,
        questionText: 'Evaluate the definite integral $I = \\frac{4}{\\pi} \\int_0^{\\pi} \\frac{x \\sin x}{1 + \\cos^2 x} \\, dx$. Find the exact integer value of $I$:',
        options: [],
        answer: '2',
        numericalAnswer: 2,
        numericalTolerance: 0,
        solutionText: 'Using King\'s property $\\int_0^a f(x) dx = \\int_0^a f(a-x) dx$:\n$I\' = \\int_0^{\\pi} \\frac{x \\sin x}{1 + \\cos^2 x} dx = \\int_0^{\\pi} \\frac{(\\pi - x) \\sin x}{1 + \\cos^2 x} dx$.\nAdding: $2I\' = \\pi \\int_0^{\\pi} \\frac{\\sin x}{1 + \\cos^2 x} dx = 2\\pi \\int_0^1 \\frac{dt}{1 + t^2} = 2\\pi [\\tan^{-1}(1)] = 2\\pi \\left(\\frac{\\pi}{4}\\right) = \\frac{\\pi^2}{2}$.\nTherefore, $I = \\frac{4}{\\pi} I\' = \\frac{4}{\\pi} \\times \\frac{\\pi^2}{4} = 2$.',
        diagram: null
    },
    {
        id: 'GOLDEN-MTH-002',
        _id: 'golden_mth_002',
        subject: 'Mathematics',
        class: '11',
        chapter: 'Limits and Derivatives',
        concept: 'Standard Trigonometric Limits',
        examType: 'CET',
        type: 'MCQ',
        level: 'easy',
        bloomLevel: 'Knowledge',
        marks: 1,
        negativeMarks: 0,
        questionText: 'The value of the limit $\\lim_{x \\to 0} \\frac{1 - \\cos(4x)}{x^2}$ is equal to:',
        options: [
            '$2$',
            '$4$',
            '$8$',
            '$16$'
        ],
        answer: 'C',
        solutionText: 'Using identity $1 - \\cos(2\\theta) = 2\\sin^2(\\theta)$:\n$\\lim_{x \\to 0} \\frac{2\\sin^2(2x)}{x^2} = 2 \\lim_{x \\to 0} \\left(\\frac{\\sin(2x)}{2x}\\right)^2 \\times 4 = 2 \\times 1^2 \\times 4 = 8$.',
        diagram: null
    },
    {
        id: 'GOLDEN-BIO-001',
        _id: 'golden_bio_001',
        subject: 'Biology',
        class: '11',
        chapter: 'Cell Cycle and Cell Division',
        concept: 'Mitosis and Stages of M-Phase',
        examType: 'NEET',
        type: 'MCQ',
        level: 'medium',
        bloomLevel: 'Knowledge',
        marks: 4,
        negativeMarks: 1,
        questionText: 'During which phase of mitotic cell division do the sister chromatids separate and move toward opposite spindle poles by shortening of kinetochore microtubules?',
        options: [
            'Prophase',
            'Metaphase',
            'Anaphase',
            'Telophase'
        ],
        answer: 'C',
        solutionText: 'During Anaphase, each chromosome\'s centromere splits, allowing sister chromatids to separate into individual daughter chromosomes which migrate to opposite poles.',
        diagram: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="%23f0f9ff"/><text x="50" y="55" font-family="sans-serif" font-size="14" fill="%230369a1">Anaphase Stage</text></svg>'
    },
    {
        id: 'GOLDEN-BIO-002',
        _id: 'golden_bio_002',
        subject: 'Biology',
        class: '12',
        chapter: 'Principles of Inheritance and Variation',
        concept: 'Mendelian Dihybrid Cross & Independent Assortment',
        examType: 'CET',
        type: 'MultiStatement',
        level: 'hard',
        bloomLevel: 'Application',
        marks: 1,
        negativeMarks: 0,
        questionText: 'In a classical Mendelian dihybrid cross involving pea seed shape (Round $R$ / Wrinkled $r$) and seed color (Yellow $Y$ / Green $y$), identify the correct statement(s) for the $F_2$ generation:',
        statements: [
            'Statement 1: The classical phenotypic ratio obtained is $9 : 3 : 3 : 1$.',
            'Statement 2: The proportion of recombinant phenotypes (Round Green + Wrinkled Yellow) is $\\frac{6}{16} = \\frac{3}{8}$.',
            'Statement 3: The genotype $RRYY$ occurs with a frequency of $\\frac{1}{16}$.'
        ],
        options: [
            'Only Statement 1 is true',
            'Statements 1 and 2 are true, but 3 is false',
            'All Statements 1, 2, and 3 are true',
            'Only Statement 3 is true'
        ],
        answer: 'C',
        solutionText: 'The $F_2$ dihybrid phenotypic ratio is $9$ (Round Yellow) : $3$ (Round Green) : $3$ (Wrinkled Yellow) : $1$ (Wrinkled Green). Recombinants are $3 + 3 = 6$ out of $16$. Pure homozygous dominant $RRYY$ is $1/16$. All statements are true.',
        diagram: null
    }
];

module.exports = {
    GOLDEN_QUESTIONS
};
