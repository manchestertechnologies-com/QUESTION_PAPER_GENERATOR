const primaryPool = require('../config/postgres');
const {
    DB_CONFIGS,
    pools,
    normalizeSubject,
    normalizeClass,
    getPoolForTarget,
    getPoolsForQuery,
    getAllPools
} = require('../config/subjectDatabases');
const { sanitizeHtml } = require('../utils/sanitize');

const isTest = process.env.NODE_ENV === 'test';
const memoryTestQuestions = new Map();

// In-memory cache for subject metadata (5 min TTL)
const metadataCache = new Map();
const METADATA_TTL_MS = 5 * 60 * 1000;

// UUID to database key routing cache (e.g. 'uuid-123' -> 'phy_11')
const MAX_UUID_CACHE_SIZE = 100000;
const uuidToDbKey = new Map();

function cacheQuestionDb(id, dbKey) {
    if (!id || !dbKey) return;
    if (uuidToDbKey.size >= MAX_UUID_CACHE_SIZE) {
        const iter = uuidToDbKey.keys();
        for (let i = 0; i < 10000; i++) {
            const k = iter.next().value;
            if (k) uuidToDbKey.delete(k);
            else break;
        }
    }
    uuidToDbKey.set(String(id), dbKey);
}

function clearMetadataCache() {
    metadataCache.clear();
}

const CHAPTER_ALIASES = {
    // Physics Units & Measurements
    'units and measurements': ['Units and Measurements', 'Units & Measurements', 'Units and Measurement', 'Physical World and Measurement', 'Units, Dimensions and Measurement', 'Physical World'],
    'units & measurements': ['Units and Measurements', 'Units & Measurements', 'Units and Measurement', 'Physical World and Measurement', 'Physical World'],
    'units and measurement': ['Units and Measurements', 'Units & Measurements', 'Units and Measurement', 'Physical World and Measurement', 'Physical World'],
    'physical world and measurement': ['Units and Measurements', 'Units & Measurements', 'Units and Measurement', 'Physical World and Measurement', 'Physical World'],
    'physical world': ['Units and Measurements', 'Units & Measurements', 'Units and Measurement', 'Physical World and Measurement', 'Physical World'],

    // Physics Mechanics & Kinematics
    'work, energy and power': ['Work, Energy and Power', 'Work, Power and Energy', 'Work, Power & Energy', 'WORK,POWER AND ENERGY', 'Work Power Energy'],
    'work, power and energy': ['Work, Energy and Power', 'Work, Power and Energy', 'Work, Power & Energy', 'WORK,POWER AND ENERGY'],
    'work, power & energy': ['Work, Energy and Power', 'Work, Power and Energy', 'Work, Power & Energy', 'WORK,POWER AND ENERGY'],
    'laws of motion': ['Laws of Motion', "Newton's Laws of Motion", 'Newton’s Laws of Motion', 'Force and Laws of Motion'],
    "newton's laws of motion": ['Laws of Motion', "Newton's Laws of Motion", 'Newton’s Laws of Motion'],
    'motion in a plane': ['Motion in a Plane', 'Motion in a Plane (Vectors)', 'Vectors'],
    'motion in a straight line': ['Motion in a Straight Line', 'Motion in a Straight Line (1D)', 'Kinematics', 'Rectilinear Motion'],

    // Physics Electromagnetism
    'electric charges and fields': ['Electric Charges and Fields', 'ELECTRIC CHARGES AND FIELDS', 'Electric Charges & Fields', 'Electrostatics'],
    'electrostatic potential and capacitance': ['Electrostatic Potential and Capacitance', 'Electrostatic Potential & Capacitance', 'Capacitance', 'Electrostatics'],
    'electromagnetic induction': ['Electromagnetic Induction', 'EMI', 'Electromagnetic Induction (EMI)'],
    'emi': ['Electromagnetic Induction', 'EMI', 'Electromagnetic Induction (EMI)'],
    'magnetism and matter': ['Magnetism and Matter', 'Magnetism & Matter', 'Moving Charges and Magnetism'],
    'moving charges and magnetism': ['Moving Charges and Magnetism', 'Moving Charges & Magnetism', 'Magnetic Effects of Current'],
    'electromagnetic waves': ['Electromagnetic Waves', 'EM Waves'],

    // Physics Thermal Physics / Thermodynamics
    'thermodynamics': ['Thermodynamics', 'Thermal Properties of Matter', 'Kinetic Theory', 'Thermal Physics'],
    'thermal properties of matter': ['Thermal Properties of Matter', 'Thermodynamics', 'Kinetic Theory'],
    'kinetic theory': ['Kinetic Theory', 'Thermodynamics', 'Thermal Properties of Matter'],
    'kinetic theory of gases': ['Kinetic Theory', 'Thermodynamics', 'Thermal Properties of Matter'],
    
    // Physics Solids & Fluids
    'mechanical properties of solids': ['Mechanical Properties of Solids', 'Mechanical Properties of Fluids', 'Elasticity'],
    'mechanical properties of fluids': ['Mechanical Properties of Fluids', 'Mechanical Properties of Solids', 'Fluid Mechanics', 'Hydrodynamics'],

    // Physics Rotational
    'system of particles and rotational motion': ['System of Particles and Rotational Motion', 'Rotational Motion', 'Laws of Motion', 'Motion in a Plane'],
    'rotational motion': ['System of Particles and Rotational Motion', 'Rotational Motion'],
    
    // Physics Semiconductors
    'semiconductor electronics': ['Semiconductor Electronics: Materials, Devices and Simple Circuits', 'Semiconductor Electronics (Legacy / Removed Syllabus)', 'Semiconductor Electronics'],
    'semiconductor electronics: materials, devices and simple circuits': ['Semiconductor Electronics: Materials, Devices and Simple Circuits', 'Semiconductor Electronics (Legacy / Removed Syllabus)'],

    // Chemistry
    'some basic concepts of chemistry': ['Some Basic Concepts of Chemistry', 'SOME BASIC CONCEPTS OF CHEMISTRY', 'Basic Concepts of Chemistry', 'Mole Concept'],
    'structure of atom': ['Structure of Atom', 'Atomic Structure'],
    'chemical bonding and molecular structure': ['Chemical Bonding and Molecular Structure', 'Chemical Bonding & Molecular Structure', 'Chemical Bonding'],
    'the p-block elements': ['The p-Block Elements', 'p-Block Elements (Group 13 and 14)', 'p-Block Elements'],
    'p-block elements': ['The p-Block Elements', 'p-Block Elements (Group 13 and 14)', 'p-Block Elements'],
    'redox reactions': ['Redox Reactions', 'Redox Reactions (Legacy / Removed Syllabus)'],
    'electrochemistry': ['Electrochemistry', 'Electrochemistry (Legacy / Removed Syllabus)'],
    'chemical kinetics': ['Chemical Kinetics', 'Chemical Kinetics (Legacy / Removed Syllabus)'],
    'organic chemistry - some basic principles and techniques': ['Organic Chemistry - Some Basic Principles and Techniques', 'Organic Chemistry - Some Basic Principles & Techniques', 'General Organic Chemistry'],

    // Mathematics
    'differential equations': ['Differential Equations', 'Differential Equations (Legacy / Removed Syllabus)'],
    'integrals': ['Integrals', 'Integrals (Legacy / Removed Syllabus)'],
    'probability': ['Probability', 'Probability (Legacy / Removed Syllabus)'],
    'continuity and differentiability': ['Continuity and Differentiability', 'Continuity and Differentiability (Legacy / Removed Syllabus)'],
    'matrices': ['Matrices', 'Matrices (Legacy / Removed Syllabus)'],
    'relations and functions': ['Relations and Functions', 'Relations and Functions (Legacy / Removed Syllabus)'],
    'complex numbers and quadratic equations': ['Complex Numbers and Quadratic Equations', 'Complex Numbers and Quadratic Equations (Legacy / Removed Syllabus)'],
    'application of integrals': ['Application of Integrals', 'Application of Integrals (Legacy / Removed Syllabus)'],
    'inverse trigonometric functions': ['Inverse Trigonometric Functions', 'Inverse Trigonometric Functions (Legacy / Removed Syllabus)']
};

