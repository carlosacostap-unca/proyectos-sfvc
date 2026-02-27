'use client';

import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import { ProjectAssignment, WorkLog, Personal, Project } from '@/app/types';
import { Calendar, Clock, Save, Loader2, AlertCircle, CheckCircle2, History, ArrowLeft, Edit, ChevronDown, ChevronRight } from 'lucide-react';

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

interface GroupedLog {
  date: string;
  totalHours: number;
  logs: WorkLog[];
}

export default function TimeTracking({ userEmail }: TimeTrackingProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [personalId, setPersonalId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ProjectTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [projectList, setProjectList] = useState<Array<{id: string, name: string, assignmentId: string}>>([]);
  
  // New state for history view
  const [viewMode, setViewMode] = useState<'daily' | 'history'>('daily');
  const [groupedHistory, setGroupedHistory] = useState<GroupedLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

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

  // Fetch history logs
  const fetchHistory = async () => {
    if (!personalId) return;
    
    try {
      setLoadingHistory(true);
      const logs = await pb.collection('work_logs').getList<WorkLog>(1, 100, {
        filter: `personal = "${personalId}"`,
        sort: '-date,-created',
        expand: 'project',
      });
      
      // Group logs by date
      const grouped: Record<string, WorkLog[]> = {};
      logs.items.forEach(log => {
        // Handle various date formats safely
        let d = '';
        if (log.date) {
            // Extract YYYY-MM-DD regardless of time component or separator
            d = log.date.substring(0, 10);
        }
        
        if (d && d.length === 10) {
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push(log);
        }
      });

      const groupedList: GroupedLog[] = Object.keys(grouped).map(dateKey => {
        const dayLogs = grouped[dateKey];
        const total = dayLogs.reduce((acc, curr) => acc + curr.hours, 0);
        return {
          date: dateKey,
          totalHours: total,
          logs: dayLogs
        };
      }).sort((a, b) => b.date.localeCompare(a.date));

      setGroupedHistory(groupedList);
    } catch (err) {
      console.error('Error fetching history:', err);
      // Silent error or simple notification in UI
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleDateExpand = (dateKey: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(dateKey)) {
        newExpanded.delete(dateKey);
    } else {
        newExpanded.add(dateKey);
    }
    setExpandedDates(newExpanded);
  };

  useEffect(() => {
    if (viewMode === 'history' && personalId) {
        fetchHistory();
    }
  }, [viewMode, personalId]);

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
      // Removed toast.error
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
      setSuccessMessage(null);
      
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
      
      setSuccessMessage('Horas guardadas correctamente');
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (err: any) {
      console.error('Error saving logs:', err);
      // Removed toast.error, could show inline error state
    } finally {
      setSaving(false);
    }
  };

  const switchToDaily = (targetDate: string) => {
      setDate(targetDate);
      setViewMode('daily');
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
            
            <div className="flex gap-2">
                <button 
                    onClick={() => setViewMode('daily')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'daily' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800'}`}
                >
                    Diario
                </button>
                <button 
                    onClick={() => setViewMode('history')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'history' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800'}`}
                >
                    Historial
                </button>
            </div>
          </div>
        </div>

        {/* Content based on View Mode */}
        {viewMode === 'daily' ? (
        <>
            <div className="px-6 pt-4">
                 <div className="flex items-center justify-end gap-2">
                    <span className="text-sm text-gray-500">Fecha:</span>
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
            <div className="p-6 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 flex justify-between items-center">
                <div>
                    {successMessage && (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium animate-fade-in">
                            <CheckCircle2 size={18} />
                            {successMessage}
                        </div>
                    )}
                </div>
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
        </>
        ) : (
            <div className="p-6">
                <div className="space-y-4">
                    {loadingHistory ? (
                        <div className="text-center py-8 text-gray-500">
                            <Loader2 className="animate-spin inline-block mr-2" size={20} />
                            Cargando historial...
                        </div>
                    ) : groupedHistory.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No hay registros de horas encontrados.
                        </div>
                    ) : (
                        groupedHistory.map((group) => {
                            const isExpanded = expandedDates.has(group.date);
                            // Safely parse YYYY-MM-DD to avoid timezone issues or Invalid Date
                            const [y, m, d] = group.date.split('-').map(Number);
                            const formattedDate = (!isNaN(y) && !isNaN(m) && !isNaN(d)) 
                                ? new Date(y, m - 1, d).toLocaleDateString()
                                : group.date;

                            return (
                                <div key={group.date} className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
                                    {/* Date Header Row */}
                                    <div 
                                        className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors ${isExpanded ? 'bg-gray-50 dark:bg-zinc-800/30' : ''}`}
                                        onClick={() => toggleDateExpand(group.date)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                                    {formattedDate}
                                                </h3>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {group.logs.length} registro{group.logs.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <span className="block text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                                    {group.totalHours}h
                                                </span>
                                                <span className="text-xs text-gray-500">Total</span>
                                            </div>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    switchToDaily(group.date);
                                                }}
                                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                                title="Editar día completo"
                                            >
                                                <Edit size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-100 dark:border-zinc-800">
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 dark:bg-zinc-800/30">
                                                    <tr>
                                                        <th className="px-4 py-2 pl-12">Proyecto</th>
                                                        <th className="px-4 py-2 text-center">Horas</th>
                                                        <th className="px-4 py-2">Descripción</th>
                                                        <th className="px-4 py-2 text-right">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/50">
                                                    {group.logs.map((log) => (
                                                        <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                                                            <td className="px-4 py-3 pl-12 text-gray-700 dark:text-gray-300">
                                                                {log.expand?.project ? (log.expand.project.system_name || log.expand.project.code) : 'Sin Proyecto / General'}
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-medium text-gray-900 dark:text-white">
                                                                {log.hours}
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                                                {log.description || '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <button 
                                                                    onClick={() => switchToDaily(group.date)}
                                                                    className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 text-xs font-medium hover:underline"
                                                                >
                                                                    Editar
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
