import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');

const originalFiles = [
    "20240205_add_description_to_criteria.sql",
    "20240205_create_criteria_catalog.sql",
    "20260205_group_subjects_assignment.sql",
    "20260208_analytical_program.sql",
    "20260209_add_cte_revision_tracking.sql",
    "20260209_apply_user_api_key.sql",
    "20260209_apply_user_api_key_v2.sql",
    "20260209_apply_user_api_key_v3.sql",
    "20260209_refactor_analytical_program_collective.sql",
    "20260209_refactor_analytical_program_unique.sql",
    "20260210_expand_analytical_program.sql",
    "20260211_add_academic_year_id_fix.sql",
    "20260211_zzz_fix_analytical_schema_full.sql",
    "20260212_add_attendance_subject.sql",
    "20260212_add_cycle_dates_to_school_details.sql",
    "20260212_add_instrument_to_assignments_final.sql",
    "20260212_add_pdf_columns.sql",
    "20260212_add_project_duration.sql",
    "20260212_add_project_purpose.sql",
    "20260212_add_proposal_persistence.sql",
    "20260212_add_school_logos.sql",
    "20260212_allow_duplicate_groups.sql",
    "20260212_close_trimester_schema.sql",
    "20260212_communication_system.sql",
    "20260212_create_school_assets_bucket.sql",
    "20260212_create_synthetic_catalog.sql",
    "20260212_enhance_incidents_schema.sql",
    "20260212_institutional_setup.sql",
    "20260212_seed_phase_6.sql",
    "20260212_seed_phases_1_2.sql",
    "20260212_seed_phases_3_4_5.sql",
    "20260212_smtp_settings.sql",
    "20260213_multi_role_support.sql",
    "20260213_staff_management.sql",
    "20260214_profile_setup_schema.sql",
    "create_calendar_tables.sql",
    "create_evaluation_config_schema.sql",
    "create_evaluation_schema.sql",
    "create_evidence_schema.sql",
    "create_formative_schema.sql",
    "create_planning_schema.sql",
    "create_rubric_schema.sql",
    "create_schedule_settings_table.sql",
    "create_schedules_table.sql",
    "create_soft_delete_system.sql",
    "create_tracking_schema.sql",
    "fix_assignments_error.sql",
    "fix_registration_trigger.sql",
    "fix_schema.sql",
    "setup_database.sql",
    "setup_phase1_5_onboarding.sql",
    "setup_phase1_6_subjects.sql",
    "setup_phase2.sql",
    "setup_phase2_fix.sql",
    "setup_phase3_students.sql",
    "update_assignments_schema.sql",
    "update_names_schema.sql",
    "update_rubrics_schema.sql"
];

const currentFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

// Sort both by name part to match them
const sortedOriginal = [...originalFiles].sort((a, b) => {
    let aName = a.replace(/^\d+_/, '');
    let bName = b.replace(/^\d+_/, '');
    return aName.localeCompare(bName);
});

const sortedCurrent = [...currentFiles].sort((a, b) => {
    let aName = a.replace(/^\d+_/, '');
    let bName = b.replace(/^\d+_/, '');
    return aName.localeCompare(bName);
});

// Rename back
sortedCurrent.forEach((file, index) => {
    const original = sortedOriginal[index];
    if (file !== original) {
        console.log(`Restoring: ${file} -> ${original}`);
        fs.renameSync(path.join(migrationsDir, file), path.join(migrationsDir, original));
    }
});

console.log("RESTORATION COMPLETE. Now fixing collisions...");

// Fix collisions specifically by using 14-digit timestamps for 20240205 and 20260212 etc.
const toFix = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
toFix.forEach(file => {
    const match = file.match(/^(\d{8})_/);
    if (match) {
        // Convert 8 digit prefix to 14 digits (prefix + index within that day)
        // This is just a simple way to make them unique without breaking the day-order
        // But wait, the remote DB has '20240205'. 
        // If I have two files with 20240205, one MUST match exactly '20240205'.
        // The other must be different.
    }
});
