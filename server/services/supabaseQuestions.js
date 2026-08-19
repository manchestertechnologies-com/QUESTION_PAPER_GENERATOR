const supabase = require('../config/supabase');
const { sanitizeHtml } = require('../utils/sanitize');

const isTest = process.env.NODE_ENV === 'test';
const memoryTestQuestions = new Map();

/**
 * Maps a Supabase `questions` table record to the frontend/system Question DTO.
 */
function mapSupabaseToQuestion(row) {
    if (!row) return null;

    // Map q_type format: 'mcq_single' / 'mcq' -> 'MCQ', 'numerical' -> 'NUMERICAL', 'assertion_reason' -> 'ASSERTION_REASON'
    let type = 'MCQ';
    const qTypeLower = (row.q_type || '').toLowerCase();
    if (qTypeLower.includes('numerical')) {
        type = 'NUMERICAL';
    } else if (qTypeLower.includes('assertion')) {
        type = 'ASSERTION_REASON';
    } else if (qTypeLower.includes('match')) {
        type = 'MATCH_FOLLOWING';
    }

    // Build options array from opt_a, opt_b, opt_c, opt_d
    const options = [];
    if (row.opt_a) options.push(row.opt_a);
    if (row.opt_b) options.push(row.opt_b);
    if (row.opt_c) options.push(row.opt_c);
    if (row.opt_d) options.push(row.opt_d);

    // Map answer
    let answer = row.correct_option || row.num_answer || '';
    // If correct_option is 1, 2, 3, 4 -> map to option text or A, B, C, D
    if (row.correct_option && options.length > 0) {
        const idx = parseInt(row.correct_option) - 1;
        if (idx >= 0 && idx < options.length) {
            answer = options[idx];
        }
    }

    // Map exams to classes array (e.g. ['JEE'], ['12'])
    const classesList = [];
    if (Array.isArray(row.exams) && row.exams.length > 0) {
        classesList.push(...row.exams);
    }
    if (row.klass && !classesList.includes(row.klass)) {
        classesList.push(`Class ${row.klass}`);
    }
    if (classesList.length === 0) classesList.push('JEE', 'NEET');

    // Extract difficulty level from [QBP_DIFFICULTY:Easy] or [DIFFICULTY:Easy] tags
    let level = 'medium';
    let cleanSolution = row.solution_text || '';
    let cleanQuestion = row.question || '';

    const diffRegex = /\[(?:QBP_)?DIFFICULTY:\s*([A-Za-z]+)\]/gi;
    const match = (row.solution_text || '').match(/\[(?:QBP_)?DIFFICULTY:\s*([A-Za-z]+)\]/i) ||
                  (row.question || '').match(/\[(?:QBP_)?DIFFICULTY:\s*([A-Za-z]+)\]/i);
    if (match && match[1]) {
        level = match[1].toLowerCase();
    }
    // Clean internal difficulty tags so they don't appear in user UI or printed papers
    cleanSolution = cleanSolution.replace(diffRegex, '').trim();
    cleanQuestion = cleanQuestion.replace(diffRegex, '').trim();

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
        options: options,
        answer: answer,
        correct_option: row.correct_option,
        num_answer: row.num_answer,
        solutionText: cleanSolution,
        questionTextTranslation: row.question_text_translation || '',
        optionsTranslation: row.options_translation || [],
        assertion: row.assertion || '',
        reason: row.reason || '',
        column_a: row.column_a || [],
        column_b: row.column_b || [],
        match_options: row.match_options || {},
        sourceType: 'REGULAR',
        sourceExam: Array.isArray(row.exams) ? row.exams.join(', ') : '',
        createdBy: row.created_by,
        createdByName: row.created_by_name || 'Admin',
        createdAt: row.created_at || new Date().toISOString()
    };
}

