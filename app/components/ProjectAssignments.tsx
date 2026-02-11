'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Edit2, Save, X, Search, 
  Calendar, Briefcase, User, Check, Clock
} from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { ProjectAssignment, Personal, RoleItem } from '@/app/types';
import { toast } from 'sonner';

interface ProjectAssignmentsProps {
  projectId: string;
}

export default function ProjectAssignments({ projectId }: ProjectAssignmentsProps) {
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [personalList, setPersonalList] = useState<Personal[]>([]);
  const [rolesList, setRolesList] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<ProjectAssignment>>({
    project: projectId,
    personal: '',
    start_date: '',
    end_date: '',
    roles: [],
    active: true
  });

  useEffect(() => {
    fetchAssignments();
    fetchPersonal();
    fetchRoles();
  }, [projectId]);

  const fetchAssignments = async () => {
    try {
      const records = await pb.collection('project_assignments').getFullList<ProjectAssignment>({
        filter: `project = "${projectId}"`,
        sort: '-start_date',
        expand: 'personal,roles'
      });
      setAssignments(records);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
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

  const fetchRoles = async () => {
    try {
      const records = await pb.collection('roles').getFullList<RoleItem>({
        sort: 'name',
        filter: 'active = true'
      });
      setRolesList(records);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      project: projectId,
      personal: '',
      start_date: '',
      end_date: '',
      roles: [],
      active: true
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { timeZone: 'UTC' });
  };

  const handleEdit = (item: ProjectAssignment) => {
    // Extract YYYY-MM-DD from the UTC timestamp string (safe for 'T' or space separator)
    const startDate = item.start_date && item.start_date.length >= 10 
      ? item.start_date.substring(0, 10) 
      : '';
    
    const endDate = item.end_date && item.end_date.length >= 10 
      ? item.end_date.substring(0, 10) 
      : '';

    setFormData({
      project: item.project,
      personal: item.personal,
      start_date: startDate,
      end_date: endDate,
      roles: item.roles,
      active: item.active ?? true
    });
    setEditingId(item.id);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta asignación?')) return;
    
    try {
      await pb.collection('project_assignments').delete(id);
      toast.success('Asignación eliminada correctamente');
      fetchAssignments();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error('Error al eliminar la asignación');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prepare data for PocketBase
    const dataToSend = {
      ...formData,
      // Ensure empty strings are sent as null for optional date fields
      end_date: formData.end_date ? formData.end_date : null,
    };

    try {
      if (editingId) {
        await pb.collection('project_assignments').update(editingId, dataToSend);
        toast.success('Asignación actualizada correctamente');
      } else {
        await pb.collection('project_assignments').create(dataToSend);
        toast.success('Asignación creada correctamente');
      }
      
      resetForm();
      fetchAssignments();
    } catch (error: any) {
      console.error('Error saving assignment:', error);
      // Log detailed validation errors if available
      if (error.data && error.data.data) {
        console.error('Validation errors:', error.data.data);
      }
      toast.error(`Error al guardar: ${error.message}`);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Briefcase className="text-indigo-600" size={24} />
          Asignaciones de Personal
        </h2>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Nueva Asignación
          </button>
        )}
      </div>

      <div className="p-6">
        {isEditing && (
          <div className="mb-8 bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-6 border border-gray-200 dark:border-zinc-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {editingId ? 'Editar Asignación' : 'Nueva Asignación'}
              </h3>
              <button 
                onClick={resetForm}
                className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Personal</label>
                  <select
                    required
                    value={formData.personal}
                    onChange={(e) => setFormData({...formData, personal: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    <option value="">Seleccionar Personal</option>
                    {personalList.map(person => (
                      <option key={person.id} value={person.id}>
                        {person.surname}, {person.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Asignación</label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Desvinculación</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Roles Asignados</label>
                <div className="flex flex-wrap gap-2 p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg min-h-[60px]">
                  {rolesList.map(role => {
                    const isSelected = formData.roles?.includes(role.id);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          const currentRoles = formData.roles || [];
                          const newRoles = isSelected
                            ? currentRoles.filter(id => id !== role.id)
                            : [...currentRoles, role.id];
                          setFormData({...formData, roles: newRoles});
                        }}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-400 dark:hover:border-zinc-600'
                        }`}
                      >
                        {isSelected && <Check size={12} className="stroke-[3]" />}
                        {role.name}
                      </button>
                    );
                  })}
                  {rolesList.length === 0 && (
                    <span className="text-xs text-gray-400 italic">No hay roles disponibles</span>
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({...formData, active: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Asignación Activa</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Save size={16} />
                  Guardar Asignación
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">Cargando asignaciones...</div>
        ) : assignments.length > 0 ? (
          <div className="grid gap-4">
            {assignments.map((item) => (
              <div 
                key={item.id}
                className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group"
              >
                <div className="flex items-start gap-4 mb-4 md:mb-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <User size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {item.expand?.personal?.surname}, {item.expand?.personal?.name}
                    </h4>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {(Array.isArray(item.expand?.roles) ? item.expand.roles : (item.expand?.roles ? [item.expand.roles] : [])).map((role: any) => (
                        <span key={role.id} className="px-2 py-0.5 text-xs bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md text-gray-600 dark:text-gray-400">
                          {role.name}
                        </span>
                      ))}
                      {(!item.expand?.roles || (Array.isArray(item.expand.roles) && item.expand.roles.length === 0)) && (
                        <span className="text-xs text-gray-400 italic">Sin roles asignados</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 pl-14 md:pl-0">
                  <div className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" />
                      <span>Desde: {formatDate(item.start_date)}</span>
                    </div>
                    {item.end_date && (
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-gray-400" />
                        <span>Hasta: {formatDate(item.end_date)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${
                        item.active 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' 
                          : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-zinc-800 dark:border-zinc-700'
                      }`}>
                        {item.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-dashed border-gray-200 dark:border-zinc-700">
            <Briefcase className="mx-auto text-gray-300 dark:text-zinc-600 mb-3" size={48} />
            <p className="text-gray-500 dark:text-gray-400">No hay personal asignado a este proyecto</p>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="mt-4 px-4 py-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium transition-colors"
              >
                Asignar Personal
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
