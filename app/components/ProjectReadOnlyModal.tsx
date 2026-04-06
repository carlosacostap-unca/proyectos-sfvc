'use client';

import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { formatLocalDate } from '@/app/utils/date';
import { Project, ProjectAssignment, ProjectTimelineItem } from '@/app/types';
import { 
  X,
  Calendar, 
  Globe, 
  HardDrive, 
  Layout, 
  Server, 
  Users,
  Code,
  Briefcase,
  FileText,
  Layers,
  Shield,
  Folder,
  Database,
  User,
  Milestone
} from 'lucide-react';

interface ProjectReadOnlyModalProps {
  projectId: string;
  onClose: () => void;
}

const ensureExpandList = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (data) return [data];
  return [];
};

export default function ProjectReadOnlyModal({ projectId, onClose }: ProjectReadOnlyModalProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [phases, setPhases] = useState<ProjectTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        setLoading(true);
        const [projectRecord, assignmentsRecord, phasesRecord] = await Promise.all([
          pb.collection('projects').getOne<Project>(projectId, {
            expand: 'requesting_area,program,personal,frontend_tech,backend_tech,database,status,project_type,shift',
          }),
          pb.collection('project_assignments').getFullList<ProjectAssignment>({
            filter: `project = "${projectId}" && active = true`,
            expand: 'personal,roles',
            sort: '-start_date'
          }),
          pb.collection('project_timeline').getFullList<ProjectTimelineItem>({
            filter: `project = "${projectId}"`,
            expand: 'phase,status,responsible',
            sort: 'planned_start_date'
          })
        ]);
        setProject(projectRecord);
        setAssignments(assignmentsRecord);
        setPhases(phasesRecord);
      } catch (err: any) {
        console.error('Error fetching project data:', err);
        setError('No se pudo cargar la información del proyecto.');
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [projectId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-zinc-800">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 sticky top-0 z-10">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Folder className="text-indigo-600" />
            Información del Proyecto
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-pulse text-indigo-600 font-medium">Cargando detalles...</div>
            </div>
          ) : error || !project ? (
            <div className="text-center py-20 text-red-500 font-medium">
              {error || 'Proyecto no encontrado'}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Main Info */}
              <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-6 border border-gray-100 dark:border-zinc-800">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{project.system_name}</h3>
                      {ensureExpandList(project.expand?.project_type).map((type: any) => (
                        <span key={type.id} className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                          {type.name}
                        </span>
                      ))}
                    </div>
                    <p className="text-gray-500 flex items-center gap-2 mb-4 text-sm">
                      <Code size={14} />
                      <span className="font-mono font-medium">{project.code}</span>
                      <span className="mx-1">•</span>
                      <span>Año {project.year}</span>
                    </p>
                    {project.description && (
                      <p className="text-gray-700 dark:text-gray-300 mt-2 text-sm leading-relaxed">
                        {project.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {project.active !== undefined && (
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${project.active ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50' : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-gray-400 dark:border-zinc-700'}`}>
                        {project.active ? 'Activo' : 'Inactivo'}
                      </span>
                    )}
                    <span className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700">
                      {project.expand?.status?.name || project.status || "Sin Estado"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grid Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Fechas */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-5 space-y-4">
                  <h4 className="text-base font-semibold flex items-center gap-2 border-b border-gray-100 dark:border-zinc-800 pb-2">
                    <Calendar size={18} className="text-blue-500" />
                    Cronograma
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-b border-gray-50 dark:border-zinc-800/50 pb-2">
                      <span className="text-gray-500">Inicio:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {project.start_date ? formatLocalDate(project.start_date) : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-gray-50 dark:border-zinc-800/50 pb-2">
                      <span className="text-gray-500">Fin Estimado:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {project.estimated_end_date ? formatLocalDate(project.estimated_end_date) : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-gray-50 dark:border-zinc-800/50 pb-2">
                      <span className="text-gray-500">Duración:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{project.estimated_duration} meses</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Turno:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {ensureExpandList(project.expand?.shift).map((s: any) => s.name).join(', ') || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Organización */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-5 space-y-4">
                  <h4 className="text-base font-semibold flex items-center gap-2 border-b border-gray-100 dark:border-zinc-800 pb-2">
                    <Users size={18} className="text-purple-500" />
                    Organización
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Responsable / Líder</span>
                      <div className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                        <User size={14} className="text-gray-400" />
                        <span className="font-medium">
                          {project.expand?.personal ? `${project.expand.personal.surname}, ${project.expand.personal.name}` : '-'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Área Solicitante</span>
                      <div className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                        <Briefcase size={14} className="text-gray-400" />
                        <span className="font-medium">{project.expand?.requesting_area?.name || '-'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Programa</span>
                      <div className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                        <Folder size={14} className="text-gray-400" />
                        <span className="font-medium">{project.expand?.program?.name || '-'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Nivel de Seguridad</span>
                      <div className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                        <Shield size={14} className={
                          project.security_level === 'high' ? 'text-red-500' :
                          project.security_level === 'medium' ? 'text-amber-500' : 'text-green-500'
                        } />
                        <span className="font-medium">
                          {project.security_level === 'high' ? 'Alto' : 
                           project.security_level === 'medium' ? 'Medio' : 
                           project.security_level === 'low' ? 'Bajo' : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stack */}
                <div className="md:col-span-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-5">
                  <h4 className="text-base font-semibold flex items-center gap-2 border-b border-gray-100 dark:border-zinc-800 pb-3 mb-4">
                    <Layers size={18} className="text-indigo-500" />
                    Stack Tecnológico
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-gray-100 dark:border-zinc-800">
                      <span className="text-xs font-bold text-gray-500 flex items-center gap-1 mb-2">
                        <Layout size={12} /> Frontend
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {ensureExpandList(project.expand?.frontend_tech).length > 0 ? (
                          ensureExpandList(project.expand?.frontend_tech).map((t: any) => (
                            <span key={t.id} className="px-2 py-0.5 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 text-xs rounded border border-gray-200 dark:border-zinc-700">
                              {t.name}
                            </span>
                          ))
                        ) : <span className="text-gray-400 text-xs">-</span>}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-gray-100 dark:border-zinc-800">
                      <span className="text-xs font-bold text-gray-500 flex items-center gap-1 mb-2">
                        <Server size={12} /> Backend
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {ensureExpandList(project.expand?.backend_tech).length > 0 ? (
                          ensureExpandList(project.expand?.backend_tech).map((t: any) => (
                            <span key={t.id} className="px-2 py-0.5 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 text-xs rounded border border-gray-200 dark:border-zinc-700">
                              {t.name}
                            </span>
                          ))
                        ) : <span className="text-gray-400 text-xs">-</span>}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-gray-100 dark:border-zinc-800">
                      <span className="text-xs font-bold text-gray-500 flex items-center gap-1 mb-2">
                        <Database size={12} /> Base de Datos
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {ensureExpandList(project.expand?.database).length > 0 ? (
                          ensureExpandList(project.expand?.database).map((t: any) => (
                            <span key={t.id} className="px-2 py-0.5 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 text-xs rounded border border-gray-200 dark:border-zinc-700">
                              {t.name}
                            </span>
                          ))
                        ) : <span className="text-gray-400 text-xs">-</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Otros Datos */}
                {project.server && (
                  <div className="md:col-span-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-5">
                    <h4 className="text-base font-semibold flex items-center gap-2 mb-2 text-gray-900 dark:text-white">
                      <Globe size={18} className="text-blue-500" /> Servidor / Deploy
                    </h4>
                    <div className="prose prose-sm max-w-none text-gray-600 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: project.server }} />
                  </div>
                )}
                {project.drive_folder && (
                  <div className="md:col-span-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-5">
                    <h4 className="text-base font-semibold flex items-center gap-2 mb-2 text-gray-900 dark:text-white">
                      <HardDrive size={18} className="text-amber-500" /> Carpeta Drive
                    </h4>
                    <div className="prose prose-sm max-w-none text-gray-600 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: project.drive_folder }} />
                  </div>
                )}
                {project.observations && (
                  <div className="md:col-span-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-5">
                    <h4 className="text-base font-semibold flex items-center gap-2 mb-2 text-gray-900 dark:text-white">
                      <FileText size={18} className="text-gray-500" /> Observaciones
                    </h4>
                    <div className="prose prose-sm max-w-none text-gray-600 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: project.observations }} />
                  </div>
                )}
                {project.expected_benefit && (
                  <div className="md:col-span-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-5">
                    <h4 className="text-base font-semibold flex items-center gap-2 mb-2 text-gray-900 dark:text-white">
                      <FileText size={18} className="text-green-500" /> Beneficio Esperado
                    </h4>
                    <div className="prose prose-sm max-w-none text-gray-600 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: project.expected_benefit }} />
                  </div>
                )}

                {/* Fases */}
                <div className="md:col-span-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-5">
                  <h4 className="text-base font-semibold flex items-center gap-2 mb-4 text-gray-900 dark:text-white border-b border-gray-100 dark:border-zinc-800 pb-2">
                    <Milestone size={18} className="text-emerald-500" /> Fases del Proyecto
                  </h4>
                  {phases.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-zinc-800/50">
                          <tr>
                            <th className="px-4 py-2">Fase</th>
                            <th className="px-4 py-2">Estado</th>
                            <th className="px-4 py-2">Responsable</th>
                            <th className="px-4 py-2">Inicio Plan.</th>
                            <th className="px-4 py-2">Fin Plan.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                          {phases.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                              <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                                {p.expand?.phase?.name || '-'}
                              </td>
                              <td className="px-4 py-2">
                                <span className="px-2 py-1 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 text-xs rounded border border-gray-200 dark:border-zinc-700">
                                  {p.expand?.status?.name || '-'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {p.expand?.responsible ? `${p.expand.responsible.surname}, ${p.expand.responsible.name}` : '-'}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {p.planned_start_date ? formatLocalDate(p.planned_start_date) : '-'}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {p.planned_end_date ? formatLocalDate(p.planned_end_date) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No hay fases registradas.</p>
                  )}
                </div>

                {/* Asignaciones */}
                <div className="md:col-span-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-5">
                  <h4 className="text-base font-semibold flex items-center gap-2 mb-4 text-gray-900 dark:text-white border-b border-gray-100 dark:border-zinc-800 pb-2">
                    <Users size={18} className="text-indigo-500" /> Personal Asignado
                  </h4>
                  {assignments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-zinc-800/50">
                          <tr>
                            <th className="px-4 py-2">Personal</th>
                            <th className="px-4 py-2">Roles</th>
                            <th className="px-4 py-2">Desde</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                          {assignments.map(a => (
                            <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                              <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                                {a.expand?.personal ? `${a.expand.personal.surname}, ${a.expand.personal.name}` : '-'}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {a.expand?.roles ? a.expand.roles.map(r => r.name).join(', ') : '-'}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {a.start_date ? formatLocalDate(a.start_date) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No hay personal asignado actualmente.</p>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}