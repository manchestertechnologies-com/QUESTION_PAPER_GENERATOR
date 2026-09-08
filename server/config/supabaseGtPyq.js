const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const SUPABASE_GT_PYQ_URL = process.env.SUPABASE_GT_PYQ_URL || '';
const SUPABASE_GT_PYQ_SECRET_KEY = process.env.SUPABASE_GT_PYQ_SECRET_KEY || process.env.SUPABASE_GT_PYQ_KEY || '';

if (!SUPABASE_GT_PYQ_URL || !SUPABASE_GT_PYQ_SECRET_KEY) {
    console.warn('⚠️ SUPABASE_GT_PYQ_URL or SUPABASE_GT_PYQ_SECRET_KEY environment variable is not defined.');
}

const supabaseGtPyq = (SUPABASE_GT_PYQ_URL && SUPABASE_GT_PYQ_SECRET_KEY)
    ? createClient(SUPABASE_GT_PYQ_URL, SUPABASE_GT_PYQ_SECRET_KEY)
    : null;

module.exports = supabaseGtPyq;
