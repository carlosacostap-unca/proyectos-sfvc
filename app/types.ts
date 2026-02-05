export interface RequestingArea {
  id: string;
  name: string;
  active?: boolean;
}

export interface ProductOwner {
  id: string;
  name: string;
  active?: boolean;
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
  product_owner: string; // Relation ID
  observations: string; // HTML/Rich Text
  drive_folder: string; // URL
  server: string; // HTML/Rich Text
  active: boolean;

  expand?: {
    requesting_area?: RequestingArea;
    product_owner?: ProductOwner;
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

export interface Evaluation {
  id: string;
  project: string; // Relation ID to Project
  user: string; // Relation ID to users collection
  
  expand?: {
    user?: WhitelistUser; // Expanded user details
  };
  
  // JSON field storing scores per dimension: { 'efficiency': 85, 'citizen_impact': 90 }
  dimension_scores: Record<string, number>;
  
  // JSON field storing raw answers: { 'eff_1': 100, 'eff_2': 0 }
  answers: Record<string, number>;
  
  total_score: number; // Average of dimension scores
  
  created: string;
  updated: string;
}

export interface WhitelistUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isRegistered?: boolean; // Frontend only flag
  isAdmin: boolean;
  active: boolean;
  created: string;
  updated: string;
}
