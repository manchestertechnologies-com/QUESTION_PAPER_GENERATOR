const pool = require('../config/postgres');
const students = require('./students_seed.json');

const testStudents = [
    { name: 'BHUVANA G N', rollNumber: '2620101', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'KUMAR KEERTHAN M', rollNumber: '2620102', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'M NACHIKETH', rollNumber: '2620103', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'MANVITH S GOWDA', rollNumber: '2620104', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'NANDAN E', rollNumber: '2620105', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'RISHIKA C R', rollNumber: '2620107', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'SANTHOSH KUMAR K M', rollNumber: '2620108', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'SHASHANK S SHETTY', rollNumber: '2620109', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'ABHIRAM G AITHAL', rollNumber: '2620110', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'AISHWARYA R REVANKAR', rollNumber: '2620111', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'AMBRUNI D KULKARNI', rollNumber: '2620112', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'ANUSHKA M VERNEKAR', rollNumber: '2620113', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'BHUVAN A R', rollNumber: '2620114', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'BHUVANA VARDHI G', rollNumber: '2620115', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'D KISHORA', rollNumber: '2620116', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'DARSHAN R', rollNumber: '2620117', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'DEERAJ J M', rollNumber: '2620118', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'DHEERAJ S', rollNumber: '2620119', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'ESHANVI S', rollNumber: '2620120', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'GAGAN M C', rollNumber: '2620121', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'HARSHITHA U MESTA', rollNumber: '2620122', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'J BHAGYASHREE', rollNumber: '2620123', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'K R PRAJWAL', rollNumber: '2620124', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'MANASA SURESH MESTA', rollNumber: '2620125', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'MANOJ KUMAR M H', rollNumber: '2620126', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'MANYA C', rollNumber: '2620127', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'NANDITHA K S', rollNumber: '2620128', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'NEHA M A', rollNumber: '2620129', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'P CHAITANYA', rollNumber: '2620130', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'PAVAN SHANBHAG', rollNumber: '2620131', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'PRATHEEK D BELLI', rollNumber: '2620132', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'PREKSHA S KHADGAD', rollNumber: '2620133', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'S SUJITH', rollNumber: '2620134', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'SOHAN V', rollNumber: '2620135', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'SUMANTH C S', rollNumber: '2620136', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'TEKUMALLA SATHWIKA', rollNumber: '2620137', section: 'II-PUC A', class_level: 'II-PUC' },
    { name: 'YASH SHARMA', rollNumber: '2620138', section: 'II-PUC A', class_level: 'II-PUC' }
];

async function insertAll() {
    console.log('Inserting students into PostgreSQL public.students...');
    let count = 0;

    // 1. Insert official PDF students
    for (const s of students) {
        if (!s.enrollment_no || !s.name) continue;
        const email = `${s.enrollment_no.toLowerCase()}@student.manchester.edu`;
        await pool.query(`
            INSERT INTO public.students (name, roll_number, enrollment_no, sats_no, section, class_level, email)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (roll_number) DO UPDATE SET
                name = EXCLUDED.name,
                enrollment_no = EXCLUDED.enrollment_no,
                sats_no = EXCLUDED.sats_no,
                section = EXCLUDED.section,
                class_level = EXCLUDED.class_level;
        `, [s.name, s.enrollment_no, s.enrollment_no, s.sats_no || '', s.section || 'I-PUC', s.class_level || 'I-PUC', email]);
        count++;
    }

    // 2. Insert test students
    for (const ts of testStudents) {
        const email = `${ts.rollNumber.toLowerCase()}@student.manchester.edu`;
        await pool.query(`
            INSERT INTO public.students (name, roll_number, enrollment_no, sats_no, section, class_level, email)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (roll_number) DO UPDATE SET
                name = EXCLUDED.name,
                enrollment_no = EXCLUDED.enrollment_no,
                section = EXCLUDED.section,
                class_level = EXCLUDED.class_level;
        `, [ts.name, ts.rollNumber, ts.rollNumber, '', ts.section, ts.class_level, email]);
        count++;
    }

    console.log(`✅ Successfully seeded/updated ${count} students in PostgreSQL!`);
    await pool.end();
}

insertAll().catch(err => {
    console.error('Error inserting students:', err);
    process.exit(1);
});
