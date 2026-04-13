'use client';

import { useState, useEffect, useMemo } from 'react';
import { pb } from '@/lib/pocketbase';
import { Personal, WorkLog } from '@/app/types';
import { Loader2, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { getLocalDayStartUTC, getLocalDayEndUTC, formatLocalDate, toLocalDateString } from '@/app/utils/date';

interface AdminWorkLogsProps {
    onBack: () => void;
}

export default function AdminWorkLogs({ onBack }: AdminWorkLogsProps) {
    const [personals, setPersonals] = useState<Personal[]>([]);
    const [selectedPersonalId, setSelectedPersonalId] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState(toLocalDateString(new Date())); // YYYY-MM-DD
    const [logs, setLogs] = useState<WorkLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalHours, setTotalHours] = useState(0);
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

    const groupedLogs = useMemo(() => {
        const groups: Record<string, { dateKey: string, displayDate: string, totalHours: number, logs: WorkLog[] }> = {};
        
        logs.forEach(log => {
            // Usa la utilidad que convierte de UTC a fecha local (YYYY-MM-DD)
            let dateKey = '';
            if (log.date) {
                dateKey = toLocalDateString(new Date(log.date));
            }
            if (!dateKey) return;

            if (!groups[dateKey]) {
                let displayDate = dateKey;
                try {
                    const [y, m, d] = dateKey.split('-').map(Number);
                    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                        const dateObj = new Date(y, m - 1, d);
                        if (!isNaN(dateObj.getTime())) {
                            const formatted = formatLocalDate(dateObj, {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            });
                            displayDate = formatted.charAt(0).toUpperCase() + formatted.slice(1);
                        }
                    }
                } catch (e) {
                    console.error('Date formatting error:', e);
                }

                groups[dateKey] = { dateKey, displayDate, totalHours: 0, logs: [] };
            }
            groups[dateKey].totalHours += log.hours;
            groups[dateKey].logs.push(log);
        });

        // Ordenar por fecha descendente
        return Object.values(groups).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    }, [logs]);

    const toggleDateExpand = (dateKey: string) => {
        const newExpanded = new Set(expandedDates);
        if (newExpanded.has(dateKey)) {
            newExpanded.delete(dateKey);
        } else {
            newExpanded.add(dateKey);
        }
        setExpandedDates(newExpanded);
    };

    // Fetch personals
    useEffect(() => {
        async function fetchPersonals() {
            try {
                // Fetch all active personal records
                // We sort by surname to make it easier to find users
                const records = await pb.collection('personal').getFullList<Personal>({
                    sort: 'surname,name',
                    // filter: 'active = true' 
                });
                setPersonals(records);
            } catch (e) {
                console.error("Error fetching personals:", e);
            }
        }
        fetchPersonals();
    }, []);

    // Fetch logs
    useEffect(() => {
        async function fetchLogs() {
            if (!selectedPersonalId || !selectedDate) {
                setLogs([]);
                setTotalHours(0);
                return;
            }

            setLoading(true);
            try {
                const records = await pb.collection('work_logs').getList<WorkLog>(1, 500, {
                    filter: `personal = "${selectedPersonalId}" && date >= "${getLocalDayStartUTC(selectedDate)}" && date <= "${getLocalDayEndUTC(selectedDate)}"`,
                    sort: '-date',
                    expand: 'project'
                });

                setLogs(records.items);
                setTotalHours(records.items.reduce((acc, log) => acc + log.hours, 0));
            } catch (e) {
                console.error("Error fetching logs:", e);
            } finally {
                setLoading(false);
            }
        }

        fetchLogs();
    }, [selectedPersonalId, selectedDate]);

    return (
        <div className="w-full animate-fade-in space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <button 
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    title="Volver a Proyectos"
                >
                    <ArrowLeft className="text-gray-600 dark:text-gray-300" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reporte de Horas</h1>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Usuario</label>
                        <select 
                            value={selectedPersonalId} 
                            onChange={(e) => setSelectedPersonalId(e.target.value)}
                            className="w-full rounded-lg border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                        >
                            <option value="">Seleccionar Usuario</option>
                            {personals.map(p => (
                                <option key={p.id} value={p.id}>{p.surname}, {p.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Día</label>
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full rounded-lg border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                        />
                    </div>
                </div>

                {/* Summary */}
                {selectedPersonalId && (
                    <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 flex justify-between items-center">
                        <span className="font-medium text-indigo-900 dark:text-indigo-200">Total de Horas</span>
                        <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalHours} hs</span>
                    </div>
                )}

                {/* Logs Accordion */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-10 text-gray-500">
                            <div className="flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
                        </div>
                    ) : groupedLogs.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg">
                            {selectedPersonalId ? 'No hay registros para este período' : 'Seleccione un usuario para ver sus registros'}
                        </div>
                    ) : (
                        groupedLogs.map((group) => {
                            const isExpanded = expandedDates.has(group.dateKey);
                            
                            return (
                                <div key={group.dateKey} className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
                                    {/* Header Row */}
                                    <div 
                                        className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors ${isExpanded ? 'bg-gray-50 dark:bg-zinc-800/30' : ''}`}
                                        onClick={() => toggleDateExpand(group.dateKey)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                                    {group.displayDate}
                                                </h3>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {group.logs.length} registro{group.logs.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                                {group.totalHours}h
                                            </span>
                                            <span className="text-xs text-gray-500">Total</span>
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
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/50">
                                                    {group.logs.map((log) => (
                                                        <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                                                            <td className="px-4 py-3 pl-12 text-gray-700 dark:text-gray-300">
                                                                {log.expand?.project?.system_name || log.expand?.project?.code || 'Sin Proyecto'}
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-medium text-gray-900 dark:text-white">
                                                                {log.hours}
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate" title={log.description}>
                                                                {log.description || '-'}
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
        </div>
    );
}
