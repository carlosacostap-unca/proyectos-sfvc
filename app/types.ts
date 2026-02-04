export interface RequestingArea {
  id: string;
  name: string;
}

export interface ProductOwner {
  id: string;
  name: string;
  // Add other fields if necessary
}

export type ProjectStatus = 
  | 'Planificación' 
  | 'Análisis' 
  | 'Diseño' 
  | 'Desarrollo' 
  | 'Testing' 
  | 'Despliegue' 
  | 'Capacitación' 
  | 'Producción' 
  | 'Necesita Informacion' 
  | 'Finalizado' 
  | 'Archivado' 
  | 'Exitoso' 
  | 'Fracaso' 
  | 'Muerto' 
  | 'Suspendido' 
  | 'Mantenimiento';

export interface Project {
  id: string;
  code: string;
  year: number;
  system_name: string;
  requesting_area: string; // Relation ID
  
  // New Fields
  status: ProjectStatus;
  start_date: string; // ISO Date
  estimated_end_date: string; // ISO Date
  product_owner: string; // Relation ID
  observations: string; // HTML/Rich Text
  drive_folder: string; // URL
  server: string; // HTML/Rich Text
  active: boolean;

  expand?: {
    requesting_area?: RequestingArea;
    product_owner?: ProductOwner;
  };
  
  project_type: string[]; // Multi-select: 'Interno' | 'Externo' | 'Opensource'
  frontend_tech: string[]; // Multi-select
  backend_tech: string[]; // Multi-select
  database: string[]; // Multi-select
  shift: string[]; // Multi-select: 'Mañana' | 'Tarde'
  estimated_duration: number; // in months
  created: string;
  updated: string;
}

export interface Evaluation {
  id: string;
  project: string; // Relation ID to Project
  user_id?: string; // ID of the user who created it
  evaluator_name?: string; // Optional name of who evaluated
  
  // JSON field storing scores per dimension: { 'efficiency': 85, 'citizen_impact': 90 }
  dimension_scores: Record<string, number>;
  
  // JSON field storing raw answers: { 'eff_1': 100, 'eff_2': 0 }
  answers: Record<string, number>;
  
  total_score: number; // Average of dimension scores
  
  created: string;
  updated: string;
}
