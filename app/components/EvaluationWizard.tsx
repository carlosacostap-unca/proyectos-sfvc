
'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { EVALUATION_DIMENSIONS, EvaluationQuestion } from '@/app/data/evaluationCriteria';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/app/contexts/AuthContext';
import { Evaluation } from '@/app/types';

interface Props {
  projectId: string;
  evaluationToEdit?: Evaluation | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EvaluationWizard({ projectId, evaluationToEdit, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0); // 0 to EVALUATION_DIMENSIONS.length - 1
  const [answers, setAnswers] = useState<Record<string, number>>(evaluationToEdit?.answers || {});
  const [evaluatorName, setEvaluatorName] = useState(evaluationToEdit?.evaluator_name || user?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (evaluationToEdit) {
      setAnswers(evaluationToEdit.answers);
      setEvaluatorName(evaluationToEdit.evaluator_name || '');
    } else if (user?.email) {
      setEvaluatorName(user.email);
    }
  }, [evaluationToEdit, user]);

  const currentDimension = EVALUATION_DIMENSIONS[currentStep];
  const isLastStep = currentStep === EVALUATION_DIMENSIONS.length - 1;

  // Check if all questions in current dimension are answered
  const canProceed = currentDimension.questions.every(q => answers[q.id] !== undefined);

  const handleAnswer = (questionId: string, value: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const calculateScores = () => {
    const dimensionScores: Record<string, number> = {};
    let totalSum = 0;

    EVALUATION_DIMENSIONS.forEach(dim => {
      const dimQuestions = dim.questions;
      const dimSum = dimQuestions.reduce((sum, q) => sum + (answers[q.id] || 0), 0);
      const dimAvg = dimSum / dimQuestions.length;
      dimensionScores[dim.id] = Math.round(dimAvg * 10) / 10; // Round to 1 decimal
      totalSum += dimAvg;
    });

    const totalScore = Math.round((totalSum / EVALUATION_DIMENSIONS.length) * 10) / 10;

    return { dimensionScores, totalScore };
  };

  const handleSubmit = async () => {
    if (!evaluatorName.trim()) {
      setError('Por favor ingresa tu nombre antes de finalizar.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const { dimensionScores, totalScore } = calculateScores();

      const data = {
        project: projectId,
        user_id: user?.id,
        evaluator_name: evaluatorName,
        dimension_scores: dimensionScores,
        answers: answers,
        total_score: totalScore
      };

      if (evaluationToEdit) {
        await pb.collection('evaluations').update(evaluationToEdit.id, data);
      } else {
        await pb.collection('evaluations').create(data);
      }
      
      onSuccess();
    } catch (err: any) {
      console.error('Error submitting evaluation:', err);
      setError(err.message || 'Error al guardar la evaluación. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {evaluationToEdit ? 'Editar Evaluación' : 'Nueva Evaluación de Proyecto'}
            </h2>
            <p className="text-sm text-gray-500">
              Paso {currentStep + 1} de {EVALUATION_DIMENSIONS.length}: {currentDimension.name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-100 dark:bg-zinc-800 h-2">
          <div 
            className="bg-blue-600 h-2 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / EVALUATION_DIMENSIONS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">{currentDimension.name}</h3>
            <p className="text-sm text-blue-600 dark:text-blue-300">{currentDimension.description}</p>
          </div>

          <div className="space-y-6">
            {currentDimension.questions.map((q) => (
              <div key={q.id} className="space-y-3">
                <p className="font-medium text-gray-800 dark:text-gray-200">{q.text}</p>
                
                {q.type === 'boolean' ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAnswer(q.id, 100)}
                      className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors
                        ${answers[q.id] === 100 
                          ? 'bg-green-100 border-green-500 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                          : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-gray-400'}`}
                    >
                      Sí (+Positivo)
                    </button>
                    <button
                      onClick={() => handleAnswer(q.id, 0)}
                      className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors
                        ${answers[q.id] === 0 
                          ? 'bg-red-100 border-red-500 text-red-800 dark:bg-red-900/30 dark:text-red-300' 
                          : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-gray-400'}`}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Totalmente en desacuerdo</span>
                      <span>Totalmente de acuerdo</span>
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((val) => {
                        const score = val * 20; // 20, 40, 60, 80, 100
                        const isSelected = answers[q.id] === score;
                        return (
                          <button
                            key={val}
                            onClick={() => handleAnswer(q.id, score)}
                            className={`flex-1 py-3 rounded-lg border font-medium transition-all
                              ${isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
                                : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {isLastStep && (
            <div className="pt-6 border-t dark:border-zinc-800">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nombre del Evaluador
              </label>
              <input
                type="text"
                value={evaluatorName}
                onChange={(e) => setEvaluatorName(e.target.value)}
                placeholder="Ingresa tu nombre..."
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 flex justify-between rounded-b-2xl">
          <button
            onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={20} />
            Anterior
          </button>

          {isLastStep ? (
            <button
              onClick={handleSubmit}
              disabled={!canProceed || !evaluatorName || isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isSubmitting ? 'Guardando...' : 'Finalizar Evaluación'}
              <Check size={20} />
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep(prev => Math.min(EVALUATION_DIMENSIONS.length - 1, prev + 1))}
              disabled={!canProceed}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              Siguiente
              <ChevronRight size={20} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
