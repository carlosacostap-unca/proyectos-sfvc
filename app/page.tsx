'use client';

import ProjectList from "./components/ProjectList";
import WelcomeScreen from "./components/WelcomeScreen";
import AdminWorkLogs from "./components/AdminWorkLogs";
import AdminProjectCleanup from "./components/AdminProjectCleanup";
import AdminProjectImport from "./components/AdminProjectImport";
import ProgramList from "./components/ProgramList";
import { useAuth } from "@/app/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Users, Settings, Clock, Trash2, Upload, Layers, Calendar } from "lucide-react";
import { pb } from "@/lib/pocketbase";
import UserManagementModal from "./components/UserManagementModal";
import SettingsModal from "./components/SettingsModal";

export default function Home() {
  const { user, loading, logout, isAdmin } = useAuth();
  const router = useRouter();
  const [showUserModal, setShowUserModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [viewMode, setViewMode] = useState<'projects' | 'worklogs' | 'cleanup' | 'import' | 'programs' | 'my_hours'>('projects');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const avatarUrl = user.avatar ? pb.files.getUrl(user, user.avatar) : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-start gap-8 px-6 py-8 md:p-24 bg-gray-50 dark:bg-black overflow-x-hidden">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex mb-0">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Project Management &nbsp;
          <code className="font-mono font-bold">SFVC</code>
        </p>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
          <div className="flex items-center gap-4 pointer-events-auto p-8 lg:p-0">
            <div className="flex items-center gap-3">
               {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="Avatar" 
                    className={`w-10 h-10 rounded-full border-2 object-cover ${isAdmin ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900' : 'border-gray-200'}`}
                  />
              ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-2 ${isAdmin ? 'bg-indigo-100 text-indigo-700 border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900' : 'bg-indigo-100 text-indigo-600 border-indigo-200'}`}>
                    {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                  </div>
              )}
              <div className="text-right hidden md:block">
                <div className="flex items-center justify-end gap-2">
                  {isAdmin && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white shadow-sm">
                      ADMIN
                    </span>
                  )}
                  <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight">
                      {user.name || 'Usuario'}
                  </p>
                </div>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>

            <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block dark:bg-gray-700"></div>

            {isAdmin && (
              <>
                <button
                  onClick={() => setViewMode(viewMode === 'my_hours' ? 'projects' : 'my_hours')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${viewMode === 'my_hours' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-700'}`}
                  title={viewMode === 'my_hours' ? "Ver Proyectos" : "Cargar Mis Horas"}
                >
                  <Calendar size={18} />
                  <span className="md:hidden">Mis Horas</span>
                </button>

                <button
                  onClick={() => setViewMode(viewMode === 'worklogs' ? 'projects' : 'worklogs')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${viewMode === 'worklogs' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-700'}`}
                  title={viewMode === 'worklogs' ? "Ver Proyectos" : "Ver Reporte de Horas"}
                >
                  <Clock size={18} />
                  <span className="md:hidden">Horas</span>
                </button>

                <button
                  onClick={() => setViewMode(viewMode === 'cleanup' ? 'projects' : 'cleanup')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${viewMode === 'cleanup' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-700'}`}
                  title={viewMode === 'cleanup' ? "Ver Proyectos" : "Eliminación Masiva"}
                >
                  <Trash2 size={18} />
                  <span className="md:hidden">Limpieza</span>
                </button>

                <button
                  onClick={() => setViewMode(viewMode === 'programs' ? 'projects' : 'programs')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${viewMode === 'programs' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-700'}`}
                  title={viewMode === 'programs' ? "Ver Proyectos" : "Gestionar Programas"}
                >
                  <Layers size={18} />
                  <span className="md:hidden">Programas</span>
                </button>

                <button
                  onClick={() => setViewMode(viewMode === 'import' ? 'projects' : 'import')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${viewMode === 'import' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-700'}`}
                  title={viewMode === 'import' ? "Ver Proyectos" : "Importar CSV"}
                >
                  <Upload size={18} />
                  <span className="md:hidden">Importar</span>
                </button>

                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors border border-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-700"
                  title="Parametrizaciones"
                >
                  <Settings size={18} />
                  <span className="md:hidden">Parametrizaciones</span>
                </button>
                <button
                  onClick={() => setShowUserModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors border border-indigo-200"
                  title="Gestionar Usuarios"
                >
                  <Users size={18} />
                  <span className="md:hidden">Usuarios</span>
                </button>
              </>
            )}

            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors border border-red-200"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
              <span className="md:hidden">Salir</span>
            </button>
          </div>
        </div>
      </div>

      {isAdmin ? (
        viewMode === 'projects' ? <ProjectList /> : 
        viewMode === 'worklogs' ? <AdminWorkLogs onBack={() => setViewMode('projects')} /> :
        viewMode === 'cleanup' ? <AdminProjectCleanup onBack={() => setViewMode('projects')} /> :
        viewMode === 'programs' ? <ProgramList onBack={() => setViewMode('projects')} /> :
        viewMode === 'my_hours' ? <WelcomeScreen user={user} /> :
        <AdminProjectImport onBack={() => setViewMode('projects')} />
      ) : (
        <WelcomeScreen user={user} />
      )}

      {showUserModal && (
        <UserManagementModal onClose={() => setShowUserModal(false)} />
      )}
      
      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
      />
    </main>
  );
}
