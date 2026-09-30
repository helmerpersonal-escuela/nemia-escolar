import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { nameSimilarity, splitGivenFirst, splitSurnamesFirst, bestMatch } from '../features/school-import/lib/names'
import { extractPhones, groupKeyOf, parseSpanishDate, parseTimeRange, splitStudentAnnotation } from '../features/school-import/lib/parsers'
import { consolidate, mapSubject, nemFieldFor, roleFor } from '../features/school-import/lib/consolidate'
import { extractFiles } from '../features/school-import/lib/extract'

// Datos 100 % ficticios
describe('nombres', () => {
    it('separa listas "PATERNO MATERNO NOMBRES" con partículas', () => {
        expect(splitSurnamesFirst('DE LA CRUZ PEREZ ANA SOFIA')).toEqual({ last_name_paternal: 'DE LA CRUZ', last_name_maternal: 'PEREZ', first_name: 'ANA SOFIA' })
        expect(splitSurnamesFirst('LOPEZ JUAN')).toEqual({ last_name_paternal: 'LOPEZ', last_name_maternal: '', first_name: 'JUAN' })
    })
    it('separa "NOMBRES PATERNO MATERNO"', () => {
        expect(splitGivenFirst('MARIA JOSE DEL VALLE ROJAS')).toEqual({ first_name: 'MARIA JOSE', last_name_paternal: 'DEL VALLE', last_name_maternal: 'ROJAS' })
    })
    it('tolera errores de dedo, nombres recortados y abreviaturas', () => {
        expect(nameSimilarity('RUIZ ZUNUN DANIEL', 'RUIZ ZUNUM DANIEL')).toBeGreaterThan(0.9)
        expect(nameSimilarity('PEREZ SOTO ANA GABRI', 'PEREZ SOTO ANA GABRIELA')).toBeGreaterThan(0.85)
        expect(nameSimilarity('LUISA DE LA PIEDRA HDEZ', 'LUISA DE LA PIEDRA HERNANDEZ')).toBe(1)
        expect(nameSimilarity('PEREZ SOTO ANA', 'GOMEZ RUIZ LUIS')).toBeLessThan(0.5)
    })
    it('no adivina cuando hay empate (gemelas)', () => {
        const pool = ['BAUTISTA RUIZ AILIN', 'BAUTISTA RUIZ YAILIN']
        expect(bestMatch('BAUTISTA RUIZ AILIN', pool, x => x)?.item).toBe('BAUTISTA RUIZ AILIN')
        expect(bestMatch('BAUTISTA RUIZ AYLIN', pool, x => x)?.item).toBe('BAUTISTA RUIZ AILIN')
        expect(bestMatch('BAUTISTA RUIZ XAILIN', pool, x => x)).toBeNull()
    })
})

