import { describe, expect, it } from 'vitest'
import { commissionsOf, removeMember, sortMembers, takenUniqueCargo, upsertMember, type Commission } from './commissions'

const base: Commission = { id: 'c1', name: 'Protección civil', school_year: '2026-2027', members: [
    { profile_id: 'a', name: 'Ana Ruiz', role: 'Vocal' },
    { profile_id: 'b', name: 'Beto Díaz', role: 'Presidente/a' },
    { name: 'CARLA LÓPEZ', role: 'SECRETARIA' },   // importada de un documento: sin cuenta y en mayúsculas
] }

describe('comisiones escolares', () => {
    it('ordena por cargo: presidencia primero, vocales al final', () => {
        expect(sortMembers(base.members).map(m => m.name)).toEqual(['Beto Díaz', 'CARLA LÓPEZ', 'Ana Ruiz'])
    })

    it('agrega a una persona y, si ya estaba, solo le cambia el cargo', () => {
        const added = upsertMember(base.members, 'd', 'Dora Paz', 'Vicepresidente/a')
        expect(added.map(m => m.name)).toEqual(['Beto Díaz', 'Dora Paz', 'CARLA LÓPEZ', 'Ana Ruiz'])
        const changed = upsertMember(base.members, 'a', 'Ana Ruiz', 'Tesorero/a')
        expect(changed.filter(m => m.profile_id === 'a')).toEqual([{ profile_id: 'a', name: 'Ana Ruiz', role: 'Tesorero/a' }])
        expect(changed).toHaveLength(3)
    })

    it('reconoce por nombre a quien venía de un documento importado', () => {
        const linked = upsertMember(base.members, 'c', 'Carla López', 'Secretario/a')
        expect(linked).toHaveLength(3)
        expect(linked.find(m => m.profile_id === 'c')?.role).toBe('Secretario/a')
        expect(removeMember(base.members, 'c', 'Carla López')).toHaveLength(2)
    })

    it('lista las comisiones y el cargo de una persona', () => {
        expect(commissionsOf([base], 'b', 'Beto Díaz')).toEqual([{ commission: base, role: 'Presidente/a' }])
        expect(commissionsOf([base], 'z', 'Zoe')).toEqual([])
    })

    it('avisa si un cargo único ya lo tiene otra persona', () => {
        expect(takenUniqueCargo(base, 'Presidente/a', 'a', 'Ana Ruiz')?.name).toBe('Beto Díaz')
        expect(takenUniqueCargo(base, 'Presidente/a', 'b', 'Beto Díaz')).toBeNull()
        expect(takenUniqueCargo(base, 'Vocal', 'd', 'Dora Paz')).toBeNull()
    })
})
