const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Primary Active Supabase Pooler URL (Physics 11 Database with support tables)
const PRIMARY_ACTIVE_URL = 'postgresql://postgres.pfnlbyjsjxttdachegne:SubClass11Physics@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres';

let DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL || DATABASE_URL.includes('vukxgqkrersxcasdklda')) {
    DATABASE_URL = PRIMARY_ACTIVE_URL;
}
if (DATABASE_URL && DATABASE_URL.includes('pooler.supabase.com:5432')) {
    DATABASE_URL = DATABASE_URL.replace(':5432', ':6543');
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 25,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err.message);
});


// Auto-migrate missing columns on whatever database is connected
pool.query(`
    CREATE TABLE IF NOT EXISTS public.exam_sessions (
        id SERIAL PRIMARY KEY,
        exam_id VARCHAR(255) NOT NULL,
        student_id VARCHAR(255) NOT NULL,
        student_name VARCHAR(255) DEFAULT 'Student',
        student_email VARCHAR(255) DEFAULT '',
        roll_number VARCHAR(100) DEFAULT '',
        from_lab_ip BOOLEAN DEFAULT FALSE,
        client_ip VARCHAR(100) DEFAULT '',
        start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS submitted BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS score NUMERIC DEFAULT 0;
    ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS attempted INTEGER DEFAULT 0;
    ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS correct INTEGER DEFAULT 0;
    ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS incorrect INTEGER DEFAULT 0;
    ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS unattempted INTEGER DEFAULT 0;
    ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS weak_areas JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS malpractice_flag BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS malpractice_reason TEXT DEFAULT '';
    ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS roll_number VARCHAR(100) DEFAULT '';
    ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS student_email VARCHAR(255) DEFAULT '';
    ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS student_name VARCHAR(255) DEFAULT '';
    ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS total_questions INTEGER DEFAULT 0;

    CREATE TABLE IF NOT EXISTS public.students (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        roll_number VARCHAR(100) UNIQUE,
        enrollment_no VARCHAR(100),
        sats_no VARCHAR(100),
        section VARCHAR(50),
        class_level VARCHAR(50) DEFAULT 'I-PUC',
        email VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS enrollment_no VARCHAR(100);
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS sats_no VARCHAR(100);
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS class_level VARCHAR(50) DEFAULT 'I-PUC';
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS section VARCHAR(50);
`).then(() => {
    try {
        const paceStudents = require('../data/pace_students.json');
        for (const s of paceStudents) {
            pool.query(`
                INSERT INTO public.students (name, roll_number, enrollment_no, sats_no, section, class_level, email)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (roll_number) DO UPDATE SET
                    name = EXCLUDED.name,
                    enrollment_no = EXCLUDED.enrollment_no,
                    section = EXCLUDED.section,
                    class_level = EXCLUDED.class_level,
                    email = EXCLUDED.email;
            `, [
                s.name, s.rollNumber, s.rollNumber, s.rollNumber,
                s.section || 'PACE', s.class_level || 'I-PUC',
                s.email || `${s.rollNumber}@student.manchester.edu`
            ]).catch(() => {});
        }
    } catch (e) {}
}).catch(err => {
    console.error('Auto-migration notice:', err.message);
});

module.exports = pool;
