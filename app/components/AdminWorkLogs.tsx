'use client';

import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import { Personal, WorkLog } from '@/app/types';
import { Loader2, ArrowLeft } from 'lucide-react';

interface AdminWorkLogsProps {
    onBack: () => void;
}

export default function AdminWorkLogs({ onBack }: AdminWorkLogsProps) {
    const [personals, setPersonals] = useState<Personal[]>([]);
    const [selectedPersonalId, setSelectedPersonalId] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [logs, setLogs] = useState<WorkLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalHours, setTotalHours] = useState(0);

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
                const [year, month] = selectedDate.split('-').map(Number);
                const startDate = `${selectedDate}-01 00:00:00`;
                // Calculate last day of month
                const lastDay = new Date(year, month, 0).getDate();
                const endDate = `${selectedDate}-${lastDay} 23:59:59`;

                const records = await pb.collection('work_logs').getList<WorkLog>(1, 500, {
                    filter: `personal = "${selectedPersonalId}" && date >= "${startDate}" && date <= "${endDate}"`,
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
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mes</label>
                        <input 
                            type="month" 
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

                {/* Logs Table */}
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-zinc-800">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
                        <thead className="bg-gray-50 dark:bg-zinc-800/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proyecto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horas</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center">
                                        <div className="flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                                        {selectedPersonalId ? 'No hay registros para este período' : 'Seleccione un usuario para ver sus registros'}
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                                            {new Date(log.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300 font-medium">
                                            {log.expand?.project?.system_name || log.expand?.project?.code || 'Sin Proyecto'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                                            {log.hours}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={log.description}>
                                            {log.description || '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
