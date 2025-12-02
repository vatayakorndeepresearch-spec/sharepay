import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env manually
const envPath = path.resolve(process.cwd(), '.env');
let env = {};
try {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            env[key] = value;
        }
    });
} catch (e) {
    console.error('Error reading .env:', e.message);
}

const supabaseUrl = env['PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'] || env['PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    console.log('Env keys found:', Object.keys(env));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Fetching profiles...');
    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, display_name, created_at').order('created_at', { ascending: true });
    if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
    }
    console.log('Profiles:', profiles);

    console.log('Fetching unpaid expenses...');
    const { data: unpaidExpenses, error: expensesError } = await supabase
        .from('expenses')
        .select('amount, paid_by, transaction_type, is_reimbursed, description, projects(name)')
        .eq('is_reimbursed', false);

    if (expensesError) {
        console.error('Error fetching expenses:', expensesError);
        return;
    }

    console.log(`Found ${unpaidExpenses.length} unpaid expenses.`);
    unpaidExpenses.forEach(e => {
        console.log(`- ${e.description}: ${e.amount} (${e.transaction_type}) by ${e.paid_by} [Project: ${e.projects?.name}]`);
    });

    const paidMap = {};
    profiles.forEach(p => paidMap[p.id] = 0);

    unpaidExpenses.forEach(item => {
        if (item.transaction_type === 'expense') {
            paidMap[item.paid_by] += item.amount;
        } else {
            paidMap[item.paid_by] -= item.amount;
        }
    });

    console.log('Paid Map:', paidMap);

    if (profiles.length < 2) {
        console.log('Not enough profiles to calculate balance.');
        return;
    }

    const p1 = profiles[0];
    const p2 = profiles[1];
    const p1_paid = paidMap[p1.id];
    const p2_paid = paidMap[p2.id];
    const diff = p1_paid - p2_paid;

    console.log(`Diff: ${diff}`);

    if (diff === 0) {
        console.log('Result: Cleared!');
    } else {
        console.log(`Result: ${diff > 0 ? p2.display_name : p1.display_name} owes ${diff > 0 ? p1.display_name : p2.display_name} ${Math.abs(diff)}`);
    }
}

main();
