const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.warn('⚠️ SUPABASE_URL or SUPABASE_SECRET_KEY environment variable is not defined.');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SECRET_KEY || '');

module.exports = supabase;
