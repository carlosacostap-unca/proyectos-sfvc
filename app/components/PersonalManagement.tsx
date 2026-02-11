'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, Edit2, Save, X, Search, 
  User, FileText, Phone, Mail, Calendar, 
  Briefcase, Check, AlertCircle, Upload, Clock
} from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { Personal, RoleItem, ShiftItem, StaffStatusItem } from '@/app/types';
import { toast } from 'sonner';

export default function PersonalManagement() {
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [statuses, setStatuses] = useState<StaffStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Personal>>({
    status: '',
    surname: '',
    name: '',
    dni: '',
    file_number: '',
    email: '',
    phone: '',
    shift: [], // Array for multiple selection
    main_role: '',
    secondary_role: '',
    join_date: new Date().toISOString().split('T')[0],
    observations: ''
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPersonal();
    fetchRoles();
    fetchShifts();
    fetchStatuses();
  }, []);

  const fetchRoles = async () => {
    try {
      const records = await pb.collection('roles').getFullList<RoleItem>({
        sort: 'name',
        filter: 'active = true'
      });
      setRoles(records);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchShifts = async () => {
    try {
      const records = await pb.collection('shifts').getFullList<ShiftItem>({
        sort: 'name',
        filter: 'active = true'
      });
      setShifts(records);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  };

  const fetchStatuses = async () => {
    try {
      const records = await pb.collection('personal_statuses').getFullList<StaffStatusItem>({
        sort: 'name',
        filter: 'active = true'
      });
      setStatuses(records);
    } catch (error) {
      console.error('Error fetching statuses:', error);
    }
  };

  const fetchPersonal = async () => {
    setLoading(true);
    try {
      const records = await pb.collection('personal').getFullList<Personal>({
        sort: 'surname,name',
        expand: 'main_role,secondary_role,shift,status'
      });
      setPersonal(records);
    } catch (error) {
      console.error('Error fetching personal:', error);
      toast.error('Error al cargar el personal');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      status: '',
      surname: '',
      name: '',
      dni: '',
      file_number: '',
      email: '',
      phone: '',
      shift: [],
      main_role: '',
      secondary_role: '',
      join_date: new Date().toISOString().split('T')[0],
      observations: ''
    });
    setCvFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsEditing(false);
    setEditingId(null);
  };

  const handleEdit = (item: Personal) => {
    setFormData({
      ...item,
      join_date: item.join_date ? item.join_date.split('T')[0] : ''
    });
    setEditingId(item.id);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return;
    
    try {
      await pb.collection('personal').delete(id);
      toast.success('Personal eliminado correctamente');
      fetchPersonal();
    } catch (error) {
      console.error('Error deleting personal:', error);
      toast.error('Error al eliminar personal');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        // Skip empty string values for relation fields to avoid 400 Invalid ID error
        if (value === '' && ['main_role', 'secondary_role', 'status'].includes(key)) {
          return;
        }

        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            // Handle array fields (like shift)
            value.forEach((v) => data.append(key, v));
          } else {
            data.append(key, value.toString());
          }
        }
      });
      
      if (cvFile) {
        data.append('cv', cvFile);
      }

      if (editingId) {
        await pb.collection('personal').update(editingId, data);
        toast.success('Personal actualizado correctamente');
      } else {
        await pb.collection('personal').create(data);
        toast.success('Personal creado correctamente');
      }
      
      resetForm();
      fetchPersonal();
    } catch (error: any) {
      console.error('Error saving personal:', error);
      toast.error(`Error al guardar: ${error.message}`);
    }
  };

  const filteredPersonal = personal.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.surname.toLowerCase().includes(search.toLowerCase()) ||
    p.dni.includes(search) ||
    p.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header & Search */}
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar personal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-zinc-800 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
        
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium text-sm"
          >
            <Plus size={18} />
            Nuevo Personal
          </button>
        )}
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* List */}
        <div className={`flex-1 overflow-y-auto ${isEditing ? 'hidden md:block md:w-1/3 md:flex-none' : ''}`}>
          <div className="grid gap-3">
            {filteredPersonal.map((item) => (
              <div 
                key={item.id} 
                className={`p-4 rounded-xl border transition-all cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 ${
                  editingId === item.id 
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                    : 'border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                }`}
                onClick={() => handleEdit(item)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {item.surname}, {item.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.expand?.main_role?.name || item.main_role}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    item.expand?.status?.active 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {item.expand?.status?.name || 'Sin estado'}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Mail size={12} />
                    {item.email}
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone size={12} />
                    {item.phone || '-'}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    {item.expand?.shift ? (
                      Array.isArray(item.expand.shift) 
                        ? item.expand.shift.map(s => s.name).join(', ') 
                        : (item.expand.shift as any).name
                    ) : '-'}
                  </div>
                </div>
              </div>
            ))}
            
            {filteredPersonal.length === 0 && (
              <div className="text-center py-10 text-gray-500">
                No se encontró personal
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        {isEditing && (
          <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingId ? 'Editar Personal' : 'Nuevo Personal'}
              </h2>
              <button 
                onClick={resetForm}
                className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Apellido</label>
                  <input
                    type="text"
                    required
                    value={formData.surname}
                    onChange={(e) => setFormData({...formData, surname: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">DNI</label>
                  <input
                    type="text"
                    required
                    value={formData.dni}
                    onChange={(e) => setFormData({...formData, dni: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Legajo</label>
                  <input
                    type="text"
                    value={formData.file_number}
                    onChange={(e) => setFormData({...formData, file_number: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Rol Principal</label>
                  <select
                    required
                    value={formData.main_role}
                    onChange={(e) => setFormData({...formData, main_role: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    <option value="">Seleccionar Rol</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Rol Secundario</label>
                  <select
                    value={formData.secondary_role}
                    onChange={(e) => setFormData({...formData, secondary_role: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    <option value="">Seleccionar Rol</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Turno (Selección múltiple)</label>
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg min-h-[80px]">
                    {shifts.map(shift => {
                      const isSelected = Array.isArray(formData.shift) && formData.shift.includes(shift.id);
                      return (
                        <button
                          key={shift.id}
                          type="button"
                          onClick={() => {
                            const currentShifts = Array.isArray(formData.shift) ? formData.shift : [];
                            const newShifts = isSelected
                              ? currentShifts.filter(id => id !== shift.id)
                              : [...currentShifts, shift.id];
                            setFormData({...formData, shift: newShifts});
                          }}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-gray-400 dark:hover:border-zinc-600'
                          }`}
                        >
                          {isSelected && <Check size={12} className="stroke-[3]" />}
                          {shift.name}
                        </button>
                      );
                    })}
                    {shifts.length === 0 && (
                      <span className="text-xs text-gray-400 italic">No hay turnos disponibles</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Incorporación</label>
                  <input
                    type="date"
                    required
                    value={formData.join_date}
                    onChange={(e) => setFormData({...formData, join_date: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Observaciones</label>
                <textarea
                  rows={3}
                  value={formData.observations}
                  onChange={(e) => setFormData({...formData, observations: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Currículum Vitae</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors flex items-center gap-2"
                  >
                    <Upload size={16} />
                    {cvFile ? cvFile.name : 'Subir CV'}
                  </button>
                  {formData.cv && !cvFile && (
                    <a 
                      href={pb.files.getUrl({ collectionId: 'personal', id: editingId || '' } as any, formData.cv)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 text-sm hover:underline flex items-center gap-1"
                    >
                      <FileText size={16} />
                      Ver CV Actual
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <label className="text-sm text-gray-700 dark:text-gray-300 w-32">Estado</label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                >
                  <option value="">Seleccionar Estado</option>
                  {statuses.map(status => (
                    <option key={status.id} value={status.id}>{status.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800 mt-4">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingId)}
                    className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
                  >
                    Eliminar
                  </button>
                )}
                <div className="flex-1"></div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Save size={18} />
                  Guardar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}