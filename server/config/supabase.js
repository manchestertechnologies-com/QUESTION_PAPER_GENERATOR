const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.warn('⚠️ Warning: SUPABASE_URL or SUPABASE_SECRET_KEY is missing from environment variables.');
}

const supabase = createClient(
    SUPABASE_URL || 'https://vznhcbwrssbqvnihysys.supabase.co',
    SUPABASE_SECRET_KEY || 'placeholder_secret'
);

module.exports = supabase;
