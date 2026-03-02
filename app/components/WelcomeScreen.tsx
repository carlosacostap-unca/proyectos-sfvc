import { User } from "lucide-react";
import { AuthModel } from "pocketbase";
import TimeTracking from "./TimeTracking";

interface WelcomeScreenProps {
  user: AuthModel | null;
}

export default function WelcomeScreen({ user }: WelcomeScreenProps) {
  const isAdmin = (user as any)?.isAdmin;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto mt-8 md:mt-20 text-center space-y-6 animate-fade-in pb-20 px-4 md:px-0">
      {isAdmin && (
        <>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-8 rounded-full shadow-sm">
            <User size={64} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
              ¡Bienvenido, {user?.name?.split(' ')[0] || 'Usuario'}!
            </h1>
            <p className="text-xl text-gray-500 dark:text-gray-400 font-light">
              Sistema de Gestión de Proyectos SFVC
            </p>
          </div>
        </>
      )}

      {user?.email && (
        <div className="w-full mt-12 animate-slide-up">
            <TimeTracking userEmail={user.email} isAdmin={isAdmin} />
        </div>
      )}
    </div>
  );
}
