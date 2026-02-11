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
  start_date: string; // ISO Date - Fecha de asignación
  end_date: string; // ISO Date - Fecha de desvinculación
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
  requesting_area: string; // Relation ID
  
  // New Fields
  status: ProjectStatus; // Relation ID
  start_date: string; // ISO Date
  estimated_end_date: string; // ISO Date
  personal: string; // Relation ID to personal collection
  observations: string; // HTML/Rich Text
  drive_folder: string; // URL
  server: string; // HTML/Rich Text
  active: boolean;

  expand?: {
    requesting_area?: RequestingArea;
    personal?: Personal;
    frontend_tech?: TechItem[];
    backend_tech?: TechItem[];
    database?: TechItem[];
    status?: ProjectStatusItem;
    project_type?: ProjectTypeItem[];
  };
  
  project_type: string[]; // Relation (Multiple) IDs
  frontend_tech: string[]; // Multi-select
  backend_tech: string[]; // Multi-select
  database: string[]; // Multi-select
  shift: string[]; // Multi-select: 'Mañana' | 'Tarde'
  estimated_duration: number; // in months
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


