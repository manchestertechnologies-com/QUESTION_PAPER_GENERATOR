const { Pool } = require('pg');

const DB_URLS = [
    'postgresql://postgres.pfnlbyjsjxttdachegne:SubClass11Physics@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres',
    'postgresql://postgres.gbdtfmutwzgkhkuuxnqr:SubClass11Chemistry@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'
];

const studentsToInsert = [
    { num: '1000', name: 'Student 1000', section: 'Batch A', class_level: 'II-PUC' },
    { num: '1001', name: 'Student 1001', section: 'Batch A', class_level: 'II-PUC' },
    { num: '1002', name: 'Student 1002', section: 'Batch A', class_level: 'II-PUC' },
    { num: '1003', name: 'Student 1003', section: 'Batch A', class_level: 'II-PUC' },
    { num: '1004', name: 'Student 1004', section: 'Batch A', class_level: 'II-PUC' },
    { num: '1005', name: 'Student 1005', section: 'Batch A', class_level: 'II-PUC' },
    { num: '1006', name: 'Student 1006', section: 'Batch B', class_level: 'I-PUC' },
    { num: '1007', name: 'Student 1007', section: 'Batch B', class_level: 'I-PUC' },
    { num: '1008', name: 'Student 1008', section: 'Batch B', class_level: 'I-PUC' },
    { num: '1009', name: 'Student 1009', section: 'Batch B', class_level: 'I-PUC' },
    { num: '1010', name: 'Student 1010', section: 'Batch B', class_level: 'I-PUC' },
];

async function seed() {
    for (const url of DB_URLS) {
        console.log(`\nConnecting to: ${url.split('@')[1]}`);
        const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
        try {
            await pool.query('SELECT 1');
            console.log('Connected successfully!');

            // Ensure table exists
            await pool.query(`
                CREATE TABLE IF NOT EXISTS public.students (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    roll_number VARCHAR(100) UNIQUE NOT NULL,
                    enrollment_no VARCHAR(100),
                    sats_no VARCHAR(100),
                    section VARCHAR(100) DEFAULT 'General',
                    class_level VARCHAR(50) DEFAULT 'II-PUC',
                    email VARCHAR(255),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `);

            for (const s of studentsToInsert) {
                const email = `${s.num}@student.manchester.edu`;
                await pool.query(`
                    INSERT INTO public.students (name, roll_number, enrollment_no, sats_no, section, class_level, email)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (roll_number) DO UPDATE SET
                        name = EXCLUDED.name,
                        enrollment_no = EXCLUDED.enrollment_no,
                        section = EXCLUDED.section,
                        class_level = EXCLUDED.class_level,
                        email = EXCLUDED.email;
                `, [s.name, s.num, s.num, s.num, s.section, s.class_level, email]);
                console.log(`Inserted / updated student: ${s.num} - ${s.name}`);
            }
            console.log(`✅ All ${studentsToInsert.length} students inserted successfully on ${url.split('@')[1]}`);
        } catch (err) {
            console.error('Error on db:', err.message);
        } finally {
            await pool.end();
        }
    }
}

seed();
