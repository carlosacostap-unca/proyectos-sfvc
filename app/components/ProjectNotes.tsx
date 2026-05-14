'use client';

import { useCallback, useEffect, useState } from 'react';
import { 
  MessageSquare, 
  Send, 
  Trash2, 
  Clock,
  Loader2
} from 'lucide-react';
import { formatLocalDate } from '@/app/utils/date';
import Image from 'next/image';
import { pb } from '@/lib/pocketbase';
import { ProjectNote, User } from '@/app/types';
import { useAuth } from '@/app/contexts/AuthContext';
import { toast } from 'sonner';
import RichTextEditor from './RichTextEditor';

interface Props {
  projectId: string;
}

type ProjectNoteRealtimeEvent = {
  action: 'create' | 'update' | 'delete' | string;
  record: {
    id: string;
    project: string;
  };
};

type ProjectNoteAuthor = Partial<User> & {
  id: string;
  collectionId?: string;
  collectionName?: string;
};

export default function ProjectNotes({ projectId }: Props) {
  const { user, isAdmin } = useAuth();
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [authorsById, setAuthorsById] = useState<Record<string, ProjectNoteAuthor>>({});
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isAssigned, setIsAssigned] = useState(false);
  const [checkingAssignment, setCheckingAssignment] = useState(true);

  const fetchNotes = useCallback(async () => {
    try {
      const records = await pb.collection('project_notes').getFullList<ProjectNote>({
        sort: '-created',
        filter: `project = "${projectId}"`,
        expand: 'user',
      });

      const expandedAuthors = records.reduce<Record<string, ProjectNoteAuthor>>((acc, note) => {
        if (note.expand?.user) {
          acc[note.user] = note.expand.user;
        }
        return acc;
      }, {});

      const missingAuthorIds = Array.from(new Set(
        records
          .filter(note => note.user && !note.expand?.user)
          .map(note => note.user)
      ));

      if (missingAuthorIds.length > 0) {
        try {
          const authorFilter = missingAuthorIds.map(id => `id = "${id}"`).join(' || ');
          const users = await pb.collection('users').getFullList<User>({
            filter: authorFilter,
          });

          users.forEach(author => {
            expandedAuthors[author.id] = author;
          });
        } catch (authorError) {
          console.warn('Could not resolve note authors:', authorError);
        }
      }

      setAuthorsById(expandedAuthors);
      setNotes(records);
    } catch (error) {
      console.error('Error fetching notes:', error);
      // Don't show error toast on 404 (collection might not exist yet)
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const checkAssignment = useCallback(async () => {
    if (isAdmin) {
      setIsAssigned(true);
      setCheckingAssignment(false);
      return;
    }

    if (!user?.email) {
      setIsAssigned(false);
      setCheckingAssignment(false);
      return;
    }

    try {
      // Verificar si hay una asignación activa para este usuario en este proyecto
      const assignments = await pb.collection('project_assignments').getFullList({
        filter: `project = "${projectId}" && personal.email = "${user.email}" && active = true`,
        $autoCancel: false,
      });

      if (assignments.length > 0) {
        setIsAssigned(true);
        return;
      }

      // También verificar si el usuario es el responsable principal del proyecto
      const project = await pb.collection('projects').getOne(projectId, {
        expand: 'personal',
        $autoCancel: false,
      });

      if (project.expand?.personal?.email === user.email) {
        setIsAssigned(true);
      } else {
        setIsAssigned(false);
      }
    } catch (error) {
      console.error('Error verificando asignación:', error);
      setIsAssigned(false);
    } finally {
      setCheckingAssignment(false);
    }
  }, [isAdmin, projectId, user]);

  useEffect(() => {
    if (!user) return; // Only subscribe if user is logged in

    fetchNotes();
    checkAssignment();

    // Subscribe to realtime updates
    const onRecordChange = (e: ProjectNoteRealtimeEvent) => {
      if (e.record.project === projectId) {
        if (e.action === 'create') {
          fetchNotes(); // Refresh to get expanded user
        } else if (e.action === 'delete') {
          setNotes(prev => prev.filter(n => n.id !== e.record.id));
        } else if (e.action === 'update') {
            fetchNotes();
        }
      }
    };

    pb.collection('project_notes').subscribe('*', onRecordChange).catch((err) => {
      console.error('Realtime subscription error:', err);
    });

    return () => {
      pb.collection('project_notes').unsubscribe('*').catch((err) => {
        // Ignore 404/client_id errors during cleanup as they are non-critical
        if (err?.status !== 404) {
             console.warn('Unsubscribe error:', err);
        }
      });
    };
  }, [checkAssignment, fetchNotes, projectId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Check if content is empty (handling HTML tags from editor)
    const strippedContent = newNote.replace(/<[^>]*>/g, '').trim();
    if (!strippedContent || !user) return;

    setSending(true);
    try {
      await pb.collection('project_notes').create({
        project: projectId,
        user: user.id,
        author_name: user.name || user.email || user.username || '',
        author_email: user.email || '',
        content: newNote,
      });
      setNewNote('');
      toast.success('Nota añadida');
    } catch (error) {
      console.error('Error creating note:', error);
      toast.error('Error al añadir la nota');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('¿Eliminar esta nota?')) return;
    
    try {
      await pb.collection('project_notes').delete(noteId);
      toast.success('Nota eliminada');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Error al eliminar la nota');
    }
  };

  const formatDate = (dateStr: string) => {
    return formatLocalDate(dateStr);
  };

  const getAuthor = (note: ProjectNote) => {
    if (note.expand?.user) return note.expand.user;
    if (note.user && authorsById[note.user]) return authorsById[note.user];
    if (note.user && user?.id === note.user) return user as ProjectNoteAuthor;
    return null;
  };

  const getAuthorName = (note: ProjectNote) => {
    const author = getAuthor(note);
    return author?.name || note.author_name || author?.email || note.author_email || author?.username || 'Usuario desconocido';
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 flex flex-col h-[600px]">
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center gap-2">
        <MessageSquare className="text-indigo-600" size={20} />
        <h3 className="font-semibold text-gray-900 dark:text-white">Notas del Proyecto</h3>
        <span className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 text-xs px-2 py-0.5 rounded-full font-medium">
          {notes.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-indigo-600" size={24} />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
            <p>No hay notas todavía</p>
          </div>
        ) : (
          notes.map((note) => {
            const author = getAuthor(note);
            const authorName = getAuthorName(note);

            return (
              <div key={note.id} className="group flex gap-3">
                <div className="flex-shrink-0">
                  {author?.avatar ? (
                    <Image
                      src={pb.files.getUrl(author, author.avatar)}
                      alt={authorName}
                      width={32}
                      height={32}
                      unoptimized
                      className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-zinc-700"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-indigo-200 dark:border-indigo-800">
                      {authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-3 relative group-hover:bg-gray-100 dark:group-hover:bg-zinc-800 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {authorName}
                      </span>
                      <div className="flex items-center gap-1 opacity-70">
                        <Clock size={10} />
                        {formatDate(note.created)}
                      </div>
                    </div>
                    <div
                      className="text-sm text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none [&>p]:mb-0"
                      dangerouslySetInnerHTML={{ __html: note.content }}
                    />

                    {(isAdmin || user?.id === note.user) && (
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                        title="Eliminar nota"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {(isAdmin || isAssigned) && !checkingAssignment ? (
        <div className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 rounded-b-xl">
          <div className="relative">
            <RichTextEditor
              value={newNote}
              onChange={setNewNote}
              placeholder="Escribe una nota..."
              className="mb-2"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={!newNote.replace(/<[^>]*>/g, '').trim() || sending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                <span>Enviar</span>
              </button>
            </div>
          </div>
        </div>
      ) : checkingAssignment ? (
        <div className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 rounded-b-xl flex justify-center">
          <Loader2 className="animate-spin text-indigo-600" size={20} />
        </div>
      ) : null}
    </div>
  );
}
