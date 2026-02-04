'use client';

import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/app/contexts/AuthContext';
import { Project, ProjectStatus } from '@/app/types';
import { Plus, Search, Filter, X } from 'lucide-react';
import Link from 'next/link';
import CreateProjectWizard from './CreateProjectWizard';

export default function ProjectList() {
  const { isAdmin } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWizard, setShowWizard] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('');

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const records = await pb.collection('projects').getFullList<Project>({
        sort: '-created',
        expand: 'requesting_area,product_owner',
      });
      setProjects(records);
      setError('');
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      if (err.status === 404) {
           setError('Projects collection not found. Please create a "projects" collection in PocketBase.');
      } else {
           setError(err.message || 'Failed to fetch projects');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();

    // Subscribe to realtime updates
    pb.collection('projects').subscribe<Project>('*', (e) => {
        if (e.action === 'create' || e.action === 'update' || e.action === 'delete') {
            fetchProjects();
        }
    });

    return () => {
        pb.collection('projects').unsubscribe('*');
    };
  }, []);

  const filteredProjects = projects.filter(project => {
    const matchesSearch = 
      (project.system_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (project.code?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter ? project.status === statusFilter : true;
    const matchesType = typeFilter 
      ? (Array.isArray(project.project_type) 
          ? project.project_type.includes(typeFilter) 
          : project.project_type === typeFilter) 
      : true;

    const matchesActive = activeFilter === '' 
      ? true 
      : activeFilter === 'true' 
        ? project.active !== false 
        : project.active === false;

    return matchesSearch && matchesStatus && matchesType && matchesActive;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setTypeFilter('');
    setActiveFilter('');
  };

  if (showWizard) {
      return (
          <CreateProjectWizard 
            onClose={() => setShowWizard(false)}
            onSuccess={() => {
                setShowWizard(false);
                fetchProjects();
            }}
          />
      );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-8">
      
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-sm border dark:border-zinc-700">
        <div>
            <h2 className="text-2xl font-bold">Proyectos</h2>
            <p className="text-gray-500">Gestión de proyectos y desarrollos</p>
        </div>
        {isAdmin && (
          <button 
              onClick={() => setShowWizard(true)}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg font-medium"
          >
              <Plus size={20} />
              Nuevo Proyecto
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border dark:border-zinc-700 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
            
            {/* Search Input */}
            <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar por nombre o código..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full md:w-auto">
                <select 
                    value={activeFilter}
                    onChange={(e) => setActiveFilter(e.target.value)}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value="">Todos (Activos/Inactivos)</option>
                    <option value="true">Activos</option>
                    <option value="false">Inactivos</option>
                </select>

                <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value="">Todos los Estados</option>
                    <option value="Planificación">Planificación</option>
                    <option value="Análisis">Análisis</option>
                    <option value="Diseño">Diseño</option>
                    <option value="Desarrollo">Desarrollo</option>
                    <option value="Testing">Testing</option>
                    <option value="Despliegue">Despliegue</option>
                    <option value="Producción">Producción</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Finalizado">Finalizado</option>
                    <option value="Suspendido">Suspendido</option>
                </select>

                <select 
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value="">Todos los Tipos</option>
                    <option value="Interno">Interno</option>
                    <option value="Externo">Externo</option>
                    <option value="Opensource">Opensource</option>
                </select>

                {(searchTerm || statusFilter || typeFilter) && (
                    <button 
                        onClick={clearFilters}
                        className="w-full sm:w-auto flex items-center justify-center gap-1 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                        <X size={16} />
                        Limpiar
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* Project List */}
      <section>
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                {searchTerm || statusFilter || typeFilter ? 'Resultados de la búsqueda' : 'Listado Reciente'}
                <span className="ml-2 text-sm font-normal text-gray-500">
                    ({filteredProjects.length} {filteredProjects.length === 1 ? 'proyecto' : 'proyectos'})
                </span>
            </h3>
        </div>

        {loading ? (
            <div className="text-center py-8 opacity-50">Cargando proyectos...</div>
        ) : error ? (
            <div className="p-4 border border-red-300 bg-red-50 text-red-700 rounded-md">
                <h3 className="font-bold">Error de Conexión</h3>
                <p>{error}</p>
                <p className="text-sm mt-2">Asegúrate de que PocketBase esté corriendo y la colección "projects" exista.</p>
            </div>
        ) : projects.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-dashed border-gray-300 dark:border-zinc-700">
                <p className="text-gray-500 mb-4">No hay proyectos registrados aún.</p>
                <button 
                    onClick={() => setShowWizard(true)}
                    className="text-blue-600 font-medium hover:underline"
                >
                    ¡Crea el primero ahora!
                </button>
            </div>
        ) : filteredProjects.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-dashed border-gray-300 dark:border-zinc-700">
                <Search className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">No se encontraron proyectos</p>
                <p className="text-gray-400 text-sm mb-4">Intenta con otros términos o filtros</p>
                <button 
                    onClick={clearFilters}
                    className="text-blue-600 font-medium hover:underline"
                >
                    Limpiar filtros
                </button>
            </div>
        ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="block h-full">
                    <div className="group p-6 border rounded-lg shadow-sm hover:shadow-md transition-all bg-white dark:bg-zinc-800 dark:border-zinc-700 flex flex-col space-y-3 hover:border-blue-200 dark:hover:border-blue-900 h-full overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                            <div className="min-w-0 w-full">
                                <h3 className="font-bold text-xl text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors truncate flex items-center gap-2">
                                    {project.system_name}
                                    {project.active && <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" title="Activo"></span>}
                                    {project.active === false && <span className="w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0" title="Inactivo"></span>}
                                </h3>
                                {project.status && (
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 mt-1">{project.status}</span>
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                {(Array.isArray(project.project_type) ? project.project_type : [project.project_type]).filter(Boolean).map(t => (
                                    <span key={t} className={`shrink-0 text-xs px-2 py-1 rounded-full ${t === 'Interno' ? 'bg-blue-100 text-blue-800' : t === 'Externo' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </div>
                        
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2 flex-grow">
                            <p className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                <span className="text-gray-400 font-medium">Código:</span> 
                                <span className="font-mono truncate">{project.code}</span>
                            </p>
                            {project.expand?.requesting_area && (
                                <p className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                    <span className="text-gray-400 font-medium">Area:</span> 
                                    <span className="text-left sm:text-right truncate sm:ml-2 max-w-full sm:max-w-[150px]">{project.expand.requesting_area.name}</span>
                                </p>
                            )}
                            {project.expand?.product_owner && (
                                <p className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                    <span className="text-gray-400 font-medium">PO:</span> 
                                    <span className="text-left sm:text-right truncate sm:ml-2 max-w-full sm:max-w-[150px]">{project.expand.product_owner.name}</span>
                                </p>
                            )}
                            <p className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                <span className="text-gray-400 font-medium">Duración:</span> 
                                <span className="truncate">{project.estimated_duration} meses</span>
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t dark:border-zinc-700/50">
                            {project.frontend_tech?.slice(0, 3).map(t => (
                                <span key={t} className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-[10px] rounded text-zinc-600 dark:text-zinc-300">{t}</span>
                            ))}
                            {(project.frontend_tech?.length || 0) > 3 && (
                                <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-[10px] rounded text-zinc-600 dark:text-zinc-300">+{project.frontend_tech!.length - 3}</span>
                            )}
                        </div>
                    </div>
                </Link>
            ))}
            </div>
        )}
      </section>
    </div>
  );
}
