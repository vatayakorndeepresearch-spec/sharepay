-- Delete associated expenses first to handle foreign key constraints
DELETE FROM public.expenses 
WHERE project_id IN (
    SELECT id FROM public.projects WHERE name IN ('ส่วนตัว', 'Cash')
);

-- Delete the projects
DELETE FROM public.projects 
WHERE name IN ('ส่วนตัว', 'Cash');
