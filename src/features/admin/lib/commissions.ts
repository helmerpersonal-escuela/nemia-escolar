/** Comisiones escolares: se nombran en el CTE intensivo de inicio de ciclo; cada docente debe estar en al menos una. */

export interface CommissionMember {
    profile_id?: string | null
    name: string
    /** Cargo dentro de la comisión (Presidente/a, Vocal…). */
    role: string
}
export interface Commission {
    id: string
    name: string
    school_year: string
    members: CommissionMember[]
}

/** Comisiones habituales en una secundaria; la escuela puede crear otras. */
export const SUGGESTED_COMMISSIONS = ['Técnico-pedagógica', 'Deporte', 'Higiene y salud', 'Jardinería', 'Protección civil', 'Sociocultural']

/** Cargos en orden jerárquico. No todas las comisiones usan todos (algunas solo responsable e integrantes). */
export const CARGOS = ['Presidente/a', 'Vicepresidente/a', 'Secretario/a', 'Tesorero/a', 'Vocal', 'Responsable', 'Integrante']

const key = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Posición del cargo para ordenar (los importados vienen en mayúsculas o con otra terminación: "SECRETARIA"). */
export function cargoRank(role: string): number {
    const k = key(role)
    const order = ['vicepresid', 'presid', 'secret', 'tesor', 'vocal', 'respons', 'integr']
    const rank = [1, 0, 2, 3, 4, 5, 6]
    const i = order.findIndex(prefix => k.startsWith(prefix))
    return i === -1 ? 7 : rank[i]
}

export const sortMembers = (members: CommissionMember[]) =>
    [...members].sort((a, b) => cargoRank(a.role) - cargoRank(b.role) || a.name.localeCompare(b.name, 'es'))

const samePerson = (m: CommissionMember, profileId: string, name: string) =>
    m.profile_id ? m.profile_id === profileId : key(m.name) === key(name)

/** Agrega a la persona o, si ya está en la comisión, le cambia el cargo. */
export function upsertMember(members: CommissionMember[], profileId: string, name: string, role: string): CommissionMember[] {
    const rest = members.filter(m => !samePerson(m, profileId, name))
    return sortMembers([...rest, { profile_id: profileId, name, role: role.trim() || 'Integrante' }])
}

export const removeMember = (members: CommissionMember[], profileId: string, name: string) =>
    members.filter(m => !samePerson(m, profileId, name))

/** Comisiones (con su cargo) de una persona. */
export function commissionsOf(commissions: Commission[], profileId: string, name: string): { commission: Commission; role: string }[] {
    return commissions.flatMap(c => {
        const m = c.members.find(x => samePerson(x, profileId, name))
        return m ? [{ commission: c, role: m.role }] : []
    })
}

/** Cargos que solo puede tener una persona por comisión y ya están ocupados por alguien más. */
export function takenUniqueCargo(commission: Commission, role: string, profileId: string, name: string): CommissionMember | null {
    if (!['Presidente/a', 'Vicepresidente/a', 'Secretario/a', 'Tesorero/a'].includes(role)) return null
    return commission.members.find(m => key(m.role) === key(role) && !samePerson(m, profileId, name)) ?? null
}
