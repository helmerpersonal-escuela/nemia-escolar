import type { Plan } from './consolidate'
import { normName } from './names'
import { phoneText } from './consolidate'
import { SECTION_LABEL, type SectionResult } from './apply'

const SEV = { error: 'Importante', warning: 'Revisar', info: 'Aviso' } as const

/** Excel para control escolar: avisos, alumnos sin teléfono y resultado de la importación. */
export async function downloadReport(plan: Plan, results?: SectionResult[]) {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const bold = (ws: import('exceljs').Worksheet) => { ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1 }] }

    if (results) {
        const ws = wb.addWorksheet('Resultado')
        ws.columns = [{ header: 'Sección', width: 32 }, { header: 'Nuevos', width: 10 }, { header: 'Actualizados', width: 14 }, { header: 'Sin cambio', width: 12 }, { header: 'Errores', width: 60 }]
        for (const r of results) ws.addRow([SECTION_LABEL[r.id], r.created, r.updated, r.skipped, r.errors.join(' | ')])
        bold(ws)
    }

    const wi = wb.addWorksheet('Avisos')
    wi.columns = [{ header: 'Tipo', width: 12 }, { header: 'Tema', width: 14 }, { header: 'Detalle', width: 100 }, { header: 'Archivo', width: 40 }]
    for (const i of plan.issues) wi.addRow([SEV[i.severity], i.area, i.message, i.source ?? ''])
    bold(wi)

    const wp = wb.addWorksheet('Faltan teléfonos')
    wp.columns = [{ header: 'Grupo', width: 8 }, { header: 'Alumno', width: 42 }, { header: 'Tutor', width: 36 }, { header: 'Principal', width: 14 }, { header: 'Respaldo 1', width: 14 }, { header: 'Respaldo 2', width: 14 }]
    const byStudent = new Map(plan.guardians.map(g => [`${g.groupKey}|${g.studentKey}`, g]))
    for (const grp of plan.groups) for (const s of grp.students) {
        const g = byStudent.get(`${grp.key}|${normName(s.full)}`)
        if (g?.phone && g.alt1 && g.alt2) continue
        wp.addRow([grp.key, s.full, g?.tutorFull ?? '', phoneText(g?.phone ?? null), phoneText(g?.alt1 ?? null), phoneText(g?.alt2 ?? null)])
    }
    bold(wp)

    const ws = wb.addWorksheet('Personal')
    ws.columns = [{ header: 'Nombre', width: 38 }, { header: 'Puesto sugerido', width: 22 }, { header: 'Materias', width: 36 }, { header: 'Grupos', width: 30 }, { header: 'Encargos', width: 50 }, { header: 'Correo (llenar)', width: 30 }]
    for (const s of plan.staff) ws.addRow([s.full, s.jobTitle ?? s.roleHint, s.subjects.join(', '), s.groups.join(', '), s.duties.join('; '), ''])
    bold(ws)

    const buf = await wb.xlsx.writeBuffer()
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    const a = document.createElement('a')
    a.href = url; a.download = `VUNLEK_importacion_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
}
