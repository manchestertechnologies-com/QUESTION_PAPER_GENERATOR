const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

/**
 * 8 Dedicated Subject Databases Configuration
 * Each subject and class has its own isolated Supabase PostgreSQL database.
 * Totaling 77,853 questions across all 8 dedicated databases.
 */
const DB_CONFIGS = {
    math_11: {
        key: 'math_11',
        subject: 'Mathematics',
        klass: '11',
        name: 'Mathematics Class 11',
        projectId: 'lhnwhbhnexxifuuqnzho',
        envVar: 'SUPABASE_DB_MATH_11_URL',
        altEnvVar: 'DB_MATH_11_URL',
        b64Conn: 'cG9zdGdyZXNxbDovL3Bvc3RncmVzLmxobndoYmhuZXh4aWZ1dXFuemhvOlN1YkNsYXNzMTFNYXRoc0Bhd3MtMC1hcC1zb3V0aGVhc3QtMS5wb29sZXIuc3VwYWJhc2UuY29tOjU0MzIvcG9zdGdyZXM='
    },
    math_12: {
        key: 'math_12',
        subject: 'Mathematics',
        klass: '12',
        name: 'Mathematics Class 12',
        projectId: 'lukbqotnuxoznnrsdqvz',
        envVar: 'SUPABASE_DB_MATH_12_URL',
        altEnvVar: 'DB_MATH_12_URL',
        b64Conn: 'cG9zdGdyZXNxbDovL3Bvc3RncmVzLmx1a2Jxb3RudXhvem5ucnNkcXZ6OlN1YkNsYXNzMTJNYXRoc0Bhd3MtMC1hcC1zb3V0aGVhc3QtMS5wb29sZXIuc3VwYWJhc2UuY29tOjU0MzIvcG9zdGdyZXM='
    },
    chem_11: {
        key: 'chem_11',
        subject: 'Chemistry',
        klass: '11',
        name: 'Chemistry Class 11',
        projectId: 'tloqcflffxrrlbxyphtb',
        envVar: 'SUPABASE_DB_CHEM_11_URL',
        altEnvVar: 'DB_CHEM_11_URL',
        b64Conn: 'cG9zdGdyZXNxbDovL3Bvc3RncmVzLnRsb3FjZmxmZnhycmxieHlwaHRiOlN1YkNsYXNzMTFDaGVtaXN0cnlAYXdzLTAtYXAtbm9ydGhlYXN0LTEucG9vbGVyLnN1cGFiYXNlLmNvbTo1NDMyL3Bvc3RncmVz'
    },
    chem_12: {
        key: 'chem_12',
        subject: 'Chemistry',
        klass: '12',
        name: 'Chemistry Class 12',
        projectId: 'dptruxcqfapmcmbxyobx',
        envVar: 'SUPABASE_DB_CHEM_12_URL',
        altEnvVar: 'DB_CHEM_12_URL',
        b64Conn: 'cG9zdGdyZXNxbDovL3Bvc3RncmVzLmRwdHJ1eGNxZmFwbWNtYnh5b2J4OlN1YkNsYXNzMTJDaGVtaXN0cnlAYXdzLTAtYXAtc291dGhlYXN0LTEucG9vbGVyLnN1cGFiYXNlLmNvbTo1NDMyL3Bvc3RncmVz'
    },
    bio_11: {
        key: 'bio_11',
        subject: 'Biology',
        klass: '11',
        name: 'Biology Class 11',
        projectId: 'tcoaxdpzvzssnkclpvkt',
        envVar: 'SUPABASE_DB_BIO_11_URL',
        altEnvVar: 'DB_BIO_11_URL',
        b64Conn: 'cG9zdGdyZXNxbDovL3Bvc3RncmVzLnRjb2F4ZHB6dnpzc25rY2xwdmt0OlN1YkNsYXNzMTFCaW9sb2d5QGF3cy0wLWFwLXNvdXRoZWFzdC0yLnBvb2xlci5zdXBhYmFzZS5jb206NTQzMi9wb3N0Z3Jlcw=='
    },
    bio_12: {
        key: 'bio_12',
        subject: 'Biology',
        klass: '12',
        name: 'Biology Class 12',
        projectId: 'zxxvxddkncoluvidbtpf',
        envVar: 'SUPABASE_DB_BIO_12_URL',
        altEnvVar: 'DB_BIO_12_URL',
        b64Conn: 'cG9zdGdyZXNxbDovL3Bvc3RncmVzLnp4eHZ4ZGRrbmNvbHV2aWRidHBmOlN1YkNsYXNzMTJCaW9sb2d5QGF3cy0wLWFwLXNvdXRoZWFzdC0yLnBvb2xlci5zdXBhYmFzZS5jb206NTQzMi9wb3N0Z3Jlcw=='
    },
    phy_11: {
        key: 'phy_11',
        subject: 'Physics',
        klass: '11',
        name: 'Physics Class 11',
        projectId: 'pfnlbyjsjxttdachegne',
        envVar: 'SUPABASE_DB_PHY_11_URL',
        altEnvVar: 'DB_PHY_11_URL',
        b64Conn: 'cG9zdGdyZXNxbDovL3Bvc3RncmVzLnBmbmxieWpzanh0dGRhY2hlZ25lOlN1YkNsYXNzMTFQaHlzaWNzQGF3cy0wLWFwLW5vcnRoZWFzdC0yLnBvb2xlci5zdXBhYmFzZS5jb206NTQzMi9wb3N0Z3Jlcw=='
    },
    phy_12: {
        key: 'phy_12',
        subject: 'Physics',
        klass: '12',
        name: 'Physics Class 12',
        projectId: 'fnbgbtvnqmccpvgpphua',
        envVar: 'SUPABASE_DB_PHY_12_URL',
        altEnvVar: 'DB_PHY_12_URL',
        b64Conn: 'cG9zdGdyZXNxbDovL3Bvc3RncmVzLmZuYmdidHZucW1jY3B2Z3BwaHVhOlN1YkNsYXNzMTJQaHlzaWNzQGF3cy0wLWFwLXNvdXRoZWFzdC0xLnBvb2xlci5zdXBhYmFzZS5jb206NTQzMi9wb3N0Z3Jlcw=='
    }
};

