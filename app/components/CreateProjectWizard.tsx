'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, ChevronUp, X, Sparkles, Search, Briefcase, Plus, Edit2, Trash2, Calendar, Clock, User, Save } from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { Project, RequestingArea, Personal, TechItem, ProjectStatusItem, ProjectTypeItem, ShiftItem, RoleItem } from '@/app/types';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for classes
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_SHIFTS = ['Mañana', 'Tarde'];

interface WizardProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface TempAssignment {
  id: string;
  personal: string;
  start_date: string;
  end_date: string;
  roles: string[];
  active: boolean;
}

export default function CreateProjectWizard({ onClose, onSuccess }: WizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [areas, setAreas] = useState<RequestingArea[]>([]);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [statuses, setStatuses] = useState<ProjectStatusItem[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeItem[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [feTechs, setFeTechs] = useState<TechItem[]>([]);
  const [beTechs, setBeTechs] = useState<TechItem[]>([]);
  const [dbTechs, setDbTechs] = useState<TechItem[]>([]);
  const [rolesList, setRolesList] = useState<RoleItem[]>([]); // Roles list
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); // Added search term state
  
  // Assignment Management State
  const [assignments, setAssignments] = useState<TempAssignment[]>([]);
  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [assignmentSearchTerm, setAssignmentSearchTerm] = useState('');
  const [assignmentForm, setAssignmentForm] = useState<TempAssignment>({
    id: '',
    personal: '',
    start_date: '',
    end_date: '',
    roles: [],
    active: true
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Project>>({
    code: '',
    year: new Date().getFullYear(),
    system_name: '',
    requesting_area: '',
    project_type: [],
    status: '',
    frontend_tech: [],
    backend_tech: [],
    database: [],
    shift: [],
    estimated_duration: 1,
    start_date: '',
    estimated_end_date: '',
    personal: '',
    observations: '',
    drive_folder: '',
    server: '',
    active: true
  });

  // Use a ref to access the latest formData inside closures (like setTimeout or async validations)
  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    // Fetch areas
    pb.collection('requesting_areas').getFullList<RequestingArea>({ sort: 'name', filter: 'active = true' })
      .then(setAreas)
      .catch(console.error);
    
    // Fetch personal
    pb.collection('personal').getFullList<Personal>({ 
      sort: 'surname,name', 
      // Removed filter to show all personal, or adjust based on needs. 
      // If 'active' field exists on personal, ensure it's boolean.
      // Based on types.ts, 'active' is not explicitly on Personal interface but might be there.
      // However, let's try without filter first to debug if it's a filtering issue.
      // Actually, looking at types.ts, Personal has 'status' which is a relation string.
      // So 'active = true' might fail if active is not a direct boolean field.
    })
      .then(setPersonal)
      .catch(console.error);

    // Fetch Statuses
    pb.collection('project_statuses').getFullList<ProjectStatusItem>({ sort: 'name', filter: 'active = true' })
      .then(setStatuses)
      .catch(console.error);

    // Fetch Project Types
    pb.collection('project_types').getFullList<ProjectTypeItem>({ sort: 'name', filter: 'active = true' })
      .then(setProjectTypes)
      .catch(console.error);

    pb.collection('shifts').getFullList<ShiftItem>({ sort: 'name', filter: 'active = true' })
      .then(setShifts)
      .catch(console.error);

    // Fetch Technologies
    pb.collection('frontend_technologies').getFullList<TechItem>({ sort: 'name', filter: 'active = true' })
      .then(setFeTechs)
      .catch(console.error);

    pb.collection('backend_technologies').getFullList<TechItem>({ sort: 'name', filter: 'active = true' })
      .then(setBeTechs)
      .catch(console.error);

    pb.collection('database_technologies').getFullList<TechItem>({ sort: 'name', filter: 'active = true' })
      .then(setDbTechs)
      .catch(console.error);

    // Fetch Roles
    pb.collection('roles').getFullList<RoleItem>({ sort: 'name', filter: 'active = true' })
      .then(setRolesList)
      .catch(console.error);
  }, []);

  // Auto-calculate end date based on start date and duration
  useEffect(() => {
    if (formData.start_date && formData.estimated_duration) {
      const start = new Date(formData.start_date);
      if (!isNaN(start.getTime())) {
        const end = new Date(start);
        end.setMonth(end.getMonth() + Number(formData.estimated_duration));
        const endString = end.toISOString().split('T')[0];
        // Only update if different to avoid loops (though with primitive check it's fine)
        if (formData.estimated_end_date !== endString) {
          setFormData(prev => ({ ...prev, estimated_end_date: endString }));
        }
      }
    }
  }, [formData.start_date, formData.estimated_duration]);

  // Questions configuration
  const questions = [
    {
      id: 'intro',
      type: 'intro',
      title: '¡Hola! 👋',
      description: 'Vamos a dar de alta un nuevo proyecto. ¿Estás listo?',
      validate: () => true,
    },
    {
      id: 'system_name',
      title: '2. ¿Cuál es el nombre del sistema?',
      description: 'Escribe un nombre corto y descriptivo.',
      type: 'text',
      field: 'system_name',
      placeholder: 'Ej: Sistema de Gestión de Expedientes',
      validate: async () => {
        if (!formDataRef.current.system_name) return false;
        try {
          const records = await pb.collection('projects').getList(1, 1, {
            filter: `system_name = "${formDataRef.current.system_name}"`,
          });
          if (records.totalItems > 0) throw new Error('Ya existe un proyecto con este nombre.');
          return true;
        } catch (e: any) {
          if (e.message === 'Ya existe un proyecto con este nombre.') throw e;
          console.error(e);
          return false;
        }
      },
    },
    {
      id: 'code',
      title: '3. ¿Qué código identificador tendrá?',
      description: 'Suele ser una sigla única.',
      type: 'text',
      field: 'code',
      placeholder: 'Ej: SGE-2024',
      validate: async () => {
        if (!formDataRef.current.code) return false;
        try {
          const records = await pb.collection('projects').getList(1, 1, {
            filter: `code = "${formDataRef.current.code}"`,
          });
          if (records.totalItems > 0) throw new Error('Ya existe un proyecto con este código.');
          return true;
        } catch (e: any) {
          if (e.message === 'Ya existe un proyecto con este código.') throw e;
          console.error(e);
          return false;
        }
      },
    },
    {
      id: 'year_duration',
      title: '4. Año y Duración estimada',
      description: 'Indica el año de inicio y cuántos meses tomará.',
      type: 'group',
      fields: ['year', 'estimated_duration'],
      validate: () => !!formDataRef.current.year && !!formDataRef.current.estimated_duration,
    },
    {
      id: 'status',
      title: '5. Estado del Proyecto',
      description: '¿En qué etapa se encuentra?',
      type: 'select',
      searchable: true,
      field: 'status',
      options: statuses.map(s => ({ label: s.name, value: s.id })),
      validate: () => !!formDataRef.current.status,
    },
    {
      id: 'active',
      title: '6. ¿El proyecto está activo?',
      description: 'Indica si el proyecto se encuentra en curso.',
      type: 'boolean',
      field: 'active',
      validate: () => true,
    },
    {
      id: 'dates',
      title: '7. Fechas Importantes',
      description: 'Inicio y finalización estimada.',
      type: 'dates-group',
      fields: ['start_date', 'estimated_end_date'],
      validate: () => !!formDataRef.current.start_date, // End date might be optional? User said "Fecha de finalización estimada", implied required but maybe not. I'll make start date required.
    },
    {
      id: 'area',
      title: '8. Área Solicitante',
      description: '¿Quién solicitó este desarrollo?',
      type: 'select',
      searchable: true,
      field: 'requesting_area',
      options: areas.map(a => ({ label: a.name, value: a.id })),
      validate: () => !!formDataRef.current.requesting_area,
    },
    {
      id: 'assignments',
      title: '9. Asignaciones de Personal',
      description: 'Gestiona el equipo del proyecto.',
      type: 'assignments-manager',
      field: 'assignments',
      validate: () => assignments.length > 0,
    },
    {
      id: 'type',
      title: '10. Tipo de Proyecto',
      description: 'Selecciona la naturaleza del proyecto.',
      type: 'cards',
      field: 'project_type',
      options: projectTypes.map(t => ({ label: t.name, value: t.id })),
      validate: () => (formDataRef.current.project_type?.length || 0) > 0,
    },
    {
      id: 'tech_stack',
      title: '11. Stack Tecnológico',
      description: 'Selecciona todas las tecnologías que apliquen.',
      type: 'multiselect-group',
      groups: [
        { label: 'Frontend', field: 'frontend_tech', options: feTechs },
        { label: 'Backend', field: 'backend_tech', options: beTechs },
        { label: 'Base de Datos', field: 'database', options: dbTechs },
      ],
      validate: () => true, // Optional
    },
    {
      id: 'shift',
      title: '12. Turno de Desarrollo',
      description: '¿En qué turno se trabajará?',
      type: 'cards',
      field: 'shift',
      options: shifts.map(s => ({ label: s.name, value: s.name })),
      validate: () => (formDataRef.current.shift?.length || 0) > 0,
    },
    {
      id: 'observations',
      title: '13. Observaciones',
      description: 'Detalles adicionales, notas o comentarios.',
      type: 'textarea',
      field: 'observations',
      placeholder: 'Escribe aquí...',
      validate: () => true, // Optional
    },
    {
      id: 'drive',
      title: '14. Carpeta de Drive',
      description: 'Enlace o nombre de la carpeta de documentación.',
      type: 'text',
      inputType: 'url',
      field: 'drive_folder',
      placeholder: 'Ej: https://drive.google.com/...',
      validate: () => {
        if (!formDataRef.current.drive_folder) return true;
        try {
          new URL(formDataRef.current.drive_folder);
          return true;
        } catch {
          throw new Error('La URL ingresada no es válida. Debe comenzar con http:// o https://');
        }
      },
    },
    {
      id: 'server',
      title: '15. Servidor',
      description: 'Información sobre el servidor de despliegue.',
      type: 'textarea', // Rich text requested, so textarea
      field: 'server',
      placeholder: 'Ej: Servidor Linux Ubuntu 20.04...',
      validate: () => true, // Optional
    },
    {
      id: 'review',
      type: 'review',
      title: '¡Todo listo!',
      description: 'Revisa los datos antes de crear el proyecto.',
      validate: () => true,
    }
  ];

  const totalSteps = questions.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleNext = async () => {
    const question = questions[currentStep];
    let isValid = false;
    let errorMessage = 'Por favor completa este campo para continuar.';

    try {
      const result = question.validate();
      if (result instanceof Promise) {
        isValid = await result;
      } else {
        isValid = result;
      }
    } catch (error: any) {
      isValid = false;
      errorMessage = error.message || errorMessage;
    }

    if (isValid) {
      setError('');
      setSearchTerm(''); // Clear search on next
      if (currentStep < totalSteps - 1) {
        setDirection(1);
        setCurrentStep(prev => prev + 1);
      } else {
        handleSubmit();
      }
    } else {
      setError(errorMessage);
    }
  };

  const handlePrev = () => {
    setError('');
    setSearchTerm(''); // Clear search on prev
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && questions[currentStep].type !== 'multiselect-group') {
      e.preventDefault();
      handleNext();
    }
  };

  const handleSaveAssignment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!assignmentForm.personal || !assignmentForm.start_date) {
      alert('Debes seleccionar personal y fecha de asignación');
      return;
    }

    if (editingAssignmentId) {
      setAssignments(prev => prev.map(a => 
        a.id === editingAssignmentId 
          ? { ...assignmentForm, id: editingAssignmentId } 
          : a
      ));
      setEditingAssignmentId(null);
    } else {
      const newAssignment: TempAssignment = {
        ...assignmentForm,
        id: Math.random().toString(36).substr(2, 9)
      };
      setAssignments(prev => [...prev, newAssignment]);
    }
    
    resetAssignmentForm();
  };

  const handleEditAssignment = (assignment: TempAssignment) => {
    setAssignmentForm({
      id: assignment.id,
      personal: assignment.personal,
      start_date: assignment.start_date,
      end_date: assignment.end_date,
      roles: assignment.roles,
      active: assignment.active
    });
    // Find personal name for search term
    const person = personal.find(p => p.id === assignment.personal);
    if (person) {
      setAssignmentSearchTerm(`${person.surname}, ${person.name}`);
    } else {
      setAssignmentSearchTerm('');
    }
    
    setEditingAssignmentId(assignment.id);
    setIsEditingAssignment(true);
  };

  const handleDeleteAssignment = (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  const resetAssignmentForm = () => {
    setAssignmentForm({
      id: '',
      personal: '',
      start_date: '',
      end_date: '',
      roles: [],
      active: true
    });
    setAssignmentSearchTerm('');
    setIsEditingAssignment(false);
    setEditingAssignmentId(null);
  };

  const updateField = (field: string, value: any) => {
    if (field === 'assignments') {
      // Assignments are handled separately now
      return;
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    
    if (error) setError('');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Prepare data for submission
      // 1. Remove 'personal' field as it is now handled by assignments
      // 2. Ensure empty strings for optional dates/urls are converted to null to avoid validation errors
      const projectData: Record<string, any> = { ...formData };
      
      // Explicitly set personal to null to avoid "empty string" validation error on relation field
      projectData.personal = null;
      
      if (projectData.estimated_end_date === '') projectData.estimated_end_date = null;
      if (projectData.drive_folder === '') projectData.drive_folder = null;
      if (projectData.server === '') projectData.server = null;
      if (projectData.observations === '') projectData.observations = null;
      
      // requestKey: null ensures this request is never cancelled by auto-cancellation
      const newProject = await pb.collection('projects').create<Project>(projectData, { requestKey: null });

      // Create assignments
      if (assignments.length > 0) {
        await Promise.all(assignments.map(assignment => 
          pb.collection('project_assignments').create({
            project: newProject.id,
            personal: assignment.personal,
            start_date: assignment.start_date,
            end_date: assignment.end_date || null,
            roles: assignment.roles,
            active: assignment.active,
          })
        ));
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error creating project:', err);
      
      let errorMessage = 'Error al crear el proyecto.';
      
      if (err.data?.data) {
        console.error('Validation data:', err.data.data);
        const fieldErrors = Object.entries(err.data.data)
          .map(([key, value]: [string, any]) => `${key}: ${value.message}`)
          .join('\n');
        errorMessage += `\n\nErrores de validación:\n${fieldErrors}`;
      } else if (err.message) {
        errorMessage += `\n${err.message}`;
      }
      
      alert(errorMessage);
      console.error('Full Error:', err); // Log full error for debugging
      setIsSubmitting(false);
    }
  };

  // Render Helpers
  const renderField = (question: any) => {
    switch (question.type) {
      case 'intro':
        return (
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4 animate-bounce">
                <Sparkles size={48} />
            </div>
            <button
              onClick={handleNext}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xl px-8 py-4 rounded-lg font-bold transition-all transform hover:scale-105 shadow-lg flex items-center gap-3"
            >
              Comenzar <ArrowRight />
            </button>
            <p className="text-sm text-gray-500 mt-4">Presiona Enter ↵</p>
          </div>
        );

      case 'boolean':
        return (
          <div className="flex flex-col items-center space-y-4">
             <button
                onClick={() => updateField(question.field, !formData[question.field as keyof Project])}
                className={`relative w-20 h-10 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  formData[question.field as keyof Project] ? 'bg-green-500' : 'bg-gray-300'
                }`}
             >
                <span
                  className={`absolute top-1 left-1 bg-white w-8 h-8 rounded-full shadow-md transform transition-transform duration-300 ${
                    formData[question.field as keyof Project] ? 'translate-x-10' : ''
                  }`}
                />
             </button>
             <span className="text-xl font-medium text-gray-700 dark:text-gray-300">
               {formData[question.field as keyof Project] ? 'Sí, Activo' : 'No, Inactivo'}
             </span>
          </div>
        );

      case 'text':
        return (
          <div key={question.id} className="w-full max-w-2xl">
            <input
              autoFocus
              type={question.inputType || 'text'}
              value={formData[question.field as keyof Project] as string}
              onChange={(e) => updateField(question.field, e.target.value)}
              placeholder={question.placeholder}
              className="w-full text-3xl md:text-5xl bg-transparent border-b-2 border-gray-300 focus:border-blue-600 outline-none py-4 placeholder:text-gray-300 transition-colors font-light"
              onKeyDown={handleKeyDown}
            />
            {question.inputType === 'url' && (
               <p className="text-sm text-gray-400 mt-2">Asegúrate de incluir https://</p>
            )}
          </div>
        );
      
      case 'textarea':
        return (
          <div className="w-full max-w-2xl">
            <textarea
              autoFocus
              value={formData[question.field as keyof Project] as string}
              onChange={(e) => updateField(question.field, e.target.value)}
              placeholder={question.placeholder}
              className="w-full h-48 text-xl bg-transparent border-2 border-gray-200 dark:border-zinc-700 rounded-lg p-4 focus:border-blue-600 outline-none transition-colors resize-none"
              onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) handleNext();
              }}
            />
            <p className="text-sm text-gray-400 mt-2 text-right">Ctrl + Enter para continuar</p>
          </div>
        );

      case 'group':
        return (
          <div className="flex gap-4 w-full max-w-2xl">
             <div className="flex-1">
                <label className="block text-sm font-medium text-gray-500 mb-1">Año</label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => updateField('year', parseInt(e.target.value))}
                  className="w-full text-3xl bg-transparent border-b-2 border-gray-300 focus:border-blue-600 outline-none py-2"
                />
             </div>
             <div className="flex-1">
                <label className="block text-sm font-medium text-gray-500 mb-1">Duración (Meses)</label>
                <input
                  type="number"
                  value={formData.estimated_duration}
                  onChange={(e) => updateField('estimated_duration', parseInt(e.target.value))}
                  className="w-full text-3xl bg-transparent border-b-2 border-gray-300 focus:border-blue-600 outline-none py-2"
                />
             </div>
          </div>
        );

      case 'dates-group':
        return (
          <div className="flex flex-col md:flex-row gap-6 w-full max-w-3xl">
             <div className="flex-1">
                <label className="block text-sm font-medium text-gray-500 mb-2">Fecha Inicio</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => updateField('start_date', e.target.value)}
                  className="w-full text-xl bg-transparent border border-gray-300 rounded-lg p-3 focus:border-blue-600 outline-none dark:border-zinc-700 dark:[color-scheme:dark]"
                />
             </div>
             <div className="flex-1">
                <label className="block text-sm font-medium text-gray-500 mb-2">Fecha Fin Estimada</label>
                <input
                  type="date"
                  value={formData.estimated_end_date}
                  onChange={(e) => updateField('estimated_end_date', e.target.value)}
                  className="w-full text-xl bg-transparent border border-gray-300 rounded-lg p-3 focus:border-blue-600 outline-none dark:border-zinc-700 dark:[color-scheme:dark]"
                />
             </div>
          </div>
        );

      case 'assignments-manager':
        return (
          <div className="w-full max-w-4xl space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="text-indigo-600" size={24} />
                  Asignaciones
                </h2>
                {!isEditingAssignment && (
                  <button
                    onClick={() => setIsEditingAssignment(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <Plus size={16} />
                    Nueva Asignación
                  </button>
                )}
              </div>

              <div className="p-6">
                {isEditingAssignment && (
                  <div className="mb-8 bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-6 border border-gray-200 dark:border-zinc-700">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {editingAssignmentId ? 'Editar Asignación' : 'Nueva Asignación'}
                      </h3>
                      <button 
                        onClick={resetAssignmentForm}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
                      >
                        <X size={18} className="text-gray-500" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Personal</label>
                          
                          {/* Custom Combobox for Personal */}
                          <div className="relative">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                              <input
                                type="text"
                                placeholder="Buscar y seleccionar personal..."
                                value={assignmentSearchTerm}
                                onChange={(e) => setAssignmentSearchTerm(e.target.value)}
                                onFocus={() => setAssignmentSearchTerm(assignmentSearchTerm || '')}
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white placeholder:text-gray-400"
                              />
                              {assignmentForm.personal && (
                                <button
                                  onClick={() => {
                                    setAssignmentForm({...assignmentForm, personal: ''});
                                    setAssignmentSearchTerm('');
                                  }}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                            
                            {/* Dropdown Results */}
                            {assignmentSearchTerm && !assignmentForm.personal && (
                              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                                {personal
                                  .filter(person => {
                                    const fullName = `${person.surname}, ${person.name}`.toLowerCase();
                                    return fullName.includes(assignmentSearchTerm.toLowerCase());
                                  })
                                  .map(person => (
                                    <button
                                      key={person.id}
                                      onClick={() => {
                                        setAssignmentForm({...assignmentForm, personal: person.id});
                                        setAssignmentSearchTerm(`${person.surname}, ${person.name}`);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                                    >
                                      <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-medium shrink-0">
                                        {person.name[0]}{person.surname[0]}
                                      </div>
                                      <span>{person.surname}, {person.name}</span>
                                    </button>
                                  ))
                                }
                                {personal.filter(p => `${p.surname}, ${p.name}`.toLowerCase().includes(assignmentSearchTerm.toLowerCase())).length === 0 && (
                                  <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                    No se encontraron resultados
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Asignación</label>
                            <input
                              type="date"
                              required
                              value={assignmentForm.start_date}
                              onChange={(e) => setAssignmentForm({...assignmentForm, start_date: e.target.value})}
                              className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:[color-scheme:dark]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Desvinculación</label>
                            <input
                              type="date"
                              value={assignmentForm.end_date}
                              onChange={(e) => setAssignmentForm({...assignmentForm, end_date: e.target.value})}
                              className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:[color-scheme:dark]"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Roles Asignados</label>
                        <div className="flex flex-wrap gap-2 p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg min-h-[60px]">
                          {rolesList.map(role => {
                            const isSelected = assignmentForm.roles?.includes(role.id);
                            return (
                              <button
                                key={role.id}
                                type="button"
                                onClick={() => {
                                  const currentRoles = assignmentForm.roles || [];
                                  const newRoles = isSelected
                                    ? currentRoles.filter(id => id !== role.id)
                                    : [...currentRoles, role.id];
                                  setAssignmentForm({...assignmentForm, roles: newRoles});
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
                            checked={assignmentForm.active}
                            onChange={(e) => setAssignmentForm({...assignmentForm, active: e.target.checked})}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Asignación Activa</span>
                        </label>
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={resetAssignmentForm}
                          className="px-4 py-2 text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveAssignment()}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                          <Save size={16} />
                          Guardar Asignación
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {assignments.length > 0 ? (
                  <div className="grid gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {assignments.map((item) => {
                      const person = personal.find(p => p.id === item.personal);
                      return (
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
                                {person ? `${person.surname}, ${person.name}` : 'Desconocido'}
                              </h4>
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                {item.roles.map((roleId) => {
                                  const role = rolesList.find(r => r.id === roleId);
                                  return (
                                    <span key={roleId} className="px-2 py-0.5 text-xs bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md text-gray-600 dark:text-gray-400">
                                      {role ? role.name : 'Rol desconocido'}
                                    </span>
                                  );
                                })}
                                {item.roles.length === 0 && (
                                  <span className="text-xs text-gray-400 italic">Sin roles asignados</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 pl-14 md:pl-0">
                            <div className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-400">
                              <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-gray-400" />
                                <span>Desde: {new Date(item.start_date).toLocaleDateString('es-ES', { timeZone: 'UTC' })}</span>
                              </div>
                              {item.end_date && (
                                <div className="flex items-center gap-2">
                                  <Clock size={14} className="text-gray-400" />
                                  <span>Hasta: {new Date(item.end_date).toLocaleDateString('es-ES', { timeZone: 'UTC' })}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEditAssignment(item)}
                                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteAssignment(item.id)}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-dashed border-gray-200 dark:border-zinc-700">
                    <Briefcase className="mx-auto text-gray-300 dark:text-zinc-600 mb-3" size={48} />
                    <p className="text-gray-500 dark:text-gray-400">No hay personal asignado</p>
                    {!isEditingAssignment && (
                      <button
                        onClick={() => setIsEditingAssignment(true)}
                        className="mt-4 px-4 py-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium transition-colors"
                      >
                        Asignar Personal
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'select':
        // Filter options if search is enabled
        const filteredOptions = question.searchable 
          ? question.options.filter((opt: any) => 
              opt.label.toLowerCase().includes(searchTerm.toLowerCase())
            )
          : question.options;

        return (
          <div className="w-full max-w-xl space-y-4">
            {question.searchable && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-zinc-700 focus:border-blue-600 outline-none bg-transparent transition-colors"
                  autoFocus
                />
              </div>
            )}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredOptions.map((opt: any) => (
              <button
                key={opt.value}
                onClick={() => {
                   updateField(question.field, opt.value);
                   setTimeout(handleNext, 150);
                }}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  formData[question.field as keyof Project] === opt.value
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-zinc-700 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                   <span className="font-medium">{opt.label}</span>
                   {formData[question.field as keyof Project] === opt.value && <Check size={20} />}
                </div>
              </button>
            ))}
            {filteredOptions.length === 0 && (
                <p className="text-center text-gray-500 py-4">No se encontraron resultados.</p>
            )}
            </div>
          </div>
        );

      case 'cards':
         return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
               {question.options.map((opt: { label: string, value: string }) => {
                  const isSelected = (formData[question.field as keyof Project] as string[]).includes(opt.value);
                  return (
                     <button
                        key={opt.value}
                        onClick={() => {
                           const current = formData[question.field as keyof Project] as string[];
                           const newValues = current.includes(opt.value) 
                              ? current.filter(x => x !== opt.value)
                              : [...current, opt.value];
                           updateField(question.field, newValues);
                        }}
                        className={`p-6 rounded-xl border-2 transition-all ${
                           isSelected
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                              : 'border-gray-200 dark:border-zinc-700 hover:border-blue-300'
                        }`}
                     >
                        <div className="flex items-center justify-between mb-2">
                           <span className="font-bold text-lg">{opt.label}</span>
                           {isSelected && <Check className="text-blue-600" size={20} />}
                        </div>
                     </button>
                  );
               })}
            </div>
         );

      case 'multiselect':
          return (
             <div className="flex flex-wrap gap-3 w-full max-w-2xl justify-center">
                {question.options.map((opt: string) => {
                   const isSelected = (formData[question.field as keyof Project] as string[]).includes(opt);
                   return (
                      <button
                         key={opt}
                         onClick={() => {
                            const current = formData[question.field as keyof Project] as string[];
                            const newValues = current.includes(opt) 
                               ? current.filter(x => x !== opt)
                               : [...current, opt];
                            updateField(question.field, newValues);
                         }}
                         className={`px-6 py-3 rounded-full border-2 transition-all ${
                            isSelected
                               ? 'border-blue-600 bg-blue-600 text-white shadow-lg transform scale-105'
                               : 'border-gray-200 dark:border-zinc-700 hover:border-blue-300'
                         }`}
                      >
                         {opt}
                      </button>
                   );
                })}
             </div>
          );

      case 'multiselect-group':
          return (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl p-2">
                {question.groups.map((group: any) => (
                   <div key={group.label} className="space-y-3">
                      <h4 className="font-bold text-gray-500 border-b pb-2">{group.label}</h4>
                      <div className="space-y-2">
                         {group.options.map((opt: TechItem) => {
                             const isSelected = (formData[group.field as keyof Project] as string[]).includes(opt.id);
                             return (
                                <button
                                   key={opt.id}
                                   onClick={() => {
                                      const current = formData[group.field as keyof Project] as string[];
                                      const newValues = isSelected
                                         ? current.filter(x => x !== opt.id)
                                         : [...current, opt.id];
                                      updateField(group.field, newValues);
                                   }}
                                   className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center justify-between ${
                                      isSelected
                                         ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                         : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                   }`}
                                >
                                   <span className="truncate">{opt.name}</span>
                                   {isSelected && <Check size={16} />}
                                </button>
                             );
                         })}
                      </div>
                   </div>
                ))}
             </div>
          );

      case 'review':
        return (
           <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-xl p-6 border border-gray-200 dark:border-zinc-700 shadow-sm space-y-4">
              <h3 className="font-bold text-xl mb-4">Resumen del Proyecto</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                 <div className="col-span-2 md:col-span-1">
                    <span className="block text-gray-500">Nombre</span>
                    <span className="font-medium">{formData.system_name || '-'}</span>
                 </div>
                 <div className="col-span-2 md:col-span-1">
                    <span className="block text-gray-500">Código</span>
                    <span className="font-medium">{formData.code || '-'}</span>
                 </div>
                 
                 <div className="col-span-2 md:col-span-1">
                    <span className="block text-gray-500">Estado</span>
                    <span className="font-medium">
                        {statuses.find(s => s.id === formData.status)?.name || formData.status || '-'}
                    </span>
                 </div>
                 <div className="col-span-2 md:col-span-1">
                    <span className="block text-gray-500">Tipo</span>
                    <span className="font-medium">
                        {formData.project_type?.map(id => projectTypes.find(t => t.id === id)?.name || id).join(', ') || '-'}
                    </span>
                 </div>

                 <div className="col-span-2 md:col-span-1">
                    <span className="block text-gray-500">Área Solicitante</span>
                    <span className="font-medium">
                        {areas.find(a => a.id === formData.requesting_area)?.name || '-'}
                    </span>
                 </div>
                 <div className="col-span-2 md:col-span-1">
                    <span className="block text-gray-500">Personal Asignado</span>
                    <span className="font-medium">
                        {assignments.length > 0 
                          ? assignments.map(assignment => personal.find(p => p.id === assignment.personal)?.surname).join(', ') 
                          : '-'}
                    </span>
                 </div>

                 <div className="col-span-2 md:col-span-1">
                    <span className="block text-gray-500">Año</span>
                    <span className="font-medium">{formData.year || '-'}</span>
                 </div>
                 <div className="col-span-2 md:col-span-1">
                    <span className="block text-gray-500">Duración Est.</span>
                    <span className="font-medium">{formData.estimated_duration ? `${formData.estimated_duration} meses` : '-'}</span>
                 </div>

                 <div className="col-span-2 md:col-span-1">
                    <span className="block text-gray-500">Fecha Inicio</span>
                    <span className="font-medium">{formData.start_date || '-'}</span>
                 </div>
                 <div className="col-span-2 md:col-span-1">
                    <span className="block text-gray-500">Fecha Fin Est.</span>
                    <span className="font-medium">{formData.estimated_end_date || '-'}</span>
                 </div>

                 <div className="col-span-2 md:col-span-1">
                    <span className="block text-gray-500">Activo</span>
                    <span className="font-medium">{formData.active ? 'Sí' : 'No'}</span>
                 </div>
                 <div className="col-span-2 md:col-span-1">
                    <span className="block text-gray-500">Turno</span>
                    <span className="font-medium">{formData.shift?.map(id => shifts.find(s => s.id === id)?.name || id).join(', ') || '-'}</span>
                 </div>

                 <div className="col-span-2">
                    <span className="block text-gray-500">Frontend</span>
                    <span className="font-medium">
                      {formData.frontend_tech?.map(id => feTechs.find(t => t.id === id)?.name || id).join(', ') || '-'}
                    </span>
                 </div>
                 <div className="col-span-2">
                    <span className="block text-gray-500">Backend</span>
                    <span className="font-medium">
                      {formData.backend_tech?.map(id => beTechs.find(t => t.id === id)?.name || id).join(', ') || '-'}
                    </span>
                 </div>
                 <div className="col-span-2">
                    <span className="block text-gray-500">Base de Datos</span>
                    <span className="font-medium">
                      {formData.database?.map(id => dbTechs.find(t => t.id === id)?.name || id).join(', ') || '-'}
                    </span>
                 </div>

                 <div className="col-span-2">
                    <span className="block text-gray-500">Carpeta Drive</span>
                    <span className="font-medium break-all">{formData.drive_folder || '-'}</span>
                 </div>
                 <div className="col-span-2">
                    <span className="block text-gray-500">Servidor</span>
                    <span className="font-medium whitespace-pre-wrap">{formData.server || '-'}</span>
                 </div>
                 <div className="col-span-2">
                    <span className="block text-gray-500">Observaciones</span>
                    <span className="font-medium whitespace-pre-wrap">{formData.observations || '-'}</span>
                 </div>
              </div>
              
              <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                 <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                 >
                    {isSubmitting ? 'Creando...' : 'Confirmar y Crear Proyecto'}
                    {!isSubmitting && <Check />}
                 </button>
              </div>
           </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 dark:bg-black">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
      </div>

      <div ref={containerRef} className="w-full max-w-4xl px-6 flex flex-col h-screen md:h-auto md:max-h-[90vh]">
         {/* Header */}
         <div className="flex items-center justify-between mb-8 py-4">
            <div className="flex items-center gap-4">
               <span className="text-sm font-mono text-gray-400">Paso {currentStep + 1} de {totalSteps}</span>
               <div className="h-2 w-32 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div 
                     className="h-full bg-blue-600"
                     initial={{ width: 0 }}
                     animate={{ width: `${progress}%` }}
                  />
               </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
               <X size={24} className="text-gray-500" />
            </button>
         </div>

         {/* Question Container */}
         <div className="flex-1 w-full overflow-y-auto overflow-x-hidden relative">
            <div className="min-h-full flex flex-col items-center justify-center py-6 px-4">
               <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                     key={currentStep}
                     custom={direction}
                     initial={{ opacity: 0, x: direction * 50 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: direction * -50 }}
                     transition={{ duration: 0.3 }}
                     className="w-full flex flex-col items-center"
                  >
                     {questions[currentStep].title && (
                        <h2 className="text-2xl md:text-4xl font-bold text-center mb-2 text-gray-900 dark:text-white">
                           {questions[currentStep].title}
                        </h2>
                     )}
                     {questions[currentStep].description && (
                        <p className="text-gray-500 text-center mb-8 text-lg">
                           {questions[currentStep].description}
                        </p>
                     )}

                     {error && (
                        <motion.div
                           initial={{ opacity: 0, y: -10 }}
                           animate={{ opacity: 1, y: 0 }}
                           className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center gap-2"
                        >
                           <X size={18} />
                           <span className="font-medium">{error}</span>
                        </motion.div>
                     )}

                     {renderField(questions[currentStep])}
                  </motion.div>
               </AnimatePresence>
            </div>
         </div>

         {/* Footer Navigation */}
         <div className="py-8 flex justify-between items-center mt-auto md:mt-0">
            <button
               onClick={handlePrev}
               disabled={currentStep === 0}
               className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                  currentStep === 0 
                     ? 'opacity-0 pointer-events-none' 
                     : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800'
               }`}
            >
               <ChevronUp className="rotate-[-90deg]" size={20} />
               Anterior
            </button>

            {questions[currentStep].type !== 'intro' && questions[currentStep].type !== 'review' && (
               <button
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
               >
                  Siguiente
                  <ChevronDown className="rotate-[-90deg]" size={20} />
               </button>
            )}
         </div>
      </div>
    </div>
  );
}
