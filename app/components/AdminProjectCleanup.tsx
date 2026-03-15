'use client';

import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import { Project } from '@/app/types';
import { Trash2, ArrowLeft, Loader2, AlertTriangle, Search } from 'lucide-react';

interface AdminProjectCleanupProps {
    onBack: () => void;
}

export default function AdminProjectCleanup({ onBack }: AdminProjectCleanupProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredProjects(projects);
        } else {
            const lower = searchTerm.toLowerCase();
            setFilteredProjects(projects.filter(p => 
                p.code.toLowerCase().includes(lower) || 
                p.system_name.toLowerCase().includes(lower)
            ));
        }
    }, [searchTerm, projects]);

    async function fetchProjects() {
        try {
            const records = await pb.collection('projects').getFullList<Project>({
                sort: '-created',
                expand: 'status'
            });
            setProjects(records);
            setFilteredProjects(records);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredProjects.length && filteredProjects.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredProjects.map(p => p.id)));
        }
    };

    const handleDelete = async () => {
        if (selectedIds.size === 0) return;
        setDeleting(true);
        try {
            const ids = Array.from(selectedIds);
            
            // Execute deletions in batches to prevent server overload
            const BATCH_SIZE = 50;
            for (let i = 0; i < ids.length; i += BATCH_SIZE) {
                const batch = ids.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(id => pb.collection('projects').delete(id)));
            }
            
            // Refresh list
            await fetchProjects();
            setSelectedIds(new Set());
            setShowConfirm(false);
        } catch (e) {
            console.error("Error deleting projects:", e);
            alert("Error al eliminar algunos proyectos. Revise la consola.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="w-full animate-fade-in space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                        title="Volver"
                    >
                        <ArrowLeft className="text-gray-600 dark:text-gray-300" />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Eliminación de Proyectos</h1>
                </div>
                
                {selectedIds.size > 0 && (
                    <button
                        onClick={() => setShowConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm animate-fade-in"
                    >
                        <Trash2 size={18} />
                        <span>Eliminar ({selectedIds.size})</span>
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por código o nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
            </div>

            {/* List */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
                        <thead className="bg-gray-50 dark:bg-zinc-800/50">
                            <tr>
                                <th className="px-6 py-3 w-12">
                                    <input 
                                        type="checkbox" 
                                        checked={filteredProjects.length > 0 && selectedIds.size === filteredProjects.length}
                                        onChange={toggleSelectAll}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                    />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre del Sistema</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seguridad</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-indigo-600" /></td></tr>
                            ) : filteredProjects.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-500">No se encontraron proyectos.</td></tr>
                            ) : (
                                filteredProjects.map(p => (
                                    <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors ${selectedIds.has(p.id) ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}`}>
                                        <td className="px-6 py-4">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.has(p.id)}
                                                onChange={() => toggleSelect(p.id)}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{p.code}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{p.system_name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            <span className="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 whitespace-nowrap">
                                                {p.expand?.status?.name || 'Sin Estado'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {p.security_level ? (
                                                <span className={`px-2 py-1 rounded-full text-xs border whitespace-nowrap ${
                                                    p.security_level === 'high' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-900' :
                                                    p.security_level === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-900' :
                                                    'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/10 dark:text-green-400 dark:border-green-900'
                                                }`}>
                                                    {p.security_level === 'high' ? 'Alto' : p.security_level === 'medium' ? 'Medio' : 'Bajo'}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            {new Date(p.created).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 animate-scale-up border border-gray-200 dark:border-zinc-800">
                        <div className="flex items-center gap-3 text-red-600 dark:text-red-500">
                            <AlertTriangle size={24} />
                            <h3 className="text-lg font-bold">¿Eliminar Proyectos?</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300">
                            Estás a punto de eliminar <strong>{selectedIds.size}</strong> proyectos seleccionados. 
                            Esta acción <strong>no se puede deshacer</strong> y eliminará toda la información asociada.
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                            <button 
                                onClick={() => setShowConfirm(false)}
                                disabled={deleting}
                                className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {deleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                                {deleting ? 'Eliminando...' : 'Sí, Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