/**
 * Universal tag cleaner to strip all internal difficulty and QPV/QBP metadata tags.
 */
function cleanDifficultyTags(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\[(?:QPV_|QBP_)?DIFFICULTY:\s*[^\]]+\]/gi, '')
        .replace(/\[(?:QPV|QBP)_[A-Za-z0-9_]+:[^\]]*\]/gi, '')
        .trim();
}

/**
 * Extracts difficulty level ('easy', 'medium', 'hard') from solution or question text.
 */
function extractDifficulty(solutionText, questionText) {
    const diffRegex = /\[(?:QPV_|QBP_)?DIFFICULTY:\s*([A-Za-z]+)\]/i;
    const match = (solutionText || '').match(diffRegex) || (questionText || '').match(diffRegex);
    if (match && match[1]) {
        return match[1].toLowerCase();
    }
    return 'medium';
}

function isUuid(str) {
    return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Maps a Supabase/Postgres `questions` table record to the frontend/system Question DTO.
 */
function mapSupabaseToQuestion(row, usageMap = null) {
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

    if (rawOptions.length === 0) {
        if (row.option_a) rawOptions.push(row.option_a);
        if (row.option_b) rawOptions.push(row.option_b);
        if (row.option_c) rawOptions.push(row.option_c);
        if (row.option_d) rawOptions.push(row.option_d);
    }

    if (rawOptions.length === 0 && row.options) {
        if (Array.isArray(row.options)) {
            rawOptions.push(...row.options);
        } else if (typeof row.options === 'string') {
            try {
                const parsed = JSON.parse(row.options);
                if (Array.isArray(parsed)) rawOptions.push(...parsed);
            } catch (e) {}
        }
    }

    if (rawOptions.length === 0 && row.options_json) {
        try {
            const parsed = typeof row.options_json === 'string' ? JSON.parse(row.options_json) : row.options_json;
            if (Array.isArray(parsed)) rawOptions.push(...parsed);
        } catch (e) {}
    }

    const options = rawOptions.map(cleanDifficultyTags).filter(Boolean);

    let answer = row.correct_option || row.num_answer || row.answer || '';
    if (row.correct_option && options.length > 0) {
        const idx = parseInt(row.correct_option, 10) - 1;
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
    if (classesList.length === 0) classesList.push('JEE', 'NEET');

    const level = extractDifficulty(row.solution_text, row.question);
    const cleanSolution = cleanDifficultyTags(row.solution_text || '');
    const cleanQuestion = cleanDifficultyTags(row.question || row.questionText || row.question_text || '');

    const qIdStr = (row.id || '').toString();
    const usage = (usageMap && usageMap.get(qIdStr)) || null;

    const usedCount = usage ? (parseInt(usage.used_count) || parseInt(usage.useCount) || 0) : (row.used_count || row.usedCount || row.timesUsed || row.useCount || 0);
    const lastUsedAt = usage ? (usage.last_used_at || usage.lastUsedAt) : (row.last_used_at || row.lastUsedAt || null);
    const firstUsedAt = usage ? (usage.first_used_at || usage.firstUsedAt || usage.last_used_at) : (row.first_used_at || row.firstUsedAt || null);
    const lastUsedExam = usage ? (usage.last_exam_name || usage.lastUsedExam) : (row.last_exam_name || row.lastUsedExam || '');
    const lastUsedTeacher = usage ? (usage.last_teacher_name || usage.lastUsedTeacher) : (row.last_teacher_name || row.lastUsedTeacher || '');
    const lastUsedDate = usage ? (usage.last_exam_date || usage.lastUsedDate) : (row.last_exam_date || row.lastUsedDate || null);
    const usageHistory = usage && Array.isArray(usage.usage_history) ? usage.usage_history : (Array.isArray(row.usage_history) ? row.usage_history : (Array.isArray(usage?.usageHistory) ? usage.usageHistory : []));

    const repeatDays = Number(row.repeatDays || row.repeat_days) || 30;
    let repeatStatus = 'AVAILABLE';
    let nextEligibleDate = null;

    if (lastUsedAt) {
        const lastTime = new Date(lastUsedAt).getTime();
        const repeatMs = repeatDays * 24 * 60 * 60 * 1000;
        const nextTime = new Date(lastTime + repeatMs);
        if (nextTime.getTime() > Date.now()) {
            repeatStatus = 'IN REPEAT PERIOD';
            nextEligibleDate = nextTime.toISOString().split('T')[0];
        } else {
            repeatStatus = 'AVAILABLE';
            nextEligibleDate = nextTime.toISOString().split('T')[0];
        }
    }

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
        imageUrl: row.image_url || row.imageUrl || null,
        solutionImageUrl: row.solution_image_url || row.solutionImageUrl || null,
        options: options,
        answer: answer,
        correct_option: row.correct_option,
        num_answer: row.num_answer,
        assertion: row.assertion || '',
        reason: row.reason || '',
        predef_options: row.predef_options || '',
        column_a: row.column_a || [],
        column_b: row.column_b || [],
        match_options: row.match_options || null,
        solutionText: cleanSolution,
        solution_text: cleanSolution,
        usedCount: usedCount,
        timesUsed: usedCount,
        firstUsedAt: firstUsedAt,
        lastUsedAt: lastUsedAt,
        lastUsedTeacher: lastUsedTeacher,
        lastUsedExam: lastUsedExam,
        lastUsedDate: lastUsedDate,
        usageHistory: usageHistory,
        useCount: usedCount,
        repeatDays: repeatDays,
        repeatStatus: repeatStatus,
        nextEligibleDate: nextEligibleDate,
        created_at: row.created_at,
        updated_at: row.updated_at,
        created_by_name: row.created_by_name || 'Academic Faculty'
    };
}

/**
 * Maps incoming Question DTO into Postgres row format for INSERT/UPDATE.
 */
function mapQuestionToSupabase(dto, userId = null, userName = 'Admin') {
    let q_type = 'mcq_single';
    const typeUpper = (dto.type || '').toUpperCase();
    if (typeUpper === 'NUMERICAL') q_type = 'numerical';
    else if (typeUpper === 'ASSERTION_REASON') q_type = 'assertion_reason';
    else if (typeUpper === 'MATCH_FOLLOWING') q_type = 'match_the_following';
    else if (typeUpper === 'STATEMENT_BASED') q_type = 'statement_based';
    else if (typeUpper === 'TRUE_FALSE') q_type = 'true_false';

    let opt_a = null, opt_b = null, opt_c = null, opt_d = null;
    if (Array.isArray(dto.options) && dto.options.length > 0) {
        opt_a = dto.options[0] || null;
        opt_b = dto.options[1] || null;
        opt_c = dto.options[2] || null;
        opt_d = dto.options[3] || null;
    }

    let klass = '12';
    if (dto.classes) {
        if (Array.isArray(dto.classes) && dto.classes.length > 0) {
            const has11 = dto.classes.some(c => String(c).includes('11'));
            klass = has11 ? '11' : '12';
        } else {
            klass = String(dto.classes).includes('11') ? '11' : '12';
        }
    }

    let correct_option = null;
    let num_answer = null;

    if (q_type === 'numerical') {
        num_answer = dto.answer ? String(dto.answer).trim() : null;
    } else {
        if (dto.answer && typeof dto.answer === 'string') {
            const trimmed = dto.answer.trim();
            if (/^[1-4]$/.test(trimmed)) {
                correct_option = trimmed;
            } else if (/^[A-D]$/i.test(trimmed)) {
                const map = { A: '1', B: '2', C: '3', D: '4' };
                correct_option = map[trimmed.toUpperCase()];
            } else if (Array.isArray(dto.options)) {
                const idx = dto.options.findIndex(o => (o || '').trim().toLowerCase() === trimmed.toLowerCase());
                if (idx !== -1) correct_option = String(idx + 1);
            }
        }
    }

    let levelTag = '';
    if (dto.level && ['easy', 'medium', 'hard'].includes(dto.level.toLowerCase())) {
        levelTag = ` [DIFFICULTY: ${dto.level.toLowerCase()}]`;
    }
    const finalSolution = dto.solutionText ? `${cleanDifficultyTags(dto.solutionText)}${levelTag}` : (levelTag ? levelTag.trim() : null);

    return {
        subject: dto.subject || 'Physics',
        klass: klass,
        chapter: dto.chapter || 'General',
        topic: dto.concept || dto.topic || dto.chapter || 'General',
        exams: Array.isArray(dto.classes) ? dto.classes : ['JEE', 'NEET'],
        q_type: q_type,
        question: cleanDifficultyTags(dto.questionText || dto.question || ''),
        opt_a: opt_a ? cleanDifficultyTags(opt_a) : null,
        opt_b: opt_b ? cleanDifficultyTags(opt_b) : null,
        opt_c: opt_c ? cleanDifficultyTags(opt_c) : null,
        opt_d: opt_d ? cleanDifficultyTags(opt_d) : null,
        assertion: dto.assertion || null,
        reason: dto.reason || null,
        num_answer: num_answer,
        correct_option: correct_option,
        solution_text: finalSolution,
        created_by: userId && isUuid(userId) ? userId : null,
        created_by_name: userName || 'Academic Faculty',
        updated_by: userId && isUuid(userId) ? userId : null,
        updated_by_name: userName || 'Academic Faculty',
        updated_at: new Date().toISOString()
    };
}

/**
 * Fetch usage history for a list of question UUIDs from primary database.
 */
async function fetchUsageMap(questionIds) {
    const usageMap = new Map();
    const validUuids = (questionIds || []).filter(isUuid);
    if (validUuids.length === 0) return usageMap;

    try {
        const query = `
            SELECT question_id, paper_id, teacher_name, exam_name, exam_date, used_at
            FROM public.question_usage
            WHERE question_id = ANY($1::uuid[])
            ORDER BY used_at DESC;
        `;
        const res = await primaryPool.query(query, [validUuids]);
        for (const row of res.rows) {
            const qIdStr = row.question_id.toString();
            if (!usageMap.has(qIdStr)) {
                usageMap.set(qIdStr, {
                    lastUsedAt: row.used_at,
                    useCount: 0,
                    usageHistory: []
                });
            }
            const record = usageMap.get(qIdStr);
            record.useCount++;
            record.usageHistory.push({
                paperId: row.paper_id,
                teacherName: row.teacher_name,
                examName: row.exam_name,
                examDate: row.exam_date,
                usedAt: row.used_at
            });
        }
    } catch (err) {
        // Soft fail if usage table is unavailable
    }
    return usageMap;
}

/**
 * Build dynamic SQL where conditions for PostgreSQL based on filter DTO.
 */
function buildWhereClause(filters) {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (filters.subject) {
        const sub = normalizeSubject(filters.subject);
        if (sub) {
            conditions.push(`subject ILIKE $${paramIndex}`);
            values.push(`%${sub}%`);
            paramIndex++;
        }
    }

    if (filters.classes || filters.class) {
        const klass = normalizeClass(filters.classes || filters.class);
        if (klass && klass !== 'both') {
            conditions.push(`klass = $${paramIndex}`);
            values.push(klass);
            paramIndex++;
        }
    }

    if (filters.chapter) {
        const ch = filters.chapter.trim();
        const chLower = ch.toLowerCase();
        const aliases = CHAPTER_ALIASES[chLower] || [ch];

        const aliasConditions = aliases.map(() => {
            const idx = paramIndex++;
            return `chapter ILIKE $${idx}`;
        });
        aliases.forEach(a => values.push(`%${a}%`));
        conditions.push(`(${aliasConditions.join(' OR ')})`);
    }

    if (filters.concept || filters.topic) {
        const conceptVal = (filters.concept || filters.topic).trim();
        conditions.push(`topic ILIKE $${paramIndex}`);
        values.push(`%${conceptVal}%`);
        paramIndex++;
    }

    if (filters.type) {
        const typeUpper = filters.type.toUpperCase();
        if (typeUpper === 'NUMERICAL') {
            conditions.push(`(q_type = 'numerical' OR num_answer IS NOT NULL)`);
        } else if (typeUpper === 'MCQ') {
            conditions.push(`(q_type = 'mcq_single' OR q_type = 'mcq' OR (opt_a IS NOT NULL AND q_type != 'numerical'))`);
        } else if (typeUpper === 'ASSERTION_REASON') {
            conditions.push(`q_type = 'assertion_reason'`);
        } else if (typeUpper === 'MATCH_FOLLOWING') {
            conditions.push(`q_type = 'match_the_following'`);
        } else if (typeUpper === 'STATEMENT_BASED') {
            conditions.push(`q_type = 'statement_based'`);
        }
    }

    if (filters.search) {
        const s = filters.search.trim();
        const idx = paramIndex++;
        conditions.push(`(question ILIKE $${idx} OR chapter ILIKE $${idx} OR topic ILIKE $${idx})`);
        values.push(`%${s}%`);
    }

    const whereString = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereString, values };
}

