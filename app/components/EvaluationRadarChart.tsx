
'use client';

import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { EVALUATION_DIMENSIONS } from '@/app/data/evaluationCriteria';
import { Evaluation } from '@/app/types';

interface Props {
  evaluation: Evaluation;
}

export default function EvaluationRadarChart({ evaluation }: Props) {
  const data = EVALUATION_DIMENSIONS.map(dim => ({
    subject: dim.name,
    score: evaluation.dimension_scores[dim.id] || 0,
    fullMark: 100
  }));

  return (
    <div className="w-full h-[300px] flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#6b7280', fontSize: 10 }} 
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Puntaje"
            dataKey="score"
            stroke="#2563eb"
            fill="#3b82f6"
            fillOpacity={0.5}
          />
          <Tooltip 
            formatter={(value: any) => [`${value}/100`, 'Puntaje']}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
