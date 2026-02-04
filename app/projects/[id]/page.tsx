'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { pb } from '@/lib/pocketbase';
import { Project } from '@/app/types';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Database, 
  Globe, 
  HardDrive, 
  Layout, 
  Server, 
  User, 
  Users,
  Code,
  Briefcase,
  FileText,
  Layers,
  Edit,
  Trash2
} from 'lucide-react';
import Link from 'next/link';
import EvaluationSection from '@/app/components/EvaluationSection';
import EditProjectModal from '@/app/components/EditProjectModal';

// Helper to ensure we handle both arrays and single strings safely
const ensureArray = (data: any): string[] => {
  if (Array.isArray(data)) return data;
  if (typeof data === 'string' && data.trim() !== '') return [data];
  return [];
};

export default function ProjectDetail() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchProject = async () => {
      try {
        setLoading(true);
        const record = await pb.collection('projects').getOne<Project>(id, {
          expand: 'requesting_area,product_owner',
        });
        setProject(record);
      } catch (err: any) {
        console.error('Error fetching project:', err);
        setError('No se pudo cargar el proyecto. Puede que no exista o haya sido eliminado.');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();

    // Subscribe to realtime updates for this specific project
    pb.collection('projects').subscribe<Project>(id, (e) => {
        if (e.action === 'update') {
             // We can optimistically update the state or re-fetch
             // Re-fetching ensures we get all expanded relations correctly
             fetchProject();
        } else if (e.action === 'delete') {
            setError('El proyecto ha sido eliminado.');
            setProject(null);
        }
    });

    return () => {
        pb.collection('projects').unsubscribe(id);
    };
  }, [id]);

  const handleDelete = async () => {
    if (!project || !confirm('¿Estás seguro de que deseas eliminar este proyecto? Esta acción no se puede deshacer.')) return;

    try {
      await pb.collection('projects').delete(project.id);
      router.push('/');
    } catch (err: any) {
      console.error('Error deleting project:', err);
      alert('Error al eliminar el proyecto: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-blue-600 font-medium">Cargando detalles del proyecto...</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4 p-4">
        <div className="text-red-500 text-lg font-medium">{error || 'Proyecto no encontrado'}</div>
        <Link href="/" className="flex items-center gap-2 text-blue-600 hover:underline">
          <ArrowLeft size={20} />
          Volver al listado
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header / Nav */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Volver</span>
          </Link>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-gray-200"
            >
              <Edit size={16} />
              Editar
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400"
            >
              <Trash2 size={16} />
              Eliminar
            </button>
          </div>
        </div>

        {/* Main Title Card */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border dark:border-zinc-700 p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{project.system_name}</h1>
                {ensureArray(project.project_type).map(type => (
                  <span key={type} className={`px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide
                    ${type === 'Interno' ? 'bg-blue-100 text-blue-800' : 
                      type === 'Externo' ? 'bg-green-100 text-green-800' : 
                      'bg-purple-100 text-purple-800'}`}
                  >
                    {type}
                  </span>
                ))}
              </div>
              <p className="text-gray-500 flex items-center gap-2">
                <Code size={16} />
                <span className="font-mono font-medium">{project.code}</span>
                <span className="mx-2">•</span>
                <span>Año {project.year}</span>
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                  {project.active !== undefined && (
                    <span className={`px-4 py-2 rounded-lg font-semibold shadow-sm border dark:border-zinc-600 ${project.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-zinc-700 dark:text-gray-400'}`}>
                        {project.active ? 'Activo' : 'Inactivo'}
                    </span>
                  )}
                  <span className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-zinc-700 font-semibold text-gray-700 dark:text-gray-200 shadow-sm border dark:border-zinc-600">
                    {project.status}
                  </span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column: Key Info */}
          <div className="space-y-6">
            
            {/* Fechas y Duración */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border dark:border-zinc-700 p-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 border-b dark:border-zinc-700 pb-2">
                <Calendar size={20} className="text-blue-500" />
                Cronograma
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Inicio:</span>
                  <span className="font-medium">
                    {project.start_date ? new Date(project.start_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'No definida'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fin Estimado:</span>
                  <span className="font-medium">
                    {project.estimated_end_date ? new Date(project.estimated_end_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'No definida'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duración Est.:</span>
                  <span className="font-medium">{project.estimated_duration} meses</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Turno:</span>
                  <span className="font-medium">
                    {ensureArray(project.shift).join(', ') || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Personas / Areas */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border dark:border-zinc-700 p-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 border-b dark:border-zinc-700 pb-2">
                <Users size={20} className="text-purple-500" />
                Equipo y Area
              </h3>
              
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Area Solicitante</p>
                <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <Briefcase size={16} />
                  <span>{project.expand?.requesting_area?.name || 'No asignada'}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Product Owner</p>
                <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <User size={16} />
                  <span>{project.expand?.product_owner?.name || 'No asignado'}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Center Column: Tech Stack & Resources */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Tecnologías */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border dark:border-zinc-700 p-6">
              <h3 className="text-lg font-semibold flex items-center gap-2 border-b dark:border-zinc-700 pb-4 mb-4">
                <Layers size={20} className="text-indigo-500" />
                Stack Tecnológico
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-sm font-bold text-gray-500 mb-2 flex items-center gap-2">
                    <Layout size={16} /> Frontend
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {ensureArray(project.frontend_tech).length > 0 ? (
                      ensureArray(project.frontend_tech).map(t => (
                        <span key={t} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded border border-indigo-100 dark:border-indigo-800">
                          {t}
                        </span>
                      ))
                    ) : <span className="text-gray-400 text-sm italic">No especificado</span>}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-500 mb-2 flex items-center gap-2">
                    <Server size={16} /> Backend
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {ensureArray(project.backend_tech).length > 0 ? (
                      ensureArray(project.backend_tech).map(t => (
                        <span key={t} className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded border border-emerald-100 dark:border-emerald-800">
                          {t}
                        </span>
                      ))
                    ) : <span className="text-gray-400 text-sm italic">No especificado</span>}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-500 mb-2 flex items-center gap-2">
                    <Database size={16} /> Base de Datos
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {ensureArray(project.database).length > 0 ? (
                      ensureArray(project.database).map(t => (
                        <span key={t} className="px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded border border-amber-100 dark:border-amber-800">
                          {t}
                        </span>
                      ))
                    ) : <span className="text-gray-400 text-sm italic">No especificado</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Recursos / Enlaces */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border dark:border-zinc-700 p-6">
                    <h3 className="text-base font-semibold flex items-center gap-2 mb-3 text-gray-700 dark:text-gray-300">
                        <HardDrive size={18} /> Carpeta Drive
                    </h3>
                    {project.drive_folder ? (
                        <div 
                            className="prose prose-sm max-w-none text-gray-600 dark:text-gray-400 break-all"
                            dangerouslySetInnerHTML={{ __html: project.drive_folder }}
                        />
                    ) : (
                        <p className="text-gray-400 text-sm italic">No hay carpeta asociada.</p>
                    )}
                </div>

                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border dark:border-zinc-700 p-6">
                    <h3 className="text-base font-semibold flex items-center gap-2 mb-3 text-gray-700 dark:text-gray-300">
                        <Globe size={18} /> Servidor / Deploy
                    </h3>
                    {project.server ? (
                        <div 
                            className="prose prose-sm max-w-none text-gray-600 dark:text-gray-400 break-all"
                            dangerouslySetInnerHTML={{ __html: project.server }}
                        />
                    ) : (
                        <p className="text-gray-400 text-sm italic">No hay información del servidor.</p>
                    )}
                </div>
            </div>

            {/* Observaciones */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border dark:border-zinc-700 p-6">
              <h3 className="text-lg font-semibold flex items-center gap-2 border-b dark:border-zinc-700 pb-2 mb-4">
                <FileText size={20} className="text-gray-500" />
                Observaciones
              </h3>
              {project.observations ? (
                <div 
                  className="prose prose-blue dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: project.observations }}
                />
              ) : (
                <p className="text-gray-400 italic">Sin observaciones registradas.</p>
              )}
            </div>

          </div>
        </div>

        {/* Evaluation Section */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border dark:border-zinc-700 p-6">
           <EvaluationSection projectId={project.id} />
        </div>

      </div>

      {showEditModal && project && (
        <EditProjectModal 
          project={project} 
          onClose={() => setShowEditModal(false)} 
          onSuccess={() => {
            setShowEditModal(false);
            // Realtime subscription will auto-update the UI, or we could refetch here manually if we prefer
            // fetchProject(); // Not needed if realtime is active, but safe to have implicit via state update from realtime
          }} 
        />
      )}
    </div>
  );
}
