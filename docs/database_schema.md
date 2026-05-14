# Documentación de la Base de Datos (PocketBase)

Este documento detalla la estructura de la base de datos del proyecto, el cual utiliza **PocketBase** como backend. Las colecciones (tablas) descritas a continuación reflejan los esquemas y relaciones definidas en los tipos del sistema (`app/types.ts`).

---

## 🏢 Entidades Principales

### `projects` (Proyectos)
Almacena la información principal de los proyectos de software gestionados en el sistema.

| Campo | Tipo | Descripción | Relación |
| --- | --- | --- | --- |
| `id` | `string` | Identificador único ||
| `code` | `string` | Código del proyecto ||
| `year` | `number` | Año del proyecto ||
| `system_name` | `string` | Nombre del sistema/proyecto ||
| `description` | `string` | Descripción del proyecto ||
| `requesting_area` | `string` | Área solicitante | Relación a `requesting_areas` |
| `program` | `string` | Programa al que pertenece (opcional) | Relación a `programs` |
| `status` | `string` | Estado actual del proyecto | Relación a `project_statuses` |
| `start_date` | `string` | Fecha de inicio (ISO Date) ||
| `estimated_end_date` | `string` | Fecha estimada de finalización (opcional) ||
| `personal` | `string` | Responsable o contacto principal (opcional) | Relación a `personal` |
| `observations` | `string` | Observaciones adicionales ||
| `drive_folder` | `string` | Enlace a la carpeta de Drive ||
| `server` | `string` | Información del servidor ||
| `active` | `boolean` | Indica si el proyecto está activo ||
| `project_type` | `string[]` | Tipos de proyecto | Múltiple a `project_types` |
| `frontend_tech` | `string[]` | Tecnologías de frontend | Múltiple a `tech_items` |
| `backend_tech` | `string[]` | Tecnologías de backend | Múltiple a `tech_items` |
| `database` | `string[]` | Tecnologías de base de datos | Múltiple a `tech_items` |
| `shift` | `string[]` | Turnos asignados | Múltiple a `shifts` |
| `estimated_duration`| `number` | Duración estimada en meses ||
| `security_level` | `string` | Nivel de seguridad (`low`, `medium`, `high`) ||
| `expected_benefit`| `string` | Beneficio esperado del proyecto ||
| `created` | `string` | Fecha de creación ||
| `updated` | `string` | Fecha de actualización ||

### `personal` (Personal)
Registro del personal, empleados o colaboradores del sistema.

| Campo | Tipo | Descripción | Relación |
| --- | --- | --- | --- |
| `id` | `string` | Identificador único ||
| `surname` | `string` | Apellido(s) ||
| `name` | `string` | Nombre(s) ||
| `dni` | `string` | DNI / Documento ||
| `file_number` | `string` | Legajo ||
| `email` | `string` | Correo electrónico ||
| `phone` | `string` | Número de teléfono ||
| `working_hours` | `number` | Cantidad de horas de trabajo ||
| `monthly_salary` | `number` | Sueldo mensual ||
| `shift` | `string[]` | Turnos asignados | Múltiple a `shifts` |
| `main_role` | `string` | Rol principal | Relación a `roles` |
| `secondary_role`| `string` | Rol secundario | Relación a `roles` |
| `join_date` | `string` | Fecha de ingreso ||
| `status` | `string` | Estado del empleado | Relación a `staff_statuses` |
| `observations` | `string` | Observaciones ||
| `cv` | `string` | Enlace o archivo de Curriculum Vitae (opcional)||
| `created` | `string` | Fecha de creación ||
| `updated` | `string` | Fecha de actualización ||

### `users` (Usuarios)
Usuarios que tienen acceso al sistema (autenticación).

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | `string` | Identificador único |
| `username` | `string` | Nombre de usuario |
| `email` | `string` | Correo electrónico |
| `name` | `string` | Nombre completo |
| `avatar` | `string` | URL o archivo de avatar (opcional) |
| `isAdmin` | `boolean` | Indicador de permisos de administrador |
| `active` | `boolean` | Estado de la cuenta de usuario |
| `created` | `string` | Fecha de creación |
| `updated` | `string` | Fecha de actualización |

---

## 🔄 Gestión y Relaciones de Proyectos

### `programs` (Programas)
Agrupaciones o programas macro a los que pueden pertenecer los proyectos.

| Campo | Tipo | Descripción | Relación |
| --- | --- | --- | --- |
| `id` | `string` | Identificador único ||
| `name` | `string` | Nombre del programa ||
| `description` | `string` | Descripción detallada ||
| `start_date` | `string` | Fecha de inicio (opcional) ||
| `end_date` | `string` | Fecha de fin (opcional) ||
| `active` | `boolean` | Estado del programa ||
| `manager` | `string` | Gerente o responsable (opcional) | Relación a `personal` |

