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
  drive_folder: string; // HTML/Rich Text
  server: string; // HTML/Rich Text

  expand?: {
    requesting_area?: RequestingArea;
    product_owner?: ProductOwner;
  };
  
  project_type: 'Interno' | 'Externo' | 'Opensource';
  frontend_tech: string[]; // Multi-select
  backend_tech: string[]; // Multi-select
  database: string[]; // Multi-select
  shift: string[]; // Multi-select: 'Mañana' | 'Tarde'
  estimated_duration: number; // in months
  created: string;
  updated: string;
}
