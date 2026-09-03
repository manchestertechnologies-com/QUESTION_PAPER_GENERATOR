/**
 * registry.js
 * Comprehensive internal test registry for Manchester Assessment Platform.
 */

const TEST_REGISTRY = [
    // ── 1. Admin & Governance
    {
        id: 'ADMIN-001',
        feature: 'Admin',
        title: 'Admin Authentication & Session Authority',
        priority: 'CRITICAL',
        type: 'Security',
        expected: 'Admin session returns valid admin role and prevents privilege escalation.'
    },
    {
        id: 'ADMIN-002',
        feature: 'Admin',
        title: 'Exam Commissioning with PCMB Faculty Delegation',
        priority: 'CRITICAL',
        type: 'Workflow',
        expected: 'Commissioning creates exam document with subject assignments for Physics, Chemistry, Maths, and Biology.'
    },
    {
        id: 'ADMIN-003',
        feature: 'Admin',
        title: 'Subject Compilation Progress Bar & Counter Sync',
        priority: 'HIGH',
        type: 'Logic',
        expected: 'Exam compilation percentage strictly reflects sum of faculty-submitted question counts.'
    },
    {
        id: 'ADMIN-004',
        feature: 'Admin',
        title: 'Exam Commissioning Notification Dispatch',
        priority: 'MEDIUM',
        type: 'Workflow',
        expected: 'Teachers receive real-time notifications when an exam is delegated to them.'
    },

    // ── 2. Role Permissions & Security
    {
        id: 'PERM-001',
        feature: 'Permissions',
        title: 'Teacher Access Boundary (403 on Admin Routes)',
        priority: 'CRITICAL',
        type: 'Security',
        expected: 'Non-admin roles receive HTTP 403 when accessing admin endpoints or Test Module.'
    },
    {
        id: 'PERM-002',
        feature: 'Permissions',
        title: 'Student Access Boundary (403 on Teacher/Admin Routes)',
        priority: 'CRITICAL',
        type: 'Security',
        expected: 'Student sessions are forbidden from mutating papers, questions, or teacher assignments.'
    },
    {
        id: 'PERM-003',
        feature: 'Permissions',
        title: 'Test Module Absolute Protection',
        priority: 'CRITICAL',
        type: 'Security',
        expected: 'Test execution endpoints reject any request lacking verified admin token.'
    },

    // ── 3. Question Bank & In-Place Editor
    {
        id: 'QBANK-001',
        feature: 'Question Bank',
        title: 'Question Schema & Mandatory Fields Validation',
        priority: 'CRITICAL',
        type: 'Data',
        expected: 'Questions have valid stems, non-empty options or numerical range, correct answer, and Bloom level.'
    },
    {
        id: 'QBANK-002',
        feature: 'Question Editor',
        title: 'In-Place Question Stem & Option Editing Persistence',
        priority: 'HIGH',
        type: 'Logic',
        expected: 'Modified question text and options persist with zero corruption of LaTeX tokens.'
    },
    {
        id: 'QBANK-003',
        feature: 'Question Editor',
        title: 'Multi-Statement Row Manipulation (Add/Delete)',
        priority: 'HIGH',
        type: 'Logic',
        expected: 'Adding or removing statement rows preserves Roman numeral sequence and option mappings.'
    },
    {
        id: 'QBANK-004',
        feature: 'Question Bank',
        title: 'Assertion & Reason Structuring',
        priority: 'HIGH',
        type: 'Logic',
        expected: 'Assertion and Reason fields are preserved and rendered with distinct styling.'
    },
    {
        id: 'QBANK-005',
        feature: 'Question Bank',
        title: 'Match the Columns Pair Formatting',
        priority: 'HIGH',
        type: 'Logic',
        expected: 'Column-I and Column-II tables maintain strict pairwise alignment.'
    },
    {
        id: 'QBANK-006',
        feature: 'Question Bank',
        title: 'Numerical Integer & Decimal Questions',
        priority: 'HIGH',
        type: 'Logic',
        expected: 'Numerical questions store valid numericalAnswer with tolerance bounds.'
    },
    {
        id: 'QBANK-007',
        feature: 'Question Bank',
        title: 'KaTeX Math Delimiter Syntax Safety',
        priority: 'HIGH',
        type: 'Visual',
        expected: 'Equations have balanced delimiters ($...$ or \\[...\\]) without raw escape leakage.'
    },

    // ── 4. Syllabus, Blueprint & Scoping
    {
        id: 'SCOPE-001',
        feature: 'Paper Builder',
        title: 'Class & Subject Isolation',
        priority: 'HIGH',
        type: 'Logic',
        expected: 'Selected Class (11/12) and Subject never return questions belonging to other subjects.'
    },
    {
        id: 'SCOPE-002',
        feature: 'Paper Builder',
        title: 'Chapter & Concept Filtering without Cross-Contamination',
        priority: 'HIGH',
        type: 'Logic',
        expected: 'Scoping by Chapter strictly limits available questions to that chapter\'s concept taxonomy.'
    },
    {
        id: 'SCOPE-003',
        feature: 'Paper Builder',
        title: 'CET Preset Question Count (60 Qs per subject)',
        priority: 'CRITICAL',
        type: 'Logic',
        expected: 'CET blueprint requires exactly 60 questions per subject across PCMB.'
    },
    {
        id: 'SCOPE-004',
        feature: 'Paper Builder',
        title: 'NEET Preset Question Count (50 Qs per subject)',
        priority: 'CRITICAL',
        type: 'Logic',
        expected: 'NEET blueprint requires 50 questions each for Physics, Chemistry, Botany, and Zoology.'
    },
    {
        id: 'SCOPE-005',
        feature: 'Paper Builder',
        title: 'JEE Main Preset (20 MCQs + 5 Numerical per subject)',
        priority: 'CRITICAL',
        type: 'Logic',
        expected: 'JEE pattern strictly enforces 20 MCQs + 5 Numerical type questions for PCM.'
    },

    // ── 5. Subject Paper Merging & Integrity
    {
        id: 'MERGE-001',
        feature: 'Merge',
        title: 'CET PCMB Deterministic Subject Ordering',
        priority: 'CRITICAL',
        type: 'Logic',
        expected: 'CET merge orders subjects: Physics -> Chemistry -> Mathematics -> Biology.'
    },
    {
        id: 'MERGE-002',
        feature: 'Merge',
        title: 'NEET PCB Deterministic Subject Ordering',
        priority: 'CRITICAL',
        type: 'Logic',
        expected: 'NEET merge orders subjects: Physics -> Chemistry -> Botany -> Zoology.'
    },
    {
        id: 'MERGE-003',
        feature: 'Merge',
        title: 'JEE PCM Deterministic Subject Ordering',
        priority: 'CRITICAL',
        type: 'Logic',
        expected: 'JEE merge orders subjects: Physics -> Chemistry -> Mathematics.'
    },
    {
        id: 'MERGE-004',
        feature: 'Merge',
        title: 'Zero Question Loss & Zero Duplication',
        priority: 'CRITICAL',
        type: 'Data',
        expected: 'Merged paper question count exactly equals sum of all source subject questions.'
    },
    {
        id: 'MERGE-005',
        feature: 'Merge',
        title: 'Full Metadata & SOE Hydration in Merged Document',
        priority: 'CRITICAL',
        type: 'Data',
        expected: 'Merged paper retains all stems, options, keys, SOE solutions, and diagrams.'
    },

    // ── 6. Paper Analysis & Cognitive Ratios
    {
        id: 'ANALYSIS-001',
        feature: 'Analysis',
        title: 'Difficulty Percentage Breakdown (Easy/Medium/Hard)',
        priority: 'HIGH',
        type: 'Calculation',
        expected: 'Difficulty breakdown sum equals 100% and matches individual question levels.'
    },
    {
        id: 'ANALYSIS-002',
        feature: 'Analysis',
        title: 'Subject Question Distribution',
        priority: 'HIGH',
        type: 'Calculation',
        expected: 'Subject proportions accurately match compiled question counts.'
    },
    {
        id: 'ANALYSIS-003',
        feature: 'Analysis',
        title: 'Chapter & Concept Weightage Calculation',
        priority: 'MEDIUM',
        type: 'Calculation',
        expected: 'Chapter question counts match source dataset.'
    },
    {
        id: 'ANALYSIS-004',
        feature: 'Analysis',
        title: 'Bloom\'s Taxonomy Cognitive Distribution',
        priority: 'MEDIUM',
        type: 'Calculation',
        expected: 'Knowledge, Application, and Analysis proportions are calculated correctly.'
    },

    // ── 7. Answer Key Integrity & Matrix
    {
        id: 'KEY-001',
        feature: 'Answer Key',
        title: 'Answer Key Existence for Every Question',
        priority: 'CRITICAL',
        type: 'Data',
        expected: 'Zero questions have null, empty, or undefined correct answers.'
    },
    {
        id: 'KEY-002',
        feature: 'Answer Key',
        title: 'Answer Key Validity in Available Options',
        priority: 'CRITICAL',
        type: 'Logic',
        expected: 'MCQ answer letters (A, B, C, D) strictly exist within the question\'s options range.'
    },
    {
        id: 'KEY-003',
        feature: 'Answer Key',
        title: 'Zero Answer Drop Across Merge and Export',
        priority: 'CRITICAL',
        type: 'Data',
        expected: 'Answer keys are never erased during paper merging, printing, or CBT export.'
    },
    {
        id: 'KEY-004',
        feature: 'Answer Key',
        title: 'Quick Key Matrix Grid Rendering',
        priority: 'MEDIUM',
        type: 'Visual',
        expected: 'Key matrix displays complete Q1-QN table with correct option letters.'
    },

    // ── 8. Step-by-Step SOE Guide
    {
        id: 'SOE-001',
        feature: 'SOE',
        title: 'Solution-to-Question 1-to-1 Mapping',
        priority: 'CRITICAL',
        type: 'Data',
        expected: 'Each step-by-step solution strictly matches its corresponding question ID.'
    },
    {
        id: 'SOE-002',
        feature: 'SOE',
        title: 'Step-by-Step KaTeX Math Formula Rendering in Solutions',
        priority: 'HIGH',
        type: 'Visual',
        expected: 'Equations in solutions render without unparsed symbols or raw string tokens.'
    },
    {
        id: 'SOE-003',
        feature: 'SOE',
        title: 'Subject Filtering in Solutions Booklet',
        priority: 'MEDIUM',
        type: 'Logic',
        expected: 'Filtering SOE by subject isolates only that subject\'s explanations.'
    },
    {
        id: 'SOE-004',
        feature: 'SOE',
        title: 'Print-Ready Solutions Booklet Styling',
        priority: 'MEDIUM',
        type: 'Visual',
        expected: 'SOE booklet print view maintains clear spacing and page breaks.'
    },

    // ── 9. PQRS 4-Set Multi-Set Engine
    {
        id: 'PQRS-001',
        feature: 'PQRS',
        title: 'Set P Original Question & Option Order',
        priority: 'CRITICAL',
        type: 'Logic',
        expected: 'Set P maintains exact 1-to-1 original question sequence and option order.'
    },
    {
        id: 'PQRS-002',
        feature: 'PQRS',
        title: 'Set Q Question Shuffling with Intact Options',
        priority: 'CRITICAL',
        type: 'Logic',
        expected: 'Set Q shuffles question order while keeping individual option positions intact.'
    },
    {
        id: 'PQRS-003',
        feature: 'PQRS',
        title: 'Set R Option Shuffling with Recalculated Answer Keys',
        priority: 'CRITICAL',
        type: 'Calculation',
        expected: 'Set R shuffles options and recalculates correct answer letters with 100% semantic accuracy.'
    },
    {
        id: 'PQRS-004',
        feature: 'PQRS',
        title: 'Set S Maximum Randomization (Questions + Options)',
        priority: 'CRITICAL',
        type: 'Calculation',
        expected: 'Set S applies double randomization with recalculated answer keys.'
    },
    {
        id: 'PQRS-005',
        feature: 'PQRS',
        title: 'Zero Question Loss Across All 4 Sets',
        priority: 'CRITICAL',
        type: 'Data',
        expected: 'Sets P, Q, R, and S have identical question counts and zero dropped items.'
    },

    // ── 10. True A4 Pagination & PDF / Word Layout
    {
        id: 'PDF-001',
        feature: 'PDF',
        title: 'A4 Dimension Compliance (210mm x 297mm)',
        priority: 'HIGH',
        type: 'Visual',
        expected: 'Page container matches exact standard ISO A4 aspect ratio (1 : 1.414).'
    },
    {
        id: 'PDF-002',
        feature: 'PDF',
        title: '2-Column & 1-Column Layout Grid Integrity',
        priority: 'HIGH',
        type: 'Visual',
        expected: '2-column competitive layout maintains gutter clearance without overlapping.'
    },
    {
        id: 'PDF-003',
        feature: 'PDF',
        title: 'Balanced Page Distribution Algorithm',
        priority: 'HIGH',
        type: 'Logic',
        expected: 'Pagination distributes questions evenly across physical pages without orphaned questions.'
    },
    {
        id: 'PDF-004',
        feature: 'PDF',
        title: 'Institutional Header, Watermark & Footer Clearance',
        priority: 'MEDIUM',
        type: 'Visual',
        expected: 'Watermark and headers remain strictly inside printable margins.'
    },
    {
        id: 'PDF-005',
        feature: 'A4',
        title: 'Zero Text Clipping & Multiline Word Wrap',
        priority: 'HIGH',
        type: 'Visual',
        expected: 'Long multiline questions wrap inside container without horizontal scroll overflow.'
    },

    // ── 11. Diagram & LaTeX Rendering
    {
        id: 'DLATEX-001',
        feature: 'LaTeX',
        title: 'KaTeX Mathematical Formula Syntax Parsing',
        priority: 'HIGH',
        type: 'Visual',
        expected: 'Fractions, square roots, integrals, and Greek letters parse into valid KaTeX DOM.'
    },
    {
        id: 'DLATEX-002',
        feature: 'LaTeX',
        title: 'Unclosed Delimiter Auto-Escaping',
        priority: 'HIGH',
        type: 'ErrorHandling',
        expected: 'Unclosed $ symbols or malformed LaTeX tags are safely handled without crashing UI.'
    },
    {
        id: 'DLATEX-003',
        feature: 'Diagrams',
        title: 'Diagram Image URL & SVG URI Validity',
        priority: 'HIGH',
        type: 'Data',
        expected: 'Diagram references have valid image URIs with non-zero dimensions.'
    },
    {
        id: 'DLATEX-004',
        feature: 'Diagrams',
        title: 'Diagram Aspect Ratio & Non-Overlapping Layout',
        priority: 'HIGH',
        type: 'Visual',
        expected: 'Diagrams are contained within question card and do not overlap option blocks.'
    },

    // ── 12. Online CBT Student Flow
    {
        id: 'CBT-001',
        feature: 'CBT',
        title: 'Direct Candidate Registration Banner',
        priority: 'CRITICAL',
        type: 'Workflow',
        expected: 'Students enter Name and Roll Number directly and initiate test without login friction.'
    },
    {
        id: 'CBT-002',
        feature: 'CBT',
        title: '5-State Question Palette State Transitions',
        priority: 'CRITICAL',
        type: 'Logic',
        expected: 'Palette transitions correctly between Not Visited, Not Answered, Answered, Review, and Answered+Review.'
    },
    {
        id: 'CBT-003',
        feature: 'CBT',
        title: 'Numerical Question Virtual Keypad Interaction',
        priority: 'HIGH',
        type: 'Workflow',
        expected: 'Virtual keypad allows typing numbers, decimal points, backspace, and clear.'
    },
    {
        id: 'CBT-004',
        feature: 'CBT',
        title: 'Subject Section Switching & Question Navigation',
        priority: 'HIGH',
        type: 'Workflow',
        expected: 'Switching between Physics, Chemistry, Maths, and Biology updates view instantly.'
    },
    {
        id: 'CBT-005',
        feature: 'Timer',
        title: 'Timer Countdown & Server Synchronization',
        priority: 'CRITICAL',
        type: 'Logic',
        expected: 'Timer counts down reliably and triggers auto-submission when reaching 00:00.'
    },
    {
        id: 'CBT-006',
        feature: 'Autosave',
        title: 'Browser LocalStorage & Background Sync Resilience',
        priority: 'CRITICAL',
        type: 'Data',
        expected: 'Selected answers persist across browser refreshes and sync to server.'
    },
    {
        id: 'CBT-007',
        feature: 'CBT',
        title: 'Test Final Submission & Result Lock',
        priority: 'CRITICAL',
        type: 'Workflow',
        expected: 'Final submission locks responses and prevents further answer changes.'
    },

    // ── 13. Assessment Scoring & Accuracy Engine
    {
        id: 'SCORE-001',
        feature: 'Scoring',
        title: 'CET Scoring Rule (+1 Mark / 0 Negative)',
        priority: 'CRITICAL',
        type: 'Calculation',
        expected: 'CET tests award +1 mark per correct answer and 0 penalty for incorrect answers.'
    },
    {
        id: 'SCORE-002',
        feature: 'Scoring',
        title: 'NEET Scoring Rule (+4 Marks / -1 Negative)',
        priority: 'CRITICAL',
        type: 'Calculation',
        expected: 'NEET tests award +4 for correct, -1 for incorrect, and 0 for unattempted.'
    },
    {
        id: 'SCORE-003',
        feature: 'Scoring',
        title: 'JEE Scoring Rule (+4 / -1 on MCQ, +4 / 0 on Numerical)',
        priority: 'CRITICAL',
        type: 'Calculation',
        expected: 'JEE tests apply -1 penalty only to MCQs and 0 penalty on numerical inputs.'
    },
    {
        id: 'SCORE-004',
        feature: 'Scoring',
        title: 'Subject-wise Marks & Accuracy Percentage',
        priority: 'HIGH',
        type: 'Calculation',
        expected: 'Accuracy % equals (Correct / Total Attempted) * 100.'
    },

    // ── 14. Candidate Results & Scorecard
    {
        id: 'RES-001',
        feature: 'Results',
        title: 'Instant Scorecard Generation',
        priority: 'HIGH',
        type: 'Workflow',
        expected: 'Scorecard displays total score, subject breakdown, accuracy, and correct count.'
    },
    {
        id: 'RES-002',
        feature: 'Results',
        title: 'Total vs Subject Marks Mathematical Consistency',
        priority: 'CRITICAL',
        type: 'Calculation',
        expected: 'Sum of subject marks strictly equals total awarded marks.'
    },
    {
        id: 'RES-003',
        feature: 'Results',
        title: 'Attempted + Unattempted Count Equality',
        priority: 'HIGH',
        type: 'Calculation',
        expected: 'Correct + Incorrect + Unattempted strictly equals total questions.'
    },

    // ── 15. Visual Boundaries & Overflow
    {
        id: 'VIS-001',
        feature: 'Visual/Layout',
        title: 'Container Boundary Overflow Prevention',
        priority: 'MEDIUM',
        type: 'Visual',
        expected: 'No UI card element has scrollWidth > clientWidth unless designed as a scrollable container.'
    },
    {
        id: 'VIS-002',
        feature: 'Visual/Layout',
        title: 'Option Letter Badge & Text Alignment',
        priority: 'MEDIUM',
        type: 'Visual',
        expected: 'Option badges (A, B, C, D) remain vertically aligned with first line of option text.'
    },
    {
        id: 'VIS-003',
        feature: 'Visual/Layout',
        title: 'Modal Viewport Responsive Constraints',
        priority: 'MEDIUM',
        type: 'Visual',
        expected: 'Modals do not overflow viewport width or height on tablet and mobile screens.'
    },

    // ── 16. Edge Cases & Graceful Degradation
    {
        id: 'ERR-001',
        feature: 'Admin',
        title: 'Graceful Handling of Empty Exam or Missing Questions',
        priority: 'HIGH',
        type: 'ErrorHandling',
        expected: 'Exams with 0 submitted questions display clear callout instead of blank screen.'
    },
    {
        id: 'ERR-002',
        feature: 'CBT',
        title: 'Invalid Exam Access Code Rejection',
        priority: 'HIGH',
        type: 'ErrorHandling',
        expected: 'Non-existent exam IDs return friendly error banner rather than crashing.'
    },
    {
        id: 'ERR-003',
        feature: 'CBT',
        title: 'Duplicate Exam Submission Prevention',
        priority: 'CRITICAL',
        type: 'ErrorHandling',
        expected: 'Multiple submit clicks do not create duplicate result records.'
    }
];

module.exports = {
    TEST_REGISTRY
};
