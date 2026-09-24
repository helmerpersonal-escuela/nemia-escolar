export interface Phrase {
    name: string;
    duration: number;
    activities: string[];
}

export interface Session {
    date: string;
    duration: number;
    phases: Phrase[];
    apertura?: string;
    desarrollo?: string;
    cierre?: string;
}

export interface AiSuggestionSession {
    date: string;
    apertura: string;
    desarrollo: string;
    cierre: string;
}

export interface AiSuggestion {
    title: string;
    sessions: AiSuggestionSession[];
}

export interface LessonPlanFormData {
    title: string;
    group_id: string;
    subject_id: string;
    temporality: 'WEEKLY' | 'MONTHLY' | 'PROJECT';
    start_date: string;
    end_date: string;
    campo_formativo: string;
    metodologia: string;
    problem_context: string;
    purpose: string;
    ejes_articuladores: string[];
    pda: string[];
    contents: string[];
    resources: string[];
    activities_sequence: Session[];
    textbook_id?: string;
    textbook_pages_from?: string;
    textbook_pages_to?: string;
    selected_themes?: string[];
    evaluation_instruments: string[];
    evaluation_criteria: string;
    period_id: string;
    project_duration: number;
    objectives: string[];
    evaluation_plan: { instruments: string[] };
    source_document_url: string;
    extracted_text: string;
}
