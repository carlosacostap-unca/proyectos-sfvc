'use client';

import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import { Program } from '@/app/types';
import { Plus, Edit, Trash2, Search, Loader2, ArrowLeft, Layers, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface ProgramListProps {
    onBack: () => void;
}

export default function ProgramList({ onBack }: ProgramListProps) {
    const [programs, setPrograms] = useState<Program[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [editingProgram, setEditingProgram] = useState<Program | null>(null);

    // Form state
    const [formData, setFormData] = useState<Partial<Program>>({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        active: true
    });

    useEffect(() => {
        fetchPrograms();
    }, []);

    async function fetchPrograms() {
        try {
            const records = await pb.collection('programs').getFullList<Program>({
                sort: '-created',
                expand: 'manager'
            });
            setPrograms(records);
        } catch (e) {
            console.error("Error fetching programs:", e);
            // Don't show error on first load if collection doesn't exist yet
        } finally {
            setLoading(false);
        }
    }

    const filteredPrograms = programs.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingProgram) {
                await pb.collection('programs').update(editingProgram.id, formData);
                toast.success('Programa actualizado');
            } else {
                await pb.collection('programs').create(formData);
                toast.success('Programa creado');
            }
            setIsCreating(false);
            setEditingProgram(null);
            setFormData({
                name: '',
                description: '',
                start_date: '',
                end_date: '',
                active: true
            });
            fetchPrograms();
        } catch (e: any) {
            console.error(e);
            toast.error('Error al guardar: ' + e.message);
        }
    };

    const handleEdit = (program: Program) => {
        setEditingProgram(program);
        setFormData({
            name: program.name,
            description: program.description,
            start_date: program.start_date,
            end_date: program.end_date,
            active: program.active
        });
        setIsCreating(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este programa?')) return;
        try {
            await pb.collection('programs').delete(id);
            toast.success('Programa eliminado');
            fetchPrograms();
        } catch (e: any) {
            console.error(e);
            toast.error('Error al eliminar: ' + e.message);
        }
    };

    if (isCreating) {
        return (
            <div className="w-full max-w-4xl mx-auto animate-fade-in p-6 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                <div className="flex items-center gap-4 mb-6">
                    <button 
                        onClick={() => {
                            setIsCreating(false);
                            setEditingProgram(null);
                        }}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <ArrowLeft className="text-gray-600 dark:text-gray-300" />
                    </button>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {editingProgram ? 'Editar Programa' : 'Nuevo Programa'}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Nombre del Programa"
                            />
                        </div>
                        
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none h-32"
                                placeholder="Descripción y objetivos del programa..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Inicio</label>
                            <input
                                type="date"
                                value={formData.start_date}
                                onChange={e => setFormData({...formData, start_date: e.target.value})}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Fin (Estimada)</label>
                            <input
                                type="date"
                                value={formData.end_date}
                                onChange={e => setFormData({...formData, end_date: e.target.value})}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="active"
                                checked={formData.active}
                                onChange={e => setFormData({...formData, active: e.target.checked})}
                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                            />
                            <label htmlFor="active" className="text-sm font-medium text-gray-700 dark:text-gray-300">Programa Activo</label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={() => {
                                setIsCreating(false);
                                setEditingProgram(null);
                            }}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            {editingProgram ? 'Actualizar' : 'Crear Programa'}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className="w-full animate-fade-in space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                        title="Volver"
                    >
                        <ArrowLeft className="text-gray-600 dark:text-gray-300" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Layers className="text-indigo-600" />
                            Programas
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Agrupa y gestiona proyectos relacionados</p>
                    </div>
                </div>
                
                <button
                    onClick={() => {
                        setFormData({
                            name: '',
                            description: '',
                            start_date: '',
                            end_date: '',
                            active: true
                        });
                        setEditingProgram(null);
                        setIsCreating(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    <span>Nuevo Programa</span>
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar programas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                </div>
            ) : filteredPrograms.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700">
                    <Layers className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No hay programas</h3>
                    <p className="mt-1 text-sm text-gray-500">Comienza creando un nuevo programa para agrupar proyectos.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPrograms.map(program => (
                        <div key={program.id} className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 hover:shadow-md transition-shadow p-6 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{program.name}</h3>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleEdit(program)}
                                        className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(program.id)}
                                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            
                            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-4 flex-grow">
                                {program.description || 'Sin descripción'}
                            </p>

                            <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-100 dark:border-zinc-800">
                                {program.start_date && (
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} />
                                        <span>Inicio: {new Date(program.start_date).toLocaleDateString()}</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${program.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400'}`}>
                                        {program.active ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}