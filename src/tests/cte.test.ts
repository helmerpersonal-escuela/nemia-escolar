import { describe, expect, it } from 'vitest'
import {
    buildProposalPrompt, currentSchoolYear, parseProposal, pickNextSession, proposalToAgenda, todayISO,
    type ProposalContext,
} from '../features/cte/lib/cteApi'
import { extractOfficeText, slideXmlToText, wordXmlToText } from '../features/cte/lib/docText'

/** ZIP mínimo sin compresión (método 0) para probar la lectura de .docx/.pptx. */
function storedZip(files: Record<string, string>): ArrayBuffer {
    const enc = new TextEncoder()
    const locals: Uint8Array[] = []
    const centrals: Uint8Array[] = []
    let offset = 0
    for (const [name, content] of Object.entries(files)) {
        const n = enc.encode(name)
        const d = enc.encode(content)
        const local = new Uint8Array(30 + n.length + d.length)
        const lv = new DataView(local.buffer)
        lv.setUint32(0, 0x04034b50, true)
        lv.setUint16(8, 0, true)
        lv.setUint32(18, d.length, true)
        lv.setUint32(22, d.length, true)
        lv.setUint16(26, n.length, true)
        local.set(n, 30)
        local.set(d, 30 + n.length)
        const central = new Uint8Array(46 + n.length)
        const cv = new DataView(central.buffer)
        cv.setUint32(0, 0x02014b50, true)
        cv.setUint16(10, 0, true)
        cv.setUint32(20, d.length, true)
        cv.setUint32(24, d.length, true)
        cv.setUint16(28, n.length, true)
        cv.setUint32(42, offset, true)
        central.set(n, 46)
        locals.push(local)
        centrals.push(central)
        offset += local.length
    }
    const centralSize = centrals.reduce((a, c) => a + c.length, 0)
    const eocd = new Uint8Array(22)
    const ev = new DataView(eocd.buffer)
    ev.setUint32(0, 0x06054b50, true)
    ev.setUint16(8, centrals.length, true)
    ev.setUint16(10, centrals.length, true)
    ev.setUint32(12, centralSize, true)
    ev.setUint32(16, offset, true)
    const all = [...locals, ...centrals, eocd]
    const out = new Uint8Array(all.reduce((a, c) => a + c.length, 0))
    let p = 0
    for (const part of all) { out.set(part, p); p += part.length }
    return out.buffer
}

describe('CTE: utilidades', () => {
    it('calcula el ciclo escolar (agosto a julio)', () => {
        expect(currentSchoolYear(new Date(2026, 8, 25))).toBe('2026-2027')
        expect(currentSchoolYear(new Date(2027, 5, 25))).toBe('2026-2027')
        expect(currentSchoolYear(new Date(2027, 7, 1))).toBe('2027-2028')
    })

    it('usa la fecha local, no UTC', () => {
        expect(todayISO(new Date(2026, 8, 25, 23, 30))).toBe('2026-09-25')
    })

    it('elige la próxima sesión o la última si ya pasaron', () => {
        const s = [{ date: '2026-10-30' }, { date: '2026-09-25' }, { date: '2026-11-27' }]
        expect(pickNextSession(s, '2026-09-25')?.date).toBe('2026-09-25')
        expect(pickNextSession(s, '2026-09-26')?.date).toBe('2026-10-30')
        expect(pickNextSession(s, '2027-01-01')?.date).toBe('2026-11-27')
    })
})

describe('CTE: propuesta con IA', () => {
    const base: ProposalContext = {
        school: { name: 'EST 37', level: 'SECONDARY' },
        session: { date: '2026-10-30', session_type: 'ORDINARIA', session_number: 2, title: null, purpose: null },
        officialDocs: [{ title: 'Guía 2ª sesión', kind: 'GUIA_OFICIAL', extracted_text: 'A'.repeat(200_000) }],
        schoolDocs: [{ title: 'Diagnóstico', kind: 'DIAGNOSTICO', extracted_text: 'B'.repeat(100_000) }],
        agreements: [{ description: 'Revisar lectura', status: 'PENDIENTE', due_date: '2026-10-15', follow_up: null, responsible_label: 'Coordinación' }],
        previousMinutes: [{ label: '1ª sesión', minutes: 'Se acordó…' }],
        indicators: { resumen: { grupos: 6 } },
        pemc: { objectives: ['Mejorar comprensión lectora'], actions: [] },
    }

    it('respeta el tope de caracteres y conserva las instrucciones de salida', () => {
        const prompt = buildProposalPrompt(base, 52_000)
        expect(prompt.length).toBeLessThanOrEqual(52_000)
        expect(prompt).toContain('2ª sesión ordinaria')
        expect(prompt).toContain('Revisar lectura')
        expect(prompt).toContain('Guía 2ª sesión')
        expect(prompt.trim().endsWith('}')).toBe(true)
    })

    it('interpreta la respuesta JSON aunque venga con cercas de código', () => {
        const raw = '```json\n{"proposito":"Dar seguimiento","agenda":[{"hora":"08:00","tema":"Bienvenida","duracion_min":15},{"sin":"tema"}],"productos_esperados":["Acta"]}\n```'
        const p = parseProposal(raw)
        expect(p.proposito).toBe('Dar seguimiento')
        expect(p.agenda).toHaveLength(1)
        const agenda = proposalToAgenda(p)
        expect(agenda[0]).toMatchObject({ time: '08:00', topic: 'Bienvenida', duration: 15, status: 'pending' })
    })

    it('marca error si la IA no devuelve JSON', () => {
        expect(() => parseProposal('Lo siento')).toThrow()
    })
})

describe('CTE: texto de documentos', () => {
    it('convierte XML de Word y de PowerPoint en texto', () => {
        expect(wordXmlToText('<w:p><w:r><w:t>Hola &amp; adiós</w:t></w:r></w:p><w:p><w:t>Dos</w:t></w:p>')).toBe('Hola & adiós\nDos')
        expect(slideXmlToText('<a:p><a:t>Título</a:t></a:p><a:p><a:t>Punto</a:t></a:p>')).toBe('Título\nPunto')
    })

    it('lee un .docx y un .pptx (ZIP)', async () => {
        const docx = storedZip({ 'word/document.xml': '<w:body><w:p><w:t>Acuerdo 1</w:t></w:p></w:body>' })
        expect(await extractOfficeText(docx, 'docx')).toBe('Acuerdo 1')
        const pptx = storedZip({
            'ppt/slides/slide2.xml': '<a:p><a:t>Segunda</a:t></a:p>',
            'ppt/slides/slide1.xml': '<a:p><a:t>Primera</a:t></a:p>',
        })
        expect(await extractOfficeText(pptx, 'pptx')).toBe('Diapositiva 1:\nPrimera\n\nDiapositiva 2:\nSegunda')
    })
})
