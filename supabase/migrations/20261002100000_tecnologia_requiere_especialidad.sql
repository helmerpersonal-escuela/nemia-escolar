-- Tecnología siempre lleva especialidad/énfasis (Informática, Carpintería, etc.).
-- Había dos registros ("Tecnología" y "TECNOLOGÍA"); el que se muestra no pedía la especialidad.
update public.subject_catalog
   set requires_specification = true
 where upper(name) in ('TECNOLOGÍA', 'TECNOLOGIA')
   and requires_specification is distinct from true;
