'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Plus, Save, X, Search,
  FileText, Phone, Mail,
  Check, Upload, Clock, DollarSign,
  Calendar, Edit2, Trash2, AlertCircle
} from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { Personal, PersonalCompensationPeriod, RoleItem, ShiftItem, StaffStatusItem } from '@/app/types';
import { toast } from 'sonner';
import { toLocalDateString, fromLocalDateString } from '@/app/utils/date';
import { listCompensationPeriodsByPersonal } from '@/app/services/compensationPeriods';
import {
  deriveDailyHours,
  findOverlappingCompensationPeriod,
} from '@/app/utils/compensation';

type RequestError = {
  message?: string;
};

type PersonalWithFlexibleShift = Omit<Personal, 'expand'> & {
  expand?: Omit<NonNullable<Personal['expand']>, 'shift'> & {
    shift?: ShiftItem[] | ShiftItem;
  };
};

type CompensationFormData = {
  personal: string;
  start_date: string;
  end_date: string;
  monthly_salary: number;
  shifts: string[];
  observations: string;
};

const formatCurrency = (value?: number) => {
  if (!value) return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCompensationShiftNames = (item: PersonalCompensationPeriod, shifts: ShiftItem[]) => {
  const expandedShifts = item.expand?.shifts;
  if (expandedShifts && expandedShifts.length > 0) {
    return expandedShifts.map(s => s.name).join(', ');
  }
  return item.shifts.map(id => shifts.find(s => s.id === id)?.name || id).join(', ');
};

const formatShiftNames = (item: Personal) => {
  const shift = (item as PersonalWithFlexibleShift).expand?.shift;
  if (!shift) return '-';
  return Array.isArray(shift) ? shift.map(s => s.name).join(', ') : shift.name;
};

export default function PersonalManagement() {
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [statuses, setStatuses] = useState<StaffStatusItem[]>([]);
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
    working_hours: 0,
    monthly_salary: 0,
    shift: [], // Array for multiple selection
    main_role: '',
    secondary_role: '',
    join_date: toLocalDateString(new Date()),
    observations: ''
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [compensationPeriods, setCompensationPeriods] = useState<PersonalCompensationPeriod[]>([]);
  const [loadingCompensation, setLoadingCompensation] = useState(false);
  const [editingCompensationId, setEditingCompensationId] = useState<string | null>(null);
  const [compensationForm, setCompensationForm] = useState<CompensationFormData>({
    personal: '',
    start_date: toLocalDateString(new Date()),
    end_date: '',
    monthly_salary: 0,
    shifts: [],
    observations: '',
  });

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
    try {
      const records = await pb.collection('personal').getFullList<Personal>({
        sort: 'surname,name',
        expand: 'main_role,secondary_role,shift,status'
      });
      setPersonal(records);
    } catch (error) {
      console.error('Error fetching personal:', error);
      toast.error('Error al cargar el personal');
    }
  };

  const resetCompensationForm = (personalId = editingId || '') => {
    setCompensationForm({
      personal: personalId,
      start_date: toLocalDateString(new Date()),
      end_date: '',
      monthly_salary: 0,
      shifts: [],
      observations: '',
    });
    setEditingCompensationId(null);
  };

  const fetchCompensationPeriods = async (personalId: string) => {
    if (!personalId) {
      setCompensationPeriods([]);
      return;
    }

    try {
      setLoadingCompensation(true);
      const records = await listCompensationPeriodsByPersonal(personalId);
      setCompensationPeriods(records);
    } catch (error) {
      console.error('Error fetching compensation periods:', error);
      setCompensationPeriods([]);
      toast.error('No se pudo cargar el historial salarial. Verifique que la coleccion exista.');
    } finally {
      setLoadingCompensation(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        fetchPersonal(),
        fetchRoles(),
        fetchShifts(),
        fetchStatuses(),
      ]);
    };

    void loadInitialData();
  }, []);

  const resetForm = () => {
    setFormData({
      status: '',
      surname: '',
      name: '',
      dni: '',
      file_number: '',
      email: '',
      phone: '',
      working_hours: 0,
      monthly_salary: 0,
      shift: [],
      main_role: '',
      secondary_role: '',
      join_date: toLocalDateString(new Date()),
      observations: ''
    });
    setCvFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsEditing(false);
    setEditingId(null);
    setCompensationPeriods([]);
    resetCompensationForm('');
  };

  const handleEdit = (item: Personal) => {
    setFormData({
      status: item.status || '',
      surname: item.surname || '',
      name: item.name || '',
      dni: item.dni || '',
      file_number: item.file_number || '',
      email: item.email || '',
      phone: item.phone || '',
      working_hours: item.working_hours || 0,
      monthly_salary: item.monthly_salary || 0,
      // Ensure shift is always an array, even if it comes as a single string ID
      shift: Array.isArray(item.shift) ? item.shift : (item.shift ? [item.shift] : []),
      main_role: item.main_role || '',
      secondary_role: item.secondary_role || '',
      // Safe date parsing
      join_date: item.join_date ? toLocalDateString(item.join_date) : '',
      observations: item.observations || '',
      cv: item.cv || ''
    });
    setEditingId(item.id);
    setIsEditing(true);
    resetCompensationForm(item.id);
    void fetchCompensationPeriods(item.id);
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
          if (key === 'join_date' && typeof value === 'string' && value.length > 0) {
            data.append(key, fromLocalDateString(value));
          } else if (Array.isArray(value)) {
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
    } catch (error: unknown) {
      const requestError = error as RequestError;
      console.error('Error saving personal:', error);
      toast.error(`Error al guardar: ${requestError.message || 'Error desconocido'}`);
    }
  };

  const handleEditCompensation = (item: PersonalCompensationPeriod) => {
    setEditingCompensationId(item.id);
    setCompensationForm({
      personal: item.personal,
      start_date: item.start_date ? toLocalDateString(item.start_date) : '',
      end_date: item.end_date ? toLocalDateString(item.end_date) : '',
      monthly_salary: item.monthly_salary || 0,
      shifts: Array.isArray(item.shifts) ? item.shifts : [],
      observations: item.observations || '',
    });
  };

  const validateCompensationForm = () => {
    if (!editingId) return 'Primero debe guardar el personal.';
    if (!compensationForm.start_date) return 'La fecha de inicio es obligatoria.';
    if (compensationForm.end_date && compensationForm.end_date < compensationForm.start_date) {
      return 'La fecha de fin no puede ser anterior al inicio.';
    }
    if (!Number.isFinite(compensationForm.monthly_salary) || compensationForm.monthly_salary < 0) {
      return 'El sueldo mensual debe ser un numero valido.';
    }
    if (compensationForm.shifts.length === 0) return 'Debe seleccionar al menos un turno.';

    const overlap = findOverlappingCompensationPeriod(
      {
        id: editingCompensationId || '',
        personal: editingId,
        start_date: compensationForm.start_date,
        end_date: compensationForm.end_date || null,
      },
      compensationPeriods,
    );

    if (overlap) return 'El periodo se superpone con otro periodo salarial existente.';
    return null;
  };

  const handleSaveCompensation = async () => {
    const validationError = validateCompensationForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!editingId) return;

    const payload = {
      personal: editingId,
      start_date: fromLocalDateString(compensationForm.start_date),
      end_date: compensationForm.end_date ? fromLocalDateString(compensationForm.end_date) : null,
      monthly_salary: compensationForm.monthly_salary,
      shifts: compensationForm.shifts,
      observations: compensationForm.observations,
    };

    try {
      if (editingCompensationId) {
        await pb.collection('personal_compensation_periods').update(editingCompensationId, payload);
        toast.success('Periodo salarial actualizado');
      } else {
        await pb.collection('personal_compensation_periods').create(payload);
        toast.success('Periodo salarial creado');
      }

      if (!payload.end_date) {
        await pb.collection('personal').update(editingId, {
          monthly_salary: payload.monthly_salary,
          working_hours: deriveDailyHours({ shifts: payload.shifts }),
          shift: payload.shifts,
        });
      }

      resetCompensationForm(editingId);
      await fetchCompensationPeriods(editingId);
      await fetchPersonal();
    } catch (error: unknown) {
      const requestError = error as RequestError;
      console.error('Error saving compensation period:', error);
      toast.error(`Error al guardar periodo: ${requestError.message || 'Verifique los datos'}`);
    }
  };

  const handleDeleteCompensation = async (id: string) => {
    if (!window.confirm('Â¿EstÃ¡s seguro de eliminar este periodo salarial?')) return;
    if (!editingId) return;

    try {
      await pb.collection('personal_compensation_periods').delete(id);
      toast.success('Periodo salarial eliminado');
      resetCompensationForm(editingId);
      await fetchCompensationPeriods(editingId);
    } catch (error) {
      console.error('Error deleting compensation period:', error);
      toast.error('Error al eliminar periodo salarial');
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
                    {formatShiftNames(item)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    {item.working_hours ? `${item.working_hours} h` : '-'}
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign size={12} />
                    {formatCurrency(item.monthly_salary)}
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
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Horas de trabajo</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.working_hours || ''}
                    onChange={(e) => setFormData({...formData, working_hours: e.target.value === '' ? 0 : Number(e.target.value)})}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Sueldo mensual</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.monthly_salary || ''}
                    onChange={(e) => setFormData({...formData, monthly_salary: e.target.value === '' ? 0 : Number(e.target.value)})}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50/60 dark:bg-zinc-800/40 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <DollarSign size={16} className="text-emerald-600" />
                      Historial salarial
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Sueldo mensual y turnos vigentes por periodo.
                    </p>
                  </div>
                  {editingCompensationId && (
                    <button
                      type="button"
                      onClick={() => resetCompensationForm(editingId || '')}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      Nuevo periodo
                    </button>
                  )}
                </div>

                {!editingId ? (
                  <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg px-3 py-2">
                    <AlertCircle size={16} />
                    Guardar el personal antes de cargar periodos salariales.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Desde</label>
                        <input
                          type="date"
                          value={compensationForm.start_date}
                          onChange={(e) => setCompensationForm({...compensationForm, start_date: e.target.value})}
                          className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Hasta</label>
                        <input
                          type="date"
                          value={compensationForm.end_date}
                          onChange={(e) => setCompensationForm({...compensationForm, end_date: e.target.value})}
                          className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Sueldo mensual</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={compensationForm.monthly_salary || ''}
                          onChange={(e) => setCompensationForm({...compensationForm, monthly_salary: e.target.value === '' ? 0 : Number(e.target.value)})}
                          className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleSaveCompensation}
                          className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <Save size={15} />
                          {editingCompensationId ? 'Actualizar' : 'Agregar'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Turnos del periodo</label>
                      <div className="flex flex-wrap gap-2 p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg min-h-[54px]">
                        {shifts.map(shift => {
                          const isSelected = compensationForm.shifts.includes(shift.id);
                          return (
                            <button
                              key={shift.id}
                              type="button"
                              onClick={() => {
                                const nextShifts = isSelected
                                  ? compensationForm.shifts.filter(id => id !== shift.id)
                                  : [...compensationForm.shifts, shift.id];
                                setCompensationForm({...compensationForm, shifts: nextShifts});
                              }}
                              className={`px-3 py-1.5 text-xs rounded-lg border transition-all flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-400 dark:hover:border-zinc-600'
                              }`}
                            >
                              {isSelected && <Check size={12} className="stroke-[3]" />}
                              {shift.name}
                            </button>
                          );
                        })}
                        <span className="ml-auto self-center text-xs text-gray-500 dark:text-gray-400">
                          {deriveDailyHours({ shifts: compensationForm.shifts })} h/dia
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Observaciones del periodo</label>
                      <input
                        type="text"
                        value={compensationForm.observations}
                        onChange={(e) => setCompensationForm({...compensationForm, observations: e.target.value})}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      {loadingCompensation ? (
                        <div className="text-sm text-gray-500 py-3">Cargando periodos...</div>
                      ) : compensationPeriods.length === 0 ? (
                        <div className="text-sm text-gray-500 py-3 border border-dashed border-gray-200 dark:border-zinc-700 rounded-lg text-center">
                          Sin periodos salariales cargados.
                        </div>
                      ) : (
                        compensationPeriods.map(period => (
                          <div
                            key={period.id}
                            className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                                <Calendar size={14} className="text-gray-400" />
                                <span>{toLocalDateString(period.start_date)}</span>
                                <span className="text-gray-400">a</span>
                                <span>{period.end_date ? toLocalDateString(period.end_date) : 'Actual'}</span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {formatCurrency(period.monthly_salary)} · {formatCompensationShiftNames(period, shifts)} · {deriveDailyHours(period)} h/dia
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditCompensation(period)}
                                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                title="Editar periodo"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCompensation(period.id)}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Eliminar periodo"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
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
                      href={pb.files.getUrl({ collectionId: 'personal', id: editingId || '' }, formData.cv)}
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
