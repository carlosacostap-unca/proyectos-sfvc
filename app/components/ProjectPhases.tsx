'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Edit2, Save, X, Search, 
  Calendar, Briefcase, User, Check, Clock, Milestone, Flag, AlignLeft
} from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { ProjectTimelineItem, Personal, PhaseItem, PhaseStatusItem } from '@/app/types';
import { toast } from 'sonner';

interface ProjectPhasesProps {
  projectId: string;
}

export default function ProjectPhases({ projectId }: ProjectPhasesProps) {
  const [timelineItems, setTimelineItems] = useState<ProjectTimelineItem[]>([]);
  const [phasesList, setPhasesList] = useState<PhaseItem[]>([]);
  const [statusesList, setStatusesList] = useState<PhaseStatusItem[]>([]);
  const [personalList, setPersonalList] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<ProjectTimelineItem>>({
    project: projectId,
    phase: '',
    planned_start_date: '',
    real_start_date: '',
    planned_end_date: '',
    real_end_date: '',
    status: '',
    responsible: '',
    observations: ''
  });

  useEffect(() => {
    fetchTimeline();
    fetchPhases();
    fetchStatuses();
    fetchPersonal();
  }, [projectId]);

  const fetchTimeline = async () => {
    try {
      const records = await pb.collection('project_timeline').getFullList<ProjectTimelineItem>({
        filter: `project = "${projectId}"`,
        sort: 'planned_start_date',
        expand: 'phase,status,responsible'
      });
      setTimelineItems(records);
    } catch (error) {
      console.error('Error fetching timeline:', error);
      // Don't show error if collection doesn't exist yet (first load)
    } finally {
      setLoading(false);
    }
  };

  const fetchPhases = async () => {
    try {
      const records = await pb.collection('project_phases').getFullList<PhaseItem>({
        sort: 'name',
        filter: 'active = true'
      });
      setPhasesList(records);
    } catch (error) {
      console.error('Error fetching phases:', error);
    }
  };

  const fetchStatuses = async () => {
    try {
      const records = await pb.collection('phase_statuses').getFullList<PhaseStatusItem>({
        sort: 'name',
        filter: 'active = true'
      });
      setStatusesList(records);
    } catch (error) {
      console.error('Error fetching statuses:', error);
    }
  };

  const fetchPersonal = async () => {
    try {
      const records = await pb.collection('personal').getFullList<Personal>({
        sort: 'surname,name',
        filter: 'status.active = true'
      });
      setPersonalList(records);
    } catch (error) {
      console.error('Error fetching personal:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      project: projectId,
      phase: '',
      planned_start_date: '',
      real_start_date: '',
      planned_end_date: '',
      real_end_date: '',
      status: '',
      responsible: '',
      observations: ''
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { timeZone: 'UTC' });
  };

  const handleEdit = (item: ProjectTimelineItem) => {
    setFormData({
      project: item.project,
      phase: item.phase,
      planned_start_date: item.planned_start_date?.substring(0, 10) || '',
      real_start_date: item.real_start_date?.substring(0, 10) || '',
      planned_end_date: item.planned_end_date?.substring(0, 10) || '',
      real_end_date: item.real_end_date?.substring(0, 10) || '',
      status: item.status,
      responsible: item.responsible,
      observations: item.observations
    });
    setEditingId(item.id);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta fase del cronograma?')) return;
    try {
      await pb.collection('project_timeline').delete(id);
      toast.success('Fase eliminada');
      fetchTimeline();
    } catch (error) {
      console.error('Error deleting timeline item:', error);
      toast.error('Error al eliminar');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phase) {
      toast.error('Debe seleccionar una fase');
      return;
    }

    try {
      const dataToSave = {
        ...formData,
        planned_start_date: formData.planned_start_date || null,
        real_start_date: formData.real_start_date || null,
        planned_end_date: formData.planned_end_date || null,
        real_end_date: formData.real_end_date || null,
      };

      if (editingId) {
        await pb.collection('project_timeline').update(editingId, dataToSave);
        toast.success('Fase actualizada');
      } else {
        await pb.collection('project_timeline').create(dataToSave);
        toast.success('Fase agregada');
      }
      resetForm();
      fetchTimeline();
    } catch (error: any) {
      console.error('Error saving timeline item:', error);
      toast.error(`Error al guardar: ${error.message}`);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border dark:border-zinc-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Milestone size={20} className="text-orange-500" />
          Fases del Proyecto
        </h3>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-sm font-medium transition-colors dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30 dark:text-indigo-400"
          >
            <Plus size={16} />
            Agregar Fase
          </button>
        )}
      </div>

      {isEditing && (
        <div className="mb-8 p-4 bg-gray-50 dark:bg-zinc-900/50 rounded-lg border border-gray-100 dark:border-zinc-700">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Fase */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fase *</label>
                <div className="relative">
                  <Milestone className="absolute left-3 top-2.5 text-gray-400" size={16} />
                  <select
                    value={formData.phase}
                    onChange={(e) => setFormData({...formData, phase: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    required
                  >
                    <option value="">Seleccionar Fase...</option>
                    {phasesList.map(phase => (
                      <option key={phase.id} value={phase.id}>{phase.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Responsable */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Responsable</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 text-gray-400" size={16} />
                  <select
                    value={formData.responsible}
                    onChange={(e) => setFormData({...formData, responsible: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    <option value="">Seleccionar Responsable...</option>
                    {personalList.map(p => (
                      <option key={p.id} value={p.id}>{p.surname}, {p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                <div className="relative">
                  <Flag className="absolute left-3 top-2.5 text-gray-400" size={16} />
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    <option value="">Seleccionar Estado...</option>
                    {statusesList.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Observaciones</label>
                <div className="relative">
                  <AlignLeft className="absolute left-3 top-2.5 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={formData.observations}
                    onChange={(e) => setFormData({...formData, observations: e.target.value})}
                    placeholder="Observaciones breves..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>
              </div>

              {/* Fechas Planificadas */}
              <div className="md:col-span-2 grid grid-cols-2 gap-4 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800/30">
                 <div>
                    <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Inicio Planificado</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 text-blue-400" size={16} />
                      <input
                        type="date"
                        value={formData.planned_start_date}
                        onChange={(e) => setFormData({...formData, planned_start_date: e.target.value})}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      />
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Fin Planificado</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 text-blue-400" size={16} />
                      <input
                        type="date"
                        value={formData.planned_end_date}
                        onChange={(e) => setFormData({...formData, planned_end_date: e.target.value})}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      />
                    </div>
                 </div>
              </div>

              {/* Fechas Reales */}
              <div className="md:col-span-2 grid grid-cols-2 gap-4 p-3 bg-green-50/50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-800/30">
                 <div>
                    <label className="block text-xs font-medium text-green-700 dark:text-green-300 mb-1">Inicio Real</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 text-green-400" size={16} />
                      <input
                        type="date"
                        value={formData.real_start_date}
                        onChange={(e) => setFormData({...formData, real_start_date: e.target.value})}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-green-200 dark:border-green-800 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-green-500 outline-none text-sm"
                      />
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-green-700 dark:text-green-300 mb-1">Fin Real</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 text-green-400" size={16} />
                      <input
                        type="date"
                        value={formData.real_end_date}
                        onChange={(e) => setFormData({...formData, real_end_date: e.target.value})}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-green-200 dark:border-green-800 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-green-500 outline-none text-sm"
                      />
                    </div>
                 </div>
              </div>

            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Save size={16} />
                {editingId ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Timeline List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">Cargando fases...</div>
        ) : timelineItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-900/50 rounded-lg border border-dashed border-gray-200 dark:border-zinc-700">
            <Milestone className="mx-auto h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm">No hay fases registradas</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-gray-200 dark:border-zinc-700 ml-3 space-y-6 pl-6 py-2">
            {timelineItems.map((item) => (
              <div key={item.id} className="relative group">
                {/* Timeline Dot */}
                <div className={`absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-2 border-white dark:border-zinc-800 ${
                  item.status 
                    ? 'bg-blue-500' 
                    : 'bg-gray-300 dark:bg-zinc-600'
                }`}></div>

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 rounded-lg bg-gray-50 dark:bg-zinc-900/50 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors border border-gray-100 dark:border-zinc-800">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {item.expand?.phase?.name || 'Fase desconocida'}
                      </h4>
                      {item.expand?.status && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {item.expand.status.name}
                        </span>
                      )}
                    </div>
                    
                    {item.observations && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                        "{item.observations}"
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm mt-2">
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Planificado</span>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <Calendar size={14} className="text-gray-400" />
                          <span>
                            {formatDate(item.planned_start_date) || '-'} 
                            <span className="mx-1">→</span>
                            {formatDate(item.planned_end_date) || '-'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Real</span>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <Calendar size={14} className="text-gray-400" />
                          <span>
                            {formatDate(item.real_start_date) || '-'} 
                            <span className="mx-1">→</span>
                            {formatDate(item.real_end_date) || '-'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {item.expand?.responsible && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700">
                        <User size={14} className="text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Responsable: <span className="font-medium text-gray-900 dark:text-gray-200">{item.expand.responsible.surname}, {item.expand.responsible.name}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-start">
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
