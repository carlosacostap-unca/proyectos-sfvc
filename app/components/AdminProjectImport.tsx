'use client';

import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import { Project, RequestingArea, ProjectStatusItem, ProjectTypeItem, ShiftItem, TechItem, Personal } from '@/app/types';
import { Upload, ArrowLeft, Loader2, Check, AlertTriangle, X, Save, FileText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface AdminProjectImportProps {
    onBack: () => void;
}

interface ImportedProject {
    id?: string; // Temporary ID for list management
    code: string;
    system_name: string;
    description?: string;
    year: number;
    requesting_area: string; // Name from CSV
    requesting_area_id?: string; // Mapped ID
    status: string; // Name from CSV
    status_id?: string; // Mapped ID
    personal: string; // Name from CSV
    personal_id?: string; // Mapped ID
    start_date: string;
    estimated_end_date: string;
    observations: string;
    expected_benefit: string;
    project_type: string[]; // Names
    project_type_ids?: string[]; // IDs
    frontend_tech: string[];
    frontend_tech_ids?: string[];
    backend_tech: string[];
    backend_tech_ids?: string[];
    database: string[];
    database_ids?: string[];
    shift: string[];
    shift_ids?: string[];
    estimated_duration: number;
    security_level?: 'low' | 'medium' | 'high' | '';
    isValid: boolean;
    errors: string[];
}

export default function AdminProjectImport({ onBack }: AdminProjectImportProps) {
    const [file, setFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    const [importedProjects, setImportedProjects] = useState<ImportedProject[]>([]);
    const [step, setStep] = useState<'upload' | 'review' | 'importing'>('upload');
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });

    // Options for mapping
    const [areas, setAreas] = useState<RequestingArea[]>([]);
    const [statuses, setStatuses] = useState<ProjectStatusItem[]>([]);
    const [types, setTypes] = useState<ProjectTypeItem[]>([]);
    const [shifts, setShifts] = useState<ShiftItem[]>([]);
    const [feTechs, setFeTechs] = useState<TechItem[]>([]);
    const [beTechs, setBeTechs] = useState<TechItem[]>([]);
    const [dbTechs, setDbTechs] = useState<TechItem[]>([]);
    const [personals, setPersonals] = useState<Personal[]>([]);

    useEffect(() => {
        loadOptions();
    }, []);

    async function loadOptions() {
        try {
            const [a, s, t, sh, fe, be, db, p] = await Promise.all([
                pb.collection('requesting_areas').getFullList<RequestingArea>(),
                pb.collection('project_statuses').getFullList<ProjectStatusItem>(),
                pb.collection('project_types').getFullList<ProjectTypeItem>(),
                pb.collection('shifts').getFullList<ShiftItem>(),
                pb.collection('frontend_technologies').getFullList<TechItem>(),
                pb.collection('backend_technologies').getFullList<TechItem>(),
                pb.collection('database_technologies').getFullList<TechItem>(),
                pb.collection('personal').getFullList<Personal>(),
            ]);
            setAreas(a);
            setStatuses(s);
            setTypes(t);
            setShifts(sh);
            setFeTechs(fe);
            setBeTechs(be);
            setDbTechs(db);
            setPersonals(p);
        } catch (e) {
            console.error("Error loading options", e);
            toast.error("Error cargando opciones de PocketBase");
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const processFile = async () => {
        if (!file) return;
        setProcessing(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/process-csv', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error procesando archivo');
            }

            const data = await res.json();
            const rawProjects = data.projects || [];
            
            // Map and validate
            const processed = rawProjects.map((p: any, index: number) => mapAndValidate(p, index));
            setImportedProjects(processed);
            setStep('review');
        } catch (e: any) {
            console.error(e);
            toast.error(`Error: ${e.message}`);
        } finally {
            setProcessing(false);
        }
    };

    const normalizeString = (str: string) => {
        return str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";
    }

    function findIdByName(name: string, options: { id: string, name: string }[]): string | undefined {
        if (!name) return undefined;
        const normalizedInput = normalizeString(name);
        
        // Exact match (normalized)
        const exact = options.find(o => normalizeString(o.name) === normalizedInput);
        if (exact) return exact.id;

        // Partial match (normalized)
        return options.find(o => {
            const normalizedOption = normalizeString(o.name);
            return normalizedOption.includes(normalizedInput) || normalizedInput.includes(normalizedOption);
        })?.id;
    }

    function findPersonalIdByName(name: string): string | undefined {
        if (!name) return undefined;
        const normalizedInput = normalizeString(name);
        
        return personals.find(p => {
            const fullName1 = normalizeString(`${p.name} ${p.surname}`);
            const fullName2 = normalizeString(`${p.surname} ${p.name}`);
            const fullName3 = normalizeString(`${p.surname}, ${p.name}`);
            
            return fullName1.includes(normalizedInput) || fullName2.includes(normalizedInput) || fullName3.includes(normalizedInput) ||
                   normalizedInput.includes(fullName1) || normalizedInput.includes(fullName2);
        })?.id;
    }

    function findIdsByNames(names: string[], options: { id: string, name: string }[]): string[] {
        if (!Array.isArray(names)) return [];
        return names.map(n => findIdByName(n, options)).filter(id => id !== undefined) as string[];
    }

    function mapAndValidate(p: any, index: number): ImportedProject {
        const errors: string[] = [];
        
        // Required fields
        if (!p.code) errors.push('Falta código');
        if (!p.system_name) errors.push('Falta nombre');

        // Map Relations
        // Note: We use the closure values of options here. If options are not loaded yet, this will fail.
        // But processFile is triggered by user interaction, so options should be loaded.
        
        // However, React state updates are async. If loadOptions runs, state updates, component re-renders.
        // The processFile function will close over the CURRENT state when it's defined? 
        // No, in functional components, state is constant per render.
        // But findIdByName needs the LATEST options.
        // So we should pass the options explicitly or use refs if we want to be super safe, 
        // but since we wait for user click, the state 'areas', etc. in the scope of processFile 
        // (which is recreated on every render) will be the latest.
        
        const areaId = findIdByName(p.requesting_area, areas);
        if (p.requesting_area && !areaId) {
            errors.push(`Área "${p.requesting_area}" no encontrada en el sistema`);
        }

        const statusId = findIdByName(p.status, statuses);
        const personalId = findPersonalIdByName(p.personal);
        
        // Arrays
        const typeIds = findIdsByNames(p.project_type, types);
        const feIds = findIdsByNames(p.frontend_tech, feTechs);
        const beIds = findIdsByNames(p.backend_tech, beTechs);
        const dbIds = findIdsByNames(p.database, dbTechs);
        const shiftIds = findIdsByNames(p.shift, shifts);

        return {
            id: `temp-${index}`,
            code: p.code || '',
            system_name: p.system_name || '',
            year: p.year || new Date().getFullYear(),
            requesting_area: p.requesting_area || '',
            requesting_area_id: areaId,
            status: p.status || '',
            status_id: statusId,
            personal: p.personal || '',
            personal_id: personalId,
            start_date: p.start_date || '',
            estimated_end_date: p.estimated_end_date || '',
            observations: p.observations || '',
            expected_benefit: p.expected_benefit || '',
            project_type: Array.isArray(p.project_type) ? p.project_type : [],
            project_type_ids: typeIds,
            frontend_tech: Array.isArray(p.frontend_tech) ? p.frontend_tech : [],
            frontend_tech_ids: feIds,
            backend_tech: Array.isArray(p.backend_tech) ? p.backend_tech : [],
            backend_tech_ids: beIds,
            database: Array.isArray(p.database) ? p.database : [],
            database_ids: dbIds,
            shift: Array.isArray(p.shift) ? p.shift : [],
            shift_ids: shiftIds,
            estimated_duration: p.estimated_duration || 0,
            security_level: ['low', 'medium', 'high'].includes(p.security_level) ? p.security_level : '',
            isValid: errors.length === 0,
            errors
        };
    }

    const handleImport = async () => {
        const toImport = importedProjects.filter(p => p.isValid);
        if (toImport.length === 0) return;

        setStep('importing');
        setImportProgress({ current: 0, total: toImport.length, success: 0, failed: 0 });

        for (let i = 0; i < toImport.length; i++) {
            const p = toImport[i];
            try {
                // Check if exists
                try {
                    const existing = await pb.collection('projects').getFirstListItem(`code="${p.code}"`);
                    if (existing) {
                        throw new Error(`El código ${p.code} ya existe (ID: ${existing.id})`);
                    }
                } catch (e: any) {
                    // 404 means it doesn't exist, which is what we want
                    if (e.status !== 404) {
                         console.error(`Error checking existence for ${p.code}:`, e);
                         throw e; // Rethrow other errors (like 0 or 400 if query is bad)
                    }
                }

                // Helper to get names from IDs for Select fields
                const getNamesFromIds = (ids: string[], collection: { id: string, name: string }[]) => {
                    return ids.map(id => collection.find(item => item.id === id)?.name).filter(Boolean) as string[];
                };

                // Prepare payload with sanitized values
                const payload: any = {
                    code: p.code,
                    system_name: p.system_name,
                    year: p.year,
                    requesting_area: p.requesting_area_id,
                    status: p.status_id,
                    personal: p.personal_id,
                    description: p.description || '',
                    observations: p.observations,
                    expected_benefit: p.expected_benefit,
                    project_type: p.project_type_ids && p.project_type_ids.length > 0 ? p.project_type_ids : undefined,
                    frontend_tech: p.frontend_tech_ids && p.frontend_tech_ids.length > 0 ? p.frontend_tech_ids : undefined,
                    backend_tech: p.backend_tech_ids && p.backend_tech_ids.length > 0 ? p.backend_tech_ids : undefined,
                    database: p.database_ids && p.database_ids.length > 0 ? p.database_ids : undefined,
                    // 'shift' is a Relation field expecting IDs
                    shift: p.shift_ids && p.shift_ids.length > 0 ? p.shift_ids : undefined,
                    estimated_duration: p.estimated_duration,
                    security_level: p.security_level || '',
                    active: true
                };

                // Only include dates if they are valid strings
                if (p.start_date) payload.start_date = p.start_date;
                if (p.estimated_end_date) payload.estimated_end_date = p.estimated_end_date;

                await pb.collection('projects').create(payload);

                setImportProgress(prev => ({ ...prev, current: prev.current + 1, success: prev.success + 1 }));
            } catch (e: any) {
                console.error(`Error importing ${p.code}:`, e);
                // Extract useful error message
                let errorMsg = e.message || "Error desconocido";
                if (e.data && e.data.data) {
                    // PocketBase validation errors often come in e.data.data
                    const fieldErrors = Object.entries(e.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join(', ');
                    if (fieldErrors) errorMsg = `Validación fallida: ${fieldErrors}`;
                }
                
                toast.error(`Error en ${p.code}: ${errorMsg}`);
                setImportProgress(prev => ({ ...prev, current: prev.current + 1, failed: prev.failed + 1 }));
            }
        }
        
        setTimeout(() => {
            toast.success("Proceso completado");
            // Stay on summary or go back?
        }, 500);
    };

    const updateProject = (id: string, field: string, value: any) => {
        setImportedProjects(prev => prev.map(p => {
            if (p.id !== id) return p;
            
            // Handle array fields updates (re-calculate IDs if needed, but for now we update IDs directly from select multiple)
            if (field.endsWith('_ids')) {
                 // Update the IDs
                 return { ...p, [field]: value };
            }
            
            const updated = { ...p, [field]: value };
            return updated;
        }));
    };

    const handleMultiSelectChange = (id: string, field: string, e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
        updateProject(id, field, selectedOptions);
    };

    const removeProject = (id: string) => {
        setImportedProjects(prev => prev.filter(p => p.id !== id));
    };

    if (step === 'upload') {
        return (
            <div className="w-full animate-fade-in space-y-6 pb-20">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <ArrowLeft className="text-gray-600 dark:text-gray-300" />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Importación Masiva (CSV)</h1>
                </div>

                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl bg-gray-50 dark:bg-zinc-900/50">
                    <input 
                        type="file" 
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                        id="csv-upload"
                    />
                    <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-4">
                        <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400">
                            <Upload size={32} />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-medium text-gray-900 dark:text-white">
                                {file ? file.name : "Selecciona un archivo CSV"}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Procesado con GPT-5-mini
                            </p>
                        </div>
                    </label>

                    {file && (
                        <button
                            onClick={processFile}
                            disabled={processing}
                            className="mt-8 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {processing ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                            {processing ? "Procesando..." : "Procesar con IA"}
                        </button>
                    )}
                </div>
                
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-lg text-sm">
                    <p><strong>Nota:</strong> El archivo debe contener columnas con información del proyecto. La IA intentará mapear automáticamente campos como Código, Nombre, Área, Tecnologías, etc.</p>
                </div>
            </div>
        );
    }

    if (step === 'importing') {
        return (
            <div className="w-full flex flex-col items-center justify-center h-[50vh] gap-6">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-bold">Importando Proyectos...</h2>
                    <p className="text-gray-500">
                        {importProgress.current} de {importProgress.total} procesados
                    </p>
                    <div className="flex gap-4 text-sm">
                        <span className="text-green-600">{importProgress.success} exitosos</span>
                        <span className="text-red-600">{importProgress.failed} fallidos</span>
                    </div>
                </div>
                {importProgress.current === importProgress.total && (
                    <button 
                        onClick={onBack}
                        className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        Finalizar
                    </button>
                )}
            </div>
        );
    }

    // Review Step
    return (
        <div className="w-full animate-fade-in space-y-6 pb-20">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => setStep('upload')} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <ArrowLeft className="text-gray-600 dark:text-gray-300" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Revisión de Importación</h1>
                        <p className="text-sm text-gray-500">
                            {importedProjects.filter(p => p.isValid).length} listos para importar
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleImport}
                    disabled={importedProjects.filter(p => p.isValid).length === 0}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                    <Save size={18} />
                    Importar Seleccionados
                </button>
            </div>

            <div className="space-y-4">
                {importedProjects.map((p, i) => (
                    <div key={p.id || i} className={`p-4 rounded-xl border ${p.isValid ? 'border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900' : 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-900/10'}`}>
                        <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-full ${p.isValid ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {p.isValid ? <Check size={20} /> : <AlertTriangle size={20} />}
                            </div>
                            
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Basic Fields */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Código</label>
                                    <input 
                                        type="text" 
                                        value={p.code} 
                                        onChange={(e) => updateProject(p.id!, 'code', e.target.value)}
                                        className="w-full text-sm border rounded px-2 py-1 bg-transparent"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Nombre</label>
                                    <input 
                                        type="text" 
                                        value={p.system_name} 
                                        onChange={(e) => updateProject(p.id!, 'system_name', e.target.value)}
                                        className="w-full text-sm border rounded px-2 py-1 bg-transparent"
                                    />
                                </div>
                                
                                {/* Area Dropdown */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Área ({p.requesting_area})</label>
                                    <select 
                                        value={p.requesting_area_id || ''} 
                                        onChange={(e) => updateProject(p.id!, 'requesting_area_id', e.target.value)}
                                        className={`w-full text-sm border rounded px-2 py-1 bg-transparent ${!p.requesting_area_id ? 'border-yellow-400' : ''}`}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>

                                {/* Status Dropdown */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Estado ({p.status})</label>
                                    <select 
                                        value={p.status_id || ''} 
                                        onChange={(e) => updateProject(p.id!, 'status_id', e.target.value)}
                                        className={`w-full text-sm border rounded px-2 py-1 bg-transparent ${!p.status_id ? 'border-yellow-400' : ''}`}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>

                                {/* Security Level */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Nivel de Seguridad</label>
                                    <select 
                                        value={p.security_level || ''} 
                                        onChange={(e) => updateProject(p.id!, 'security_level', e.target.value)}
                                        className="w-full text-sm border rounded px-2 py-1 bg-transparent"
                                    >
                                        <option value="">Sin Asignar</option>
                                        <option value="low">Bajo</option>
                                        <option value="medium">Medio</option>
                                        <option value="high">Alto</option>
                                    </select>
                                </div>

                                {/* Personal Dropdown */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Líder ({p.personal})</label>
                                    <select 
                                        value={p.personal_id || ''} 
                                        onChange={(e) => updateProject(p.id!, 'personal_id', e.target.value)}
                                        className={`w-full text-sm border rounded px-2 py-1 bg-transparent ${!p.personal_id && p.personal ? 'border-yellow-400' : ''}`}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {personals.map(pe => <option key={pe.id} value={pe.id}>{pe.surname}, {pe.name}</option>)}
                                    </select>
                                </div>
                                
                                {/* Dates */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Inicio</label>
                                    <input 
                                        type="date" 
                                        value={p.start_date} 
                                        onChange={(e) => updateProject(p.id!, 'start_date', e.target.value)}
                                        className="w-full text-sm border rounded px-2 py-1 bg-transparent"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Fin Estimado</label>
                                    <input 
                                        type="date" 
                                        value={p.estimated_end_date} 
                                        onChange={(e) => updateProject(p.id!, 'estimated_end_date', e.target.value)}
                                        className="w-full text-sm border rounded px-2 py-1 bg-transparent"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Duración (meses)</label>
                                    <input 
                                        type="number" 
                                        value={p.estimated_duration} 
                                        onChange={(e) => updateProject(p.id!, 'estimated_duration', parseInt(e.target.value) || 0)}
                                        className="w-full text-sm border rounded px-2 py-1 bg-transparent"
                                    />
                                </div>
                            </div>
                            
                            {/* Extended Fields */}
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 dark:border-zinc-800">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Observaciones</label>
                                    <textarea 
                                        value={p.observations} 
                                        onChange={(e) => updateProject(p.id!, 'observations', e.target.value)}
                                        className="w-full text-sm border rounded px-2 py-1 bg-transparent h-20"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Beneficio Esperado</label>
                                    <textarea 
                                        value={p.expected_benefit} 
                                        onChange={(e) => updateProject(p.id!, 'expected_benefit', e.target.value)}
                                        className="w-full text-sm border rounded px-2 py-1 bg-transparent h-20"
                                    />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2">
                                     <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">Tipos de Proyecto</label>
                                        <select 
                                            multiple
                                            value={p.project_type_ids || []} 
                                            onChange={(e) => handleMultiSelectChange(p.id!, 'project_type_ids', e)}
                                            className="w-full text-sm border rounded px-2 py-1 bg-transparent h-20"
                                        >
                                            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">Turno</label>
                                        <select 
                                            multiple
                                            value={p.shift_ids || []} 
                                            onChange={(e) => handleMultiSelectChange(p.id!, 'shift_ids', e)}
                                            className="w-full text-sm border rounded px-2 py-1 bg-transparent h-20"
                                        >
                                            {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                                     <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">Frontend</label>
                                        <select 
                                            multiple
                                            value={p.frontend_tech_ids || []} 
                                            onChange={(e) => handleMultiSelectChange(p.id!, 'frontend_tech_ids', e)}
                                            className="w-full text-sm border rounded px-2 py-1 bg-transparent h-24"
                                        >
                                            {feTechs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">Backend</label>
                                        <select 
                                            multiple
                                            value={p.backend_tech_ids || []} 
                                            onChange={(e) => handleMultiSelectChange(p.id!, 'backend_tech_ids', e)}
                                            className="w-full text-sm border rounded px-2 py-1 bg-transparent h-24"
                                        >
                                            {beTechs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">Base de Datos</label>
                                        <select 
                                            multiple
                                            value={p.database_ids || []} 
                                            onChange={(e) => handleMultiSelectChange(p.id!, 'database_ids', e)}
                                            className="w-full text-sm border rounded px-2 py-1 bg-transparent h-24"
                                        >
                                            {dbTechs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => removeProject(p.id!)} className="text-gray-400 hover:text-red-500">
                                <X size={20} />
                            </button>
                        </div>
                        
                        {!p.isValid && (
                            <div className="mt-2 text-xs text-red-600 pl-11">
                                {p.errors.join(', ')}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
