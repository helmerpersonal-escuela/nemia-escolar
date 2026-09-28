import { describe, it, expect } from 'vitest'
import { filterSettlements, normalizeGeo } from '../lib/geoMx'
import estadosJson from '../../public/geo/estados.json'
import chiapasJson from '../../public/geo/07.json'

const files: Record<string, any> = { 'estados.json': estadosJson, '07.json': chiapasJson }
const geo = (f: string) => files[f]

describe('catálogo geográfico de México', () => {
    it('tiene los 32 estados con clave INEGI', () => {
        const { estados, tipos } = geo('estados.json')
        expect(estados).toHaveLength(32)
        expect(estados.find(([c]: string[]) => c === '07')?.[1]).toBe('Chiapas')
        expect(tipos).toContain('Colonia')
    })

    it('Chiapas incluye Tuxtla Gutiérrez y sus colonias con CP', () => {
        const chis = geo('07.json')
        const tuxtla = chis.m.find(([, n]: string[]) => n === 'Tuxtla Gutiérrez')
        expect(tuxtla?.[0]).toBe('101')
        const cols = chis.c['101']
        expect(cols.length).toBeGreaterThan(300)
        expect(cols.some(([n, cp]: string[]) => n === 'Albania Alta' && cp === '29010')).toBe(true)
    })

    it('busca colonias sin acentos, por inicio de palabra o por CP', () => {
        const list = [
            { name: 'Albania Alta', cp: '29010', type: 'Colonia' },
            { name: 'Burócrata', cp: '29010', type: 'Colonia' },
            { name: 'Terán', cp: '29050', type: 'Colonia' },
        ]
        expect(filterSettlements(list, 'burocrata').map(s => s.name)).toEqual(['Burócrata'])
        expect(filterSettlements(list, 'ran').map(s => s.name)).toEqual(['Terán'])
        expect(filterSettlements(list, '2905').map(s => s.name)).toEqual(['Terán'])
        expect(normalizeGeo('  Tuxtla   GUTIÉRREZ ')).toBe('tuxtla gutierrez')
    })
})