/**
 * Query questions across the targeted subject pools (all 8 databases).
 */
async function getQuestions(filters = {}, page = 1, limit = 50) {
    if (isTest) {
        const allTest = Array.from(memoryTestQuestions.values());
        let filtered = allTest;
        if (filters.subject) {
            filtered = filtered.filter(q => (q.subject || '').toLowerCase().includes(filters.subject.toLowerCase()));
        }
        if (filters.chapter) {
            filtered = filtered.filter(q => (q.chapter || '').toLowerCase().includes(filters.chapter.toLowerCase()));
        }
        return {
            questions: filtered.slice((page - 1) * limit, page * limit),
            pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) }
        };
    }

    const targetPools = getPoolsForQuery(filters.subject, filters.classes || filters.class);
    const offset = (page - 1) * limit;

    try {
        const { whereString, values } = buildWhereClause(filters);

        // Fetch counts from targeted pools in parallel
        const countPromises = targetPools.map(entry => {
            return entry.pool.query(`SELECT count(*)::int as total FROM public.questions ${whereString}`, values)
                .then(res => res.rows[0]?.total || 0)
                .catch(() => 0);
        });

        const counts = await Promise.all(countPromises);
        const totalCount = counts.reduce((acc, c) => acc + c, 0);

        if (totalCount === 0) {
            return {
                questions: [],
                pagination: { page, limit, total: 0, totalPages: 0 }
            };
        }

        // Fetch questions from pools
        let questionsToFetch = limit;
        let skipRemaining = offset;
        const allFoundRows = [];

        for (let i = 0; i < targetPools.length; i++) {
            const entry = targetPools[i];
            const poolTotal = counts[i];

            if (poolTotal === 0) continue;

            if (skipRemaining >= poolTotal) {
                skipRemaining -= poolTotal;
                continue;
            }

            const poolOffset = skipRemaining;
            skipRemaining = 0;
            const poolLimit = questionsToFetch;

            const dataQuery = `
                SELECT * FROM public.questions
                ${whereString}
                ORDER BY created_at DESC NULLS LAST, id DESC
                LIMIT ${poolLimit} OFFSET ${poolOffset};
            `;

            try {
                const res = await entry.pool.query(dataQuery, values);
                for (const row of res.rows) {
                    cacheQuestionDb(row.id, entry.key);
                    allFoundRows.push(row);
                }
                questionsToFetch -= res.rows.length;
                if (questionsToFetch <= 0) break;
            } catch (err) {
                console.error(`[Query error on ${entry.name}]:`, err.message);
            }
        }

        // Fetch usage history
        const questionIds = allFoundRows.map(r => r.id);
        const usageMap = await fetchUsageMap(questionIds);

        const dtos = allFoundRows.map(r => mapSupabaseToQuestion(r, usageMap));

        return {
            questions: dtos,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        };
    } catch (err) {
        console.error('[DATABASE] getQuestions error:', err.message);
        throw new Error(err.message);
    }
}

