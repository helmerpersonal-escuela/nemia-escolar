import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'

// Register fonts if needed (optional, using default Helvetica for now)
Font.register({
    family: 'Inter',
    src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.ttf'
})

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Helvetica',
        fontSize: 10,
        lineHeight: 1.5,
        color: '#333'
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#f3f4f6',
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        textTransform: 'uppercase'
    },
    schoolInfo: {
        marginBottom: 20,
        backgroundColor: '#f9fafb',
        padding: 10,
        borderRadius: 4,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10
    },
    infoItem: {
        width: '30%',
        marginBottom: 5
    },
    label: {
        fontSize: 8,
        color: '#6b7280',
        textTransform: 'uppercase',
        fontWeight: 'bold'
    },
    value: {
        fontSize: 10,
        color: '#1f2937',
        fontWeight: 'bold'
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 10,
        color: '#4f46e5', // Indigo
        textTransform: 'uppercase',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        paddingBottom: 4
    },
    paragraph: {
        marginBottom: 10,
        textAlign: 'justify'
    },
    box: {
        marginBottom: 15,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 4
    },
    tag: {
        backgroundColor: '#e0e7ff',
        color: '#3730a3',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        fontSize: 8,
        marginRight: 4,
        marginBottom: 4
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 4
    },
    table: {
        width: '100%',
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        minHeight: 24,
        alignItems: 'center'
    },
    tableHeader: {
        backgroundColor: '#f3f4f6',
        fontWeight: 'bold',
        fontSize: 8,
        color: '#374151'
    },
    tableCell: {
        flex: 1,
        padding: 4,
        fontSize: 8,
        borderRightWidth: 1,
        borderRightColor: '#e5e7eb',
    },
    tableCellLast: {
        flex: 1,
        padding: 4,
        fontSize: 8,
        borderRightWidth: 0
    }
})

