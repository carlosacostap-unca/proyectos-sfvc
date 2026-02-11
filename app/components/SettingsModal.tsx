import { useState, useEffect } from 'react';
import { 
  X, Plus, Trash2, Check, AlertCircle, Loader2, Edit2, Save, 
  Settings, LayoutGrid, Users, Activity, Tag, 
  Monitor, Server, Database, ChevronRight 
} from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { toast } from 'sonner';

import PersonalManagement from './PersonalManagement';

interface SettingsItem {
  id: string;
  name: string;
  active: boolean;
  collectionName: string;
}

type SettingsCategory = 
  // Maestros
  | 'areas' | 'personal' | 'statuses' | 'types'
  // Tecnologías
  | 'frontend' | 'backend' | 'database';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsCategory>('areas');
  const [items, setItems] = useState<SettingsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const getCollectionName = (category: SettingsCategory) => {
    switch (category) {
      // Maestros
      case 'areas': return 'requesting_areas';
      case 'personal': return 'personal'; // Handled by PersonalManagement
      case 'statuses': return 'project_statuses';
      case 'types': return 'project_types';
      // Tecnologías
      case 'frontend': return 'frontend_technologies';
      case 'backend': return 'backend_technologies';
      case 'database': return 'database_technologies';
    }
  };

  const getTabLabel = (category: SettingsCategory) => {
    switch (category) {
      case 'areas': return 'Áreas Solicitantes';
      case 'personal': return 'Personal';
      case 'statuses': return 'Estados de Proyecto';
      case 'types': return 'Tipos de Proyecto';
      case 'frontend': return 'Frontend';
      case 'backend': return 'Backend';
      case 'database': return 'Base de Datos';
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const collection = getCollectionName(activeTab);
      const records = await pb.collection(collection).getFullList<SettingsItem>({
        sort: 'name',
      });
      setItems(records);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen, activeTab]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    setIsAdding(true);
    try {
      const collection = getCollectionName(activeTab);
      await pb.collection(collection).create({
        name: newItemName.trim(),
        active: true
      });
      setNewItemName('');
      toast.success('Elemento agregado correctamente');
      fetchItems();
    } catch (error: any) {
      console.error('Error adding item:', error);
      toast.error(`Error al agregar: ${error.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este elemento?')) return;
    
    try {
      const collection = getCollectionName(activeTab);
      await pb.collection(collection).delete(id);
      toast.success('Elemento eliminado');
      setItems(items.filter(i => i.id !== id));
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Error al eliminar');
    }
  };

  const startEditing = (item: SettingsItem) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;

    try {
      const collection = getCollectionName(activeTab);
      await pb.collection(collection).update(id, {
        name: editName.trim()
      });
      toast.success('Actualizado correctamente');
      setEditingId(null);
      fetchItems();
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Error al actualizar');
    }
  };

  const toggleActive = async (item: SettingsItem) => {
    try {
      const collection = getCollectionName(activeTab);
      await pb.collection(collection).update(item.id, {
        active: !item.active
      });
      toast.success(`Elemento ${!item.active ? 'activado' : 'desactivado'}`);
      fetchItems();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al cambiar estado');
    }
  };

  if (!isOpen) return null;

  const NavItem = ({ id, icon: Icon, label }: { id: SettingsCategory; icon: any; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        activeTab === id
          ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
          : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-800'
      }`}
    >
      <Icon size={18} />
      {label}
      {activeTab === id && <ChevronRight size={16} className="ml-auto" />}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-5xl h-[80vh] flex overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-100 dark:border-zinc-800 flex flex-col bg-gray-50/50 dark:bg-zinc-900/50">
          <div className="p-6 border-b border-gray-100 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="text-indigo-600 dark:text-indigo-400" />
              Parametrizaciones
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            <NavItem id="areas" icon={LayoutGrid} label="Áreas Solicitantes" />
            <NavItem id="personal" icon={Users} label="Personal" />
            <NavItem id="statuses" icon={Activity} label="Estados" />
            <NavItem id="types" icon={Tag} label="Tipos de Proyecto" />
            <NavItem id="frontend" icon={Monitor} label="Frontend" />
            <NavItem id="backend" icon={Server} label="Backend" />
            <NavItem id="database" icon={Database} label="Base de Datos" />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Content Header */}
          <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {getTabLabel(activeTab)}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Administra los elementos disponibles para {getTabLabel(activeTab).toLowerCase()}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-zinc-900">
            {activeTab === 'personal' ? (
              <div className="flex-1 overflow-hidden p-6">
                <PersonalManagement />
              </div>
            ) : (
              <>
                {/* Add New Form */}
                <div className="p-6 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-900/30">
                  <form onSubmit={handleAdd} className="flex gap-3">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={`Nuevo elemento en ${getTabLabel(activeTab)}...`}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={isAdding || !newItemName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {isAdding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  Agregar
                </button>
              </form>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-indigo-600" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={32} className="opacity-50" />
                  </div>
                  <p>No hay elementos registrados en esta categoría.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {items.map((item) => (
                    <div 
                      key={item.id}
                      className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                        item.active 
                          ? 'bg-white dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700' 
                          : 'bg-gray-50 dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 opacity-60'
                      }`}
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        {editingId === item.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border rounded dark:bg-zinc-700 dark:border-zinc-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleUpdate(item.id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {item.name}
                            </span>
                            {!item.active && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400">
                                Inactivo
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => toggleActive(item)}
                          className={`p-2 rounded-lg transition-colors ${
                            item.active 
                              ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' 
                              : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                          }`}
                          title={item.active ? 'Desactivar' : 'Activar'}
                        >
                          <Check size={16} className={!item.active ? 'opacity-50' : ''} />
                        </button>
                        <button
                          onClick={() => startEditing(item)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  </div>
</div>
);
}