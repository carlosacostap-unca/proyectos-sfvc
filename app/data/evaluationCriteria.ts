
export interface EvaluationQuestion {
  id: string;
  text: string;
  type: 'boolean' | 'likert'; // boolean = 0 or 100, likert = 1-5 scale mapped to 0-100
}

export interface EvaluationDimension {
  id: string;
  name: string;
  description: string;
  questions: EvaluationQuestion[];
}

export const EVALUATION_DIMENSIONS: EvaluationDimension[] = [
  {
    id: 'efficiency',
    name: 'Eficiencia Administrativa',
    description: 'Capacidad del proyecto para optimizar recursos y tiempos en la gestión municipal.',
    questions: [
      { id: 'eff_1', text: '¿El proyecto reduce significativamente el tiempo de trámite para el ciudadano o empleado?', type: 'likert' },
      { id: 'eff_2', text: '¿Se eliminan pasos redundantes o burocracia innecesaria mediante este sistema?', type: 'boolean' },
      { id: 'eff_3', text: '¿El proyecto permite reducir el uso de papel o insumos físicos?', type: 'likert' },
      { id: 'eff_4', text: '¿Automatiza tareas que antes se realizaban manualmente?', type: 'boolean' },
      { id: 'eff_5', text: '¿Permite reasignar recursos humanos a tareas de mayor valor agregado?', type: 'likert' }
    ]
  },
  {
    id: 'citizen_impact',
    name: 'Impacto al Ciudadano',
    description: 'Beneficio directo percibido por los vecinos de la ciudad.',
    questions: [
      { id: 'cit_1', text: '¿Mejora la accesibilidad de los servicios municipales para el ciudadano?', type: 'likert' },
      { id: 'cit_2', text: '¿El sistema es intuitivo y fácil de usar para personas con bajas competencias digitales?', type: 'likert' },
      { id: 'cit_3', text: '¿Reduce la necesidad de traslado físico a oficinas municipales?', type: 'boolean' },
      { id: 'cit_4', text: '¿Provee información clara y en tiempo real al ciudadano?', type: 'likert' },
      { id: 'cit_5', text: '¿Existe un mecanismo claro de feedback o reclamo integrado?', type: 'boolean' }
    ]
  },
  {
    id: 'transparency',
    name: 'Transparencia y Datos',
    description: 'Apertura de información y uso inteligente de datos.',
    questions: [
      { id: 'tra_1', text: '¿Los datos generados son accesibles en formatos abiertos (Open Data)?', type: 'boolean' },
      { id: 'tra_2', text: '¿El sistema permite auditoría y trazabilidad completa de las acciones?', type: 'boolean' },
      { id: 'tra_3', text: '¿Se publican estadísticas o indicadores de gestión derivados del sistema?', type: 'likert' },
      { id: 'tra_4', text: '¿Facilita la rendición de cuentas hacia la ciudadanía?', type: 'likert' },
      { id: 'tra_5', text: '¿Cumple con las normativas vigentes de protección de datos personales?', type: 'boolean' }
    ]
  },
  {
    id: 'tech_sustainability',
    name: 'Sostenibilidad Tecnológica',
    description: 'Calidad técnica, mantenibilidad y escalabilidad del software.',
    questions: [
      { id: 'sus_1', text: '¿Utiliza tecnologías modernas con soporte activo (LTS)?', type: 'boolean' },
      { id: 'sus_2', text: '¿El código está documentado y sigue estándares de calidad?', type: 'likert' },
      { id: 'sus_3', text: '¿Es escalable para soportar un aumento en la carga de trabajo?', type: 'likert' },
      { id: 'sus_4', text: '¿Depende mínimamente de licencias propietarias costosas?', type: 'likert' },
      { id: 'sus_5', text: '¿Existe capacidad técnica interna para mantenerlo a largo plazo?', type: 'likert' },
      { id: 'sus_6', text: '¿El sistema está desarrollado por el área de modernización?', type: 'boolean' }
    ]
  },
  {
    id: 'interoperability',
    name: 'Interoperabilidad',
    description: 'Capacidad de conectarse y compartir datos con otros sistemas.',
    questions: [
      { id: 'int_1', text: '¿Expone APIs documentadas para integración con otros sistemas?', type: 'boolean' },
      { id: 'int_2', text: '¿Utiliza estándares abiertos de intercambio de datos (JSON, XML, GeoJSON)?', type: 'boolean' },
      { id: 'int_3', text: '¿Se integra con el sistema de autenticación central (SSO/CiDi/etc.)?', type: 'boolean' },
      { id: 'int_4', text: '¿Evita la duplicación de bases de datos de personas o contribuyentes?', type: 'likert' },
      { id: 'int_5', text: '¿Puede ser consumido por otras áreas del municipio sin desarrollos complejos?', type: 'likert' }
    ]
  },
  {
    id: 'security',
    name: 'Seguridad',
    description: 'Protección de la información e infraestructura.',
    questions: [
      { id: 'sec_1', text: '¿Implementa cifrado en tránsito (HTTPS) y en reposo?', type: 'boolean' },
      { id: 'sec_2', text: '¿Realiza copias de seguridad automáticas y periódicas?', type: 'boolean' },
      { id: 'sec_3', text: '¿Tiene roles y permisos de usuario claramente definidos?', type: 'boolean' },
      { id: 'sec_4', text: '¿Ha pasado pruebas de vulnerabilidad básicas?', type: 'likert' },
      { id: 'sec_5', text: '¿Existe un plan de contingencia ante fallos críticos?', type: 'likert' }
    ]
  }
];
