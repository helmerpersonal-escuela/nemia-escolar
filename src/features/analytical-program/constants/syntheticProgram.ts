
export interface SyntheticContent {
    id: string;
    campo_formativo: string;
    subject: string;
    content: string;
    pda: string[];
}

export const SYNTHETIC_PROGRAM_SECONDARY: SyntheticContent[] = [
    // LENGUAJES
    {
        id: 'l1',
        campo_formativo: 'Lenguajes',
        subject: 'Español',
        content: 'La diversidad de lenguas y su uso en la comunicación familiar, escolar y comunitaria.',
        pda: ['Reconoce la riqueza lingüística de México y el mundo.', 'Comprende el papel del español como lengua común.']
    },
    {
        id: 'l2',
        campo_formativo: 'Lenguajes',
        subject: 'Español',
        content: 'La diversidad étnica, cultural y lingüística de México a favor de una sociedad intercultural.',
        pda: ['Compara semejanzas y diferencias en la forma de hablar de las personas.']
    },
    {
        id: 'l3',
        campo_formativo: 'Lenguajes',
        subject: 'Inglés',
        content: 'La diversidad lingüística y sus formas de expresión en México y el mundo.',
        pda: ['Hace uso del alfabeto, los números y las expresiones básicas en inglés.']
    },
    {
        id: 'l4',
        campo_formativo: 'Lenguajes',
        subject: 'Artes',
        content: 'Diversidad de lenguajes artísticos en la riqueza pluricultural de México y del mundo.',
        pda: ['Explora las características de los lenguajes artísticos.']
    },
    // SABERES Y PENSAMIENTO CIENTÍFICO
    {
        id: 's1',
        campo_formativo: 'Saberes y Pensamiento Científico',
        subject: 'Matemáticas',
        content: 'Expresión de fracciones como decimales y de decimales como fracciones.',
        pda: ['Usa diversas estrategias al convertir números fraccionarios a decimales.']
    },
    {
        id: 's2',
        campo_formativo: 'Saberes y Pensamiento Científico',
        subject: 'Matemáticas',
        content: 'Extensión de los números a positivos y negativos y su orden.',
        pda: ['Reconoce la necesidad de los números negativos a partir de usar cantidades que se restan de otras menores.']
    },
    {
        id: 's3',
        campo_formativo: 'Saberes y Pensamiento Científico',
        subject: 'Biología',
        content: 'Funcionamiento del cuerpo humano coordinado por los sistemas nervioso y endocrino.',
        pda: ['Explica la participación de los sistemas nervioso y endocrino en la coordinación de las funciones del cuerpo humano.']
    },
    {
        id: 's4',
        campo_formativo: 'Saberes y Pensamiento Científico',
        subject: 'Física',
        content: 'El pensamiento científico, una forma de plantear y solucionar problemas y su incidencia en la transformación de la sociedad.',
        pda: ['Describe problemas comunes de la vida cotidiana explicando cómo se procede para buscarles solución.']
    },
    // ÉTICA, NATURALEZA Y SOCIEDADES
    {
        id: 'e1',
        campo_formativo: 'Ética, Naturaleza y Sociedades',
        subject: 'Historia',
        content: 'Los albores de la humanidad: los pueblos antiguos del mundo y su devenir.',
        pda: ['Busca, localiza y estudia con sus pares fuentes que den cuenta de mitos fundacionales de pueblos antiguos.']
    },
    {
        id: 'e2',
        campo_formativo: 'Ética, Naturaleza y Sociedades',
        subject: 'Geografía',
        content: 'El espacio geográfico como un producto social.',
        pda: ['Comprende que el espacio geográfico se conforma de interrelaciones sociedad-naturaleza.']
    },
    {
        id: 'e3',
        campo_formativo: 'Ética, Naturaleza y Sociedades',
        subject: 'Formación Cívica y Ética',
        content: 'Los derechos humanos en México y en el mundo como valores compartidos por las sociedades fecundas.',
        pda: ['Asume una postura crítica acerca de la vigencia de los derechos humanos.']
    },
    // DE LO HUMANO Y LO COMUNITARIO
    {
        id: 'h1',
        campo_formativo: 'De lo Humano y lo Comunitario',
        subject: 'Tecnología',
        content: 'Herramientas, máquinas e instrumentos como extensión corporal, en la satisfacción continua de intereses y necesidades humanas.',
        pda: ['Explora las posibilidades corporales y la delegación de funciones en herramientas, máquinas e instrumentos.']
    },
    {
        id: 'h2',
        campo_formativo: 'De lo Humano y lo Comunitario',
        subject: 'Educación Física',
        content: 'Capacidades, habilidades y destrezas motrices.',
        pda: ['Explora las capacidades, habilidades y destrezas motrices para enriquecer el potencial propio y de los demás.']
    },
    {
        id: 'h3',
        campo_formativo: 'De lo Humano y lo Comunitario',
        subject: 'Tutoría / Socioemocional',
        content: 'Formas de ser, pensar, actuar y relacionarse.',
        pda: ['Reconoce ideas, gustos, necesidades, posibilidades, intereses, deseos y experiencias para favorecer el autoconocimiento.']
    }
];