### `project_assignments` (Asignaciones de Proyecto)
Relaciona al personal con los proyectos indicando su periodo de participación y roles.

| Campo | Tipo | Descripción | Relación |
| --- | --- | --- | --- |
| `id` | `string` | Identificador único ||
| `project` | `string` | Proyecto asignado | Relación a `projects` |
| `personal` | `string` | Personal asignado | Relación a `personal` |
| `start_date` | `string` | Fecha de asignación (ISO Date) ||
| `end_date` | `string` | Fecha de desvinculación (ISO Date, null si sigue activo) ||
| `roles` | `string[]` | Roles ejercidos en este proyecto | Múltiple a `roles` |
| `active` | `boolean` | Indica si la asignación está vigente ||

### `project_timeline_items` (Línea de tiempo de fases)
Gestiona las fases cronológicas de un proyecto específico.

| Campo | Tipo | Descripción | Relación |
| --- | --- | --- | --- |
| `id` | `string` | Identificador único ||
| `project` | `string` | Proyecto asociado | Relación a `projects` |
| `phase` | `string` | Fase del proyecto | Relación a `project_phases` |
| `planned_start_date`| `string`| Fecha de inicio planificada ||
| `real_start_date` | `string`| Fecha de inicio real ||
| `planned_end_date`| `string`| Fecha de fin planificada ||
| `real_end_date` | `string`| Fecha de fin real ||
| `status` | `string` | Estado de la fase | Relación a `phase_statuses` |
| `responsible` | `string` | Responsable de la fase | Relación a `personal` |
| `observations` | `string` | Notas u observaciones adicionales ||

### `project_notes` (Notas de Proyecto)
Comentarios, bitácoras o notas dejadas por los usuarios en un proyecto.

| Campo | Tipo | Descripción | Relación |
| --- | --- | --- | --- |
| `id` | `string` | Identificador único ||
| `project` | `string` | Proyecto asociado | Relación a `projects` |
| `user` | `string` | Usuario que creó la nota | Relación a `users` |
| `content` | `string` | Contenido de la nota (HTML/Rich Text) ||

---

## 📊 Evaluaciones y Registros

### `evaluations` (Evaluaciones)
Métricas y puntajes asignados a proyectos.

| Campo | Tipo | Descripción | Relación |
| --- | --- | --- | --- |
| `id` | `string` | Identificador único ||
| `project` | `string` | Proyecto evaluado | Relación a `projects` |
| `user` | `string` | Usuario evaluador | Relación a `users` |
| `dimension_scores`| `json` | Puntajes por dimensión (ej. `{ 'efficiency': 85 }`) ||
| `answers` | `json` | Respuestas crudas del formulario ||
| `total_score` | `number` | Puntaje promedio total ||

### `work_logs` (Registros de Trabajo/Horas)
Registro de horas trabajadas por el personal, opcionalmente ligadas a proyectos.

| Campo | Tipo | Descripción | Relación |
| --- | --- | --- | --- |
| `id` | `string` | Identificador único ||
| `personal` | `string` | Personal que registra | Relación a `personal` |
| `project` | `string` | Proyecto (opcional) | Relación a `projects` |
| `date` | `string` | Fecha de trabajo (YYYY-MM-DD) ||
| `hours` | `number` | Cantidad de horas registradas ||
| `description` | `string` | Descripción del trabajo realizado (opcional)||

---

## 🧩 Catálogos y Entidades Auxiliares (Diccionarios)

Estas colecciones funcionan generalmente como listas de selección (diccionarios) y comparten una estructura simple: `id`, `name`, `active`.

| Colección | Interfaz Frontend | Descripción |
| --- | --- | --- |
| **`requesting_areas`** | `RequestingArea` | Áreas que solicitan los proyectos (ej. "Recursos Humanos", "Finanzas"). |
| **`tech_items`** | `TechItem` | Tecnologías utilizadas (ej. "React", "Node.js", "PostgreSQL"). Aplica a frontend, backend y BD. |
| **`project_statuses`** | `ProjectStatusItem` | Estados posibles de un proyecto (ej. "En progreso", "Finalizado"). |
| **`project_types`** | `ProjectTypeItem` | Clasificación o tipos de proyectos. |
| **`project_phases`** | `PhaseItem` | Fases estándar de un proyecto (ej. "Análisis", "Desarrollo", "Testing"). |
| **`phase_statuses`** | `PhaseStatusItem` | Estados específicos para las fases (ej. "Completada", "Atrasada"). |
| **`shifts`** | `ShiftItem` | Turnos de trabajo (ej. "Mañana", "Tarde"). |
| **`roles`** | `RoleItem` | Roles que puede tener el personal (ej. "Desarrollador Backend", "Project Manager"). |
| **`staff_statuses`** | `StaffStatusItem` | Estados del personal (ej. "Activo", "De licencia"). |

---
*Documentación generada automáticamente a partir de las definiciones de tipos de PocketBase (`app/types.ts`).*