/**
 * Fast aggregate metadata query for a subject across databases.
 */
async function getSubjectMetadata(subject, cleanClass = '') {
    const normSub = normalizeSubject(subject) || 'Physics';
    const normKlass = normalizeClass(cleanClass);
    const cacheKey = `${normSub.toLowerCase()}_${normKlass || 'all'}`;

    const cached = metadataCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < METADATA_TTL_MS)) {
        return cached.data;
    }

    const targetPools = getPoolsForQuery(normSub, normKlass);

    try {
        const metadataPromises = targetPools.map(async (entry) => {
            const whereParts = [`subject ILIKE '${normSub}%'`];
            if (normKlass && normKlass !== 'both') {
                whereParts.push(`klass = '${normKlass}'`);
            }
            const whereClause = `WHERE ${whereParts.join(' AND ')}`;

            const totalQuery = `SELECT count(*)::int as total FROM public.questions ${whereClause};`;
            const chaptersQuery = `
                SELECT chapter, count(*)::int as count 
                FROM public.questions 
                ${whereClause} 
                GROUP BY chapter 
                ORDER BY chapter ASC;
            `;
            const conceptsQuery = `
                SELECT chapter, topic as name, count(*)::int as count 
                FROM public.questions 
                ${whereClause} AND topic IS NOT NULL AND topic != '' 
                GROUP BY chapter, topic 
                ORDER BY chapter, count DESC;
            `;

            const [totRes, chapRes, cptRes] = await Promise.all([
                entry.pool.query(totalQuery).catch(() => ({ rows: [{ total: 0 }] })),
                entry.pool.query(chaptersQuery).catch(() => ({ rows: [] })),
                entry.pool.query(conceptsQuery).catch(() => ({ rows: [] }))
            ]);

            return {
                total: totRes.rows[0]?.total || 0,
                chapters: chapRes.rows || [],
                concepts: cptRes.rows || []
            };
        });

        const results = await Promise.all(metadataPromises);

        let grandTotal = 0;
        const chapterMap = new Map();
        const conceptMap = new Map();

        for (const res of results) {
            grandTotal += res.total;
            for (const ch of res.chapters) {
                if (ch.chapter) {
                    chapterMap.set(ch.chapter, (chapterMap.get(ch.chapter) || 0) + ch.count);
                }
            }
            for (const cpt of res.concepts) {
                if (cpt.name && cpt.chapter) {
                    const key = `${cpt.chapter}:::${cpt.name}`;
                    if (!conceptMap.has(key)) {
                        conceptMap.set(key, { chapter: cpt.chapter, name: cpt.name, count: 0 });
                    }
                    conceptMap.get(key).count += cpt.count;
                }
            }
        }

        const chaptersList = Array.from(chapterMap.keys()).sort();
        const conceptsList = Array.from(conceptMap.values()).sort((a, b) => a.chapter.localeCompare(b.chapter));

        const resultData = {
            total: grandTotal,
            chapters: chaptersList,
            concepts: conceptsList
        };

        metadataCache.set(cacheKey, { timestamp: Date.now(), data: resultData });
        return resultData;
    } catch (err) {
        console.error('[DATABASE] getSubjectMetadata error:', err.message);
        return { total: 0, chapters: [], concepts: [] };
    }
}

