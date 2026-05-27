'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Calculator, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { ProjectLaborCostSummary } from '@/app/types';
import {
  calculateProjectLaborCostSummary,
  BASE_WORKING_DAYS_PER_MONTH,
  HOURS_PER_SHIFT,
} from '@/app/utils/compensation';
import {
  listCompensationPeriodsForPersonalIds,
  listProjectWorkLogs,
} from '@/app/services/compensationPeriods';
import { formatLocalDate, toLocalDateString } from '@/app/utils/date';

interface ProjectLaborCostsProps {
  projectId: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
};

export default function ProjectLaborCosts({ projectId }: ProjectLaborCostsProps) {
  const [summary, setSummary] = useState<ProjectLaborCostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const loadCosts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const logs = await listProjectWorkLogs(projectId);
      const personalIds = logs.map(log => log.personal);
      const compensationPeriods = await listCompensationPeriodsForPersonalIds(personalIds);

      setSummary(calculateProjectLaborCostSummary(projectId, logs, compensationPeriods));
    } catch (err) {
      console.error('Error loading project labor costs:', err);
      setError('No se pudo calcular el costo. Verifique que el historial salarial este configurado.');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadCosts();
  }, [loadCosts]);

  const lineCount = summary?.lines.length || 0;

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border dark:border-zinc-700 overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calculator className="text-emerald-600" size={22} />
            Costo de Personal
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Base: {BASE_WORKING_DAYS_PER_MONTH} dias/mes · {HOURS_PER_SHIFT} h por turno
          </p>
        </div>
        <button
          type="button"
          onClick={loadCosts}
          disabled={loading}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-60"
        >
          Recalcular
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">
          <Loader2 className="animate-spin inline-block mr-2" size={20} />
          Calculando costo...
        </div>
      ) : error ? (
        <div className="p-6 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      ) : summary ? (
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10 p-4">
              <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Costo confirmado</div>
              <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                {formatCurrency(summary.confirmedCost)}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-zinc-700 p-4">
              <div className="text-xs text-gray-500 font-medium">Horas imputadas</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {summary.totalHours}h
              </div>
            </div>
            <div className="rounded-lg border border-amber-100 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-900/10 p-4">
              <div className="text-xs text-amber-700 dark:text-amber-300 font-medium">Sin costo</div>
              <div className="text-2xl font-bold text-amber-800 dark:text-amber-200 mt-1">
                {summary.missingCostHours}h
              </div>
            </div>
          </div>

          {summary.missingCompensationCount > 0 && (
            <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg px-3 py-2">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span>
                Hay {summary.missingCompensationCount} registro{summary.missingCompensationCount === 1 ? '' : 's'} de horas sin periodo salarial vigente.
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between rounded-lg border border-gray-200 dark:border-zinc-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700"
          >
            <span>Detalle de calculo ({lineCount} registros)</span>
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>

          {expanded && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-zinc-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-zinc-900 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Personal</th>
                    <th className="px-3 py-2 text-right">Horas</th>
                    <th className="px-3 py-2 text-right">Sueldo</th>
                    <th className="px-3 py-2 text-right">$/h</th>
                    <th className="px-3 py-2 text-right">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                  {summary.lines.map(line => {
                    const personName = line.personal
                      ? `${line.personal.surname}, ${line.personal.name}`
                      : line.workLog.personal;
                    return (
                      <tr key={line.id} className={line.missingCompensation ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {line.date ? formatLocalDate(line.date) : toLocalDateString(line.workLog.date)}
                        </td>
                        <td className="px-3 py-2 min-w-44">
                          <div className="font-medium text-gray-900 dark:text-white">{personName}</div>
                          {line.compensationPeriod && (
                            <div className="text-xs text-gray-500">
                              {toLocalDateString(line.compensationPeriod.start_date)} - {line.compensationPeriod.end_date ? toLocalDateString(line.compensationPeriod.end_date) : 'Actual'} · {line.shiftCount} turno{line.shiftCount === 1 ? '' : 's'}
                            </div>
                          )}
                          {line.missingCompensation && (
                            <div className="text-xs text-amber-700 dark:text-amber-300">Sin periodo salarial</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{line.hours}</td>
                        <td className="px-3 py-2 text-right">
                          {line.monthlySalary !== undefined ? formatCurrency(line.monthlySalary) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {line.hourlyRate !== undefined ? formatCurrency(line.hourlyRate) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {line.missingCompensation ? '-' : formatCurrency(line.cost)}
                        </td>
                      </tr>
                    );
                  })}
                  {summary.lines.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                        No hay horas registradas para este proyecto.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
