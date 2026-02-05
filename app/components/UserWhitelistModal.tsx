'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit, Save, Shield, User, Ban, CheckCircle, Users } from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { WhitelistUser } from '@/app/types';
import { useAuth } from '@/app/contexts/AuthContext';

interface Props {
  onClose: () => void;
}

export default function UserWhitelistModal({ onClose }: Props) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<WhitelistUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<WhitelistUser | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    avatar: '',
    isAdmin: false,
    active: true
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const [whitelistRecords, usersRecords] = await Promise.all([
        pb.collection('whitelist').getFullList<WhitelistUser>({ sort: '-created' }),
        pb.collection('users').getFullList(),
      ]);

      // Create a map for fast lookup: email -> userRecord
      const usersMap = new Map(usersRecords.map(u => [u.email, u]));

      // Merge data
      const enrichedUsers = whitelistRecords.map(wUser => {
        const userProfile = usersMap.get(wUser.email);
        return {
          ...wUser,
          name: wUser.name || userProfile?.name || '', // Prefer whitelist name (if edited), then user profile
          avatar: userProfile?.avatar ? pb.files.getUrl(userProfile, userProfile.avatar) : undefined,
          isRegistered: !!userProfile, // Flag to check if user exists in 'users' collection
        };
      });

      setUsers(enrichedUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Error al cargar la lista de usuarios');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ email: '', avatar: '', isAdmin: false, active: true });
    setEditingUser(null);
    setIsCreating(false);
    setError('');
  };

  const handleCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleEdit = (user: WhitelistUser) => {
    // Prevent editing own account
    if (user.email === currentUser?.email) {
      alert('No puedes editar tu propia cuenta.');
      return;
    }

    setEditingUser(user);
    setFormData({
      email: user.email,
      avatar: user.avatar || '',
      isAdmin: user.isAdmin,
      active: user.active
    });
    setIsCreating(false);
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.email) {
      setError('El email es obligatorio');
      return;
    }

    try {
      if (isCreating) {
        await pb.collection('whitelist').create(formData);
      } else if (editingUser) {
        await pb.collection('whitelist').update(editingUser.id, formData);
      }
      
      await fetchUsers();
      resetForm();
    } catch (err: any) {
      console.error('Error saving user:', err);
      setError(err.message || 'Error al guardar el usuario');
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (email === currentUser?.email) {
      alert('No puedes eliminar tu propia cuenta.');
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar al usuario ${email}?`)) return;

    try {
      await pb.collection('whitelist').delete(id);
      await fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Error al eliminar usuario');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="text-indigo-600" size={24} />
              Gestión de Usuarios (Whitelist)
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Administra quién tiene acceso a la aplicación
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* List Section */}
          <div className={`flex-1 overflow-y-auto p-6 ${isCreating || editingUser ? 'hidden md:block' : ''}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Usuarios Registrados</h3>
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
              >
                <Plus size={16} />
                Nuevo Usuario
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((u) => {
                  const isCurrentUser = u.email === currentUser?.email;
                  return (
                    <div 
                      key={u.id} 
                      className={`p-4 rounded-lg border transition-all ${
                        editingUser?.id === u.id 
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                          : 'border-gray-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${u.avatar ? '' : (u.isAdmin ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400')}`}>
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.name || u.email} className="w-full h-full object-cover" />
                            ) : (
                              u.isAdmin ? <Shield size={18} /> : <User size={18} />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                              {u.name || u.email}
                              {isCurrentUser && (
                                <span className="text-[10px] bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                                  TÚ
                                </span>
                              )}
                            </p>
                            {u.name && <p className="text-xs text-gray-500">{u.email}</p>}
                            
                            {!u.isRegistered && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium mt-0.5 flex items-center gap-1">
                                • Acceso Pendiente
                              </p>
                            )}

                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                u.active 
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                                {u.active ? <CheckCircle size={10} /> : <Ban size={10} />}
                                {u.active ? 'Activo' : 'Inactivo'}
                              </span>
                              {u.isAdmin && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                  Admin
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {!isCurrentUser && (
                            <>
                              <button
                                onClick={() => handleEdit(u)}
                                className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                title="Editar"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(u.id, u.email)}
                                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {users.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No hay usuarios registrados</p>
                )}
              </div>
            )}
          </div>

          {/* Form Section */}
          {(isCreating || editingUser) && (
            <div className="w-full md:w-80 border-l border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 dark:text-white">
                  {isCreating ? 'Nuevo Usuario' : 'Editar Usuario'}
                </h3>
                <button 
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-800 dark:border-zinc-700"
                    placeholder="usuario@ejemplo.com"
                    required
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 cursor-pointer hover:border-indigo-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.isAdmin}
                      onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">Es Administrador</span>
                      <span className="block text-xs text-gray-500">Puede gestionar proyectos y usuarios</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 cursor-pointer hover:border-indigo-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">Cuenta Activa</span>
                      <span className="block text-xs text-gray-500">Permitir acceso al sistema</span>
                    </div>
                  </label>
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {error}
                  </div>
                )}

                <div className="pt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center justify-center gap-2"
                  >
                    <Save size={16} />
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}