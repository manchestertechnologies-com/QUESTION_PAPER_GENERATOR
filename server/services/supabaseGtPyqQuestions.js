const supabaseGtPyq = require('../config/supabaseGtPyq');
const { cleanDifficultyTags, extractDifficulty } = require('./supabaseQuestions');

/**
 * Maps a record from the secondary Supabase database (hjjgjcvpqgcebuokjque) to Question DTO.
 */
function mapGtPyqToQuestion(row) {
    if (!row) return null;

    const rawQuestion = row.question || '';
    const rawSolution = row.solution_text || '';
    const rawAssertion = row.assertion || '';
    const rawReason = row.reason || '';
    const qTypeLower = (row.q_type || '').toLowerCase();

    // 1. Extract any QBP metadata encoded in solution_text or question
    let qbpType = null;
    let qbpData = null;
    const typeMatch = rawSolution.match(/\[QBP_TYPE:([^\]]+)\]/i) || rawQuestion.match(/\[QBP_TYPE:([^\]]+)\]/i);
    if (typeMatch) qbpType = typeMatch[1].trim().toLowerCase();

    const dataMatch = rawSolution.match(/\[QBP_DATA:([^\]]+)\]/i) || rawQuestion.match(/\[QBP_DATA:([^\]]+)\]/i);
    if (dataMatch) {
        try {
            qbpData = JSON.parse(Buffer.from(dataMatch[1].trim(), 'base64').toString('utf-8'));
        } catch (e) {}
    }

    const rawOptions = [];
    if (row.opt_a) rawOptions.push(row.opt_a);
    if (row.opt_b) rawOptions.push(row.opt_b);
    if (row.opt_c) rawOptions.push(row.opt_c);
    if (row.opt_d) rawOptions.push(row.opt_d);

    const matchOptionsObj = row.match_options || (qbpData && (qbpData.matchOptions || qbpData.match_options)) || null;
    if (rawOptions.length === 0 && matchOptionsObj) {
        try {
            const mOpts = typeof matchOptionsObj === 'string' ? JSON.parse(matchOptionsObj) : matchOptionsObj;
            if (mOpts && typeof mOpts === 'object') {
                ['A', 'B', 'C', 'D'].forEach(k => {
                    if (mOpts[k]) rawOptions.push(mOpts[k]);
                });
                if (rawOptions.length === 0) {
                    rawOptions.push(...Object.values(mOpts));
                }
            }
        } catch (e) {}
    }

    const options = rawOptions.map(cleanDifficultyTags).filter(Boolean);

    // Match Columns Extraction
    let colA = (Array.isArray(row.column_a) && row.column_a.length > 0)
        ? row.column_a
        : (qbpData && Array.isArray(qbpData.columnA) && qbpData.columnA.length > 0)
            ? qbpData.columnA
            : (qbpData && Array.isArray(qbpData.column_a) && qbpData.column_a.length > 0)
                ? qbpData.column_a
                : [];

    let colB = (Array.isArray(row.column_b) && row.column_b.length > 0)
        ? row.column_b
        : (qbpData && Array.isArray(qbpData.columnB) && qbpData.columnB.length > 0)
            ? qbpData.columnB
            : (qbpData && Array.isArray(qbpData.column_b) && qbpData.column_b.length > 0)
                ? qbpData.column_b
                : [];

    const isInstructionText = (s) => {
        if (!s || typeof s !== 'string') return true;
        const c = s.trim();
        return c.length === 0 || /^(?:(?:Choose|Select)\s+)?(?:the\s+)?correct\s+(?:answer|combination|option|statement|code)|\b(?:from\s+the\s+options|given\s+below|options?\s+given)\b/i.test(c);
    };

    colA = colA.map(cleanDifficultyTags).map(s => s.trim()).filter(s => s && !isInstructionText(s));
    colB = colB.map(cleanDifficultyTags).map(s => s.trim()).filter(s => s && !isInstructionText(s));

    const matchPairs = [];
    if (colA.length > 0 || colB.length > 0) {
        const maxLen = Math.max(colA.length, colB.length);
        for (let i = 0; i < maxLen; i++) {
            matchPairs.push({
                left: colA[i] || '',
                right: colB[i] || ''
            });
        }
    }

    // Statements Extraction
    const statements = [];
    if (Array.isArray(row.statements) && row.statements.length > 0) {
        statements.push(...row.statements);
    } else if (qbpData) {
        if (Array.isArray(qbpData.statements) && qbpData.statements.length > 0) {
            statements.push(...qbpData.statements);
        } else {
            ['statement1', 'statement2', 'statement3', 'statement4', 'statementI', 'statementII'].forEach((k, idx) => {
                if (qbpData[k] && typeof qbpData[k] === 'string' && qbpData[k].trim()) {
                    statements.push({
                        label: `Statement ${idx + 1}:`,
                        text: cleanDifficultyTags(qbpData[k].trim())
                    });
                }
            });
        }
    }

    let assertion = cleanDifficultyTags(row.assertion || (qbpData && qbpData.assertion) || '');
    let reason = cleanDifficultyTags(row.reason || (qbpData && qbpData.reason) || '');

    let type = 'MCQ';
    const isAR = (
        qbpType === 'assertion_reason' || 
        qbpType === 'ar' || 
        qTypeLower.includes('assertion') || 
        Boolean(rawAssertion && rawReason) || 
        Boolean(assertion && reason) ||
        (/Assertion\s*(?:\(A\))?/i.test(rawQuestion) && /Reason\s*(?:\(R\))?/i.test(rawQuestion))
    );
    const isStatement = (
        qbpType === 'statement' || 
        qbpType === 'statement_based' || 
        qTypeLower.includes('statement') || 
        statements.length >= 2 ||
        (/Statement\s*(?:I|1)\s*[:\-]/i.test(rawQuestion) && /Statement\s*(?:II|2)\s*[:\-]/i.test(rawQuestion))
    );
    const hasMatchOpts = options.length >= 2 && options.every(opt => /^[a-dA-D1-4][\-–—]\(?[ivx0-9p-t]+\)?/i.test(String(opt).trim()));
    const isMatch = (
        qbpType === 'match' ||
        qbpType === 'match_following' ||
        qTypeLower.includes('match') || 
        colA.length > 0 || 
        matchPairs.length > 0 ||
        hasMatchOpts ||
        /(?:Column|List)\s*[-–—\s]*(?:I|1|A)[\s\S]*(?:Column|List)\s*[-–—\s]*(?:II|2|B)/i.test(rawQuestion) ||
        /(?:Match|Connect|Pair)\s+(?:the\s+)?(?:following|items\s+in\s+)?(?:List|Column|pairs?)/i.test(rawQuestion) ||
        /Match\s+(?:the\s+)?List\s*[-–—\s]*(?:I|1|A)?\s+with\s+(?:the\s+)?List\s*[-–—\s]*(?:II|2|B)?/i.test(rawQuestion)
    );
    const isNumeric = (
        qbpType === 'numerical' || 
        qbpType === 'integer' || 
        qTypeLower.includes('numerical') || 
        qTypeLower.includes('integer') || 
        (!options.length && Boolean(row.num_answer || row.correct_option))
    );

    if (isAR) {
        type = 'ASSERTION_REASON';
    } else if (isStatement) {
        type = 'STATEMENT_BASED';
    } else if (isMatch) {
        type = 'MATCH_FOLLOWING';
    } else if (isNumeric) {
        type = 'NUMERICAL';
    } else if (qTypeLower.includes('true') || qTypeLower.includes('false')) {
        type = 'TRUE_FALSE';
    }

    let answer = row.correct_option || row.num_answer || '';
    if (row.correct_option && options.length > 0) {
        const idx = parseInt(row.correct_option) - 1;
        if (idx >= 0 && idx < options.length) {
            answer = options[idx];
        }
    }

    const classesList = [];
    if (Array.isArray(row.exams) && row.exams.length > 0) {
        classesList.push(...row.exams);
    }
    if (row.klass && !classesList.includes(row.klass)) {
        classesList.push(`Class ${row.klass}`);
    }
    if (classesList.length === 0) classesList.push('12');

    const level = extractDifficulty(row.solution_text, row.question);
    const cleanSolution = cleanDifficultyTags(row.solution_text || '');
    let cleanQuestion = cleanDifficultyTags(row.question || '');

    if (type === 'MATCH_FOLLOWING' && matchPairs.length > 0) {
        const hasColsInStem = Boolean(
            /(\*\*|\b)(?:Column|List)\s*[-–—\s]*(?:I|1|A)\b[^\n]*\n[\s\S]*?(?:\n|^)\s*(\*\*|\b)(?:Column|List)\s*[-–—\s]*(?:II|2|B)\b/i.test(cleanQuestion)
        );
        if (!hasColsInStem) {
            const hasRoman = options.some(o => /[\-\s\(](?:i{1,4}|iv|v|vi{0,3})\b/i.test(String(o)));
            const romanList = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'];
            const intro = (cleanQuestion && cleanQuestion.trim()) ? cleanQuestion.trim().replace(/[:\.\s]+$/, '') : 'Match List-I with List-II';
            const col1Lines = matchPairs.map((p, idx) => `(${String.fromCharCode(97 + idx)}) ${p.left}`).join('\n');
            const col2Lines = matchPairs.map((p, idx) => `(${hasRoman ? (romanList[idx] || (idx + 1)) : (idx + 1)}) ${p.right}`).join('\n');
            cleanQuestion = `${intro}:\n\n**List-I**\n${col1Lines}\n\n**List-II**\n${col2Lines}`;
        }
    } else if (type === 'STATEMENT_BASED' && statements.length >= 2) {
        const hasStmtsInStem = /Statement\s*[-–—\s]*(?:I|1|A)/i.test(cleanQuestion);
        if (!hasStmtsInStem) {
            const intro = (cleanQuestion && cleanQuestion.trim()) ? cleanQuestion.trim() + '\n\n' : '';
            const stmtLines = statements.map((s, idx) => {
                const lbl = (typeof s === 'object' && s.label) ? s.label : `Statement ${idx + 1}:`;
                const txt = typeof s === 'object' ? (s.text || '') : s;
                return `${lbl.endsWith(':') ? lbl : lbl + ':'} ${txt}`;
            }).join('\n');
            cleanQuestion = `${intro}${stmtLines}`;
        }
    } else if (type === 'ASSERTION_REASON' && assertion && reason) {
        const hasARInStem = /Assertion/i.test(cleanQuestion) && /Reason/i.test(cleanQuestion);
        if (!hasARInStem) {
            const intro = (cleanQuestion && cleanQuestion.trim()) ? cleanQuestion.trim() + '\n\n' : '';
            cleanQuestion = `${intro}Assertion (A): ${assertion}\nReason (R): ${reason}`;
        }
    }

    if (!cleanQuestion && type === 'MATCH_FOLLOWING') {
        cleanQuestion = 'Match the statements/terms in Column A with Column B:';
    }

    // Determine if PYQ or GT
    const sourceStr = `${row.source || ''} ${row.reference_book || ''} ${(row.exams || []).join(' ')} ${row.tags || ''}`.toUpperCase();
    let sourceType = 'PYQ';
    if (sourceStr.includes('GT') || sourceStr.includes('GRAND TEST') || sourceStr.includes('MOCK')) {
        sourceType = 'GT';
    } else if (sourceStr.includes('PYQ') || sourceStr.includes('NEET') || sourceStr.includes('JEE') || sourceStr.includes('BOARD') || row.year) {
        sourceType = 'PYQ';
    }

    const sourceExam = (Array.isArray(row.exams) && row.exams.length > 0) ? row.exams.join(', ') : (row.board || row.source || '');
    const sourceYear = row.year ? parseInt(row.year) : null;
    const sourcePaperName = row.source || row.reference_book || '';

    return {
        _id: row.id,
        id: row.id,
        questionId: row.id,
        subject: row.subject || 'Physics',
        classes: classesList,
        chapter: row.chapter || 'General',
        concept: row.topic || row.chapter || 'General',
        subConcept: '',
        level: level,
        type: type,
        q_type: row.q_type,
        questionText: cleanQuestion,
        imageUrl: row.image_url || null,
        solutionImageUrl: row.solution_image_url || null,
        options: options,
        matchPairs: matchPairs,
        answer: answer,
        correct_option: row.correct_option,
        num_answer: row.num_answer,
        solutionText: cleanSolution,
        assertion: cleanDifficultyTags(row.assertion || ''),
        reason: cleanDifficultyTags(row.reason || ''),
        column_a: row.column_a || [],
        column_b: row.column_b || [],
        match_options: row.match_options || {},
        sourceType: sourceType,
        sourceExam: sourceExam,
        sourceYear: sourceYear,
        sourcePaperName: sourcePaperName,
        createdBy: row.created_by,
        createdByName: row.created_by_name || 'Admin',
        createdAt: row.created_at || new Date().toISOString(),
    };
}

