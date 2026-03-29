export interface Program {
  id: string;
  name: string;
  description: string;
  start_date?: string;
  end_date?: string;
  active: boolean;
  manager?: string; // Relation to personal
  created: string;
  updated: string;
  expand?: {
    manager?: Personal;
  };
}

export interface RequestingArea {
  id: string;
  name: string;
  active?: boolean;
}

export interface Personal {
  id: string;
  surname: string;
  name: string;
  dni: string;
  file_number: string; // Legajo
  email: string;
  phone: string;
  shift: string[]; // Relation to shifts (Multiple)
  main_role: string; // Relation to roles
  secondary_role: string; // Relation to roles
  join_date: string;
  status: string; // Relation to personal_statuses
  observations: string;
  cv?: string;
  created: string;
  updated: string;
  expand?: {
    shift?: ShiftItem[];
    main_role?: RoleItem;
    secondary_role?: RoleItem;
    status?: StaffStatusItem;
  };
}

export interface TechItem {
  id: string;
  name: string;
  active: boolean;
}

export interface ProjectStatusItem {
  id: string;
  name: string;
  active: boolean;
}

export interface ProjectTypeItem {
  id: string;
  name: string;
  active: boolean;
}

export interface PhaseItem {
  id: string;
  name: string;
  active: boolean;
}

export interface PhaseStatusItem {
  id: string;
  name: string;
  active: boolean;
}

export interface ProjectTimelineItem {
  id: string;
  project: string; // Relation to projects
  phase: string; // Relation to project_phases
  planned_start_date: string; // ISO Date
  real_start_date: string; // ISO Date
  planned_end_date: string; // ISO Date
  real_end_date: string; // ISO Date
  status: string; // Relation to phase_statuses
  responsible: string; // Relation to personal
  observations: string;
  created: string;
  updated: string;
  expand?: {
    phase?: PhaseItem;
    status?: PhaseStatusItem;
    responsible?: Personal;
  };
}

export interface ShiftItem {
  id: string;
  name: string;
  active: boolean;
}

export interface RoleItem {
  id: string;
  name: string;
  active: boolean;
}

export interface StaffStatusItem {
  id: string;
  name: string;
  active: boolean;
}

export interface ProjectNote {
  id: string;
  project: string; // Relation to projects
  user: string; // Relation to users
  content: string; // HTML/Rich Text
  created: string;
  updated: string;
  expand?: {
    user?: User;
  };
}

export interface ProjectAssignment {
  id: string;
  project: string; // Relation to projects
  personal: string; // Relation to personal
  start_date: string | null; // ISO Date - Fecha de asignación
  end_date: string | null; // ISO Date - Fecha de desvinculación
  roles: string[]; // Relation to roles (Multiple)
  active: boolean;
  created: string;
  updated: string;
  expand?: {
    personal?: Personal;
    roles?: RoleItem[];
  };
}

export type ProjectStatus = string;

export interface Project {
  id: string;
  code: string;
  year: number;
  system_name: string;
  description?: string; // New description field
  requesting_area: string; // Relation ID
  program?: string; // Relation to programs
  
  // New Fields
  status: ProjectStatus; // Relation ID
  start_date: string; // ISO Date
  estimated_end_date?: string; // ISO Date
  personal?: string; // Relation to personal (single)
  observations?: string;
  drive_folder?: string;
  server?: string;
  active?: boolean;

  expand?: {
    requesting_area?: RequestingArea;
    program?: Program;
    personal?: Personal;
    frontend_tech?: TechItem[];
    backend_tech?: TechItem[];
    database?: TechItem[];
    status?: ProjectStatusItem;
    project_type?: ProjectTypeItem[];
    shift?: ShiftItem[];
  };
  
  project_type: string[]; // Relation (Multiple) IDs
  frontend_tech: string[]; // Multi-select
  backend_tech: string[]; // Multi-select
  database: string[]; // Multi-select
  shift: string[]; // Multi-select: 'Mañana' | 'Tarde'
  estimated_duration: number; // in months
  security_level?: 'low' | 'medium' | 'high' | ''; // Security Level
  expected_benefit?: string; // Beneficio esperado
  created: string;
  updated: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar?: string;
  isAdmin: boolean;
  active: boolean;
  created: string;
  updated: string;
}

export interface Evaluation {
  id: string;
  project: string; // Relation ID to Project
  user: string; // Relation ID to users collection
  
  expand?: {
    user?: User; // Expanded user details
  };
  
  // JSON field storing scores per dimension: { 'efficiency': 85, 'citizen_impact': 90 }
  dimension_scores: Record<string, number>;
  
  // JSON field storing raw answers: { 'eff_1': 100, 'eff_2': 0 }
  answers: Record<string, number>;
  
  total_score: number; // Average of dimension scores
  
  created: string;
  updated: string;
}

export interface WorkLog {
  id: string;
  personal: string; // Relation to personal
  project?: string; // Relation to projects (Optional)
  date: string; // ISO Date YYYY-MM-DD
  hours: number;
  description?: string;
  created: string;
  updated: string;
  expand?: {
    project?: Project;
  };
}


