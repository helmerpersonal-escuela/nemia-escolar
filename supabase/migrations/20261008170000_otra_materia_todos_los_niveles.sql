-- "Otra Materia / Actividad" (para lo que no está en el catálogo) también en secundaria
UPDATE public.subject_catalog SET educational_level = 'BOTH', requires_specification = true
 WHERE name = 'Otra Materia / Actividad';
