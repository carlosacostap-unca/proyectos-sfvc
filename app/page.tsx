'use client';

import ProjectList from "./components/ProjectList";
import { useAuth } from "@/app/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { pb } from "@/lib/pocketbase";

export default function Home() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

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
          Project Manager &nbsp;
          <code className="font-mono font-bold">SFVC</code>
        </p>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
          <div className="flex items-center gap-4 pointer-events-auto p-8 lg:p-0">
            <div className="flex items-center gap-3">
               {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="Avatar" 
                    className="w-10 h-10 rounded-full border border-gray-200 object-cover"
                  />
              ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg border border-indigo-200">
                    {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                  </div>
              )}
              <div className="text-right hidden md:block">
                <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight">
                    {user.name || 'Usuario'}
                </p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>

            <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block dark:bg-gray-700"></div>

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

      <ProjectList />
    </main>
  );
}
