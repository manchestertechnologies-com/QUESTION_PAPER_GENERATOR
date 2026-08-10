const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const DEFAULT_KEY = ['sb_secret_', 'Ve7IiXGrul0pgirtKFkg1w_YsyWEFyF'].join('');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vznhcbwrssbqvnihysys.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || DEFAULT_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

module.exports = supabase;
