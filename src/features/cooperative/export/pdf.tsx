import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import type { FormatModel, FormatTable } from '../lib/format'

const STATUS_TEXT: Record<string, string> = { BORRADOR: 'BORRADOR', ENVIADO: 'ENVIADO A REVISIÓN', CON_OBSERVACIONES: 'CON OBSERVACIONES', APROBADO: 'APROBADO' }

const s = StyleSheet.create({
    page: { paddingTop: 28, paddingBottom: 36, paddingHorizontal: 30, fontSize: 8, fontFamily: 'Helvetica', color: '#0f172a' },
    headerLine: { textAlign: 'center', fontSize: 7.5, fontFamily: 'Helvetica-Bold', lineHeight: 1.35 },
    title: { textAlign: 'center', fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 8 },
    subtitle: { textAlign: 'center', fontSize: 9, marginTop: 2, color: '#334155' },
    status: { position: 'absolute', top: 14, right: 30, fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#4f46e5', borderWidth: 1, borderColor: '#4f46e5', paddingVertical: 2, paddingHorizontal: 5, borderRadius: 3 },
    meta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 6 },
    metaItem: { width: '50%', flexDirection: 'row', paddingVertical: 1.5, paddingRight: 8 },
    metaLabel: { fontFamily: 'Helvetica-Bold', marginRight: 4, color: '#334155' },
    metaValue: { flex: 1, borderBottomWidth: 0.5, borderBottomColor: '#94a3b8' },
    tableTitle: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginTop: 10, marginBottom: 3 },
    table: { borderWidth: 0.75, borderColor: '#334155', marginTop: 4 },
    tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#94a3b8' },
    th: { backgroundColor: '#e2e8f0', fontFamily: 'Helvetica-Bold', fontSize: 7, padding: 3, borderRightWidth: 0.5, borderRightColor: '#94a3b8' },
    td: { fontSize: 7.5, padding: 3, borderRightWidth: 0.5, borderRightColor: '#cbd5e1' },
    tf: { fontFamily: 'Helvetica-Bold', backgroundColor: '#f1f5f9' },
    summary: { marginTop: 10, alignSelf: 'flex-end', width: '55%', borderWidth: 0.75, borderColor: '#334155' },
    summaryRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1', padding: 3 },
    notes: { marginTop: 8, fontSize: 7, color: '#475569' },
    sigs: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', marginTop: 34 },
    sig: { width: 150, alignItems: 'center', marginBottom: 26 },
    sigLine: { width: '100%', borderTopWidth: 0.75, borderTopColor: '#0f172a', paddingTop: 3, textAlign: 'center', fontSize: 7 },
    footer: { position: 'absolute', bottom: 16, left: 30, right: 30, fontSize: 6.5, color: '#94a3b8', flexDirection: 'row', justifyContent: 'space-between' },
})

const Table = ({ t }: { t: FormatTable }) => {
    const total = t.columns.reduce((a, c) => a + (c.width ?? 10), 0)
    const w = (i: number) => `${((t.columns[i].width ?? 10) / total) * 100}%`
    const align = (i: number) => t.columns[i].align ?? 'left'
    return (
        <View wrap>
            {t.title && <Text style={s.tableTitle}>{t.title.toUpperCase()}</Text>}
            <View style={s.table}>
                <View style={s.tr} fixed>
                    {t.columns.map((c, i) => <Text key={i} style={[s.th, { width: w(i), textAlign: align(i) }]}>{c.label.toUpperCase()}</Text>)}
                </View>
                {t.rows.length === 0 && (
                    <View style={s.tr}><Text style={[s.td, { width: '100%', textAlign: 'center', color: '#94a3b8' }]}>Sin registros</Text></View>
                )}
                {t.rows.map((r, ri) => (
                    <View key={ri} style={s.tr} wrap={false}>
                        {r.map((v, i) => <Text key={i} style={[s.td, { width: w(i), textAlign: align(i) }]}>{String(v ?? '')}</Text>)}
                    </View>
                ))}
                {t.footer && (
                    <View style={[s.tr, s.tf]} wrap={false}>
                        {t.footer.map((v, i) => <Text key={i} style={[s.td, s.tf, { width: w(i), textAlign: align(i) }]}>{String(v ?? '')}</Text>)}
                    </View>
                )}
            </View>
        </View>
    )
}

export const FormatPage = ({ model }: { model: FormatModel }) => (
    <Page size="LETTER" orientation={model.landscape ? 'landscape' : 'portrait'} style={s.page}>
        {model.status && model.status !== 'APROBADO' && <Text style={s.status} fixed>{STATUS_TEXT[model.status] ?? model.status}</Text>}
        {model.status === 'APROBADO' && <Text style={[s.status, { color: '#047857', borderColor: '#047857' }]} fixed>APROBADO</Text>}
        {model.headerLines.map((l, i) => <Text key={i} style={s.headerLine}>{l}</Text>)}
        <Text style={s.title}>{model.title}</Text>
        {model.subtitle && <Text style={s.subtitle}>{model.subtitle}</Text>}
        <View style={s.meta}>
            {model.meta.map(([k, v], i) => (
                <View key={i} style={s.metaItem}>
                    <Text style={s.metaLabel}>{k.toUpperCase()}:</Text>
                    <Text style={s.metaValue}>{v || ' '}</Text>
                </View>
            ))}
        </View>
        {model.tables.map((t, i) => <Table key={i} t={t} />)}
        {model.summary && model.summary.length > 0 && (
            <View style={s.summary} wrap={false}>
                {model.summary.map(([k, v], i) => (
                    <View key={i} style={s.summaryRow}>
                        <Text style={{ flex: 1, fontFamily: 'Helvetica-Bold' }}>{k}</Text>
                        <Text style={{ textAlign: 'right', maxWidth: '65%' }}>{v}</Text>
                    </View>
                ))}
            </View>
        )}
        {model.notes?.map((n, i) => <Text key={i} style={s.notes}>{n}</Text>)}
        <View style={s.sigs} wrap={false}>
            {model.signatures.map((sg, i) => (
                <View key={i} style={s.sig}>
                    <Text style={s.sigLine}>{sg}</Text>
                </View>
            ))}
        </View>
        <View style={s.footer} fixed>
            <Text>{model.title}</Text>
            <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages} · Generado con VUNLEK`} />
        </View>
    </Page>
)

export async function modelsToPdf(models: FormatModel[], title = 'Cooperativa escolar'): Promise<Blob> {
    return pdf(
        <Document title={title} author="VUNLEK" creator="VUNLEK">
            {models.map((m, i) => <FormatPage key={i} model={m} />)}
        </Document>
    ).toBlob()
}
