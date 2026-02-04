'use client';

import { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { Project, RequestingArea, ProductOwner, ProjectStatus } from '@/app/types';

interface Props {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}

// Constants (duplicated from wizard for now)
const PROJECT_TYPES = ['Interno', 'Externo', 'Opensource'];
const SHIFTS = ['Mañana', 'Tarde'];
const STATUS_OPTIONS: ProjectStatus[] = [
  'Planificación', 'Análisis', 'Diseño', 'Desarrollo', 'Testing', 
  'Despliegue', 'Capacitación', 'Producción', 'Necesita Informacion', 
  'Finalizado', 'Archivado', 'Exitoso', 'Fracaso', 'Muerto', 
  'Suspendido', 'Mantenimiento'
];
const FE_TECHS = ['React', 'Vue', 'Angular', 'Next.js', 'Svelte', 'Tailwind', 'Bootstrap'];
const BE_TECHS = ['Node.js', 'Python', 'Go', 'Java', 'PHP', 'C#', 'PocketBase', 'Express'];
const DATABASES = ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite', 'Redis', 'Firebase'];

export default function EditProjectModal({ project, onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState<Partial<Project>>({
    ...project,
    // Ensure arrays are arrays
    frontend_tech: project.frontend_tech || [],
    backend_tech: project.backend_tech || [],
    database: project.database || [],
    shift: typeof project.shift === 'string' ? [project.shift] : (project.shift || []), // Handle legacy string shift if any
  });

  const [areas, setAreas] = useState<RequestingArea[]>([]);
  const [productOwners, setProductOwners] = useState<ProductOwner[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load dependencies
    Promise.all([
      pb.collection('requesting_areas').getFullList<RequestingArea>({ sort: 'name' }),
      pb.collection('product_owners').getFullList<ProductOwner>({ sort: 'name' })
    ]).then(([areasData, ownersData]) => {
      setAreas(areasData);
      setProductOwners(ownersData);
    }).catch(err => console.error('Error loading dependencies:', err));
  }, []);

  const handleChange = (field: keyof Project, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleMultiSelect = (field: 'frontend_tech' | 'backend_tech' | 'database' | 'shift', value: string) => {
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
      };

      await pb.collection('projects').update(project.id, dataToSend);
      onSuccess();
    } catch (err: any) {
      console.error('Error updating project:', err);
      setError(err.message || 'Error al actualizar el proyecto.');
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
                  <label className="block text-sm font-medium mb-1">Tipo de Proyecto</label>
                  <select 
                    value={formData.project_type}
                    onChange={e => handleChange('project_type', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                  >
                    {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Estado</label>
                  <select 
                    value={formData.status}
                    onChange={e => handleChange('status', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
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
                    value={formData.product_owner}
                    onChange={e => handleChange('product_owner', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                  >
                    <option value="">Seleccionar PO</option>
                    {productOwners.map(po => <option key={po.id} value={po.id}>{po.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Turno de Desarrollo</label>
                  <div className="flex gap-4">
                    {SHIFTS.map(shift => (
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
                  {FE_TECHS.map(tech => (
                    <button
                      key={tech}
                      type="button"
                      onClick={() => handleMultiSelect('frontend_tech', tech)}
                      className={`px-3 py-1 rounded-full text-xs border ${
                        (formData.frontend_tech as string[])?.includes(tech)
                          ? 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-gray-400'
                      }`}
                    >
                      {tech}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Backend</label>
                <div className="flex flex-wrap gap-2">
                  {BE_TECHS.map(tech => (
                    <button
                      key={tech}
                      type="button"
                      onClick={() => handleMultiSelect('backend_tech', tech)}
                      className={`px-3 py-1 rounded-full text-xs border ${
                        (formData.backend_tech as string[])?.includes(tech)
                          ? 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-gray-400'
                      }`}
                    >
                      {tech}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Base de Datos</label>
                <div className="flex flex-wrap gap-2">
                  {DATABASES.map(tech => (
                    <button
                      key={tech}
                      type="button"
                      onClick={() => handleMultiSelect('database', tech)}
                      className={`px-3 py-1 rounded-full text-xs border ${
                        (formData.database as string[])?.includes(tech)
                          ? 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-gray-400'
                      }`}
                    >
                      {tech}
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
                    className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha Fin Estimada</label>
                  <input 
                    type="date" 
                    value={formData.estimated_end_date ? new Date(formData.estimated_end_date).toISOString().split('T')[0] : ''}
                    onChange={e => handleChange('estimated_end_date', e.target.value ? new Date(e.target.value).toISOString() : '')}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
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
                  type="text" 
                  value={formData.drive_folder || ''}
                  onChange={e => handleChange('drive_folder', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                  placeholder="URL de la carpeta"
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

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                <AlertCircle size={20} />
                {error}
              </div>
            )}

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