/**
 * Fetch questions from secondary Supabase database (hjjgjcvpqgcebuokjque).
 */
async function getQuestions(filters = {}, page = 1, limit = 200) {
    try {
        let query = supabaseGtPyq.from('questions').select('*', { count: 'exact' });

        if (filters.subject) {
            const sub = filters.subject.trim();
            if (sub.toLowerCase().includes('botan') || sub.toLowerCase().includes('zool') || sub.toLowerCase().includes('bio')) {
                query = query.or('subject.ilike.%biology%,subject.ilike.%botany%,subject.ilike.%zoology%');
            } else {
                query = query.ilike('subject', sub);
            }
        }

        if (filters.chapter) {
            const chs = Array.isArray(filters.chapter) ? filters.chapter : filters.chapter.split(',').map(c => c.trim()).filter(Boolean);
            if (chs.length === 1) {
                query = query.ilike('chapter', chs[0]);
            } else if (chs.length > 1) {
                query = query.in('chapter', chs);
            }
        }

        if (filters.level) {
            query = query.ilike('difficulty', filters.level);
        }

        if (filters.search && filters.search.trim()) {
            const s = filters.search.trim();
            query = query.or(`question.ilike.%${s}%,chapter.ilike.%${s}%,topic.ilike.%${s}%,source.ilike.%${s}%`);
        }

        // Apply pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to).order('created_at', { ascending: false });

        const { data, count, error } = await query;
        if (error) throw error;

        const mapped = (data || []).map(mapGtPyqToQuestion).filter(Boolean);
        return {
            questions: mapped,
            pagination: {
                page,
                limit,
                total: count || mapped.length,
                totalPages: Math.ceil((count || mapped.length) / limit)
            }
        };
    } catch (err) {
        console.warn('[SUPABASE GT/PYQ] getQuestions warning:', err.message);
        return { questions: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } };
    }
}

