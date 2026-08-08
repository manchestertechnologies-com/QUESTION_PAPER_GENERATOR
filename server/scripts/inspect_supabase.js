const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function inspect() {
    console.log('Connecting to Supabase at:', SUPABASE_URL);

    const tables = ['questions', 'question_bank', 'questions_bank', 'papers', 'users'];

    for (const table of tables) {
        try {
            const { data, error, count } = await supabase
                .from(table)
                .select('*', { count: 'exact' })
                .limit(5);

            if (error) {
                console.log(`Table '${table}':`, error.message);
            } else {
                console.log(`\n✅ Table '${table}' exists! Record count:`, count);
                if (data && data.length > 0) {
                    console.log('Sample record columns:', Object.keys(data[0]));
                }
            }
        } catch (e) {
            console.error(`Error querying '${table}':`, e.message);
        }
    }
}

inspect();
