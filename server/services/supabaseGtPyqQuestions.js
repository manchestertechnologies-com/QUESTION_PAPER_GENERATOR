const supabaseGtPyq = require('../config/supabaseGtPyq');
const { cleanDifficultyTags, extractDifficulty } = require('./supabaseQuestions');

/**
 * Maps a record from the secondary Supabase database (hjjgjcvpqgcebuokjque) to Question DTO.
 */
function mapGtPyqToQuestion(row) {
    if (!row) return null;

    let type = 'MCQ';
    const qTypeLower = (row.q_type || '').toLowerCase();
    if (qTypeLower.includes('numerical')) {
        type = 'NUMERICAL';
    } else if (qTypeLower.includes('assertion')) {
        type = 'ASSERTION_REASON';
    } else if (qTypeLower.includes('match')) {
        type = 'MATCH_FOLLOWING';
    } else if (qTypeLower.includes('statement')) {
        type = 'STATEMENT_BASED';
    } else if (qTypeLower.includes('true') || qTypeLower.includes('false')) {
        type = 'TRUE_FALSE';
    }

    const rawOptions = [];
    if (row.opt_a) rawOptions.push(row.opt_a);
    if (row.opt_b) rawOptions.push(row.opt_b);
    if (row.opt_c) rawOptions.push(row.opt_c);
    if (row.opt_d) rawOptions.push(row.opt_d);

    if (rawOptions.length === 0 && row.match_options) {
        try {
            const mOpts = typeof row.match_options === 'string' ? JSON.parse(row.match_options) : row.match_options;
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

    const matchPairs = [];
    if (Array.isArray(row.column_a) && row.column_a.length > 0) {
        const colB = Array.isArray(row.column_b) ? row.column_b : [];
        const maxLen = Math.max(row.column_a.length, colB.length);
        for (let i = 0; i < maxLen; i++) {
            matchPairs.push({
                left: row.column_a[i] || '',
                right: colB[i] || ''
            });
        }
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