/**
 * Fetch a single question by UUID from secondary Supabase database.
 */
async function getQuestionById(id) {
    if (!id) return null;
    try {
        const { data, error } = await supabaseGtPyq.from('questions').select('*').eq('id', id).single();
        if (error || !data) return null;
        return mapGtPyqToQuestion(data);
    } catch (err) {
        return null;
    }
}

/**
 * Fetch multiple questions by UUID list from secondary Supabase database.
 */
async function getQuestionsByIds(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    try {
        const { data, error } = await supabaseGtPyq.from('questions').select('*').in('id', ids);
        if (error || !data) return [];
        return data.map(mapGtPyqToQuestion).filter(Boolean);
    } catch (err) {
        return [];
    }
}

/**
 * Get distinct metadata from secondary Supabase database.
 */
async function getMetadata(subject) {
    try {
        let query = supabaseGtPyq.from('questions').select('chapter,topic');
        if (subject) {
            query = query.ilike('subject', subject);
        }
        const { data, error } = await query;
        if (error || !data) return { chapters: [], concepts: [] };

        const chapters = [...new Set(data.map(r => r.chapter).filter(Boolean))];
        const concepts = [...new Set(data.map(r => r.topic).filter(Boolean))];
        return { chapters, concepts };
    } catch (err) {
        return { chapters: [], concepts: [] };
    }
}

module.exports = {
    getQuestions,
    getQuestionById,
    getQuestionsByIds,
    getMetadata,
    mapGtPyqToQuestion
};
