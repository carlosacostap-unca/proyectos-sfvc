'use client';

import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { Project } from '@/app/types';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import CreateProjectWizard from './CreateProjectWizard';

export default function ProjectManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWizard, setShowWizard] = useState(false);

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
  }, []);

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
      <div className="flex justify-between items-center bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-sm border dark:border-zinc-700">
        <div>
            <h2 className="text-2xl font-bold">Proyectos</h2>
            <p className="text-gray-500">Gestión de proyectos y desarrollos</p>
        </div>
        <button 
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg font-medium"
        >
            <Plus size={20} />
            Nuevo Proyecto
        </button>
      </div>

      {/* Project List */}
      <section>
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Listado Reciente</h3>
            <button onClick={fetchProjects} className="text-sm text-blue-500 hover:underline">Actualizar</button>
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
        ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="block h-full">
                    <div className="group p-6 border rounded-lg shadow-sm hover:shadow-md transition-all bg-white dark:bg-zinc-800 dark:border-zinc-700 flex flex-col space-y-3 hover:border-blue-200 dark:hover:border-blue-900 h-full">
                        <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                                <h3 className="font-bold text-xl text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors truncate">{project.system_name}</h3>
                                {project.status && (
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 mt-1">{project.status}</span>
                                )}
                            </div>
                            <span className={`shrink-0 text-xs px-2 py-1 rounded-full ${project.project_type === 'Interno' ? 'bg-blue-100 text-blue-800' : project.project_type === 'Externo' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                                {project.project_type}
                            </span>
                        </div>
                        
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 flex-grow">
                            <p className="flex justify-between"><span className="text-gray-400">Código:</span> <span className="font-mono">{project.code}</span></p>
                            {project.expand?.requesting_area && (
                                <p className="flex justify-between"><span className="text-gray-400">Area:</span> <span className="text-right truncate ml-2 max-w-[150px]">{project.expand.requesting_area.name}</span></p>
                            )}
                            {project.expand?.product_owner && (
                                <p className="flex justify-between"><span className="text-gray-400">PO:</span> <span className="text-right truncate ml-2 max-w-[150px]">{project.expand.product_owner.name}</span></p>
                            )}
                            <p className="flex justify-between"><span className="text-gray-400">Duración:</span> <span>{project.estimated_duration} meses</span></p>
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