export const AnalyticalProgramPDF = ({ data }: { data: any }) => {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Programa Analítico</Text>
                        <Text style={{ fontSize: 10, color: '#6b7280' }}>Ciclo Escolar 2025-2026</Text>
                    </View>
                </View>

                {/* School Data */}
                <View style={styles.schoolInfo}>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>Escuela</Text>
                        <Text style={styles.value}>{data.school_data.name}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>CCT</Text>
                        <Text style={styles.value}>{data.school_data.cct}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>Zona/Sector</Text>
                        <Text style={styles.value}>{data.school_data.zone} / {data.school_data.sector}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>Nivel</Text>
                        <Text style={styles.value}>{data.school_data.level}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>Turno</Text>
                        <Text style={styles.value}>{data.school_data.turn}</Text>
                    </View>
                </View>

                {/* 1. Diagnosis */}
                <Text style={styles.sectionTitle}>1. Lectura de la Realidad (Diagnóstico)</Text>
                <View style={styles.box}>
                    <Text style={styles.paragraph}>{data.diagnosis.narrative_final || 'Sin narrativa generada.'}</Text>

                    <Text style={[styles.label, { marginTop: 10 }]}>Contexto Identificado:</Text>
                    <View style={styles.tagsContainer}>
                        {/* Render tags logic if needed, or rely on narrative */}
                        {data.diagnosis.external_context.geo.split(', ').filter(Boolean).map((t: string) => <Text key={t} style={styles.tag}>{t}</Text>)}
                        {data.diagnosis.external_context.social.split(', ').filter(Boolean).map((t: string) => <Text key={t} style={styles.tag}>{t}</Text>)}
                    </View>
                </View>

                {/* 2. Problem */}
                <Text style={styles.sectionTitle}>2. Contextualización de la Problemática</Text>
                {data.problems.map((prob: any, idx: number) => (
                    <View key={idx} style={styles.box}>
                        <Text style={styles.label}>Problemática Principal:</Text>
                        <Text style={[styles.value, { fontSize: 12, marginBottom: 8 }]}>{prob.description}</Text>

                        <View style={{ flexDirection: 'row', gap: 20 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Rasgo Perfil de Egreso:</Text>
                                <Text style={{ fontSize: 9 }}>{prob.trait_id}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Ejes Articuladores:</Text>
                                <View style={styles.tagsContainer}>
                                    {prob.axes_ids?.map((a: string) => <Text key={a} style={styles.tag}>{a}</Text>)}
                                </View>
                            </View>
                        </View>
                    </View>
                ))}

                {/* 3. Proceso de Codiseño (NUEVO) */}
                <Text style={styles.sectionTitle}>3. Proceso Colectivo de Codiseño</Text>

                {/* Simulated Dialogue */}
                <View style={[styles.box, { backgroundColor: '#f3f4f6', borderColor: '#d1d5db' }]}>
                    <Text style={[styles.label, { marginBottom: 10 }]}>Diálogo del Colectivo:</Text>
                    {data.codesign_process?.dialogue?.map((chat: any, idx: number) => (
                        <View key={idx} style={{ marginBottom: 8, borderLeftWidth: 2, borderLeftColor: chat.role === 'Director' ? '#4f46e5' : '#e11d48', paddingLeft: 8 }}>
                            <Text style={{ fontSize: 7, fontWeight: 'bold', color: chat.role === 'Director' ? '#4f46e5' : '#e11d48', textTransform: 'uppercase' }}>{chat.name}:</Text>
                            <Text style={{ fontSize: 9, fontStyle: 'italic' }}>"{chat.content}"</Text>
                        </View>
                    ))}
                </View>

                {/* Problematization Table */}
                <View style={styles.table}>
                    <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: '#1f2937' }]}>
                        <Text style={[styles.tableCell, { color: 'white', fontSize: 7 }]}>Programa Sintético</Text>
                        <Text style={[styles.tableCell, { color: 'white', fontSize: 7 }]}>Falta / No esta</Text>
                        <Text style={[styles.tableCell, { color: 'white', fontSize: 7 }]}>Certezas</Text>
                        <Text style={[styles.tableCell, { color: 'white', fontSize: 7 }]}>Causas/Consec.</Text>
                        <Text style={[styles.tableCellLast, { color: 'white', fontSize: 7 }]}>Aprendizaje</Text>
                    </View>
                    {data.codesign_process?.problematization_table?.map((row: any, idx: number) => (
                        <View key={idx} style={styles.tableRow}>
                            <Text style={styles.tableCell}>{row.synthesis_info}</Text>
                            <Text style={styles.tableCell}>{row.missing_info}</Text>
                            <Text style={styles.tableCell}>{row.certainties}</Text>
                            <Text style={styles.tableCell}>{row.causes}</Text>
                            <Text style={styles.tableCellLast}>{row.learning_goal}</Text>
                        </View>
                    ))}
                </View>

                {/* Reflexive Questions & Notes */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                    <View style={{ flex: 1, padding: 10, backgroundColor: '#f0fdf4', borderRadius: 4, borderWidth: 1, borderColor: '#bbf7d0' }}>
                        <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#15803d', marginBottom: 8, textTransform: 'uppercase' }}>Para Interiorizar:</Text>
                        {data.codesign_process?.reflexive_questions?.map((q: string, idx: number) => (
                            <View key={idx} style={{ flexDirection: 'row', gap: 5, marginBottom: 4 }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginTop: 2 }} />
                                <Text style={{ fontSize: 8, color: '#166534' }}>{q}</Text>
                            </View>
                        ))}
                    </View>
                    <View style={{ flex: 1, padding: 10, backgroundColor: '#fff1f2', borderRadius: 4, borderWidth: 1, borderColor: '#fecdd3' }}>
                        <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#be123c', marginBottom: 8, textTransform: 'uppercase' }}>Notas para el colectivo:</Text>
                        {data.codesign_process?.collective_notes?.map((note: string, idx: number) => (
                            <Text key={idx} style={{ fontSize: 8, color: '#9f1239', fontStyle: 'italic', marginBottom: 4 }}>• "{note}"</Text>
                        ))}
                    </View>
                </View>

                {/* 4. Codesign of Contents (Shifted to index 4) */}
                <Text style={styles.sectionTitle}>4. Codiseño de Contenidos (Plano Didáctico)</Text>

                {Object.entries(data.program_by_fields).map(([field, items]: any) => {
                    if (items.length === 0) return null
                    return (
                        <View key={field} style={{ marginBottom: 20 }}>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 5, color: '#374151', textTransform: 'capitalize' }}>
                                Campo Formativo: {field}
                            </Text>

                            <View style={styles.table}>
                                <View style={[styles.tableRow, styles.tableHeader]}>
                                    <Text style={[styles.tableCell, { flex: 2 }]}>Contenido</Text>
                                    <Text style={[styles.tableCell, { flex: 3 }]}>PDA</Text>
                                    <Text style={[styles.tableCell, { flex: 2 }]}>Metodología</Text>
                                    <Text style={[styles.tableCellLast, { flex: 2 }]}>Evaluación</Text>
                                </View>
                                {items.map((item: any, idx: number) => (
                                    <View key={idx} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { flex: 2 }]}>{item.contentName}</Text>
                                        <View style={[styles.tableCell, { flex: 3 }]}>
                                            <Text>{item.pda_grade_1}</Text>
                                            {item.pda_grade_2 && <Text style={{ marginTop: 4 }}>{item.pda_grade_2}</Text>}
                                            {item.pda_grade_3 && <Text style={{ marginTop: 4 }}>{item.pda_grade_3}</Text>}
                                        </View>
                                        <Text style={[styles.tableCell, { flex: 2 }]}>{item.methodology}</Text>
                                        <Text style={[styles.tableCellLast, { flex: 2 }]}>{item.evaluation}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )
                })}

                <Text style={{ position: 'absolute', bottom: 30, left: 40, fontSize: 8, color: '#9ca3af' }}>
                    Generado con Vunlek Escolar - {new Date().toLocaleDateString()}
                </Text>
            </Page>
        </Document>
    )
}