/**
 * Get daily question creation count across all subject databases.
 */
async function getDailyQuestionsCount() {
    try {
        const allPools = getAllPools();
        const countPromises = allPools.map(entry => {
            return entry.pool.query("SELECT count(*)::int as count FROM public.questions WHERE created_at >= CURRENT_DATE")
                .then(res => res.rows[0]?.count || 0)
                .catch(() => 0);
        });

        const counts = await Promise.all(countPromises);
        return counts.reduce((acc, c) => acc + c, 0);
    } catch (err) {
        console.error('[DATABASE] getDailyQuestionsCount error:', err.message);
        return 0;
    }
}

/**
 * Fetch a single question by UUID across subject databases.
 */
async function getQuestionById(id) {
    if (isTest && memoryTestQuestions.has(id)) {
        return memoryTestQuestions.get(id);
    }

    if (!isUuid(id)) return null;

    let targetDbKey = uuidToDbKey.get(String(id));
    let targetPoolEntry = targetDbKey ? pools.get(targetDbKey) : null;

    if (targetPoolEntry) {
        try {
            const res = await targetPoolEntry.pool.query('SELECT * FROM public.questions WHERE id = $1 LIMIT 1;', [id]);
            if (res.rows.length > 0) {
                const usageMap = await fetchUsageMap([id]);
                return mapSupabaseToQuestion(res.rows[0], usageMap);
            }
        } catch (e) {}
    }

    // Search across all pools
    for (const entry of getAllPools()) {
        try {
            const res = await entry.pool.query('SELECT * FROM public.questions WHERE id = $1 LIMIT 1;', [id]);
            if (res.rows.length > 0) {
                cacheQuestionDb(id, entry.key);
                const usageMap = await fetchUsageMap([id]);
                return mapSupabaseToQuestion(res.rows[0], usageMap);
            }
        } catch (e) {}
    }

    return null;
}

