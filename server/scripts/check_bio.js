require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URI || process.env.SUPABASE_DB_URL,
  ssl: (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')) ? false : { rejectUnauthorized: false }
});

async function run() {
  try {
    const subs = await pool.query('SELECT DISTINCT subject, count(*) FROM public.questions GROUP BY subject;');
    console.log('Distinct subjects:', subs.rows);

    const bioCh = await pool.query(`SELECT DISTINCT subject, chapter FROM public.questions WHERE subject ILIKE '%bio%' OR subject ILIKE '%bot%' OR subject ILIKE '%zoo%' ORDER BY subject, chapter;`);
    console.log('Bio chapters count:', bioCh.rows.length);
    console.log('Bio chapters sample:', bioCh.rows.slice(0, 30));
  } catch(e) {
    console.error('DB Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
