
'use client';

import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { Evaluation } from '@/app/types';
import { EVALUATION_DIMENSIONS } from '@/app/data/evaluationCriteria';
import { Plus, ClipboardCheck, ChevronDown, ChevronUp, History, HelpCircle } from 'lucide-react';
import EvaluationWizard from './EvaluationWizard';
import EvaluationRadarChart from './EvaluationRadarChart';

interface Props {
  projectId: string;
}

export default function EvaluationSection({ projectId }: Props) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);

  const fetchEvaluations = async () => {
    try {
      setLoading(true);
      const records = await pb.collection('evaluations').getList<Evaluation>(1, 50, {
        filter: `project = "${projectId}"`,
        sort: '-created',
      });
      setEvaluations(records.items);
      
      // Expand the latest one by default if exists
      if (records.items.length > 0 && !expandedId) {
        setExpandedId(records.items[0].id);
      }
    } catch (err) {
      console.error('Error fetching evaluations:', err);
      // Fail silently or show empty state (collection might not exist yet)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, [projectId]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setExpandedDimension(null); // Reset dimension expansion when switching evaluations
  };

  const getAnswerText = (val: number, type: 'boolean' | 'likert') => {
    if (type === 'boolean') {
      return val === 100 ? 'Sí' : 'No';
    }
    // Likert 1-5 mapped to 20-100
    const score = val / 20;
    return `${score}/5`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 40) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
          <ClipboardCheck className="text-blue-600" />
          Evaluaciones de Modernización
        </h3>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium w-full sm:w-auto"
        >
          <Plus size={16} />
          Nueva Evaluación
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500 animate-pulse">Cargando evaluaciones...</div>
      ) : evaluations.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-zinc-800 rounded-xl border border-dashed dark:border-zinc-700">
          <ClipboardCheck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No hay evaluaciones registradas</p>
          <p className="text-sm text-gray-400 mb-4">Realiza la primera evaluación de dimensiones para este proyecto.</p>
          <button
            onClick={() => setShowWizard(true)}
            className="text-blue-600 hover:underline text-sm font-medium"
          >
            Comenzar Evaluación
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {evaluations.map((evaluation) => (
            <div 
              key={evaluation.id} 
              className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border dark:border-zinc-700 overflow-hidden transition-all"
            >
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700/50"
                onClick={() => toggleExpand(evaluation.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border ${getScoreColor(evaluation.total_score)}`}>
                    {evaluation.total_score}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      Evaluación del {new Date(evaluation.created).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <History size={12} />
                      Por {evaluation.evaluator_name || 'Anónimo'}
                    </p>
                  </div>
                </div>
                
                <div className="text-gray-400">
                  {expandedId === evaluation.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>

              {expandedId === evaluation.id && (
                <div className="p-6 border-t dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-900/30">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Chart */}
                    <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border dark:border-zinc-700 shadow-sm">
                      <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4 text-center">Radar de Dimensiones</h4>
                      <EvaluationRadarChart evaluation={evaluation} />
                    </div>

                    {/* Details Table */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Desglose por Dimensión (Click para ver detalle)</h4>
                      <div className="space-y-2">
                        {EVALUATION_DIMENSIONS.map((dim) => {
                          const score = evaluation.dimension_scores[dim.id] || 0;
                          const isExpanded = expandedDimension === dim.id;

                          return (
                            <div key={dim.id} className="bg-white dark:bg-zinc-800 rounded border dark:border-zinc-700 overflow-hidden">
                              {/* Dimension Header */}
                              <div 
                                onClick={() => setExpandedDimension(isExpanded ? null : dim.id)}
                                className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-zinc-700/50'}`}
                              >
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  {dim.name}
                                </span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-gray-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${score >= 60 ? 'bg-blue-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                      style={{ width: `${score}%` }}
                                    />
                                  </div>
                                  <span className={`text-sm font-bold w-8 text-right ${score >= 60 ? 'text-blue-600' : score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {score}
                                  </span>
                                </div>
                              </div>

                              {/* Questions Details */}
                              {isExpanded && (
                                <div className="px-3 pb-3 pt-1 border-t dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/30">
                                  <div className="space-y-2 mt-2">
                                    {dim.questions.map((q) => {
                                      const answerVal = evaluation.answers[q.id];
                                      return (
                                        <div key={q.id} className="text-sm grid grid-cols-[1fr_auto] gap-4 py-1 border-b border-dashed border-gray-200 dark:border-zinc-700 last:border-0">
                                          <div className="text-gray-600 dark:text-gray-400">
                                            {q.text}
                                          </div>
                                          <div className="font-medium text-gray-900 dark:text-gray-200 whitespace-nowrap">
                                            {answerVal !== undefined ? (
                                              <span className={`px-2 py-0.5 rounded text-xs ${
                                                answerVal >= 60 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                                answerVal <= 40 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                                'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-300'
                                              }`}>
                                                {getAnswerText(answerVal, q.type)}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400 italic">Sin respuesta</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showWizard && (
        <EvaluationWizard 
          projectId={projectId} 
          onClose={() => setShowWizard(false)} 
          onSuccess={() => {
            setShowWizard(false);
            fetchEvaluations();
          }} 
        />
      )}

    </div>
  );
}