function isUuid(str) {
    return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Maps a system/frontend question object to Supabase database row format.
 */
function mapQuestionToSupabase(dto, userId = null, userName = 'Admin') {
    const qType = (dto.type || 'MCQ').toLowerCase();
    const isNumerical = qType === 'numerical';

    let optionsArr = Array.isArray(dto.options) ? dto.options : [];
    if (typeof dto.options === 'string') {
        try { optionsArr = JSON.parse(dto.options); } catch(e) { optionsArr = []; }
    }
    if (!Array.isArray(optionsArr)) optionsArr = [];

    const optA = optionsArr[0] || '';
    const optB = optionsArr[1] || '';
    const optC = optionsArr[2] || '';
    const optD = optionsArr[3] || '';

    // Deduce correct_option index if answer matches an option
    let correctOpt = '';
    if (optionsArr.length > 0 && dto.answer) {
        const idx = optionsArr.findIndex(opt => opt === dto.answer);
        if (idx !== -1) correctOpt = String(idx + 1);
    }

    const klassVal = Array.isArray(dto.classes)
        ? (dto.classes.find(c => c.includes('11') || c.includes('12')) || '12').replace(/Class\s*/i, '')
        : '12';

    const examsList = Array.isArray(dto.classes)
        ? dto.classes.filter(c => ['JEE', 'NEET', 'CET', 'JEE Main', 'JEE Advanced'].includes(c))
        : ['JEE'];

    if (examsList.length === 0) examsList.push('JEE');

    const validUserId = isUuid(userId) ? userId : null;

    return {
        subject: dto.subject || 'Physics',
        klass: klassVal,
        chapter: dto.chapter || 'General',
        topic: dto.concept || dto.subConcept || 'General',
        exams: examsList,
        q_type: isNumerical ? 'numerical' : 'mcq_single',
        question: sanitizeHtml(dto.questionText || ''),
        opt_a: sanitizeHtml(optA),
        opt_b: sanitizeHtml(optB),
        opt_c: sanitizeHtml(optC),
        opt_d: sanitizeHtml(optD),
        assertion: sanitizeHtml(dto.assertion || ''),
        reason: sanitizeHtml(dto.reason || ''),
        num_answer: isNumerical ? (dto.answer || '') : '',
        correct_option: correctOpt,
        solution_text: sanitizeHtml(dto.solutionText || ''),
        created_by: validUserId,
        created_by_name: userName,
        updated_by: validUserId,
        updated_by_name: userName,
        updated_at: new Date().toISOString()
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

function applyFilters(query, filters = {}) {
    if (filters.subject) {
        const sub = (filters.subject || '').trim().toLowerCase();
        if (sub.includes('math')) {
            query = query.in('subject', ['Maths', 'Mathematics', 'Math', 'MATHEMATICS', 'MATHS']);
        } else if (sub.includes('physic')) {
            query = query.in('subject', ['Physics', 'PHYSICS']);
        } else if (sub.includes('chem')) {
            query = query.in('subject', ['Chemistry', 'CHEMISTRY']);
        } else if (sub.includes('bio')) {
            query = query.in('subject', ['Biology', 'BIOLOGY']);
        } else {
            query = query.ilike('subject', `%${filters.subject}%`);
        }
    }

    if (filters.search) {
        query = query.ilike('question', `%${filters.search}%`);
    }

    if (filters.chapter) {
        const chapters = Array.isArray(filters.chapter) ? filters.chapter : filters.chapter.split(',').map(c => c.trim()).filter(Boolean);
        if (chapters.length > 0) {
            query = query.in('chapter', chapters);
        }
    }

    if (filters.concept) {
        const concepts = Array.isArray(filters.concept) ? filters.concept : filters.concept.split(',').map(c => c.trim()).filter(Boolean);
        if (concepts.length > 0) {
            query = query.in('topic', concepts);
        }
    }

    if (filters.type) {
        const typeArr = Array.isArray(filters.type) ? filters.type : filters.type.split(',').map(t => t.trim().toLowerCase());
        const qTypes = [];
        typeArr.forEach(t => {
            if (t.includes('numerical')) qTypes.push('numerical');
            else if (t.includes('assertion')) qTypes.push('assertion_reason', 'assertion');
            else if (t.includes('match')) qTypes.push('match', 'match_following');
            else if (t.includes('mcq')) qTypes.push('mcq_single', 'mcq', 'mcq_multiple');
        });
        if (qTypes.length > 0) {
            query = query.in('q_type', [...new Set(qTypes)]);
        }
    }

    if (filters.level) {
        const levelArr = Array.isArray(filters.level) ? filters.level : filters.level.split(',').map(l => l.trim()).filter(Boolean);
        if (levelArr.length === 1) {
            const l = levelArr[0].toLowerCase();
            const cap = l.charAt(0).toUpperCase() + l.slice(1);
            query = query.or(`solution_text.ilike.%DIFFICULTY:${cap}%,question.ilike.%DIFFICULTY:${cap}%`);
        } else if (levelArr.length > 1) {
            const orClauses = levelArr.map(lvl => {
                const cap = lvl.charAt(0).toUpperCase() + lvl.slice(1).toLowerCase();
                return `solution_text.ilike.%DIFFICULTY:${cap}%,question.ilike.%DIFFICULTY:${cap}%`;
            }).join(',');
            query = query.or(orClauses);
        }
    }

    if (filters.classes) {
        const classesArr = Array.isArray(filters.classes) ? filters.classes : filters.classes.split(',');
        const klassVals = [];
        const examVals = [];
        classesArr.forEach(c => {
            const clean = c.replace(/Class\s*/i, '').trim();
            if (['11', '12'].includes(clean)) {
                klassVals.push(clean);
            } else if (clean) {
                examVals.push(clean);
            }
        });

        if (klassVals.length > 0 && examVals.length > 0) {
            query = query.in('klass', klassVals).overlaps('exams', examVals);
        } else if (klassVals.length > 0) {
            query = query.in('klass', klassVals);
        } else if (examVals.length > 0) {
            query = query.overlaps('exams', examVals);
        }
    }

    return query;
}

/**
 * Query questions with filters and pagination from Supabase.
 * Supports unlimited / multi-thousand questions by querying in parallel chunks when limit > 1000.
 */
async function getQuestions(filters = {}, page = 1, limit = 100) {
    if (isTest && memoryTestQuestions.size > 0) {
        let list = Array.from(memoryTestQuestions.values());
        if (filters.subject) list = list.filter(q => q.subject === filters.subject);
        return {
            questions: list,
            pagination: { page: Number(page), limit: Number(limit), total: list.length, pages: 1 }
        };
    }

    const CHUNK_SIZE = 1000;
    const requestedLimit = Math.min(50000, Number(limit) || 100);
    const requestedPage = Math.max(1, Number(page) || 1);

    // If single chunk (<= 1000)
    if (requestedLimit <= CHUNK_SIZE) {
        const from = (requestedPage - 1) * requestedLimit;
        const to = from + requestedLimit - 1;

        let query = supabase.from('questions').select('*', { count: 'exact' });
        query = applyFilters(query, filters);
        query = query.range(from, to).order('created_at', { ascending: false });

        const { data, error, count } = await query;

        if (error) {
            console.error('[SUPABASE] getQuestions error:', error.message);
            return { questions: [], pagination: { page: requestedPage, limit: requestedLimit, total: 0, pages: 0 } };
        }

        const mappedQuestions = (data || []).map(mapSupabaseToQuestion);

        return {
            questions: mappedQuestions,
            pagination: {
                page: requestedPage,
                limit: requestedLimit,
                total: count || 0,
                pages: Math.ceil((count || 0) / requestedLimit)
            }
        };
    }

    // Multi-chunk fetching for large requests (e.g. 5000, 20000)
    let initialQuery = supabase.from('questions').select('*', { count: 'exact' });
    initialQuery = applyFilters(initialQuery, filters);
    initialQuery = initialQuery.range(0, CHUNK_SIZE - 1).order('created_at', { ascending: false });

    const { data: firstChunk, error: firstErr, count } = await initialQuery;
    if (firstErr) {
        console.error('[SUPABASE] getQuestions multi-chunk error:', firstErr.message);
        return { questions: [], pagination: { page: 1, limit: requestedLimit, total: 0, pages: 0 } };
    }

    const totalCount = count || 0;
    const targetCount = Math.min(totalCount, requestedLimit);
    let allData = [...(firstChunk || [])];

    if (targetCount > CHUNK_SIZE) {
        const totalChunksNeeded = Math.ceil(targetCount / CHUNK_SIZE);
        const chunkPromises = [];
        for (let c = 1; c < totalChunksNeeded; c++) {
            const from = c * CHUNK_SIZE;
            const to = Math.min(from + CHUNK_SIZE - 1, targetCount - 1);
            let chunkQuery = supabase.from('questions').select('*');
            chunkQuery = applyFilters(chunkQuery, filters);
            chunkQuery = chunkQuery.range(from, to).order('created_at', { ascending: false });
            chunkPromises.push(chunkQuery);
        }

        const chunkResults = await Promise.all(chunkPromises);
        chunkResults.forEach(res => {
            if (res.data) allData.push(...res.data);
        });
    }

    const mappedQuestions = allData.map(mapSupabaseToQuestion);
    return {
        questions: mappedQuestions,
        pagination: {
            page: 1,
            limit: requestedLimit,
            total: totalCount,
            pages: Math.ceil(totalCount / requestedLimit)
        }
    };
}

async function getSubjectMetadata(subject = '') {
    try {
        let countQuery = supabase.from('questions').select('*', { count: 'exact', head: true });
        if (subject) {
            countQuery = applyFilters(countQuery, { subject });
        }
        const { count } = await countQuery;

        // Fetch distinct chapters & topics
        let metaQuery = supabase.from('questions').select('chapter, topic');
        if (subject) {
            metaQuery = applyFilters(metaQuery, { subject });
        }

        const promises = [
            metaQuery.range(0, 999),
            applyFilters(supabase.from('questions').select('chapter, topic'), { subject }).range(1000, 1999),
            applyFilters(supabase.from('questions').select('chapter, topic'), { subject }).range(2000, 2999),
            applyFilters(supabase.from('questions').select('chapter, topic'), { subject }).range(3000, 3999),
            applyFilters(supabase.from('questions').select('chapter, topic'), { subject }).range(4000, 4999),
            applyFilters(supabase.from('questions').select('chapter, topic'), { subject }).range(5000, 5999),
            applyFilters(supabase.from('questions').select('chapter, topic'), { subject }).range(6000, 6999)
        ];

        const metaResults = await Promise.all(promises);
        let allMeta = [];
        metaResults.forEach(r => { if (r.data) allMeta.push(...r.data); });

        const chapters = [...new Set(allMeta.map(d => d.chapter).filter(Boolean))].sort();
        const concepts = [...new Set(allMeta.map(d => d.topic).filter(Boolean))].sort();

        return {
            total: count || 0,
            chapters,
            concepts
        };
    } catch (err) {
        console.error('[SUPABASE] getSubjectMetadata error:', err.message);
        return { total: 0, chapters: [], concepts: [] };
    }
}

async function getQuestionById(id) {
    if (isTest && memoryTestQuestions.has(id)) {
        return memoryTestQuestions.get(id);
    }

    const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) return null;
    return mapSupabaseToQuestion(data);
}

async function getQuestionsByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];

    if (isTest) {
        return ids.map(id => memoryTestQuestions.get(id)).filter(Boolean);
    }

    const { data, error } = await supabase
        .from('questions')
        .select('*')
        .in('id', ids);

    if (error) {
        console.error('[SUPABASE] getQuestionsByIds error:', error.message);
        return [];
    }

    return (data || []).map(mapSupabaseToQuestion);
}