const pools = new Map();

for (const [key, cfg] of Object.entries(DB_CONFIGS)) {
    const defaultUrl = Buffer.from(cfg.b64Conn, 'base64').toString('utf8');
    const connStr = process.env[cfg.envVar] || process.env[cfg.altEnvVar] || defaultUrl;
    const pool = new Pool({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    });

    pool.on('error', (err) => {
        console.error(`[Pool error - ${cfg.name}]:`, err.message);
    });

    pools.set(key, {
        ...cfg,
        pool
    });
}

function normalizeSubject(sub) {
    if (!sub || typeof sub !== 'string') return null;
    const clean = sub.trim().toLowerCase();
    if (clean.includes('math')) return 'Mathematics';
    if (clean.includes('physic')) return 'Physics';
    if (clean.includes('chem')) return 'Chemistry';
    if (clean.includes('bio') || clean.includes('botan') || clean.includes('zool')) return 'Biology';
    return sub.trim();
}

function normalizeClass(klass) {
    if (!klass) return null;
    if (Array.isArray(klass)) {
        const has11 = klass.some(k => String(k).includes('11') || String(k).toLowerCase().includes('i'));
        const has12 = klass.some(k => String(k).includes('12') || String(k).toLowerCase().includes('ii'));
        if (has11 && has12) return 'both';
        if (has11) return '11';
        if (has12) return '12';
        return null;
    }
    const str = String(klass).toLowerCase();
    if (str.includes('both') || (str.includes('11') && str.includes('12'))) return 'both';
    if (str.includes('11') || str.includes('i')) return '11';
    if (str.includes('12') || str.includes('ii')) return '12';
    return null;
}

function getPoolForTarget(subject, klass = '12') {
    const normSub = normalizeSubject(subject);
    const normKlass = normalizeClass(klass) || '12';
    const effectiveKlass = normKlass === 'both' ? '12' : normKlass;

    let prefix = 'phy';
    if (normSub === 'Mathematics') prefix = 'math';
    else if (normSub === 'Chemistry') prefix = 'chem';
    else if (normSub === 'Biology') prefix = 'bio';
    else if (normSub === 'Physics') prefix = 'phy';

    const key = `${prefix}_${effectiveKlass}`;
    return pools.get(key) || pools.get('phy_12');
}

function getPoolsForQuery(subject, klass) {
    const normSub = normalizeSubject(subject);
    const normKlass = normalizeClass(klass);

    const all = Array.from(pools.values());

    let filtered = all;

    if (normSub) {
        filtered = filtered.filter(p => p.subject.toLowerCase() === normSub.toLowerCase());
    }

    if (normKlass && normKlass !== 'both') {
        filtered = filtered.filter(p => p.klass === normKlass);
    }

    return filtered.length > 0 ? filtered : all;
}

function getAllPools() {
    return Array.from(pools.values());
}

module.exports = {
    DB_CONFIGS,
    pools,
    normalizeSubject,
    normalizeClass,
    getPoolForTarget,
    getPoolsForQuery,
    getAllPools
};
