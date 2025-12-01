import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
    const projectId = url.searchParams.get('project');
    const status = url.searchParams.get('status'); // 'all', 'unpaid', 'paid'

    // Fetch projects for filter
    const { data: projects } = await supabase.from('projects').select('*').order('name');

    // Build query
    let query = supabase
        .from('expenses')
        .select(`
      *,
      projects (name),
      profiles!expenses_paid_by_fkey (display_name)
    `)
        .order('paid_at', { ascending: false });

    if (projectId && projectId !== 'all') {
        query = query.eq('project_id', projectId);
    }

    if (status === 'unpaid') {
        query = query.eq('is_reimbursed', false);
    } else if (status === 'paid') {
        query = query.eq('is_reimbursed', true);
    }

    const { data: expenses } = await query;

    return {
        expenses: expenses || [],
        projects: projects || [],
        filters: {
            project: projectId || 'all',
            status: status || 'all'
        }
    };
};
