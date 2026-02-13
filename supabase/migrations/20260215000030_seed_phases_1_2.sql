-- Seed Data: Synthetic Program Catalog (Fase 1 & 2)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.synthetic_program_contents WHERE phase IN (1, 2)) THEN
        INSERT INTO public.synthetic_program_contents (phase, educational_level, field_of_study, content, pda) VALUES
        -- FASE 1: INICIAL
        (1, 'INICIAL', 'Lenguajes', 'Las diferentes formas de los lenguajes para la expresión de necesidades, intereses, emociones, afectos y sentimientos.', 'Construye vínculos afectivos a través de los diferentes lenguajes, verbales y no verbales. Utiliza diversas estructuras del lenguaje oral: el maternés, el balbuceo, los juegos metalingüísticos y las narraciones, para la expresión lingüística. Experimenta la lengua de relato cotidianamente, favoreciendo la capacidad de imaginar, de organizar el tiempo, de reflejarse en los cuentos y poemas y de aprender a narrar.'),
        (1, 'INICIAL', 'Lenguajes', 'La identidad familiar y comunitaria que aporta la riqueza cultural de las lenguas maternas (español, indígenas o extranjeras) en contextos de diversidad para fortalecer su uso en niñas y niños.', 'Usa cotidianamente la lengua materna con apoyo de sus familiares de crianza, identificándose como parte de su comunidad. Disfruta de la belleza sonora que le aportan las nanas, “canciones para llamar al sueño” o canciones de cuna.'),
        (1, 'INICIAL', 'Lenguajes', 'El encuentro creador de niñas y niños consigo mismas, consigo mismos, y con el mundo, por medio del disfrute de las experiencias artísticas.', 'Experimenta y transforma el espacio a través del arte y el juego, en forma colectiva. Encuentra formas de dejar sus huellas gráficas en el espacio y experimenta con distintos materiales, a partir del contacto con las artes plásticas y visuales. Escucha, canta y habla haciendo uso de experiencias musicales, disfrutando su envoltura sonora. Descubre el movimiento estético y la representación, al participar en experiencias de expresión corporal propias. Disfruta la lectura como una experiencia que alimenta su curiosidad y capacidad creadora tanto en la familia como en el servicio educativo. Experimenta diversos roles, como espectadora, espectador y participante en narrativas teatrales.'),
        (1, 'INICIAL', 'Lenguajes', 'Artes Plásticas y Visuales', 'Experimenta sus propias huellas con diferentes texturas y en diferentes soportes. Hace uso del espacio y los recursos disponibles para dibujar, pintar y compartir sus creaciones. Deja huellas gráficas identificando y relacionando las propias y las de otros, con ayuda de las artes plásticas y visuales. Disfruta de experiencias artísticas en las que observa, interactúa, manipula, experimenta y juega con materiales variados. Plasma o crea, con los recursos disponibles, sus interpretaciones y simbolizaciones a través de un proceso corporal, táctil y visual. Trae, desde el imaginario a la representación gráfica y visual, lo que evoca o asocia.'),
        (1, 'INICIAL', 'Lenguajes', 'Música', 'Escucha, canta y habla haciendo uso de experiencias musicales, disfrutando su envoltura sonora.'),
        (1, 'INICIAL', 'Saberes y Pensamiento Científico', 'El juego como base de la experiencia de investigación para que niñas y niños construyan sentido del mundo, de sí mismas y de sí mismos.', NULL),
        (1, 'INICIAL', 'Saberes y Pensamiento Científico', 'La exploración e investigación del mundo para el desarrollo del pensamiento a través de la curiosidad, los sentidos y la creatividad.', NULL),
        (1, 'INICIAL', 'Saberes y Pensamiento Científico', 'El aprendizaje de niñas y niños a través de la observación y el involucramiento en la comunidad y el ambiente que les rodea.', NULL),
        (1, 'INICIAL', 'Ética, Naturaleza y Sociedades', 'El enfoque de derechos como base de la intervención integral con niñas y niños.', NULL),
        (1, 'INICIAL', 'Ética, Naturaleza y Sociedades', 'La corresponsabilidad de las personas adultas frente al cuidado y protección de niñas y niños y su papel como garantes de derechos.', NULL),
        (1, 'INICIAL', 'Ética, Naturaleza y Sociedades', 'La crianza compartida como prolongación de los cuidados amorosos consensuados, capaces de proveer una continuidad cultural.', NULL),
        (1, 'INICIAL', 'De lo Humano y lo Comunitario', 'El sostenimiento afectivo como base de las experiencias de cuidado que proveen y generan vínculos amorosos para el bienestar y desarrollo de las infancias.', NULL),
        (1, 'INICIAL', 'De lo Humano y lo Comunitario', 'El contacto y el sostén como bases del desarrollo corporal y las vivencias afectivas.', NULL),
        (1, 'INICIAL', 'De lo Humano y lo Comunitario', 'Los beneficios que otorga una alimentación perceptiva para niñas, niños y sus familias.', NULL),
        (1, 'INICIAL', 'De lo Humano y lo Comunitario', 'El acompañamiento a niñas y niños en el sueño, desde el respeto, atención y escucha de sus necesidades.', NULL),
        (1, 'INICIAL', 'De lo Humano y lo Comunitario', 'Espacios que proveen seguridad y sostén afectivo para aprender de la comunidad con interés y creatividad.', NULL),
        (1, 'INICIAL', 'De lo Humano y lo Comunitario', 'El desarrollo cerebral como base importante para la adquisición de habilidades.', NULL),
        
        -- FASE 2: PREESCOLAR
        (2, 'PREESCOLAR', 'Lenguajes', 'Comunicación oral de necesidades, emociones, gustos, ideas y saberes, a través de los diversos lenguajes, desde una perspectiva comunitaria.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Narración de historias mediante diversos lenguajes, en un ambiente donde niñas y niños participen y se apropien de la cultura, a través de diferentes textos.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Recursos y juegos del lenguaje que fortalecen la diversidad de formas de expresión oral, y que rescatan la o las lenguas de la comunidad y de otros lugares.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Reconocimiento y aprecio de la diversidad lingüística, al identificar las formas en que se comunican las distintas personas de la comunidad.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Representación gráfica de ideas y descubrimientos, al explorar los diversos textos que hay en su comunidad y otros lugares.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Expresión de emociones y experiencias, en igualdad de oportunidades, apoyándose de recursos gráficos personales y de los lenguajes artísticos.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Producciones gráficas dirigidas a destinatarias y diversos destinatarios, para establecer vínculos sociales y acercarse a la cultura escrita.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Reconocimiento de ideas o emociones en la interacción con manifestaciones culturales y artísticas y con la naturaleza, a través de diversos lenguajes.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Producción de expresiones creativas con los distintos elementos de los lenguajes artísticos.', NULL),
        
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Exploración de la diversidad natural que existe en la comunidad y en otros lugares.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Saberes familiares y comunitarios que resuelven situaciones y necesidades en el hogar y la comunidad.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Los seres vivos: elementos, procesos y fenómenos naturales que ofrecen oportunidades para entender y explicar hechos cotidianos, desde distintas perspectivas.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Los saberes numéricos como herramienta para resolver situaciones del entorno, en diversos contextos socioculturales.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'El dominio del espacio y reconocimiento de formas en el entorno desde diversos puntos de observación y mediante desplazamientos o recorridos.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Las magnitudes de longitud, peso, capacidad y tiempo en situaciones cotidianas del hogar y del entorno sociocultural.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Clasificación y experimentación con objetos y elementos del entorno que reflejan la diversidad de la comunidad o región.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Características de objetos y comportamiento de los materiales del entorno sociocultural.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Objetos y artefactos tecnológicos que mejoran y facilitan la vida familiar y de la comunidad.', NULL),
        
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'Interacción, cuidado, conservación y regeneración de la naturaleza, que favorece la construcción de una conciencia socioambiental.', NULL),
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'Transformación responsable del entorno al satisfacer necesidades básicas de alimentación, vestido y vivienda.', NULL),
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'Construcción de la identidad y pertenencia a una comunidad y país a partir del conocimiento de su historia, sus celebraciones, conmemoraciones tradicionales y obras del patrimonio artístico y cultural.', NULL),
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'Cambios que ocurren en los lugares, entornos, objetos, costumbres y formas de vida de las distintas familias y comunidades con el paso del tiempo.', NULL),
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'Labores y servicios que contribuyen al bien común de las distintas familias y comunidades.', NULL),
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'Los derechos de niñas y niños como base para el bienestar integral y el establecimiento de acuerdos que favorecen la convivencia pacífica.', NULL),
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'La diversidad de personas y familias en la comunidad y su convivencia, en un ambiente de equidad, libertad, inclusión y respeto a los derechos humanos.', NULL),
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'La cultura de paz como una forma de relacionarse con otras personas para promover la inclusión y el respeto a la diversidad.', NULL),
        
        (2, 'PREESCOLAR', 'De lo Humano y lo Comunitario', 'Construcción de la identidad personal a partir de su pertenencia a un territorio, su origen étnico, cultural y lingüístico, y la interacción con personas cercanas', 'Descubre gustos, preferencias, posibilidades motrices y afectivas. Describe cómo es físicamente, identifica sus rasgos familiares. Reconoce algunos rasgos de su identidad, qué se le facilita, qué se le dificulta.'),
        (2, 'PREESCOLAR', 'De lo Humano y lo Comunitario', 'Posibilidades de movimiento en diferentes espacios, para favorecer las habilidades motrices', 'Explora las posibilidades de movimiento de su cuerpo. Adapta sus movimientos y fortalece su lateralidad. Combina movimientos que implican el control, equilibrio y estabilidad.'),
        (2, 'PREESCOLAR', 'De lo Humano y lo Comunitario', 'Precisión y coordinación en los movimientos al usar objetos, herramientas y materiales, de acuerdo con sus condiciones, capacidades y características', 'Explora y manipula objetos, herramientas y materiales. Participa en juegos y actividades que involucran la coordinación. Controla sus movimientos al usar objetos.'),
        (2, 'PREESCOLAR', 'De lo Humano y lo Comunitario', 'Las emociones en la interacción con diversas personas y situaciones', 'Identifica emociones como alegría, tristeza, sorpresa, miedo o enojo. Expresa lo que siente o le provocan algunas situaciones. Escucha con empatía a sus pares.'),
        (2, 'PREESCOLAR', 'De lo Humano y lo Comunitario', 'Interacción con personas de diversos contextos, que contribuyan al establecimiento de relaciones positivas y a una convivencia basada en la aceptación de la diversidad', 'Interactúa con diferentes compañeras y compañeros. Identifica las consecuencias positivas o negativas de sus comportamientos. Participa y respeta acuerdos de convivencia.'),
        (2, 'PREESCOLAR', 'De lo Humano y lo Comunitario', 'Cuidado de la salud personal y colectiva, al llevar a cabo acciones de higiene, limpieza, y actividad física, desde los saberes prácticos de la comunidad y la información científica', 'Practica hábitos de higiene personal y limpieza. Reconoce los beneficios que la actividad física, la alimentación y la higiene aportan.');
    END IF;
END $$;