/**
 * Fetch multiple questions by an array of UUIDs across databases.
 */
async function getQuestionsByIds(ids = []) {
    const validUuids = ids.filter(isUuid);
    if (validUuids.length === 0) return [];

    try {
        const foundRowsMap = new Map();
        const uncachedUuids = [];

        // 1. Group cached IDs by pool
        const poolToIds = new Map();
        for (const id of validUuids) {
            const idStr = id.toString();
            const dbKey = uuidToDbKey.get(idStr);
            if (dbKey && pools.has(dbKey)) {
                if (!poolToIds.has(dbKey)) poolToIds.set(dbKey, []);
                poolToIds.get(dbKey).push(id);
            } else {
                uncachedUuids.push(id);
            }
        }

        // 2. Query known pools
        const knownPromises = Array.from(poolToIds.entries()).map(async ([dbKey, poolIds]) => {
            const entry = pools.get(dbKey);
            try {
                const res = await entry.pool.query('SELECT * FROM public.questions WHERE id = ANY($1::uuid[])', [poolIds]);
                res.rows.forEach(r => foundRowsMap.set(r.id.toString(), r));
            } catch (e) {}
        });

        // 3. Search uncached IDs across all pools
        const uncachedPromises = uncachedUuids.length > 0 ? getAllPools().map(async (entry) => {
            try {
                const res = await entry.pool.query('SELECT * FROM public.questions WHERE id = ANY($1::uuid[])', [uncachedUuids]);
                res.rows.forEach(r => {
                    foundRowsMap.set(r.id.toString(), r);
                    cacheQuestionDb(r.id, entry.key);
                });
            } catch (e) {}
        }) : [];

        await Promise.all([...knownPromises, ...uncachedPromises]);

        // 4. Fetch usage
        const foundUuids = Array.from(foundRowsMap.keys());
        const usageMap = await fetchUsageMap(foundUuids);

        // 5. Return ordered according to requested IDs
        return validUuids
            .map(id => foundRowsMap.get(id.toString()))
            .filter(Boolean)
            .map(r => mapSupabaseToQuestion(r, usageMap));
    } catch (err) {
        console.error('[DATABASE] getQuestionsByIds error:', err.message);
        return [];
    }
}

