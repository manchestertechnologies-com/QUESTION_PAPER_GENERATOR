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

    return {
        _id: row.id,
        id: row.id,
        questionId: row.id,
        subject: row.subject || 'Physics',
        classes: classesList,
        chapter: row.chapter || 'General',
        concept: row.topic || row.chapter || 'General',
        subConcept: '',
        level: 'medium',
        type: type,
        q_type: row.q_type,
        questionText: row.question || '',
        options: options,
        answer: answer,
        correct_option: row.correct_option,
        num_answer: row.num_answer,
        solutionText: row.solution_text || '',
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

/**
 * Query questions with filters and pagination from Supabase.
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

    let query = supabase
        .from('questions')
        .select('*', { count: 'exact' });

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
        const chapters = Array.isArray(filters.chapter) ? filters.chapter : filters.chapter.split(',');
        query = query.in('chapter', chapters);
    }

    if (filters.type) {
        const typeStr = (filters.type || '').toLowerCase();
        if (typeStr.includes('numerical')) {
            query = query.eq('q_type', 'numerical');
        } else if (typeStr.includes('mcq')) {
            query = query.in('q_type', ['mcq_single', 'mcq', 'mcq_multiple']);
        }
    }

    if (filters.classes) {
        const classesArr = Array.isArray(filters.classes) ? filters.classes : filters.classes.split(',');
        const klassVals = classesArr.map(c => c.replace(/Class\s*/i, ''));
        query = query.in('klass', klassVals);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
        console.error('[SUPABASE] getQuestions error:', error.message);
        return { questions: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } };
    }

    const mappedQuestions = (data || []).map(mapSupabaseToQuestion);

    return {
        questions: mappedQuestions,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total: count || 0,
            pages: Math.ceil((count || 0) / limit)
        }
    };
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
    createQuestion,
    updateQuestion,
    deleteQuestion,
    mapSupabaseToQuestion,
    mapQuestionToSupabase
};
