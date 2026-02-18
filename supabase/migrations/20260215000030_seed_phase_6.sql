-- Seed Data: Synthetic Program Catalog (Fase 6)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.synthetic_program_contents WHERE phase = 6) THEN
        INSERT INTO public.synthetic_program_contents (phase, educational_level, field_of_study, subject_name, content, pda) VALUES
        -- FASE 6: SECUNDARIA
        -- Lenguajes
        (6, 'SECUNDARIA', 'Lenguajes', 'Español', 'La diversidad de lenguas y su uso en la comunicación familiar, escolar y comunitaria.', NULL),
        (6, 'SECUNDARIA', 'Lenguajes', 'Español', 'La diversidad étnica, cultural y lingüística de México a favor de una sociedad intercultural.', NULL),
        (6, 'SECUNDARIA', 'Lenguajes', 'Español', 'Las lenguas como manifestación de la identidad y del sentido de pertenencia.', NULL),
        (6, 'SECUNDARIA', 'Lenguajes', 'Inglés', 'La diversidad lingüística y sus formas de expresión en México y el mundo.', NULL),
        (6, 'SECUNDARIA', 'Lenguajes', 'Inglés', 'La identidad y cultura de pueblos de habla inglesa.', NULL),
        (6, 'SECUNDARIA', 'Lenguajes', 'Artes', 'Diversidad de lenguajes artísticos en la riqueza pluricultural de México y del mundo.', NULL),
        (6, 'SECUNDARIA', 'Lenguajes', 'Artes', 'Manifestaciones culturales y artísticas que conforman la diversidad étnica, cultural y lingüística.', NULL),

        -- Saberes y Pensamiento Científico
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Matemáticas', 'Expresión de fracciones como decimales y de decimales como fracciones.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Matemáticas', 'Extensión de los números a positivos y negativos y su orden.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Matemáticas', 'Introducción al álgebra.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Biología', 'Funcionamiento del cuerpo humano coordinado por los sistemas nervioso y endocrino.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Biología', 'Salud sexual y reproductiva.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Física', 'El pensamiento científico, una forma de plantear y solucionar problemas.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Física', 'Estructura, propiedades y características de la materia.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Química', 'Las propiedades extensivas e intensivas como una forma de identificar sustancias.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Química', 'Composición de las mezclas y su clasificación.', NULL),

        -- Ética, Naturaleza y Sociedades
        (6, 'SECUNDARIA', 'Ética, Naturaleza y Sociedades', 'Geografía', 'El espacio geográfico como una construcción social y colectiva.', NULL),
        (6, 'SECUNDARIA', 'Ética, Naturaleza y Sociedades', 'Geografía', 'Las categorías de análisis espacial y representaciones del espacio geográfico.', NULL),
        (6, 'SECUNDARIA', 'Ética, Naturaleza y Sociedades', 'Historia', 'Los albores de la humanidad: los pueblos antiguos del mundo y su devenir.', NULL),
        (6, 'SECUNDARIA', 'Ética, Naturaleza y Sociedades', 'Historia', 'La conformación de las metrópolis y los sistemas de dominación.', NULL),
        (6, 'SECUNDARIA', 'Ética, Naturaleza y Sociedades', 'Formación Cívica y Ética', 'Los derechos humanos en México y en el mundo.', NULL),
        (6, 'SECUNDARIA', 'Ética, Naturaleza y Sociedades', 'Formación Cívica y Ética', 'El conflicto en la convivencia humana desde la cultura de paz.', NULL),

        -- De lo Humano y lo Comunitario
        (6, 'SECUNDARIA', 'De lo Humano y lo Comunitario', 'Educación Física', 'Capacidades, habilidades y destrezas motrices.', NULL),
        (6, 'SECUNDARIA', 'De lo Humano y lo Comunitario', 'Educación Física', 'Estilos de vida activos y saludables.', NULL),
        (6, 'SECUNDARIA', 'De lo Humano y lo Comunitario', 'Tecnología', 'Herramientas, máquinas e instrumentos, como extensión corporal.', NULL),
        (6, 'SECUNDARIA', 'De lo Humano y lo Comunitario', 'Tecnología', 'Materiales, procesos técnicos y comunidad.', NULL),
        (6, 'SECUNDARIA', 'De lo Humano y lo Comunitario', 'Tutoría / Socioemocional', 'Autoconocimiento.', NULL),
        (6, 'SECUNDARIA', 'De lo Humano y lo Comunitario', 'Tutoría / Socioemocional', 'Manejo de emociones.', NULL);
    END IF;
END $$;