/**
 * Record usage of questions in a paper / exam into primary database.
 */
async function recordQuestionUsage(questionIds, paperId, teacherId, teacherName, examName, examDate) {
    if (!Array.isArray(questionIds) || questionIds.length === 0) return;

    if (isTest) {
        const nowIso = new Date().toISOString();
        const dateStr = examDate || nowIso.split('T')[0];
        questionIds.forEach(rawId => {
            const id = typeof rawId === 'string' ? rawId : (rawId._id || rawId.id);
            if (memoryTestQuestions.has(id)) {
                const q = memoryTestQuestions.get(id);
                const prevCount = q.usedCount || q.timesUsed || 0;
                const newCount = prevCount + 1;
                const history = Array.isArray(q.usageHistory) ? [...q.usageHistory] : [];
                history.push({
                    paper_id: paperId ? paperId.toString() : 'paper_test',
                    teacher_id: teacherId ? teacherId.toString() : 'teacher_test',
                    teacher_name: teacherName || 'Faculty',
                    exam_name: examName || 'Assessment',
                    exam_date: dateStr,
                    used_at: nowIso
                });
                q.usedCount = newCount;
                q.timesUsed = newCount;
                q.lastUsedAt = nowIso;
                q.lastUsedExam = examName || 'Assessment';
                q.lastUsedTeacher = teacherName || 'Faculty';
                q.lastUsedDate = dateStr;
                q.usageHistory = history;
                if (!q.firstUsedAt) q.firstUsedAt = nowIso;
                memoryTestQuestions.set(id, q);
            }
        });
        return;
    }

    const validUuids = questionIds.filter(isUuid);
    if (validUuids.length === 0) return;

    try {
        const client = await primaryPool.connect();
        try {
            await client.query('BEGIN');
            const insertQuery = `
                INSERT INTO public.question_usage (question_id, paper_id, teacher_id, teacher_name, exam_name, exam_date, used_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW());
            `;
            for (const qId of validUuids) {
                await client.query(insertQuery, [
                    qId,
                    paperId ? paperId.toString() : null,
                    teacherId ? teacherId.toString() : null,
                    teacherName || 'Faculty',
                    examName || 'Assessment',
                    examDate || new Date().toISOString().split('T')[0]
                ]);
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('[PRIMARY DB] recordQuestionUsage error:', err.message);
    }
}

/**
 * Create a question in the appropriate subject/class database.
 */
async function createQuestion(dto, userId = null, userName = 'Admin') {
    const payload = mapQuestionToSupabase(dto, userId, userName);

    if (isTest) {
        const fakeId = `q_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const testRow = {
            id: fakeId,
            ...payload,
            answer: dto.answer || '',
            opt_a: payload.opt_a,
            opt_b: payload.opt_b,
            opt_c: payload.opt_c,
            opt_d: payload.opt_d,
            options: (dto.options || [payload.opt_a, payload.opt_b, payload.opt_c, payload.opt_d]).filter(Boolean),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        const mapped = mapSupabaseToQuestion(testRow);
        if (dto.answer) mapped.answer = dto.answer;
        memoryTestQuestions.set(fakeId, mapped);
        return mapped;
    }

    const targetPoolEntry = getPoolForTarget(payload.subject, payload.klass);

    const insertSql = `
        INSERT INTO public.questions (
            subject, klass, chapter, topic, exams, q_type,
            question, opt_a, opt_b, opt_c, opt_d, assertion, reason,
            num_answer, correct_option, solution_text,
            created_by, created_by_name, updated_by, updated_by_name, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12, $13,
            $14, $15, $16,
            $17, $18, $19, $20, $21
        )
        RETURNING *;
    `;

    const values = [
        payload.subject, payload.klass, payload.chapter, payload.topic, payload.exams, payload.q_type,
        payload.question, payload.opt_a, payload.opt_b, payload.opt_c, payload.opt_d, payload.assertion, payload.reason,
        payload.num_answer, payload.correct_option, payload.solution_text,
        payload.created_by, payload.created_by_name, payload.updated_by, payload.updated_by_name, payload.updated_at
    ];

    const res = await targetPoolEntry.pool.query(insertSql, values);
    const row = res.rows[0];

    cacheQuestionDb(row.id, targetPoolEntry.key);
    metadataCache.clear();

    return mapSupabaseToQuestion(row);
}

/**
 * Update an existing question in its database.
 */
async function updateQuestion(id, dto, userId = null, userName = 'Admin') {
    if (isTest && memoryTestQuestions.has(id)) {
        const existing = memoryTestQuestions.get(id);
        const updated = { ...existing, ...dto };
        memoryTestQuestions.set(id, updated);
        return updated;
    }

    let targetDbKey = uuidToDbKey.get(String(id));
    let targetPoolEntry = targetDbKey ? pools.get(targetDbKey) : null;

    if (!targetPoolEntry) {
        for (const entry of getAllPools()) {
            const check = await entry.pool.query('SELECT id FROM public.questions WHERE id = $1 LIMIT 1;', [id]);
            if (check.rows.length > 0) {
                targetPoolEntry = entry;
                cacheQuestionDb(id, entry.key);
                break;
            }
        }
    }

    if (!targetPoolEntry) {
        throw new Error(`Question ${id} not found in any database.`);
    }

    const payload = mapQuestionToSupabase(dto, userId, userName);

    const updateSql = `
        UPDATE public.questions SET
            subject = $1, klass = $2, chapter = $3, topic = $4, exams = $5, q_type = $6,
            question = $7, opt_a = $8, opt_b = $9, opt_c = $10, opt_d = $11,
            assertion = $12, reason = $13, num_answer = $14, correct_option = $15,
            solution_text = $16, updated_by = $17, updated_by_name = $18, updated_at = $19
        WHERE id = $20
        RETURNING *;
    `;

    const values = [
        payload.subject, payload.klass, payload.chapter, payload.topic, payload.exams, payload.q_type,
        payload.question, payload.opt_a, payload.opt_b, payload.opt_c, payload.opt_d,
        payload.assertion, payload.reason, payload.num_answer, payload.correct_option,
        payload.solution_text, payload.updated_by, payload.updated_by_name, payload.updated_at,
        id
    ];

    const res = await targetPoolEntry.pool.query(updateSql, values);
    metadataCache.clear();

    return mapSupabaseToQuestion(res.rows[0]);
}

/**
 * Delete a question from its database.
 */
async function deleteQuestion(id) {
    if (isTest) {
        memoryTestQuestions.delete(id);
        return true;
    }

    let targetDbKey = uuidToDbKey.get(String(id));
    let targetPoolEntry = targetDbKey ? pools.get(targetDbKey) : null;

    if (!targetPoolEntry) {
        for (const entry of getAllPools()) {
            const check = await entry.pool.query('SELECT id FROM public.questions WHERE id = $1 LIMIT 1;', [id]);
            if (check.rows.length > 0) {
                targetPoolEntry = entry;
                break;
            }
        }
    }

    if (!targetPoolEntry) {
        throw new Error(`Question ${id} not found.`);
    }

    await targetPoolEntry.pool.query('DELETE FROM public.questions WHERE id = $1;', [id]);
    uuidToDbKey.delete(String(id));
    metadataCache.clear();

    return true;
}

module.exports = {
    getQuestions,
    getQuestionById,
    getQuestionsByIds,
    getSubjectMetadata,
    getDailyQuestionsCount,
    clearMetadataCache,
    recordQuestionUsage,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    mapSupabaseToQuestion,
    mapQuestionToSupabase,
    cleanDifficultyTags,
    extractDifficulty
};
