'use client';

import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import { ProjectAssignment, WorkLog, Personal, Project } from '@/app/types';
import { toast } from 'sonner';
import { Calendar, Clock, Save, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TimeTrackingProps {
  userEmail: string;
}

interface ProjectTimeEntry {
  assignmentId: string; // Can be a real assignment ID or a generated one for owned projects
  projectId: string;
  projectName: string;
  hours: number;
  logId?: string; // If updating existing log
  description?: string;
}

export default function TimeTracking({ userEmail }: TimeTrackingProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [personalId, setPersonalId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ProjectTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectList, setProjectList] = useState<Array<{id: string, name: string, assignmentId: string}>>([]);

  // Initialize: Find personal record and assignments
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 1. Fetch Assignments AND Owned Projects in parallel using email filter directly
        // This avoids issues where the personal record found by ID might not match the one in assignments
        const [assignmentRecords, ownedProjects] = await Promise.all([
          pb.collection('project_assignments').getFullList<ProjectAssignment>({
            filter: `personal.email = "${userEmail}" && active = true`,
            expand: 'project,personal',
          }),
          pb.collection('projects').getFullList<Project>({
            filter: `personal.email = "${userEmail}" && active = true`,
            expand: 'personal',
          })
        ]);

        // 2. Extract Personal ID from the first valid record found
        let foundPersonalId: string | null = null;

        if (assignmentRecords.length > 0) {
            // @ts-ignore
            foundPersonalId = assignmentRecords[0].expand?.personal?.id;
        } else if (ownedProjects.length > 0) {
            // @ts-ignore
            foundPersonalId = ownedProjects[0].expand?.personal?.id;
        }

        if (!foundPersonalId) {
             // If no projects found, we might still want to check if a Personal record exists to give a better error
             // But for now, if no assignments/owned projects, we just show empty state or error
             // Try one last check for personal record just to be sure
             try {
                 const personalCheck = await pb.collection('personal').getFirstListItem(`email = "${userEmail}"`);
                 if (personalCheck) {
                     setPersonalId(personalCheck.id);
                     setError('No tienes proyectos asignados actualmente.');
                 } else {
                     setError('No se encontró un perfil de personal asociado a tu cuenta. Contacta al administrador.');
                 }
             } catch (e) {
                 setError('No se encontró un perfil de personal asociado a tu cuenta. Contacta al administrador.');
             }
             setLoading(false);
             return;
        }

        setPersonalId(foundPersonalId);

        // 3. Merge projects (avoiding duplicates if user is both assigned and owner)
        const mergedProjects = new Map<string, {id: string, name: string, assignmentId: string}>();

        // Add from assignments
        assignmentRecords.forEach(assignment => {
           // @ts-ignore
           const project = assignment.expand?.project;
           if (project) {
             mergedProjects.set(project.id, {
               id: project.id,
               name: project.system_name || project.code,
               assignmentId: assignment.id
             });
           }
        });

        // Add from ownership
        ownedProjects.forEach(project => {
          if (!mergedProjects.has(project.id)) {
            mergedProjects.set(project.id, {
              id: project.id,
              name: project.system_name || project.code,
              assignmentId: `owner_${project.id}` // Virtual assignment ID
            });
          }
        });

        const finalProjects = Array.from(mergedProjects.values());
        
        // Add "General" entry at the beginning
        finalProjects.unshift({
            id: 'general',
            name: 'Sin Proyecto / Tareas Generales',
            assignmentId: 'general'
        });

        if (finalProjects.length === 0) {
          setError('No tienes proyectos asignados actualmente.');
          setLoading(false);
          return;
        }

        setProjectList(finalProjects);
        
        // Load logs for today (initial load)
        await loadLogsForDate(foundPersonalId, date, finalProjects);

      } catch (err: any) {
        console.error('Error initializing time tracking:', err);
        setError('Error al cargar la información. Intenta nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    if (userEmail) {
      init();
    }
  }, [userEmail]);

  // When date changes, reload logs
  useEffect(() => {
    if (personalId && projectList.length > 0) {
      loadLogsForDate(personalId, date, projectList);
    }
  }, [date, personalId]); // specific dependency on date

  const loadLogsForDate = async (pId: string, selectedDate: string, currentProjects: Array<{id: string, name: string, assignmentId: string}>) => {
    try {
      setLoading(true);
      // Fetch logs for this date
      try {
        const logs = await pb.collection('work_logs').getFullList<WorkLog>({
          filter: `personal = "${pId}" && date >= "${selectedDate} 00:00:00" && date <= "${selectedDate} 23:59:59"`,
        });

        // Map projects to entries
        const newEntries: ProjectTimeEntry[] = currentProjects.map(proj => {
            let log;
            if (proj.id === 'general') {
                // Find log with empty project or specific general id if we decided to use one. 
                // But typically "general" means project field is empty.
                log = logs.find(l => !l.project || l.project === '');
            } else {
                log = logs.find(l => l.project === proj.id);
            }
            
            return {
                assignmentId: proj.assignmentId,
                projectId: proj.id,
                projectName: proj.name,
                hours: log ? log.hours : 0,
                logId: log ? log.id : undefined,
                description: log ? log.description : ''
            };
        });

        setEntries(newEntries);
      } catch (err: any) {
        if (err.status === 404) {
             console.warn('Work logs collection might be missing or empty query', err);
             // Initialize empty entries
             const newEntries: ProjectTimeEntry[] = currentProjects.map(proj => {
                return {
                    assignmentId: proj.assignmentId,
                    projectId: proj.id,
                    projectName: proj.name,
                    hours: 0,
                    description: ''
                };
            });
            setEntries(newEntries);
        } else {
            throw err;
        }
      }

    } catch (err) {
      console.error('Error loading logs:', err);
      toast.error('Error al cargar las horas registradas');
    } finally {
      setLoading(false);
    }
  };

  const handleHourChange = (index: number, value: string) => {
    const newEntries = [...entries];
    const numValue = parseFloat(value);
    newEntries[index].hours = isNaN(numValue) ? 0 : numValue;
    setEntries(newEntries);
  };

  const handleDescriptionChange = (index: number, value: string) => {
    const newEntries = [...entries];
    newEntries[index].description = value;
    setEntries(newEntries);
  };

  const handleSave = async () => {
    if (!personalId) return;

    try {
      setSaving(true);
      
      const promises = entries.map(async (entry) => {
        // Only save if hours > 0 or if there was a log before (to update to 0 or delete?)
        // Usually we keep 0 hours logs or delete them. Let's update/create.
        
        if (entry.hours === 0 && !entry.logId) {
            return; // Nothing to save
        }

        const data: any = {
            personal: personalId,
            date: date,
            hours: entry.hours,
            description: entry.description
        };

        // Handle project field
        if (entry.projectId !== 'general') {
            data.project = entry.projectId;
        } else {
            // For general, we send null or empty string depending on PB config. 
            // Usually omitting it or sending null works for optional relation.
            data.project = null; 
        }

        if (entry.logId) {
            if (entry.hours === 0) {
                // Option: Delete log if hours set to 0? Or just set to 0.
                // Let's delete it to keep DB clean
                await pb.collection('work_logs').delete(entry.logId);
                return { ...entry, logId: undefined }; // Return updated entry state
            } else {
                await pb.collection('work_logs').update(entry.logId, data);
                return entry;
            }
        } else {
            if (entry.hours > 0) {
                const record = await pb.collection('work_logs').create(data);
                return { ...entry, logId: record.id };
            }
        }
        return entry;
      });

      const results = await Promise.all(promises);
      
      // Update local state with new logIds
      // We need to reload or update state carefully.
      // Re-loading logs is safer to ensure sync.
      await loadLogsForDate(personalId, date, projectList);
      
      toast.success('Horas guardadas correctamente');

    } catch (err: any) {
      console.error('Error saving logs:', err);
      toast.error('Error al guardar: ' + (err.message || 'Verifique conexión'));
    } finally {
      setSaving(false);
    }
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center max-w-2xl mx-auto mt-8">
        <AlertCircle className="mx-auto text-red-500 mb-2" size={48} />
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">No se puede cargar el panel</h3>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-zinc-800 bg-indigo-50/50 dark:bg-indigo-900/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="text-indigo-600" />
                Registro de Horas
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Carga tus horas de trabajo diarias por proyecto
              </p>
            </div>
            
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-sm">
              <Calendar size={18} className="text-gray-500 ml-2" />
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-200 text-sm font-medium"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
            {entries.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                    <p>No tienes asignaciones activas para registrar horas.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                        <div className="col-span-5 md:col-span-4">Proyecto</div>
                        <div className="col-span-3 md:col-span-2 text-center">Horas</div>
                        <div className="col-span-4 md:col-span-6">Descripción (Opcional)</div>
                    </div>
                    
                    {entries.map((entry, index) => (
                        <div key={entry.assignmentId} className="grid grid-cols-12 gap-4 items-center bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                            <div className="col-span-5 md:col-span-4">
                                <span className="font-medium text-gray-800 dark:text-gray-200 block truncate" title={entry.projectName}>
                                    {entry.projectName}
                                </span>
                            </div>
                            <div className="col-span-3 md:col-span-2">
                                <input 
                                    type="number" 
                                    min="0" 
                                    max="24" 
                                    step="0.5"
                                    value={entry.hours || ''}
                                    placeholder="0"
                                    onChange={(e) => handleHourChange(index, e.target.value)}
                                    className="w-full text-center bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>
                            <div className="col-span-4 md:col-span-6">
                                <input 
                                    type="text" 
                                    value={entry.description || ''}
                                    placeholder="Detalle de tareas..."
                                    onChange={(e) => handleDescriptionChange(index, e.target.value)}
                                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg py-1.5 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 flex justify-end">
            <button
                onClick={handleSave}
                disabled={saving || entries.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
                {saving ? (
                    <>
                        <Loader2 size={18} className="animate-spin" />
                        Guardando...
                    </>
                ) : (
                    <>
                        <Save size={18} />
                        Guardar Registros
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
}
