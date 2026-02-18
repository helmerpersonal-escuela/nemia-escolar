import { supabase } from '../lib/supabase';

/**
 * Exporta toda la información relevante de un usuario (tenant) a un archivo JSON descargable.
 * @param tenantId ID del tenant/usuario actual
 * @param fileName Nombre sugerido para el archivo
 */
export const exportUserData = async (tenantId: string, fileName = 'backup_escolar.json') => {
    try {
        const tablesToExport = [
            'students',
            'groups',
            'lesson_plans',
            'assignments',
            'grades',
            'attendance',
            'analytical_programs', // Si existe, intentamos
            'rubrics'
        ];

        const exportData: Record<string, any[]> = {};

        // Fetch data in parallel
        await Promise.all(tablesToExport.map(async (table) => {
            try {
                const { data, error } = await supabase
                    .from(table)
                    .select('*')
                    .eq('tenant_id', tenantId);

                if (!error && data) {
                    exportData[table] = data;
                } else {
                    console.warn(`Backup: Could not fetch table ${table}`, error);
                    exportData[table] = [];
                }
            } catch (e) {
                console.warn(`Backup: Skipped table ${table} due to error`, e);
                exportData[table] = [];
            }
        }));

        // Add metadata
        const meta = {
            exportDate: new Date().toISOString(),
            tenantId,
            version: '1.0',
            system: 'Vunlek'
        };

        const finalPayload = {
            meta,
            data: exportData
        };

        // Create Blob and Download
        const jsonString = JSON.stringify(finalPayload, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return { success: true, size: jsonString.length };
    } catch (error) {
        console.error('Backup failed:', error);
        throw error;
    }
};
