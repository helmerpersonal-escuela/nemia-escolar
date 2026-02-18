-- Seed Data: Synthetic Program Catalog (Fase 3, 4 & 5)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.synthetic_program_contents WHERE phase IN (3, 4, 5)) THEN
        INSERT INTO public.synthetic_program_contents (phase, educational_level, field_of_study, content, pda) VALUES
        -- FASE 3: PRIMARIA (1º-2º)
        (3, 'PRIMARIA', 'Lenguajes', 'Escritura de nombres en la lengua materna.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Lectura compartida en voz alta.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Narración de actividades y eventos relevantes que tengan lugar en la familia, la escuela o el resto de la comunidad.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Escritura colectiva por medio del dictado.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Descripción de objetos, lugares y seres vivos.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Uso de convenciones de la escritura presentes en la cotidianidad.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Uso del dibujo y/o la escritura para recordar actividades y acuerdos escolares.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Registro y/o resumen de información consultada en fuentes orales, escritas, audiovisuales, táctiles o sonoras, para estudiar y/o exponer.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Empleo de textos con instrucciones para participar en juegos, usar o elaborar objetos, preparar alimentos u otros propósitos.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Producción e interpretación de avisos, carteles, anuncios publicitarios y letreros en la vida cotidiana.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Elaboración y difusión de notas informativas en la escuela y el resto de la comunidad.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Producción de textos dirigidos a autoridades y personas de la comunidad, en relación con necesidades, intereses o actividades escolares.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Lectura, escritura y otros tipos de interacción mediante lenguajes que ocurren en el contexto familiar.', NULL),
        (3, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Cuerpo humano: estructura externa, acciones para su cuidado y sus cambios como parte del crecimiento.', NULL),
        (3, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Beneficios del consumo de alimentos saludables, de agua simple potable, y de la práctica de actividad física.', NULL),
        (3, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Características del entorno natural y sociocultural.', NULL),
        (3, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Impacto de las actividades humanas en el entorno natural, así como acciones y prácticas socioculturales para su cuidado.', NULL),
        (3, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Estudio de los números.', NULL),
        (3, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Construcción de la noción de suma y resta, y su relación como operaciones inversas.', NULL),
        (3, 'PRIMARIA', 'Ética, Naturaleza y Sociedades', 'Diversos contextos sociales, naturales y territoriales: cambios y continuidades.', NULL),
        (3, 'PRIMARIA', 'Ética, Naturaleza y Sociedades', 'Respeto, cuidado y empatía hacia la naturaleza, como parte de un todo interdependiente.', NULL),
        (3, 'PRIMARIA', 'Ética, Naturaleza y Sociedades', 'Impacto de las actividades humanas en la naturaleza y sustentabilidad.', NULL),
        (3, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'La comunidad como el espacio en el que se vive y se encuentra la escuela.', NULL),
        (3, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'Sentido de pertenencia a la familia y la comunidad.', NULL),
        (3, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'Formas de ser, pensar, actuar y relacionarse.', NULL),
        (3, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'Capacidades y habilidades motrices.', NULL),
        
        -- FASE 4: PRIMARIA (3º-4º)
        (4, 'PRIMARIA', 'Lenguajes', 'Narración de sucesos del pasado y del presente.', NULL),
        (4, 'PRIMARIA', 'Lenguajes', 'Descripción de personas, lugares, hechos y procesos.', NULL),
        (4, 'PRIMARIA', 'Lenguajes', 'Diálogo para la toma de acuerdos y el intercambio de puntos de vista.', NULL),
        (4, 'PRIMARIA', 'Lenguajes', 'Comprensión y producción de textos expositivos en los que se planteen: problema-solución, comparación-contraste, causa-consecuencia y enumeración.', NULL),
        (4, 'PRIMARIA', 'Lenguajes', 'Búsqueda y manejo reflexivo de información.', NULL),
        (4, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Estructura y funcionamiento del cuerpo humano: sistemas locomotor y digestivo.', NULL),
        (4, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Alimentación saludable, con base en el Plato del Bien Comer.', NULL),
        (4, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Relaciones entre los factores físicos y biológicos que conforman los ecosistemas.', NULL),
        (4, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Estudio de los números.', NULL),
        (4, 'PRIMARIA', 'Ética, Naturaleza y Sociedades', 'Representaciones cartográficas de la localidad y/o comunidad.', NULL),
        (4, 'PRIMARIA', 'Ética, Naturaleza y Sociedades', 'Valoración de los ecosistemas: características del territorio como espacio de vida.', NULL),
        (4, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'La escuela como espacio de convivencia, colaboración y aprendizaje.', NULL),
        (4, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'Sentido de pertenencia, identidad personal y social.', NULL),
        
        -- FASE 5: PRIMARIA (5º-6º)
        (5, 'PRIMARIA', 'Lenguajes', 'Narración de sucesos autobiográficos.', NULL),
        (5, 'PRIMARIA', 'Lenguajes', 'Comprensión y producción de textos explicativos.', NULL),
        (5, 'PRIMARIA', 'Lenguajes', 'Participación en debates sobre temas de interés común.', NULL),
        (5, 'PRIMARIA', 'Lenguajes', 'Comprensión y producción de textos argumentativos.', NULL),
        (5, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Estructura y funcionamiento del cuerpo humano: sistemas circulatorio, respiratorio e inmunológico.', NULL),
        (5, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Alimentación saludable: características de la dieta correcta, costumbres de la comunidad.', NULL),
        (5, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Factores que conforman la biodiversidad y el medio ambiente.', NULL),
        (5, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Estudio de los números.', NULL),
        (5, 'PRIMARIA', 'Ética, Naturaleza y Sociedades', 'Valoración de la biodiversidad: en el territorio donde se ubica la localidad.', NULL),
        (5, 'PRIMARIA', 'Ética, Naturaleza y Sociedades', 'Derechos humanos: a un ambiente sano y acceso al agua potable.', NULL),
        (5, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'La comunidad como espacio para el desarrollo del sentido de pertenencia y autonomía.', NULL),
        (5, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'Estilos de vida activos y saludables.', NULL);
    END IF;
END $$;