async function createQuestion(dto, userId = null, userName = 'Admin') {
    const payload = mapQuestionToSupabase(dto, userId, userName);
    payload.created_at = new Date().toISOString();

    if (isTest) {
        const fakeId = `q_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const mapped = {
            _id: fakeId,
            id: fakeId,
            questionId: fakeId,
            subject: dto.subject || 'Physics',
            classes: dto.classes || ['JEE'],
            chapter: dto.chapter || 'General',
            concept: dto.concept || 'General',
            type: dto.type || 'MCQ',
            questionText: sanitizeHtml(dto.questionText || ''),
            options: dto.options || [],
            answer: dto.answer || '',
            solutionText: sanitizeHtml(dto.solutionText || ''),
            questionTextTranslation: dto.questionTextTranslation || '',
            optionsTranslation: dto.optionsTranslation || [],
            createdBy: userId,
            createdAt: payload.created_at
        };
        memoryTestQuestions.set(fakeId, mapped);
        return mapped;
    }

    const { data, error } = await supabase
        .from('questions')
        .insert([payload])
        .select()
        .single();

    if (error) {
        console.error('[SUPABASE] createQuestion error:', error.message);
        throw new Error(error.message);
    }

    return mapSupabaseToQuestion(data);
}

async function updateQuestion(id, dto, userId = null, userName = 'Admin') {
    if (isTest && memoryTestQuestions.has(id)) {
        const existing = memoryTestQuestions.get(id);
        const updated = { ...existing, ...dto };
        memoryTestQuestions.set(id, updated);
        return updated;
    }

    const payload = mapQuestionToSupabase(dto, userId, userName);

    const { data, error } = await supabase
        .from('questions')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[SUPABASE] updateQuestion error:', error.message);
        throw new Error(error.message);
    }

    return mapSupabaseToQuestion(data);
}

async function deleteQuestion(id) {
    if (isTest) {
        memoryTestQuestions.delete(id);
        return true;
    }

    const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[SUPABASE] deleteQuestion error:', error.message);
        throw new Error(error.message);
    }

    return true;
}

module.exports = {
    getQuestions,
    getQuestionById,
    getQuestionsByIds,
    getSubjectMetadata,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    mapSupabaseToQuestion,
    mapQuestionToSupabase
};
