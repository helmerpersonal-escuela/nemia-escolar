// Generado desde Supabase (proyecto VUNLEK). No editar a mano:
// regenerar con `npx supabase gen types typescript --project-id xgrwivblrrucucjhrmni > src/lib/database.types.ts`
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absence_plans: {
        Row: {
          activities: Json
          created_at: string
          end_date: string
          id: string
          profile_id: string
          reason: string | null
          start_date: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activities?: Json
          created_at?: string
          end_date: string
          id?: string
          profile_id: string
          reason?: string | null
          start_date: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activities?: Json
          created_at?: string
          end_date?: string
          id?: string
          profile_id?: string
          reason?: string | null
          start_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_plans_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_years: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean | null
          name: string
          start_date: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean | null
          name: string
          start_date: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean | null
          name?: string
          start_date?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          action: string
          chars: number | null
          created_at: string
          id: number
          provider: string | null
          user_id: string
        }
        Insert: {
          action: string
          chars?: number | null
          created_at?: string
          id?: never
          provider?: string | null
          user_id: string
        }
        Update: {
          action?: string
          chars?: number | null
          created_at?: string
          id?: never
          provider?: string | null
          user_id?: string
        }
        Relationships: []
      }
      analytical_program_contents: {
        Row: {
          campo_formativo: string
          content_id: string | null
          created_at: string | null
          custom_content: string | null
          ejes_articuladores: string[] | null
          id: string
          justification: string | null
          pda_ids: string[] | null
          program_id: string
          subject_id: string | null
          temporality: string | null
        }
        Insert: {
          campo_formativo: string
          content_id?: string | null
          created_at?: string | null
          custom_content?: string | null
          ejes_articuladores?: string[] | null
          id?: string
          justification?: string | null
          pda_ids?: string[] | null
          program_id: string
          subject_id?: string | null
          temporality?: string | null
        }
        Update: {
          campo_formativo?: string
          content_id?: string | null
          created_at?: string | null
          custom_content?: string | null
          ejes_articuladores?: string[] | null
          id?: string
          justification?: string | null
          pda_ids?: string[] | null
          program_id?: string
          subject_id?: string | null
          temporality?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytical_program_contents_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "synthetic_program_contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytical_program_contents_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "analytical_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytical_program_contents_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      analytical_programs: {
        Row: {
          academic_year_id: string
          created_at: string | null
          diagnosis_context: string | null
          evaluation_strategies: Json | null
          external_context: Json | null
          extracted_text: string | null
          group_diagnosis: Json | null
          id: string
          internal_context: Json | null
          last_cte_session: string | null
          national_strategies: Json | null
          pedagogical_strategies: Json | null
          problem_statements: Json | null
          program_by_fields: Json | null
          school_data: Json | null
          source_document_url: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          academic_year_id: string
          created_at?: string | null
          diagnosis_context?: string | null
          evaluation_strategies?: Json | null
          external_context?: Json | null
          extracted_text?: string | null
          group_diagnosis?: Json | null
          id?: string
          internal_context?: Json | null
          last_cte_session?: string | null
          national_strategies?: Json | null
          pedagogical_strategies?: Json | null
          problem_statements?: Json | null
          program_by_fields?: Json | null
          school_data?: Json | null
          source_document_url?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          academic_year_id?: string
          created_at?: string | null
          diagnosis_context?: string | null
          evaluation_strategies?: Json | null
          external_context?: Json | null
          extracted_text?: string | null
          group_diagnosis?: Json | null
          id?: string
          internal_context?: Json | null
          last_cte_session?: string | null
          national_strategies?: Json | null
          pedagogical_strategies?: Json | null
          problem_statements?: Json | null
          program_by_fields?: Json | null
          school_data?: Json | null
          source_document_url?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytical_programs_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytical_programs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_receipts: {
        Row: {
          announcement_id: string | null
          id: string
          profile_id: string | null
          read_at: string | null
        }
        Insert: {
          announcement_id?: string | null
          id?: string
          profile_id?: string | null
          read_at?: string | null
        }
        Update: {
          announcement_id?: string | null
          id?: string
          profile_id?: string | null
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_receipts_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "school_announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_receipts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          created_at: string | null
          criterion_id: string | null
          description: string | null
          due_date: string | null
          group_id: string
          id: string
          instrument_id: string | null
          lesson_plan_id: string | null
          start_date: string | null
          subject_id: string | null
          tenant_id: string
          title: string
          type: string
          updated_at: string | null
          weighting_percentage: number | null
        }
        Insert: {
          created_at?: string | null
          criterion_id?: string | null
          description?: string | null
          due_date?: string | null
          group_id: string
          id?: string
          instrument_id?: string | null
          lesson_plan_id?: string | null
          start_date?: string | null
          subject_id?: string | null
          tenant_id: string
          title: string
          type: string
          updated_at?: string | null
          weighting_percentage?: number | null
        }
        Update: {
          created_at?: string | null
          criterion_id?: string | null
          description?: string | null
          due_date?: string | null
          group_id?: string
          id?: string
          instrument_id?: string | null
          lesson_plan_id?: string | null
          start_date?: string | null
          subject_id?: string | null
          tenant_id?: string
          title?: string
          type?: string
          updated_at?: string | null
          weighting_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "evaluation_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          created_at: string | null
          date: string
          group_id: string
          id: string
          notes: string | null
          status: string
          student_id: string
          subject_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          group_id: string
          id?: string
          notes?: string | null
          status: string
          student_id: string
          subject_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          group_id?: string
          id?: string
          notes?: string | null
          status?: string
          student_id?: string
          subject_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      behavioral_contracts: {
        Row: {
          content: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          signed: boolean | null
          student_id: string
          tenant_id: string
          type: string
          valid_until: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          signed?: boolean | null
          student_id: string
          tenant_id: string
          type: string
          valid_until?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          signed?: boolean | null
          student_id?: string
          tenant_id?: string
          type?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "behavioral_contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavioral_contracts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavioral_contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          id: string
          is_direction: boolean | null
          is_official_sep: boolean
          start_date: string
          tenant_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          is_direction?: boolean | null
          is_official_sep?: boolean
          start_date: string
          tenant_id: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          is_direction?: boolean | null
          is_official_sep?: boolean
          start_date?: string
          tenant_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          room_id: string | null
          sender_id: string | null
          type: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          room_id?: string | null
          sender_id?: string | null
          type?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          room_id?: string | null
          sender_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          id: string
          last_read_at: string | null
          profile_id: string | null
          role: string | null
          room_id: string | null
        }
        Insert: {
          id?: string
          last_read_at?: string | null
          profile_id?: string | null
          role?: string | null
          room_id?: string | null
        }
        Update: {
          id?: string
          last_read_at?: string | null
          profile_id?: string | null
          role?: string | null
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_permissions: {
        Row: {
          can_view_all_users: boolean | null
          can_view_staff: boolean | null
          can_view_students: boolean | null
          can_view_teachers: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          profile_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          can_view_all_users?: boolean | null
          can_view_staff?: boolean | null
          can_view_students?: boolean | null
          can_view_teachers?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          profile_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          can_view_all_users?: boolean | null
          can_view_staff?: boolean | null
          can_view_students?: boolean | null
          can_view_teachers?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          profile_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reactions: {
        Row: {
          id: string
          message_id: string | null
          profile_id: string | null
          reaction: string
        }
        Insert: {
          id?: string
          message_id?: string | null
          profile_id?: string | null
          reaction: string
        }
        Update: {
          id?: string
          message_id?: string | null
          profile_id?: string | null
          reaction?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string | null
          id: string
          name: string | null
          tenant_id: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string | null
          tenant_id?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string | null
          tenant_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      class_plans: {
        Row: {
          ai_generated_content: Json
          class_date: string
          created_at: string | null
          duration_or_module: string | null
          group_id: string
          id: string
          lesson_plan_id: string | null
          subject_id: string | null
          teacher_reflection: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          ai_generated_content?: Json
          class_date: string
          created_at?: string | null
          duration_or_module?: string | null
          group_id: string
          id?: string
          lesson_plan_id?: string | null
          subject_id?: string | null
          teacher_reflection?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          ai_generated_content?: Json
          class_date?: string
          created_at?: string | null
          duration_or_module?: string | null
          group_id?: string
          id?: string
          lesson_plan_id?: string | null
          subject_id?: string | null
          teacher_reflection?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_plans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_plans_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_plans_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "group_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dropout_risk_cases: {
        Row: {
          detected_at: string | null
          id: string
          intervention_plan: string | null
          last_update: string | null
          risk_factors: Json | null
          status: string | null
          student_id: string
          tenant_id: string
        }
        Insert: {
          detected_at?: string | null
          id?: string
          intervention_plan?: string | null
          last_update?: string | null
          risk_factors?: Json | null
          status?: string | null
          student_id: string
          tenant_id: string
        }
        Update: {
          detected_at?: string | null
          id?: string
          intervention_plan?: string | null
          last_update?: string | null
          risk_factors?: Json | null
          status?: string | null
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dropout_risk_cases_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dropout_risk_cases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_criteria: {
        Row: {
          created_at: string | null
          description: string | null
          group_id: string
          id: string
          name: string
          percentage: number
          period_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          group_id: string
          id?: string
          name: string
          percentage: number
          period_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          group_id?: string
          id?: string
          name?: string
          percentage?: number
          period_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_criteria_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_criteria_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "evaluation_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_criteria_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_criteria_catalog: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_criteria_catalog_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_periods: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          is_active: boolean | null
          is_closed: boolean | null
          name: string
          start_date: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          is_active?: boolean | null
          is_closed?: boolean | null
          name: string
          start_date: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          is_closed?: boolean | null
          name?: string
          start_date?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_periods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_snapshots: {
        Row: {
          academic_year_id: string | null
          breakdown: Json | null
          created_at: string | null
          final_score: number
          group_id: string
          id: string
          period_id: string | null
          stats: Json | null
          status: string | null
          student_id: string
          subject_id: string | null
          tenant_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          academic_year_id?: string | null
          breakdown?: Json | null
          created_at?: string | null
          final_score?: number
          group_id: string
          id?: string
          period_id?: string | null
          stats?: Json | null
          status?: string | null
          student_id: string
          subject_id?: string | null
          tenant_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          academic_year_id?: string | null
          breakdown?: Json | null
          created_at?: string | null
          final_score?: number
          group_id?: string
          id?: string
          period_id?: string | null
          stats?: Json | null
          status?: string | null
          student_id?: string
          subject_id?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_snapshots_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_snapshots_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_snapshots_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "evaluation_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_snapshots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_snapshots_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_portfolio: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          file_type: string | null
          file_url: string
          id: string
          student_id: string
          teacher_id: string | null
          tenant_id: string | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          student_id: string
          teacher_id?: string | null
          tenant_id?: string | null
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          student_id?: string
          teacher_id?: string | null
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_portfolio_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_portfolio_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_portfolio_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      formative_records: {
        Row: {
          content: Json
          created_at: string | null
          group_id: string
          id: string
          observation_date: string
          student_id: string | null
          tenant_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          content: Json
          created_at?: string | null
          group_id: string
          id?: string
          observation_date?: string
          student_id?: string | null
          tenant_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          group_id?: string
          id?: string
          observation_date?: string
          student_id?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formative_records_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formative_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formative_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          assignment_id: string
          created_at: string | null
          feedback: string | null
          graded_at: string | null
          id: string
          is_graded: boolean | null
          score: number | null
          student_id: string
          tenant_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string | null
          feedback?: string | null
          graded_at?: string | null
          id?: string
          is_graded?: boolean | null
          score?: number | null
          student_id: string
          tenant_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string | null
          feedback?: string | null
          graded_at?: string | null
          id?: string
          is_graded?: boolean | null
          score?: number | null
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_subjects: {
        Row: {
          created_at: string
          custom_name: string | null
          group_id: string
          id: string
          subject_catalog_id: string | null
          teacher_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          custom_name?: string | null
          group_id: string
          id?: string
          subject_catalog_id?: string | null
          teacher_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          custom_name?: string | null
          group_id?: string
          id?: string
          subject_catalog_id?: string | null
          teacher_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_subjects_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_subjects_subject_catalog_id_fkey"
            columns: ["subject_catalog_id"]
            isOneToOne: false
            referencedRelation: "subject_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_subjects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          academic_year_id: string | null
          created_at: string
          grade: string
          id: string
          section: string
          shift: string | null
          tenant_id: string
        }
        Insert: {
          academic_year_id?: string | null
          created_at?: string
          grade: string
          id?: string
          section: string
          shift?: string | null
          tenant_id: string
        }
        Update: {
          academic_year_id?: string | null
          created_at?: string
          grade?: string
          id?: string
          section?: string
          shift?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name_maternal: string | null
          last_name_paternal: string
          occupation: string | null
          phone: string | null
          profile_id: string | null
          relationship: string
          student_id: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name_maternal?: string | null
          last_name_paternal: string
          occupation?: string | null
          phone?: string | null
          profile_id?: string | null
          relationship: string
          student_id: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name_maternal?: string | null
          last_name_paternal?: string
          occupation?: string | null
          phone?: string | null
          profile_id?: string | null
          relationship?: string
          student_id?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardians_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardians_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plan_templates: {
        Row: {
          activities_sequence: Json | null
          campo_formativo: string | null
          created_at: string
          educational_level: string
          grade: number
          id: string
          metodologia: string | null
          pda: string[] | null
          purpose: string | null
          subject_name: string | null
          title: string
        }
        Insert: {
          activities_sequence?: Json | null
          campo_formativo?: string | null
          created_at?: string
          educational_level: string
          grade: number
          id?: string
          metodologia?: string | null
          pda?: string[] | null
          purpose?: string | null
          subject_name?: string | null
          title: string
        }
        Update: {
          activities_sequence?: Json | null
          campo_formativo?: string | null
          created_at?: string
          educational_level?: string
          grade?: number
          id?: string
          metodologia?: string | null
          pda?: string[] | null
          purpose?: string | null
          subject_name?: string | null
          title?: string
        }
        Relationships: []
      }
      lesson_plans: {
        Row: {
          activities_sequence: Json | null
          campo_formativo: string | null
          contents: Json | null
          created_at: string | null
          ejes_articuladores: Json | null
          end_date: string | null
          evaluation_plan: Json | null
          extracted_text: string | null
          group_id: string
          id: string
          metodologia: string | null
          objectives: Json | null
          pda: Json | null
          period_id: string | null
          problem_context: string | null
          project_duration: number | null
          purpose: string | null
          resources: string[] | null
          source_document_url: string | null
          start_date: string | null
          status: string | null
          subject_id: string | null
          temporality: string | null
          tenant_id: string
          textbook_id: string | null
          textbook_pages_from: string | null
          textbook_pages_to: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          activities_sequence?: Json | null
          campo_formativo?: string | null
          contents?: Json | null
          created_at?: string | null
          ejes_articuladores?: Json | null
          end_date?: string | null
          evaluation_plan?: Json | null
          extracted_text?: string | null
          group_id: string
          id?: string
          metodologia?: string | null
          objectives?: Json | null
          pda?: Json | null
          period_id?: string | null
          problem_context?: string | null
          project_duration?: number | null
          purpose?: string | null
          resources?: string[] | null
          source_document_url?: string | null
          start_date?: string | null
          status?: string | null
          subject_id?: string | null
          temporality?: string | null
          tenant_id: string
          textbook_id?: string | null
          textbook_pages_from?: string | null
          textbook_pages_to?: string | null
          title?: string
          updated_at?: string | null
        }
        Update: {
          activities_sequence?: Json | null
          campo_formativo?: string | null
          contents?: Json | null
          created_at?: string | null
          ejes_articuladores?: Json | null
          end_date?: string | null
          evaluation_plan?: Json | null
          extracted_text?: string | null
          group_id?: string
          id?: string
          metodologia?: string | null
          objectives?: Json | null
          pda?: Json | null
          period_id?: string | null
          problem_context?: string | null
          project_duration?: number | null
          purpose?: string | null
          resources?: string[] | null
          source_document_url?: string | null
          start_date?: string | null
          status?: string | null
          subject_id?: string | null
          temporality?: string | null
          tenant_id?: string
          textbook_id?: string | null
          textbook_pages_from?: string | null
          textbook_pages_to?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "evaluation_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_textbook_id_fkey"
            columns: ["textbook_id"]
            isOneToOne: false
            referencedRelation: "textbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      license_keys: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          duration_days: number
          expires_at: string | null
          id: string
          plan_type: string
          redeemed_at: string | null
          redeemed_by: string | null
          status: string
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          duration_days?: number
          expires_at?: string | null
          id?: string
          plan_type: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          duration_days?: number
          expires_at?: string | null
          id?: string
          plan_type?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      license_limits: {
        Row: {
          created_at: string | null
          id: string
          max_groups: number
          max_students_per_group: number
          plan_type: string
          price_annual: number
          trial_days: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_groups: number
          max_students_per_group: number
          plan_type: string
          price_annual: number
          trial_days?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_groups?: number
          max_students_per_group?: number
          plan_type?: string
          price_annual?: number
          trial_days?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      licenses: {
        Row: {
          created_at: string | null
          ends_at: string | null
          features: Json | null
          id: string
          plan_type: string
          starts_at: string | null
          status: string
          tenant_id: string | null
          transaction_id: string | null
        }
        Insert: {
          created_at?: string | null
          ends_at?: string | null
          features?: Json | null
          id?: string
          plan_type: string
          starts_at?: string | null
          status?: string
          tenant_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          created_at?: string | null
          ends_at?: string | null
          features?: Json | null
          id?: string
          plan_type?: string
          starts_at?: string | null
          status?: string
          tenant_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nem_document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string
          embedding: string | null
          id: string
          page_number: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          document_id: string
          embedding?: string | null
          id?: string
          page_number?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string
          embedding?: string | null
          id?: string
          page_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nem_document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "nem_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      nem_documents: {
        Row: {
          created_at: string | null
          file_size_bytes: number | null
          file_url: string
          id: string
          metadata: Json | null
          original_filename: string
          title: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_size_bytes?: number | null
          file_url: string
          id?: string
          metadata?: Json | null
          original_filename: string
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          metadata?: Json | null
          original_filename?: string
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nem_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          meta: Json | null
          provider: string
          provider_payment_id: string | null
          status: string
          subscription_id: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          meta?: Json | null
          provider?: string
          provider_payment_id?: string | null
          status: string
          subscription_id?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          meta?: Json | null
          provider?: string
          provider_payment_id?: string | null
          status?: string
          subscription_id?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "view_god_mode_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pemc_actions: {
        Row: {
          created_at: string | null
          deadline: string | null
          description: string
          id: string
          objective_id: string | null
          resources: string | null
          responsible_profile_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          deadline?: string | null
          description: string
          id?: string
          objective_id?: string | null
          resources?: string | null
          responsible_profile_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          deadline?: string | null
          description?: string
          id?: string
          objective_id?: string | null
          resources?: string | null
          responsible_profile_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pemc_actions_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "pemc_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pemc_actions_responsible_profile_id_fkey"
            columns: ["responsible_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pemc_cycles: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_year: number
          id: string
          is_active: boolean | null
          name: string
          start_year: number
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_year: number
          id?: string
          is_active?: boolean | null
          name: string
          start_year: number
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_year?: number
          id?: string
          is_active?: boolean | null
          name?: string
          start_year?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pemc_cycles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pemc_cycles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pemc_diagnosis: {
        Row: {
          content: string | null
          cycle_id: string | null
          evidence_urls: Json | null
          field_name: string
          id: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          cycle_id?: string | null
          evidence_urls?: Json | null
          field_name: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          cycle_id?: string | null
          evidence_urls?: Json | null
          field_name?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pemc_diagnosis_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "pemc_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      pemc_monitoring: {
        Row: {
          action_id: string | null
          comment: string | null
          created_at: string | null
          id: string
          progress_percentage: number | null
        }
        Insert: {
          action_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          progress_percentage?: number | null
        }
        Update: {
          action_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          progress_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pemc_monitoring_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "pemc_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pemc_objectives: {
        Row: {
          created_at: string | null
          cycle_id: string | null
          description: string
          goal: string | null
          id: string
          is_completed: boolean | null
        }
        Insert: {
          created_at?: string | null
          cycle_id?: string | null
          description: string
          goal?: string | null
          id?: string
          is_completed?: boolean | null
        }
        Update: {
          created_at?: string | null
          cycle_id?: string | null
          description?: string
          goal?: string | null
          id?: string
          is_completed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pemc_objectives_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "pemc_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_roles: {
        Row: {
          id: string
          profile_id: string | null
          role: string
        }
        Insert: {
          id?: string
          profile_id?: string | null
          role: string
        }
        Update: {
          id?: string
          profile_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_subjects: {
        Row: {
          created_at: string
          custom_detail: string | null
          id: string
          profile_id: string
          subject_catalog_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          custom_detail?: string | null
          id?: string
          profile_id: string
          subject_catalog_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          custom_detail?: string | null
          id?: string
          profile_id?: string
          subject_catalog_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_subjects_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_subjects_subject_catalog_id_fkey"
            columns: ["subject_catalog_id"]
            isOneToOne: false
            referencedRelation: "subject_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_subjects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_tenants: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          first_name: string | null
          is_default: boolean | null
          last_name_maternal: string | null
          last_name_paternal: string | null
          profile_id: string
          role: string
          tenant_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          first_name?: string | null
          is_default?: boolean | null
          last_name_maternal?: string | null
          last_name_paternal?: string | null
          profile_id: string
          role: string
          tenant_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          first_name?: string | null
          is_default?: boolean | null
          last_name_maternal?: string | null
          last_name_paternal?: string | null
          profile_id?: string
          role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_tenants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_particular: string | null
          advisory_group_id: string | null
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          curp: string | null
          deleted_at: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name_maternal: string | null
          last_name_paternal: string | null
          last_tenant_id: string | null
          marital_status: string | null
          nationality: string | null
          phone_contact: string | null
          profile_setup_completed: boolean | null
          rfc: string | null
          role: string
          sex: string | null
          tenant_id: string | null
          work_start_time: string | null
        }
        Insert: {
          address_particular?: string | null
          advisory_group_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          curp?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name_maternal?: string | null
          last_name_paternal?: string | null
          last_tenant_id?: string | null
          marital_status?: string | null
          nationality?: string | null
          phone_contact?: string | null
          profile_setup_completed?: boolean | null
          rfc?: string | null
          role: string
          sex?: string | null
          tenant_id?: string | null
          work_start_time?: string | null
        }
        Update: {
          address_particular?: string | null
          advisory_group_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          curp?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name_maternal?: string | null
          last_name_paternal?: string | null
          last_tenant_id?: string | null
          marital_status?: string | null
          nationality?: string | null
          phone_contact?: string | null
          profile_setup_completed?: boolean | null
          rfc?: string | null
          role?: string
          sex?: string | null
          tenant_id?: string | null
          work_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_advisory_group_id_fkey"
            columns: ["advisory_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_last_tenant_id_fkey"
            columns: ["last_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_criteria: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          order_index: number
          rubric_id: string
          title: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          order_index?: number
          rubric_id: string
          title: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          order_index?: number
          rubric_id?: string
          title?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rubric_criteria_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_descriptors: {
        Row: {
          created_at: string | null
          criterion_id: string
          description: string | null
          id: string
          level_id: string
        }
        Insert: {
          created_at?: string | null
          criterion_id: string
          description?: string | null
          id?: string
          level_id: string
        }
        Update: {
          created_at?: string | null
          criterion_id?: string
          description?: string | null
          id?: string
          level_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubric_descriptors_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "rubric_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_descriptors_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "rubric_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_levels: {
        Row: {
          created_at: string | null
          id: string
          order_index: number
          rubric_id: string
          score: number
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_index?: number
          rubric_id: string
          score: number
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          order_index?: number
          rubric_id?: string
          score?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubric_levels_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      rubrics: {
        Row: {
          content: Json | null
          created_at: string | null
          description: string | null
          id: string
          is_ai_generated: boolean | null
          is_public: boolean | null
          original_prompt: string | null
          tenant_id: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_public?: boolean | null
          original_prompt?: string | null
          tenant_id: string
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_public?: boolean | null
          original_prompt?: string | null
          tenant_id?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rubrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_settings: {
        Row: {
          breaks: Json | null
          created_at: string
          end_time: string
          id: string
          module_duration: number
          start_time: string
          tenant_id: string
        }
        Insert: {
          breaks?: Json | null
          created_at?: string
          end_time?: string
          id?: string
          module_duration?: number
          start_time?: string
          tenant_id: string
        }
        Update: {
          breaks?: Json | null
          created_at?: string
          end_time?: string
          id?: string
          module_duration?: number
          start_time?: string
          tenant_id?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          created_at: string
          custom_subject: string | null
          day_of_week: string
          end_time: string
          group_id: string
          id: string
          start_time: string
          subject_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          custom_subject?: string | null
          day_of_week: string
          end_time: string
          group_id: string
          id?: string
          start_time: string
          subject_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          custom_subject?: string | null
          day_of_week?: string
          end_time?: string
          group_id?: string
          id?: string
          start_time?: string
          subject_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      school_announcements: {
        Row: {
          content: string
          created_at: string | null
          id: string
          send_email: boolean | null
          sender_id: string | null
          target_groups: string[] | null
          target_roles: string[] | null
          tenant_id: string | null
          title: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          send_email?: boolean | null
          sender_id?: string | null
          target_groups?: string[] | null
          target_roles?: string[] | null
          tenant_id?: string | null
          title: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          send_email?: boolean | null
          sender_id?: string | null
          target_groups?: string[] | null
          target_roles?: string[] | null
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_announcements_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_announcements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      school_details: {
        Row: {
          address_municipality: string | null
          address_neighborhood: string | null
          address_state: string | null
          address_street: string | null
          address_zip_code: string | null
          cct: string
          cte_config: Json | null
          current_cycle_end: string | null
          current_cycle_start: string | null
          curriculum_plan: string | null
          digital_seal_url: string | null
          director_curp: string | null
          director_name: string | null
          educational_level: string | null
          email: string | null
          header_logo_url: string | null
          logo_url: string | null
          official_name: string
          phone: string | null
          regime: string | null
          sector: string | null
          shift: string | null
          social_media: Json | null
          tenant_id: string
          updated_at: string | null
          workshops: string[] | null
          zone: string | null
        }
        Insert: {
          address_municipality?: string | null
          address_neighborhood?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          cct: string
          cte_config?: Json | null
          current_cycle_end?: string | null
          current_cycle_start?: string | null
          curriculum_plan?: string | null
          digital_seal_url?: string | null
          director_curp?: string | null
          director_name?: string | null
          educational_level?: string | null
          email?: string | null
          header_logo_url?: string | null
          logo_url?: string | null
          official_name: string
          phone?: string | null
          regime?: string | null
          sector?: string | null
          shift?: string | null
          social_media?: Json | null
          tenant_id: string
          updated_at?: string | null
          workshops?: string[] | null
          zone?: string | null
        }
        Update: {
          address_municipality?: string | null
          address_neighborhood?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          cct?: string
          cte_config?: Json | null
          current_cycle_end?: string | null
          current_cycle_start?: string | null
          curriculum_plan?: string | null
          digital_seal_url?: string | null
          director_curp?: string | null
          director_name?: string | null
          educational_level?: string | null
          email?: string | null
          header_logo_url?: string | null
          logo_url?: string | null
          official_name?: string
          phone?: string | null
          regime?: string | null
          sector?: string | null
          shift?: string | null
          social_media?: Json | null
          tenant_id?: string
          updated_at?: string | null
          workshops?: string[] | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_details_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      special_schedule_structure: {
        Row: {
          breaks: Json | null
          created_at: string
          end_time: string
          id: string
          module_duration: number
          name: string
          start_time: string
          target_date: string
          tenant_id: string
        }
        Insert: {
          breaks?: Json | null
          created_at?: string
          end_time: string
          id?: string
          module_duration: number
          name: string
          start_time: string
          target_date: string
          tenant_id: string
        }
        Update: {
          breaks?: Json | null
          created_at?: string
          end_time?: string
          id?: string
          module_duration?: number
          name?: string
          start_time?: string
          target_date?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_schedule_structure_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          date: string | null
          id: string
          notes: string | null
          profile_id: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          date?: string | null
          id?: string
          notes?: string | null
          profile_id?: string | null
          status: string
          tenant_id?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          date?: string | null
          id?: string
          notes?: string | null
          profile_id?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_commissions: {
        Row: {
          academic_year_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          profile_id: string | null
          tenant_id: string | null
        }
        Insert: {
          academic_year_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          profile_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          academic_year_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          profile_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_commissions_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_commissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_commissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          expires_at: string | null
          id: string
          role: string
          status: string | null
          tenant_id: string | null
          token: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          expires_at?: string | null
          id?: string
          role: string
          status?: string | null
          tenant_id?: string | null
          token?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          role?: string
          status?: string | null
          tenant_id?: string | null
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permits: {
        Row: {
          created_at: string | null
          end_date: string
          evidence_url: string | null
          id: string
          profile_id: string | null
          reason: string
          start_date: string
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          evidence_url?: string | null
          id?: string
          profile_id?: string | null
          reason: string
          start_date: string
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          evidence_url?: string | null
          id?: string
          profile_id?: string | null
          reason?: string
          start_date?: string
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_permits_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_permits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_alerts: {
        Row: {
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          read_at: string | null
          student_id: string
          tenant_id: string
          title: string
          tutor_id: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read_at?: string | null
          student_id: string
          tenant_id: string
          title: string
          tutor_id: string
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read_at?: string | null
          student_id?: string
          tenant_id?: string
          title?: string
          tutor_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_alerts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_alerts_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_bap_records: {
        Row: {
          adjustments: Json | null
          barrier_type: string | null
          created_at: string | null
          diagnosis: string | null
          follow_up_notes: string | null
          id: string
          student_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          adjustments?: Json | null
          barrier_type?: string | null
          created_at?: string | null
          diagnosis?: string | null
          follow_up_notes?: string | null
          id?: string
          student_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          adjustments?: Json | null
          barrier_type?: string | null
          created_at?: string | null
          diagnosis?: string | null
          follow_up_notes?: string | null
          id?: string
          student_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_bap_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_bap_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_citations: {
        Row: {
          created_at: string | null
          id: string
          incident_id: string | null
          meeting_date: string
          meeting_time: string
          notes: string | null
          reason: string
          requested_by: string | null
          status: string | null
          student_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          incident_id?: string | null
          meeting_date: string
          meeting_time: string
          notes?: string | null
          reason: string
          requested_by?: string | null
          status?: string | null
          student_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          incident_id?: string | null
          meeting_date?: string
          meeting_time?: string
          notes?: string | null
          reason?: string
          requested_by?: string | null
          status?: string | null
          student_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_citations_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "student_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_citations_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_citations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_citations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_incidents: {
        Row: {
          action_taken: string | null
          commitment_description: string | null
          created_at: string | null
          description: string
          has_commitment: boolean | null
          id: string
          is_private: boolean | null
          severity: string
          status: string | null
          student_id: string
          teacher_id: string | null
          tenant_id: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          action_taken?: string | null
          commitment_description?: string | null
          created_at?: string | null
          description: string
          has_commitment?: boolean | null
          id?: string
          is_private?: boolean | null
          severity: string
          status?: string | null
          student_id: string
          teacher_id?: string | null
          tenant_id: string
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          action_taken?: string | null
          commitment_description?: string | null
          created_at?: string | null
          description?: string
          has_commitment?: boolean | null
          id?: string
          is_private?: boolean | null
          severity?: string
          status?: string | null
          student_id?: string
          teacher_id?: string | null
          tenant_id?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_incidents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_incidents_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_incidents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_tracking: {
        Row: {
          agreements: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          severity: string | null
          status: string
          student_id: string
          tenant_id: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          agreements?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          severity?: string | null
          status?: string
          student_id: string
          tenant_id: string
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          agreements?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          severity?: string | null
          status?: string
          student_id?: string
          tenant_id?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_tracking_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_tracking_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_tracking_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          allergies: string | null
          birth_date: string | null
          blood_type: string | null
          condition: string | null
          condition_details: string | null
          created_at: string
          curp: string | null
          email: string | null
          fingerprint_data: string | null
          first_name: string
          gender: string | null
          group_id: string | null
          id: string
          last_name_maternal: string | null
          last_name_paternal: string
          phone: string | null
          photo_url: string | null
          status: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          birth_date?: string | null
          blood_type?: string | null
          condition?: string | null
          condition_details?: string | null
          created_at?: string
          curp?: string | null
          email?: string | null
          fingerprint_data?: string | null
          first_name: string
          gender?: string | null
          group_id?: string | null
          id?: string
          last_name_maternal?: string | null
          last_name_paternal: string
          phone?: string | null
          photo_url?: string | null
          status?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          allergies?: string | null
          birth_date?: string | null
          blood_type?: string | null
          condition?: string | null
          condition_details?: string | null
          created_at?: string
          curp?: string | null
          email?: string | null
          fingerprint_data?: string | null
          first_name?: string
          gender?: string | null
          group_id?: string | null
          id?: string
          last_name_maternal?: string | null
          last_name_paternal?: string
          phone?: string | null
          photo_url?: string | null
          status?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_catalog: {
        Row: {
          created_at: string
          educational_level: string
          field_of_study: string
          id: string
          name: string
          requires_specification: boolean | null
        }
        Insert: {
          created_at?: string
          educational_level: string
          field_of_study: string
          id?: string
          name: string
          requires_specification?: boolean | null
        }
        Update: {
          created_at?: string
          educational_level?: string
          field_of_study?: string
          id?: string
          name?: string
          requires_specification?: boolean | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          mercadopago_customer_id: string | null
          mercadopago_subscription_id: string | null
          plan_type: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end: string
          current_period_start?: string
          id?: string
          mercadopago_customer_id?: string | null
          mercadopago_subscription_id?: string | null
          plan_type?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          mercadopago_customer_id?: string | null
          mercadopago_subscription_id?: string | null
          plan_type?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      substitution_activities: {
        Row: {
          absence_id: string
          activity_description: string
          activity_title: string
          ai_generated_hints: string | null
          attended_by: string | null
          created_at: string | null
          group_id: string
          id: string
          is_completed: boolean | null
          module_index: number | null
          prefect_observations: string | null
          resources_urls: Json | null
          subject_id: string | null
          tenant_id: string
        }
        Insert: {
          absence_id: string
          activity_description: string
          activity_title: string
          ai_generated_hints?: string | null
          attended_by?: string | null
          created_at?: string | null
          group_id: string
          id?: string
          is_completed?: boolean | null
          module_index?: number | null
          prefect_observations?: string | null
          resources_urls?: Json | null
          subject_id?: string | null
          tenant_id: string
        }
        Update: {
          absence_id?: string
          activity_description?: string
          activity_title?: string
          ai_generated_hints?: string | null
          attended_by?: string | null
          created_at?: string | null
          group_id?: string
          id?: string
          is_completed?: boolean | null
          module_index?: number | null
          prefect_observations?: string | null
          resources_urls?: Json | null
          subject_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "substitution_activities_absence_id_fkey"
            columns: ["absence_id"]
            isOneToOne: false
            referencedRelation: "teacher_absences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitution_activities_attended_by_fkey"
            columns: ["attended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitution_activities_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitution_activities_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitution_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      synthetic_program_contents: {
        Row: {
          content: string
          created_at: string | null
          educational_level: string
          field_of_study: string
          id: string
          pda: string | null
          phase: number
          subject_name: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          educational_level: string
          field_of_study: string
          id?: string
          pda?: string | null
          phase: number
          subject_name?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          educational_level?: string
          field_of_study?: string
          id?: string
          pda?: string | null
          phase?: number
          subject_name?: string | null
        }
        Relationships: []
      }
      synthetic_programs_pdfs: {
        Row: {
          created_at: string
          extracted_text: string
          file_name: string
          file_url: string
          id: string
          phase: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          extracted_text: string
          file_name: string
          file_url: string
          id?: string
          phase: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          extracted_text?: string
          file_name?: string
          file_url?: string
          id?: string
          phase?: number
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string | null
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_absences: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          profile_id: string
          reason: string | null
          start_date: string
          status: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          profile_id: string
          reason?: string | null
          start_date: string
          status?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          profile_id?: string
          reason?: string | null
          start_date?: string
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_absences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_absences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_events: {
        Row: {
          created_at: string
          description: string | null
          end_time: string
          group_id: string | null
          id: string
          notify_tutors: boolean | null
          start_time: string
          teacher_id: string
          tenant_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time: string
          group_id?: string | null
          id?: string
          notify_tutors?: boolean | null
          start_time: string
          teacher_id: string
          tenant_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string
          group_id?: string | null
          id?: string
          notify_tutors?: boolean | null
          start_time?: string
          teacher_id?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_events_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_module_attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string | null
          date: string
          id: string
          notes: string | null
          schedule_id: string | null
          status: string
          teacher_id: string
          tenant_id: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          schedule_id?: string | null
          status: string
          teacher_id: string
          tenant_id: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          schedule_id?: string | null
          status?: string
          teacher_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_module_attendance_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_module_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_module_attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          ai_config: Json | null
          cct: string | null
          created_at: string
          educational_level: string | null
          grade: number | null
          id: string
          location_lat: number | null
          location_lng: number | null
          logo_left_url: string | null
          logo_right_url: string | null
          logo_url: string | null
          name: string
          onboarding_completed: boolean | null
          phase: number | null
          phone: string | null
          type: string
        }
        Insert: {
          address?: string | null
          ai_config?: Json | null
          cct?: string | null
          created_at?: string
          educational_level?: string | null
          grade?: number | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          logo_left_url?: string | null
          logo_right_url?: string | null
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean | null
          phase?: number | null
          phone?: string | null
          type: string
        }
        Update: {
          address?: string | null
          ai_config?: Json | null
          cct?: string | null
          created_at?: string
          educational_level?: string | null
          grade?: number | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          logo_left_url?: string | null
          logo_right_url?: string | null
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean | null
          phase?: number | null
          phone?: string | null
          type?: string
        }
        Relationships: []
      }
      textbooks: {
        Row: {
          created_at: string | null
          field_of_study: string | null
          file_url: string
          grade: number
          id: string
          level: string
          subject_id: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          field_of_study?: string | null
          file_url: string
          grade: number
          id?: string
          level: string
          subject_id?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          field_of_study?: string | null
          file_url?: string
          grade?: number
          id?: string
          level?: string
          subject_id?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "textbooks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      user_textbooks: {
        Row: {
          created_at: string | null
          file_url: string
          id: string
          profile_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          file_url: string
          id?: string
          profile_id: string
          title: string
        }
        Update: {
          created_at?: string | null
          file_url?: string
          id?: string
          profile_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_textbooks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      view_god_mode_license_keys: {
        Row: {
          code: string | null
          created_at: string | null
          created_by: string | null
          creator_email: string | null
          duration_days: number | null
          expires_at: string | null
          id: string | null
          plan_type: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          redeemer_email: string | null
          status: string | null
        }
        Relationships: []
      }
      view_god_mode_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string | null
          mercadopago_customer_id: string | null
          mercadopago_subscription_id: string | null
          plan_type: string | null
          status: Database["public"]["Enums"]["subscription_status"] | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
          user_avatar_url: string | null
          user_email: string | null
          user_first_name: string | null
          user_id: string | null
          user_last_name: string | null
        }
        Relationships: []
      }
      view_god_mode_transactions: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          id: string | null
          meta: Json | null
          provider: string | null
          provider_payment_id: string | null
          status: string | null
          subscription_id: string | null
          tenant_id: string | null
          user_email: string | null
          user_first_name: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "view_god_mode_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_set_any_password: {
        Args: { new_password: string; target_user_id: string }
        Returns: Json
      }
      admin_verify_email: { Args: { target_user_id: string }; Returns: Json }
      back_to_god_mode: { Args: never; Returns: undefined }
      create_workspace: {
        Args: {
          workspace_name: string
          workspace_role: string
          workspace_type: string
        }
        Returns: string
      }
      delete_own_account: { Args: never; Returns: undefined }
      generate_license_keys: {
        Args: { p_count: number; p_duration_days: number; p_plan_type: string }
        Returns: string[]
      }
      get_current_role: { Args: never; Returns: string }
      get_current_tenant_id: { Args: never; Returns: string }
      get_database_size: { Args: never; Returns: number }
      get_invitation_info: {
        Args: { token_uuid: string }
        Returns: {
          email: string
          role: string
          tenant_name: string
        }[]
      }
      get_or_create_system_room: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: string
      }
      get_own_tenant_id_bypass: { Args: never; Returns: string }
      has_role_bypass: { Args: { p_role: string }; Returns: boolean }
      has_tenant_link: {
        Args: { p_profile: string; p_role?: string; p_tenant: string }
        Returns: boolean
      }
      is_god_mode: { Args: never; Returns: boolean }
      is_room_participant: { Args: { room_uuid: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_super_admin_bypass: { Args: never; Returns: boolean }
      match_nem_chunks: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          document_title: string
          id: string
          page_number: number
          similarity: number
        }[]
      }
      purge_account: { Args: { target_user_id: string }; Returns: undefined }
      purge_auth_user_by_email: {
        Args: { target_email: string }
        Returns: undefined
      }
      redeem_license_key: { Args: { key_code: string }; Returns: Json }
      restore_account: { Args: { target_user_id: string }; Returns: undefined }
      send_system_message: {
        Args: { p_content: string; p_metadata?: Json; p_room_id: string }
        Returns: string
      }
      soft_delete_account: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      start_free_trial: { Args: { p_plan_type: string }; Returns: Json }
      switch_active_role: { Args: { new_role: string }; Returns: undefined }
      switch_workspace: { Args: { new_tenant_id: string }; Returns: undefined }
      system_setting_visibility: {
        Args: { setting_key: string }
        Returns: string
      }
      update_profile_for_workspace: {
        Args: {
          p_avatar_url: string
          p_first_name: string
          p_last_name_maternal: string
          p_last_name_paternal: string
        }
        Returns: undefined
      }
    }
    Enums: {
      plan_interval: "month" | "year"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      plan_interval: ["month", "year"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
      ],
    },
  },
} as const