describe('textos de las escuelas', () => {
    it('reconoce grupos', () => {
        expect(['1°A', '3A', '2o A', '3° B', '1 ° -C'].map(groupKeyOf)).toEqual(['1A', '3A', '2A', '3B', '1C'])
        expect(groupKeyOf('DOCENTES')).toBeNull()
        expect(groupKeyOf('Hoja1')).toBeNull()
    })
    it('encuentra teléfonos en texto libre', () => {
        expect(extractPhones('961-555-0101 wasap').ok).toEqual(['9615550101'])
        expect(extractPhones('52 961-555-0102').ok).toEqual(['9615550102'])
        expect(extractPhones('961 555 0103  961 555 0104').ok).toEqual(['9615550103', '9615550104'])
        expect(extractPhones('+1743 555 0105').bad.length).toBe(1)
    })
    it('separa las claves al final del nombre', () => {
        expect(splitStudentAnnotation('PEREZ SOTO ANA      AL, RP.')).toEqual({ name: 'PEREZ SOTO ANA', note: 'AL, RP.' })
        expect(splitStudentAnnotation('SANDOVAL RUIZ  JULIO')).toEqual({ name: 'SANDOVAL RUIZ  JULIO' })
    })
    it('lee fechas y horas', () => {
        expect(parseSpanishDate('26 de septiembre de 2026')).toBe('2026-09-26')
        expect(parseTimeRange('7:00 - 7:50')).toEqual(['07:00', '07:50'])
    })
    it('mapea materias y puestos', () => {
        expect(mapSubject('MATEMATICAS 1')).toEqual({ catalogName: 'MATEMÁTICAS', customName: null })
        expect(mapSubject('FORMACION CIVICA E 3').catalogName).toBe('FORMACIÓN CÍVICA Y ÉTICA')
        expect(mapSubject('CIENCIAS (BIOLOGÍA)').catalogName).toBe('BIOLOGÍA')
        expect(mapSubject('EDUCACIÓN FÍSICA').catalogName).toBe('EDUCACIÓN FÍSICA')
        expect(mapSubject('INFORMATICA')).toEqual({ catalogName: 'TECNOLOGÍA', customName: 'Tecnología - Informática' })
        expect(mapSubject('P. C. I. A.').customName).toBe('Tecnología - PCIA')
        expect(mapSubject('CLUB DE LECTURA').catalogName).toBe('Otra Materia / Actividad')
        expect(roleFor('SUBDIRECCIÓN').jobTitle).toBe('Subdirector(a)')
        expect(roleFor('CONTROL ESCOLAR').role).toBe('SCHOOL_CONTROL')
        expect(nemFieldFor('g. Infraestructura y equipamiento')).toBe('Infraestructura y equipamiento')
    })
})

