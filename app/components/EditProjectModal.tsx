'use client';

import { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { Project, RequestingArea, Personal, ProjectStatus, TechItem, ProjectTypeItem, ProjectStatusItem, ShiftItem } from '@/app/types';

interface Props {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}

// Constants (duplicated from wizard for now)
const DEFAULT_SHIFTS = ['Mañana', 'Tarde'];

export default function EditProjectModal({ project, onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState<Partial<Project>>({
    ...project,
    // Ensure arrays are arrays
    frontend_tech: project.frontend_tech || [],
    backend_tech: project.backend_tech || [],
    database: project.database || [],
    shift: typeof project.shift === 'string' ? [project.shift] : (project.shift || []), // Handle legacy string shift if any
    project_type: typeof project.project_type === 'string' ? [project.project_type] : (project.project_type || []),
  });

  const [areas, setAreas] = useState<RequestingArea[]>([]);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [feTechs, setFeTechs] = useState<TechItem[]>([]);
  const [beTechs, setBeTechs] = useState<TechItem[]>([]);
  const [dbTechs, setDbTechs] = useState<TechItem[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeItem[]>([]);
  const [statuses, setStatuses] = useState<ProjectStatusItem[]>([]);
  const [shifts, setShifts] = useState<string[]>(DEFAULT_SHIFTS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load dependencies
    Promise.all([
      pb.collection('requesting_areas').getFullList<RequestingArea>({ sort: 'name' }),
      pb.collection('personal').getFullList<Personal>({ sort: 'surname,name', filter: 'active = true' }),
      pb.collection('frontend_technologies').getFullList<TechItem>({ sort: 'name', filter: 'active = true' }).catch(() => []),
      pb.collection('backend_technologies').getFullList<TechItem>({ sort: 'name', filter: 'active = true' }).catch(() => []),
      pb.collection('database_technologies').getFullList<TechItem>({ sort: 'name', filter: 'active = true' }).catch(() => []),
      pb.collection('project_types').getFullList<ProjectTypeItem>({ sort: 'name', filter: 'active = true' }).catch(() => []),
      pb.collection('project_statuses').getFullList<ProjectStatusItem>({ sort: 'name', filter: 'active = true' }).catch(() => [])
    ]).then(([areasData, personalData, feData, beData, dbData, typesData, statusesData]) => {
      setAreas(areasData);
      setPersonal(personalData);
      setFeTechs(feData);
      setBeTechs(beData);
      setDbTechs(dbData);
      setProjectTypes(typesData);
      setStatuses(statusesData);

      // Fetch Shifts separately
      pb.collection('shifts').getFullList<ShiftItem>({ sort: 'name', filter: 'active = true' })
        .then(items => {
          if (items.length > 0) {
            setShifts(items.map(i => i.name));
          }
        })
        .catch(() => {
           console.log('Using default shifts');
        });

    }).catch(err => {
      console.error('Error loading data:', err);
      setError('Error al cargar datos necesarios. Por favor recarga la página.');
    });
  }, []);

  // Auto-calculate end date based on start date and duration
  useEffect(() => {
    if (formData.start_date && formData.estimated_duration) {
      const start = new Date(formData.start_date);
      if (!isNaN(start.getTime())) {
        const end = new Date(start);
        end.setMonth(end.getMonth() + Number(formData.estimated_duration));
        
        // Compare dates (YYYY-MM-DD) to avoid unnecessary updates/loops
        const currentEndDay = formData.estimated_end_date ? new Date(formData.estimated_end_date).toISOString().split('T')[0] : '';
        const newEndDay = end.toISOString().split('T')[0];
        
        if (currentEndDay !== newEndDay) {
          setFormData(prev => ({ ...prev, estimated_end_date: end.toISOString() }));
        }
      }
    }
  }, [formData.start_date, formData.estimated_duration]);

  const handleChange = (field: keyof Project, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleMultiSelect = (field: 'frontend_tech' | 'backend_tech' | 'database' | 'shift' | 'project_type', value: string) => {
    setFormData(prev => {
      const current = (prev[field] as string[]) || [];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter(item => item !== value) };
      } else {
        return { ...prev, [field]: [...current, value] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError('');
      
      // Clean up data before sending
      const dataToSend = {
        ...formData,
        year: Number(formData.year),
        estimated_duration: Number(formData.estimated_duration),
        // Ensure shift is always array for PB
        shift: Array.isArray(formData.shift) ? formData.shift : [],
        project_type: Array.isArray(formData.project_type) ? formData.project_type : [],
      };

      // Check for duplicates (name)
      const existingName = await pb.collection('projects').getList(1, 1, {
        filter: `system_name = "${formData.system_name}" && id != "${project.id}"`,
      });
      if (existingName.totalItems > 0) {
        throw new Error('Ya existe otro proyecto con este nombre.');
      }

      // Check for duplicates (code)
      const existingCode = await pb.collection('projects').getList(1, 1, {
        filter: `code = "${formData.code}" && id != "${project.id}"`,
      });
      if (existingCode.totalItems > 0) {
        throw new Error('Ya existe otro proyecto con este código.');
      }

      await pb.collection('projects').update(project.id, dataToSend);
      onSuccess();
    } catch (err: any) {
      // console.error('Error updating project:', err); // Suppress console error to avoid UI overlay
      setError(err.message || 'Error al actualizar el proyecto.');
      // Scroll to top of form to show error if it's rendered there, 
      // or ensure error is rendered in a visible place (e.g. top of form)
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col my-8">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b dark:border-zinc-800 shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Editar Proyecto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="edit-project-form" onSubmit={handleSubmit} className="space-y-8">
            
            {/* Error Message at the top */}
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 animate-pulse">
                <AlertCircle size={20} />
                <span className="font-medium">{error}</span>
              </div>
            )}
            
            {/* Section 1: Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide border-b pb-1">Información General</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre del Sistema</label>
                  <input 
                    type="text" 
                    required
                    value={formData.system_name}
                    onChange={e => handleChange('system_name', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Código</label>
                  <input 
                    type="text" 
                    required
                    value={formData.code}
                    onChange={e => handleChange('code', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Año</label>
                  <input 
                    type="number" 
                    required
                    value={formData.year}
                    onChange={e => handleChange('year', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Tipo de Proyecto</label>
                  <div className="flex flex-wrap gap-2">
                    {projectTypes.map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => handleMultiSelect('project_type', type.id)}
                        className={`px-3 py-1 rounded-full text-xs border ${
                          (formData.project_type as string[])?.includes(type.id)
                            ? 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-gray-400'
                        }`}
                      >
                        {type.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Estado</label>
                  <select 
                    value={formData.status}
                    onChange={e => handleChange('status', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                  >
                    <option value="">Seleccionar Estado</option>
                    {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">¿Activo?</label>
                  <label className="inline-flex items-center cursor-pointer mt-2">
                    <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={!!formData.active}
                        onChange={(e) => handleChange('active', e.target.checked)}
                    />
                    <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">{formData.active ? 'Activo' : 'Inactivo'}</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Section 2: Responsibles */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide border-b pb-1">Responsables y Turno</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Area Solicitante</label>
                  <select 
                    value={formData.requesting_area}
                    onChange={e => handleChange('requesting_area', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                  >
                    <option value="">Seleccionar Area</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Product Owner</label>
                  <select 
                    value={formData.personal}
                    onChange={e => handleChange('personal', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                  >
                    <option value="">Seleccionar PO</option>
                    {personal.map(p => <option key={p.id} value={p.id}>{p.surname}, {p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Turno de Desarrollo</label>
                  <div className="flex gap-4">
                    {shifts.map(shift => (
                      <label key={shift} className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={(formData.shift as string[])?.includes(shift)}
                          onChange={() => handleMultiSelect('shift', shift)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{shift}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Tech Stack */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide border-b pb-1">Stack Tecnológico</h3>
              
              <div>
                <label className="block text-sm font-medium mb-2">Frontend</label>
                <div className="flex flex-wrap gap-2">
                  {feTechs.map(tech => (
                    <button
                      key={tech.id}
                      type="button"
                      onClick={() => handleMultiSelect('frontend_tech', tech.id)}
                      className={`px-3 py-1 rounded-full text-xs border ${
                        (formData.frontend_tech as string[])?.includes(tech.id)
                          ? 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-gray-400'
                      }`}
                    >
                      {tech.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Backend</label>
                <div className="flex flex-wrap gap-2">
                  {beTechs.map(tech => (
                    <button
                      key={tech.id}
                      type="button"
                      onClick={() => handleMultiSelect('backend_tech', tech.id)}
                      className={`px-3 py-1 rounded-full text-xs border ${
                        (formData.backend_tech as string[])?.includes(tech.id)
                          ? 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-gray-400'
                      }`}
                    >
                      {tech.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Base de Datos</label>
                <div className="flex flex-wrap gap-2">
                  {dbTechs.map(tech => (
                    <button
                      key={tech.id}
                      type="button"
                      onClick={() => handleMultiSelect('database', tech.id)}
                      className={`px-3 py-1 rounded-full text-xs border ${
                        (formData.database as string[])?.includes(tech.id)
                          ? 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-gray-400'
                      }`}
                    >
                      {tech.name}
                    </button>
                  ))}
                </div>
              </div>

               <div>
                  <label className="block text-sm font-medium mb-1">Servidor / Despliegue</label>
                  <input 
                    type="text" 
                    value={formData.server || ''}
                    onChange={e => handleChange('server', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                    placeholder="Ej: VPS, Vercel, On-premise..."
                  />
                </div>
            </div>

            {/* Section 4: Timeline */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide border-b pb-1">Tiempos</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha de Inicio</label>
                  <input 
                    type="date" 
                    value={formData.start_date ? new Date(formData.start_date).toISOString().split('T')[0] : ''}
                    onChange={e => handleChange('start_date', e.target.value ? new Date(e.target.value).toISOString() : '')}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha Fin Estimada</label>
                  <input 
                    type="date" 
                    readOnly
                    tabIndex={-1}
                    value={formData.estimated_end_date ? new Date(formData.estimated_end_date).toISOString().split('T')[0] : ''}
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-500 dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Duración (meses)</label>
                  <input 
                    type="number" 
                    min="1"
                    value={formData.estimated_duration}
                    onChange={e => handleChange('estimated_duration', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Extra */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide border-b pb-1">Detalles Adicionales</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Carpeta Drive</label>
                <input 
                  type="url" 
                  value={formData.drive_folder || ''}
                  onChange={e => handleChange('drive_folder', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                  placeholder="URL de la carpeta (https://...)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Observaciones</label>
                <textarea 
                  rows={4}
                  value={formData.observations || ''}
                  onChange={e => handleChange('observations', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t dark:border-zinc-800 shrink-0 flex justify-end gap-3 bg-gray-50 dark:bg-zinc-900/50 rounded-b-2xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            form="edit-project-form"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando...' : (
              <>
                <Save size={18} />
                Guardar Cambios
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
