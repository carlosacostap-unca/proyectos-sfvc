'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { Project, RequestingArea, ProductOwner } from '@/app/types';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for classes
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const PROJECT_TYPES = ['Interno', 'Externo', 'Opensource'];
const SHIFTS = ['Mañana', 'Tarde'];
const STATUS_OPTIONS = [
  'Planificación', 'Análisis', 'Diseño', 'Desarrollo', 'Testing', 
  'Despliegue', 'Capacitación', 'Producción', 'Necesita Informacion', 
  'Finalizado', 'Archivado', 'Exitoso', 'Fracaso', 'Muerto', 
  'Suspendido', 'Mantenimiento'
];
const FE_TECHS = ['React', 'Vue', 'Angular', 'Next.js', 'Svelte', 'Tailwind', 'Bootstrap'];
const BE_TECHS = ['Node.js', 'Python', 'Go', 'Java', 'PHP', 'C#', 'PocketBase', 'Express'];
const DATABASES = ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite', 'Redis', 'Firebase'];

interface WizardProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateProjectWizard({ onClose, onSuccess }: WizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [areas, setAreas] = useState<RequestingArea[]>([]);
  const [productOwners, setProductOwners] = useState<ProductOwner[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Project>>({
    code: '',
    year: new Date().getFullYear(),
    system_name: '',
    requesting_area: '',
    project_type: [],
    status: 'Planificación',
    frontend_tech: [],
    backend_tech: [],
    database: [],
    shift: [],
    estimated_duration: 1,
    start_date: '',
    estimated_end_date: '',
    product_owner: '',
    observations: '',
    drive_folder: '',
    server: '',
    active: true
  });

  useEffect(() => {
    // Fetch areas
    pb.collection('requesting_areas').getFullList<RequestingArea>({ sort: 'name' })
      .then(setAreas)
      .catch(console.error);
    
    // Fetch product owners
    pb.collection('product_owners').getFullList<ProductOwner>({ sort: 'name' })
      .then(setProductOwners)
      .catch(console.error);
      
    // Focus management could go here
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
      title: '1. ¿Cuál es el nombre del sistema?',
      description: 'Escribe un nombre corto y descriptivo.',
      type: 'text',
      field: 'system_name',
      placeholder: 'Ej: Sistema de Gestión de Expedientes',
      validate: async () => {
        if (!formData.system_name) return false;
        try {
          const records = await pb.collection('projects').getList(1, 1, {
            filter: `system_name = "${formData.system_name}"`,
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
      title: '2. ¿Qué código identificador tendrá?',
      description: 'Suele ser una sigla única.',
      type: 'text',
      field: 'code',
      placeholder: 'Ej: SGE-2024',
      validate: async () => {
        if (!formData.code) return false;
        try {
          const records = await pb.collection('projects').getList(1, 1, {
            filter: `code = "${formData.code}"`,
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
      title: '3. Año y Duración estimada',
      description: 'Indica el año de inicio y cuántos meses tomará.',
      type: 'group',
      fields: ['year', 'estimated_duration'],
      validate: () => !!formData.year && !!formData.estimated_duration,
    },
    {
      id: 'status',
      title: '4. Estado del Proyecto',
      description: '¿En qué etapa se encuentra?',
      type: 'select',
      field: 'status',
      options: STATUS_OPTIONS.map(s => ({ label: s, value: s })),
      validate: () => !!formData.status,
    },
    {
      id: 'active',
      title: '5. ¿El proyecto está activo?',
      description: 'Indica si el proyecto se encuentra en curso.',
      type: 'boolean',
      field: 'active',
      validate: () => true,
    },
    {
      id: 'dates',
      title: '6. Fechas Importantes',
      description: 'Inicio y finalización estimada.',
      type: 'dates-group',
      fields: ['start_date', 'estimated_end_date'],
      validate: () => !!formData.start_date, // End date might be optional? User said "Fecha de finalización estimada", implied required but maybe not. I'll make start date required.
    },
    {
      id: 'area',
      title: '7. Área Solicitante',
      description: '¿Quién solicitó este desarrollo?',
      type: 'select',
      field: 'requesting_area',
      options: areas.map(a => ({ label: a.name, value: a.id })),
      validate: () => !!formData.requesting_area,
    },
    {
      id: 'product_owner',
      title: '8. Product Owner',
      description: '¿Quién es el responsable del producto?',
      type: 'select',
      field: 'product_owner',
      options: productOwners.map(p => ({ label: p.name, value: p.id })),
      validate: () => !!formData.product_owner,
    },
    {
      id: 'type',
      title: '9. Tipo de Proyecto',
      description: 'Selecciona la naturaleza del proyecto.',
      type: 'cards',
      field: 'project_type',
      options: PROJECT_TYPES,
      validate: () => (formData.project_type?.length || 0) > 0,
    },
    {
      id: 'tech_stack',
      title: '10. Stack Tecnológico',
      description: 'Selecciona todas las tecnologías que apliquen.',
      type: 'multiselect-group',
      groups: [
        { label: 'Frontend', field: 'frontend_tech', options: FE_TECHS },
        { label: 'Backend', field: 'backend_tech', options: BE_TECHS },
        { label: 'Base de Datos', field: 'database', options: DATABASES },
      ],
      validate: () => true, // Optional
    },
    {
      id: 'shift',
      title: '11. Turno de Desarrollo',
      description: '¿En qué turno se trabajará?',
      type: 'multiselect',
      field: 'shift',
      options: SHIFTS,
      validate: () => (formData.shift?.length || 0) > 0,
    },
    {
      id: 'observations',
      title: '12. Observaciones',
      description: 'Detalles adicionales, notas o comentarios.',
      type: 'textarea',
      field: 'observations',
      placeholder: 'Escribe aquí...',
      validate: () => true, // Optional
    },
    {
      id: 'drive',
      title: '13. Carpeta de Drive',
      description: 'Enlace o nombre de la carpeta de documentación.',
      type: 'text',
      inputType: 'url',
      field: 'drive_folder',
      placeholder: 'Ej: https://drive.google.com/...',
      validate: () => {
        if (!formData.drive_folder) return true;
        try {
          new URL(formData.drive_folder);
          return true;
        } catch {
          throw new Error('La URL ingresada no es válida. Debe comenzar con http:// o https://');
        }
      },
    },
    {
      id: 'server',
      title: '14. Servidor',
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
      if (currentStep < totalSteps - 1) {
        setDirection(1);
        setCurrentStep(prev => prev + 1);
      } else {
        handleSubmit();
      }
    } else {
      alert(errorMessage);
    }
  };

  const handlePrev = () => {
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

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // requestKey: null ensures this request is never cancelled by auto-cancellation
      await pb.collection('projects').create(formData, { requestKey: null });
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Error al crear el proyecto. Revisa la consola.');
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
          </div>
        );

      case 'group':
        return (
          <div className="flex flex-col md:flex-row gap-8 w-full max-w-3xl">
            <div className="flex-1">
                <label className="block text-sm font-bold text-blue-600 mb-2 uppercase tracking-wider">Año</label>
                <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => updateField('year', parseInt(e.target.value))}
                    className="w-full text-4xl bg-transparent border-b-2 border-gray-300 focus:border-blue-600 outline-none py-2"
                    onKeyDown={handleKeyDown}
                />
            </div>
            <div className="flex-1">
                <label className="block text-sm font-bold text-blue-600 mb-2 uppercase tracking-wider">Meses Estimados</label>
                <input
                    type="number"
                    value={formData.estimated_duration}
                    onChange={(e) => updateField('estimated_duration', parseInt(e.target.value))}
                    className="w-full text-4xl bg-transparent border-b-2 border-gray-300 focus:border-blue-600 outline-none py-2"
                    onKeyDown={handleKeyDown}
                />
            </div>
          </div>
        );

      case 'select':
        return (
          <div className="w-full max-w-2xl">
            <select
              autoFocus
              value={formData[question.field as keyof Project] as string}
              onChange={(e) => {
                  updateField(question.field, e.target.value);
                  // Auto advance on selection? Maybe not for select
              }}
              className="w-full text-2xl md:text-4xl bg-transparent border-b-2 border-gray-300 focus:border-blue-600 outline-none py-4 cursor-pointer appearance-none"
              onKeyDown={handleKeyDown}
            >
              <option value="">Selecciona una opción...</option>
              {question.options.map((opt: any) => (
                <option key={opt.value} value={opt.value} className="text-lg">
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="mt-4 text-sm text-gray-500">
                Tip: Puedes escribir para buscar
            </div>
          </div>
        );

      case 'cards':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
            {question.options.map((option: string, idx: number) => {
                const currentVal = formData[question.field as keyof Project];
                // Handle both array (multiselect) and string (single select) for flexibility
                const isArray = Array.isArray(currentVal);
                const isSelected = isArray 
                    ? (currentVal as string[]).includes(option) 
                    : currentVal === option;

                return (
                    <div
                        key={option}
                        onClick={() => {
                            if (isArray) {
                                const currentArray = currentVal as string[];
                                const newValue = isSelected
                                    ? currentArray.filter(v => v !== option)
                                    : [...currentArray, option];
                                updateField(question.field, newValue);
                            } else {
                                updateField(question.field, option);
                            }
                        }}
                        className={cn(
                            "cursor-pointer p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-lg flex items-center justify-center text-center h-32 md:h-48 text-xl font-medium relative overflow-hidden group",
                            isSelected 
                                ? "border-blue-600 bg-blue-50 text-blue-700" 
                                : "border-gray-200 bg-white hover:border-blue-300"
                        )}
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full border border-current flex items-center justify-center text-sm opacity-50">
                                {String.fromCharCode(65 + idx)}
                            </span>
                            {option}
                        </span>
                        {isSelected && (
                            <motion.div 
                                layoutId="check"
                                className="absolute top-4 right-4 text-blue-600"
                            >
                                <Check />
                            </motion.div>
                        )}
                    </div>
                );
            })}
          </div>
        );
      
      case 'multiselect':
        return (
            <div className="flex flex-wrap gap-4 w-full max-w-4xl">
                {question.options.map((option: string) => {
                    const current = (formData[question.field as keyof Project] as string[]) || [];
                    const isSelected = current.includes(option);
                    return (
                        <div
                            key={option}
                            onClick={() => {
                                const newValue = isSelected
                                    ? current.filter(v => v !== option)
                                    : [...current, option];
                                updateField(question.field, newValue);
                            }}
                            className={cn(
                                "cursor-pointer px-6 py-3 rounded-full border-2 transition-all text-lg font-medium select-none",
                                isSelected 
                                    ? "border-blue-600 bg-blue-600 text-white" 
                                    : "border-gray-300 text-gray-600 hover:border-blue-400"
                            )}
                        >
                            {option}
                        </div>
                    );
                })}
            </div>
        );

      case 'multiselect-group':
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl overflow-y-auto max-h-[60vh] p-2">
                {question.groups.map((group: any) => (
                    <div key={group.label} className="flex flex-col space-y-3">
                        <h4 className="font-bold text-gray-500 uppercase tracking-wider text-sm border-b pb-2">{group.label}</h4>
                        <div className="flex flex-col space-y-2">
                            {group.options.map((option: string) => {
                                const current = (formData[group.field as keyof Project] as string[]) || [];
                                const isSelected = current.includes(option);
                                return (
                                    <label key={option} className={cn(
                                        "flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-gray-100 transition-colors",
                                        isSelected && "bg-blue-50 hover:bg-blue-100"
                                    )}>
                                        <div className={cn(
                                            "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                            isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-400 bg-white"
                                        )}>
                                            {isSelected && <Check size={14} />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={isSelected}
                                            onChange={() => {
                                                const newValue = isSelected
                                                    ? current.filter(v => v !== option)
                                                    : [...current, option];
                                                updateField(group.field, newValue);
                                            }}
                                        />
                                        <span className={cn(isSelected ? "text-blue-700 font-medium" : "text-gray-700")}>
                                            {option}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );

      case 'dates-group':
        return (
          <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl">
            <div className="flex-1">
                <label className="block text-sm font-bold text-blue-600 mb-2 uppercase tracking-wider">Fecha de Inicio</label>
                <input
                    type="date"
                    value={formData.start_date as string}
                    onChange={(e) => updateField('start_date', e.target.value)}
                    className="w-full text-2xl bg-transparent border-b-2 border-gray-300 focus:border-blue-600 outline-none py-2 text-gray-700 dark:text-gray-200"
                    onKeyDown={handleKeyDown}
                />
            </div>
            <div className="flex-1">
                <label className="block text-sm font-bold text-blue-600 mb-2 uppercase tracking-wider">Fecha Final (Estimada)</label>
                <input
                    type="date"
                    readOnly
                    tabIndex={-1}
                    value={formData.estimated_end_date as string}
                    className="w-full text-2xl bg-transparent border-b-2 border-gray-200 focus:border-gray-200 outline-none py-2 text-gray-400 cursor-not-allowed"
                />
            </div>
          </div>
        );

      case 'textarea':
        return (
          <div className="w-full max-w-4xl">
            <textarea
              autoFocus
              value={formData[question.field as keyof Project] as string || ''}
              onChange={(e) => updateField(question.field, e.target.value)}
              placeholder={question.placeholder}
              className="w-full h-48 text-xl bg-white dark:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700 rounded-xl p-4 focus:border-blue-600 outline-none transition-colors font-light resize-none shadow-inner"
              onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                      handleNext();
                  }
              }}
            />
            <div className="mt-2 text-sm text-gray-400 text-right">
                Presiona <strong>Ctrl + Enter</strong> para continuar
            </div>
          </div>
        );

      case 'review':
        return (
            <div className="w-full max-w-4xl bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-left space-y-4 max-h-[70vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4 border-b pb-2">Resumen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div>
                        <span className="block text-gray-500">Sistema</span>
                        <span className="font-medium text-lg">{formData.system_name}</span>
                    </div>
                    <div>
                        <span className="block text-gray-500">Código</span>
                        <span className="font-medium text-lg">{formData.code}</span>
                    </div>
                    <div>
                         <span className="block text-gray-500">Estado</span>
                         <span className="font-medium inline-block px-2 py-1 rounded bg-blue-50 text-blue-700">{formData.status}</span>
                    </div>
                    <div>
                        <span className="block text-gray-500">Tipo</span>
                        <span className="font-medium">
                            {Array.isArray(formData.project_type) 
                                ? formData.project_type.join(', ') 
                                : formData.project_type}
                        </span>
                    </div>
                    <div>
                        <span className="block text-gray-500">Fechas</span>
                        <span className="font-medium">{formData.start_date?.split('-').reverse().join('/')} <span className="text-gray-400">→</span> {formData.estimated_end_date?.split('-').reverse().join('/') || '?'}</span>
                    </div>
                    <div>
                        <span className="block text-gray-500">Area Solicitante</span>
                        <span className="font-medium">{areas.find(a => a.id === formData.requesting_area)?.name || formData.requesting_area}</span>
                    </div>
                    <div>
                        <span className="block text-gray-500">Product Owner</span>
                        <span className="font-medium">{productOwners.find(p => p.id === formData.product_owner)?.name || formData.product_owner || '-'}</span>
                    </div>
                    <div className="md:col-span-2">
                        <span className="block text-gray-500">Stack Tecnológico</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {[...(formData.frontend_tech||[]), ...(formData.backend_tech||[]), ...(formData.database||[])].map(t => (
                                <span key={t} className="px-2 py-1 bg-gray-100 rounded text-xs">{t}</span>
                            ))}
                        </div>
                    </div>
                    {formData.observations && (
                        <div className="md:col-span-2">
                            <span className="block text-gray-500">Observaciones</span>
                            <p className="text-gray-700 truncate">{formData.observations}</p>
                        </div>
                    )}
                </div>
                
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full mt-8 bg-green-600 hover:bg-green-700 text-white text-xl py-4 rounded-xl font-bold shadow-lg transition-transform hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                    {isSubmitting ? 'Creando...' : 'Confirmar y Crear'}
                    {!isSubmitting && <Check />}
                </button>
            </div>
        );

      default:
        return null;
    }
  };

  const currentQ = questions[currentStep];

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-900 flex flex-col h-screen overflow-hidden">
      {/* Header / Progress */}
      <div className="h-2 bg-gray-100 w-full">
        <motion.div 
            className="h-full bg-blue-600" 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
        />
      </div>
      
      <div className="flex justify-between items-center p-6">
        <div className="text-sm font-medium text-gray-500">
            {currentStep > 0 && `Pregunta ${currentStep} de ${totalSteps - 1}`}
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="text-gray-500" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto w-full relative">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            initial={{ opacity: 0, y: direction * 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction * -50 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full flex flex-col items-center text-center max-w-5xl"
          >
            {currentQ.type !== 'intro' && currentQ.type !== 'review' && (
                <div className="mb-8 space-y-2 text-left w-full max-w-4xl">
                    <h2 className="text-2xl md:text-4xl font-light text-gray-900 dark:text-white leading-tight">
                        <span className="text-blue-600 font-bold mr-2">{currentQ.id !== 'intro' ? currentQ.id.replace(/[^0-9]/g, '') : ''}</span>
                        {currentQ.title}
                    </h2>
                    {currentQ.description && (
                        <p className="text-lg md:text-xl text-gray-500 font-light">
                            {currentQ.description}
                        </p>
                    )}
                </div>
            )}
            
            {renderField(currentQ)}

            {/* Error Message placeholder */}
            <div className="h-6 mt-2 text-red-500 text-sm"></div>

            {currentQ.type !== 'intro' && currentQ.type !== 'review' && (
                <div className="mt-8 flex items-center gap-4">
                    <button
                        onClick={handleNext}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-bold text-lg flex items-center gap-2 transition-transform hover:scale-105"
                    >
                        OK <Check size={18} />
                    </button>
                    <span className="text-xs text-gray-400 hidden md:inline">presiona <strong>Enter ↵</strong></span>
                </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Footer */}
      <div className="p-6 flex justify-end gap-2 border-t dark:border-zinc-800">
        <button 
            onClick={handlePrev} 
            disabled={currentStep === 0}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
            <ChevronUp size={24} />
        </button>
        <button 
            onClick={handleNext}
            disabled={currentStep === totalSteps - 1}
            className="p-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
            <ChevronDown size={24} />
        </button>
      </div>
    </div>
  );
}