async function workbook(): Promise<ArrayBuffer> {
    const wb = new ExcelJS.Workbook()
    const list = wb.addWorksheet('1°A')
    list.addRow(['ESCUELA SECUNDARIA TÉCNICA DE EJEMPLO'])
    list.addRow(['', 'ZONA ESCOLAR: 09', 'CLAVE: 07DST9999X', '', 'CICLO: 2026 – 2027'])
    list.addRow(['No', 'NOMBRE DEL ALUMNO', 'SEXO'])
    list.addRow([1, 'PEREZ SOTO ANA GABRIELA', 'M'])
    list.addRow([2, 'RUIZ ZUNUN DANIEL      N.I.', 'H'])
    list.addRow([3, 'GOMEZ LARA LUIS', 'H'])
    const dir = wb.addWorksheet('1o A ')
    dir.addRow(['DIRECTORIO DE PADRES'])
    dir.addRow(['NP', 'NOMBRE DEL ALUMNO', 'SEXO', 'GDO GPO', 'NOMBRE DEL PADRE, MADRE O TUTOR', 'TELEFONO CEL', 'TELEFONO CASA'])
    dir.addRow([1, 'PEREZ SOTO ANA GABRI', 'M', '1A', 'LAURA SOTO DIAZ', '961-555-0101', '961 555 0102'])
    dir.addRow([2, 'RUIZ ZUNUM DANIEL', 'H', '1A', 'JOSE RUIZ PEREZ', '961-555-0103', ''])
    dir.addRow([2, 'RUIZ ZUNUM DANIEL', 'H', '1A', 'JOSE RUIZ PEREZ', '961-555-0104', ''])
    const staff = wb.addWorksheet('PERSONAL')
    staff.addRow(['N.P.', 'NOMBRE', 'FUNCIÓN'])
    staff.addRow([1, 'ROSA MARIA LOPEZ DIAZ', 'DIRECCIÓN'])
    staff.addRow([2, 'CARLOS PEREZ GIL', 'MATEMÁTICAS'])
    const exp = wb.addWorksheet('Exportacion SEP')
    exp.addRow(['GRADO', 'GRUPO', 'PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'NOMBRE(S)', 'CURP'])
    exp.addRow(['1', 'A', 'PEREZ', 'SOTO', 'ANA GABRIELA', 'PESA100101MCSRTNA1'])
    exp.addRow(['1', 'A', 'GOMEZ', 'LARA', 'LUIS', 'GOLL100202HCSMRSA2'])
    return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

async function docx(): Promise<ArrayBuffer> {
    const p = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`
    const tc = (t: string) => `<w:tc>${t.split('\n').map(p).join('')}</w:tc>`
    const tr = (cells: string[]) => `<w:tr>${cells.map(tc).join('')}</w:tr>`
    const tbl = (rows: string[][]) => `<w:tbl>${rows.map(tr).join('')}</w:tbl>`
    const body = [
        p('HORARIO ESCOLAR CICLO 2026 - 2027'),
        tbl([
            ['1A', '1A', '1A', '1A', '1A', '1A'],
            ['', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi'],
            ['7:00 - 7:50', 'MATEMATICAS 1\nCARLOS PEREZ GIL', 'INFORMATICA\nLUIS MORA VEGA', 'MATEMATICAS 1\nCARLOS PEREZ GIL', '', ''],
            ['8:00 - 8:30', 'R E C E S O', 'R E C E S O', 'R E C E S O', 'R E C E S O', 'R E C E S O'],
            ['8:30 - 9:20', 'ESPAÑOL 1\nROSA MARIA LOPEZ DIAZ', '', '', '', ''],
        ]),
        tbl([
            ['#', 'Sesión ordinaria de CTE', 'Corte'],
            ['1', '26 de septiembre de 2026', '—'],
            ['2', '31 de octubre de 2026', 'Corte 1'],
        ]),
    ].join('')
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
    const zip = new JSZip()
    zip.file('word/document.xml', xml)
    return zip.generateAsync({ type: 'arraybuffer' })
}

describe('importación de archivos (ficticios)', () => {
    it('lee listas, directorio, personal, horario y CTE', async () => {
        const ex = await extractFiles([{ name: 'listas.xlsx', data: await workbook() }, { name: 'horario.docx', data: await docx() }])
        const plan = consolidate(ex)
        expect(plan.meta.cct).toBe('07DST9999X')
        expect(plan.groups).toHaveLength(1)
        expect(plan.groups[0].students.map(s => s.full)).toEqual(['PEREZ SOTO ANA GABRIELA', 'RUIZ ZUNUN DANIEL', 'GOMEZ LARA LUIS'])
        expect(plan.history.some(h => h.kind === 'NOTA' && (h.data as any).text === 'N.I.')).toBe(true)
        // El directorio se liga aunque los nombres vengan distintos; los renglones repetidos suman teléfonos
        const daniel = plan.guardians.find(g => g.studentFull === 'RUIZ ZUNUN DANIEL')!
        expect([daniel.phone, daniel.alt1]).toEqual(['9615550103', '9615550104'])
        expect(plan.guardians.find(g => g.studentFull.startsWith('PEREZ'))?.alt1).toBe('9615550102')
        expect(plan.stats).toMatchObject({ students: 3, withGuardian: 2, phone1: 2, curp: 2 })
        expect(plan.groups[0].students.find(s => s.full === 'GOMEZ LARA LUIS')?.curp).toBe('GOLL100202HCSMRSA2')
        // Horario → jornada, materias con su docente y clases
        expect(plan.jornada).toMatchObject({ start: '07:00', end: '09:20', moduleMinutes: 50 })
        expect(plan.jornada?.breaks).toEqual([{ name: 'Receso', start_time: '08:00', end_time: '08:30' }])
        const tech = plan.subjects.find(s => s.catalogName === 'TECNOLOGÍA')!
        expect(tech.customName).toBe('Tecnología - Informática')
        expect(plan.staff.find(s => s.key === tech.teacherKey)?.full).toBe('LUIS MORA VEGA')
        expect(plan.classes).toHaveLength(4)
        const director = plan.staff.find(s => s.full === 'ROSA MARIA LOPEZ DIAZ')!
        expect(director).toMatchObject({ roleHint: 'DIRECTOR', jobTitle: 'Director(a)', inSchedule: true })
        expect(plan.cte.map(c => c.date)).toEqual(['2026-09-26', '2026-10-31'])
    })
})
