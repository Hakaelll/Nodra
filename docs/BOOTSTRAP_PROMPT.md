# NODRA — MASTER PROJECT BOOTSTRAP PROMPT

Actúa como:

* Staff Software Engineer
* Software Architect
* Product Engineer
* Backend Engineer
* Frontend Engineer
* Flutter Engineer
* Database Architect
* DevOps Engineer
* Security Engineer
* UX/UI Designer
* Technical Writer

Tu objetivo es **iniciar correctamente desde cero un proyecto real llamado provisionalmente Nodra**, crear su arquitectura base, implementar una primera vertical funcional y dejar el repositorio preparado para que futuros agentes puedan continuar trabajando sin depender de esta conversación.

No quiero un prototipo desechable.

No quiero solamente interfaces.

No quiero mocks que aparenten funcionalidad.

Quiero comenzar una base de producto seria, mantenible y escalable.

---

# 0. REGLA FUNDAMENTAL

Antes de modificar archivos:

1. inspecciona completamente el repositorio;
2. identifica instrucciones existentes;
3. localiza y lee completamente el `design.md` proporcionado;
4. revisa versiones instaladas y toolchains disponibles;
5. documenta cualquier limitación real del entorno;
6. no asumas que algo está instalado;
7. no elimines archivos existentes sin comprender su propósito.

Si el repositorio está vacío, inicialízalo siguiendo esta especificación.

---

# 1. PRODUCTO

El nombre provisional del producto es:

# Nodra

Nodra es una plataforma neutral de coordinación de personal y equipos.

Está dirigida principalmente a organizaciones que trabajan con:

* personal eventual;
* personal discontinuo;
* equipos variables;
* trabajadores por servicios;
* trabajadores que pueden pertenecer a varias empresas;
* necesidades puntuales de personal.

Ejemplos de sectores donde podría utilizarse:

* eventos;
* catering;
* hostelería;
* hoteles;
* montaje;
* limpieza;
* promociones;
* festivales;
* producción audiovisual;
* actividades;
* logística;
* mantenimiento;
* servicios auxiliares;
* otros sectores similares.

Estos son únicamente ejemplos.

---

# 2. NODRA NO ES UN ERP

Esto es extremadamente importante.

Nodra NO debe convertirse durante el MVP en:

* ERP;
* sistema de nóminas;
* software contable;
* software fiscal;
* marketplace público;
* bolsa de empleo;
* ETT;
* software de contratación laboral;
* plataforma de freelance;
* sistema de pagos;
* CRM.

Su objetivo inicial es mucho más concreto:

> facilitar la coordinación entre organizaciones y personas mediante servicios, disponibilidad, avisos, grupos, selección y confirmaciones.

---

# 3. PROBLEMA A RESOLVER

Actualmente muchas organizaciones gestionan estas situaciones mediante:

* WhatsApp;
* grupos;
* mensajes individuales;
* llamadas;
* Excel;
* notas;
* calendarios separados.

Por ejemplo:

```text
Necesitamos 4 personas el sábado.

¿Puedes?

No.

Pregunto a otra persona.

Sí.

Faltan tres.

...
```

El proceso genera:

* mensajes dispersos;
* trabajo administrativo;
* respuestas tardías;
* cancelaciones;
* información perdida;
* poca trazabilidad;
* dificultad para conocer quién está disponible;
* dificultad para formar equipos;
* dificultad para recordar quién trabajó;
* dificultad para informar cambios.

Nodra debe reemplazar gran parte de ese proceso.

---

# 4. FLUJO FUNDAMENTAL

La experiencia esencial debe reducirse a:

```text
CREAR
↓
AVISAR
↓
RECIBIR INTERESADOS
↓
SELECCIONAR
↓
CONFIRMAR
↓
REALIZAR SERVICIO
↓
GUARDAR HISTORIAL
```

La empresa no debería necesitar mandar veinte mensajes manuales.

---

# 5. NO ES UN MARKETPLACE

Cada organización dispone de su propio equipo.

Los trabajadores acceden mediante:

* invitación;
* enlace;
* código;
* QR posteriormente.

Un trabajador puede pertenecer simultáneamente a varias organizaciones.

Ejemplo:

```text
Yago

├── Empresa A
├── Empresa B
└── Empresa C
```

La misma cuenta debe permitir gestionar todas ellas.

---

# 6. PLATAFORMA NEUTRAL

No construyas Nodra específicamente para:

```text
camareros
monitores
hinchables
bodas
festivales
```

El dominio interno debe permanecer neutral.

Ejemplos:

NO:

```text
Waiter
Monitor
InflatableEvent
WeddingWorker
```

SÍ:

```text
User
Organization
Membership
JobRole
Group
Service
ServicePosition
Assignment
```

Las organizaciones crearán sus propios tipos.

---

# 7. TERMINOLOGÍA

Una organización podría llamar a `Service`:

```text
Servicio
```

otra:

```text
Evento
```

otra:

```text
Turno
```

otra:

```text
Trabajo
```

Internamente continúa siendo:

```text
Service
```

Diseña la arquitectura para permitir terminología configurable.

No hace falta completar todo el sistema de traducción de términos en esta primera iteración si retrasa demasiado el MVP.

---

# 8. MODELO CENTRAL

Las piezas fundamentales de Nodra son:

```text
Organization
User
Membership
PermissionRole
JobRole
Group
Service
ServicePosition
ServiceInterest
ServiceAssignment
Confirmation
Notice
Notification
```

Construye el sistema alrededor de ellas.

---

# 9. OBJETIVO DE ESTA PRIMERA ITERACIÓN

Esta primera iteración debe crear:

* arquitectura;
* monorepo;
* backend;
* base de datos;
* autenticación;
* multi-tenancy;
* organizaciones;
* membresías;
* invitaciones;
* roles laborales;
* grupos;
* servicios;
* posiciones;
* interesados;
* asignaciones;
* confirmaciones;
* avisos;
* infraestructura de notificaciones;
* web;
* aplicación Flutter;
* entorno Docker;
* tests;
* documentación;
* NEXT_TODOS.

Y al finalizar debe funcionar un flujo real completo.

---

# 10. VERTICAL FUNCIONAL OBLIGATORIA

Como mínimo debe funcionar:

```text
Administrador se registra
↓
crea organización
↓
genera invitación
↓
trabajador se registra
↓
acepta invitación
↓
aparece como miembro
↓
administrador crea JobRole
↓
crea Service
↓
crea ServicePosition
↓
publica
↓
trabajador consulta servicio
↓
pulsa Me interesa
↓
empresa consulta interesados
↓
selecciona trabajador
↓
se crea Assignment
↓
trabajador recibe confirmación pendiente
↓
trabajador confirma
↓
administrador ve CONFIRMED
```

Debe persistir realmente en PostgreSQL.

Nada de datos hardcodeados para fingir funcionalidad.

---

# 11. RESTRICCIÓN CRÍTICA — COSTE CERO

Esta regla tiene prioridad sobre cualquier otra decisión técnica.

## Nodra debe poder desarrollarse completamente sin contratar ningún servicio de pago.

Durante esta fase:

NO utilices ninguna tecnología, SaaS, API o infraestructura que requiera:

* tarjeta;
* suscripción;
* créditos;
* prueba gratuita;
* plan de pago;
* cuenta empresarial;
* API de pago.

El desarrollador debe poder clonar el repositorio y utilizar Nodra sin pagar.

---

# 12. PRINCIPIO OPEN SOURCE / SELF-HOSTED

Cuando exista una alternativa razonable entre:

```text
SaaS externo
```

y:

```text
self-hosted / open source
```

elige:

```text
self-hosted / open source
```

durante esta fase.

No dependas de free tiers comerciales como fundamento arquitectónico.

---

# 13. STACK PRINCIPAL

Utiliza este stack salvo incompatibilidad técnica real.

---

# 14. MOBILE

Flutter.

Dart.

Utiliza preferentemente:

```text
Riverpod
GoRouter
Dio
Freezed
json_serializable
flutter_secure_storage
```

Puedes añadir otras dependencias open source justificadas.

Debe poder ejecutarse para:

```text
Android
iOS
```

No es necesario publicar todavía.

---

# 15. WEB

Utiliza:

```text
Next.js
React
TypeScript
Tailwind CSS
```

Usa App Router.

La web estará principalmente orientada a:

* propietarios;
* administradores;
* coordinadores.

No depender de Vercel.

Debe poder compilarse y desplegarse como aplicación Node estándar.

---

# 16. BACKEND

Utiliza:

```text
NestJS
Fastify
TypeScript
```

Arquitectura:

# Modular Monolith

NO microservicios en esta fase.

Diseña módulos con límites claros para que puedan extraerse posteriormente si realmente fuese necesario.

---

# 17. API

REST.

Documentación automática mediante:

```text
OpenAPI
Swagger
```

La API debe ser la fuente contractual entre:

```text
Web
Mobile
Backend
```

Diseña los contratos pensando en poder generar:

```text
TypeScript client
Dart client
```

posteriormente.

---

# 18. BASE DE DATOS

Utiliza:

```text
PostgreSQL
```

con:

```text
Prisma
```

PostgreSQL debe ejecutarse localmente mediante Docker.

NO depender de:

* Supabase;
* Neon;
* PlanetScale;
* AWS RDS;
* Cloud SQL;
* Azure Database.

---

# 19. CACHE Y COLAS

Utiliza:

```text
Valkey
```

como opción preferida.

Utiliza:

```text
BullMQ
```

para colas si la compatibilidad con la versión seleccionada de Valkey es correcta.

Verifica compatibilidad antes.

Si existe incompatibilidad:

* documenta el problema;
* utiliza una alternativa gratuita/open source;
* no contrates ningún servicio externo.

---

# 20. WORKER

Debe existir una aplicación worker separada.

Ejemplo:

```text
apps/api
apps/worker
```

Responsabilidades del worker:

* notificaciones;
* emails;
* recordatorios;
* trabajos BullMQ;
* tareas programadas;
* mantenimiento;
* procesamiento futuro.

La API HTTP no debe quedarse esperando tareas largas.

---

# 21. EMAIL LOCAL

Utiliza:

```text
Mailpit
```

durante desarrollo.

Los emails deben poder verse desde navegador local.

Arquitectura:

```text
Business Logic
↓
MailProvider
↓
MailpitProvider
```

No acoples dominio a Mailpit.

---

# 22. MAIL PROVIDER

Crea una interfaz:

```text
MailProvider
```

Permite posteriormente:

```text
SMTP
SES
Resend
Postmark
otro
```

Pero actualmente el provider por defecto debe ser gratuito/local.

NO utilizar servicios de email externos como requisito.

---

# 23. STORAGE

Utiliza:

```text
MinIO
```

en desarrollo cuando sea necesario almacenar archivos.

Crea:

```text
ObjectStorageProvider
```

La arquitectura debe ser compatible con S3.

No acoples el dominio directamente a AWS S3.

---

# 24. PUSH NOTIFICATIONS

Crear abstracción:

```text
PushNotificationProvider
```

Implementación por defecto:

```text
ConsolePushProvider
```

Debe registrar:

```text
recipient
title
body
metadata
```

y permitir probar todo el flujo sin servicios externos.

---

# 25. FIREBASE

Firebase Cloud Messaging puede diseñarse como integración opcional futura.

Por ejemplo:

```text
FcmPushProvider
```

pero debe estar desactivada por defecto.

Ejemplo:

```text
FCM_ENABLED=false
```

Nodra debe arrancar y funcionar sin Firebase.

---

# 26. IOS / APNS

Prepara arquitectura para integración futura con:

```text
APNs
```

pero:

* no exigir Apple Developer Program;
* no exigir credenciales Apple;
* no exigir publicación;
* no exigir servicio externo.

Documentar futura integración.

---

# 27. ANDROID

La app debe poder probarse mediante:

```text
flutter run
```

o:

```text
APK local
```

No se necesita actualmente Google Play Developer.

---

# 28. AUTENTICACIÓN

Autenticación propia.

Utilizar:

```text
NestJS
PostgreSQL
Argon2id
JWT
Refresh Tokens
```

Implementar:

* registro;
* login;
* logout;
* refresh;
* cambio contraseña;
* recuperación preparada;
* verificación email preparada.

NO depender de:

```text
Auth0
Clerk
Firebase Auth
Supabase Auth
Okta
```

---

# 29. REFRESH TOKENS

No guardar refresh tokens en texto plano.

Implementar una estrategia segura:

* hashing;
* rotación;
* revocación;
* expiración;
* detección razonable de reutilización si procede.

Documentar la estrategia.

---

# 30. MONOREPO

Utiliza una estructura similar a:

```text
/
├── apps/
│   ├── api/
│   ├── worker/
│   ├── web/
│   └── mobile/
│
├── packages/
│   ├── contracts/
│   ├── config/
│   ├── shared/
│   └── eslint-config/
│
├── infrastructure/
│   ├── docker/
│   └── scripts/
│
├── docs/
│
├── .github/
│
├── docker-compose.yml
├── .env.example
├── README.md
├── AGENTS.md
├── PROJECT_STATE.md
└── NEXT_TODOS.md
```

Adapta si existe una razón técnica.

Documenta cualquier cambio.

---

# 31. PACKAGE MANAGER

Para TypeScript utiliza preferentemente:

```text
pnpm
```

y workspaces.

No intentes integrar Flutter artificialmente dentro del package manager JS.

Flutter mantiene su propio:

```text
pubspec.yaml
```

---

# 32. MULTI-TENANCY

Este requisito es crítico.

Un usuario puede pertenecer a varias organizaciones.

NO:

```text
User.organizationId
```

SÍ:

```text
User
↓
Membership
↓
Organization
```

---

# 33. ORGANIZATION

Crear entidad similar a:

```text
Organization

id
slug
name
displayName
logoUrl
createdAt
updatedAt
```

También:

```text
OrganizationSettings
```

---

# 34. MEMBERSHIP

Debe unir:

```text
User
+
Organization
```

Campos aproximados:

```text
id
userId
organizationId
permissionRole
status
joinedAt
createdAt
updatedAt
```

Estados:

```text
INVITED
ACTIVE
SUSPENDED
LEFT
```

---

# 35. PERMISSION ROLES

Distingue:

```text
PermissionRole
```

de:

```text
JobRole
```

PermissionRole inicial:

```text
OWNER
ADMIN
COORDINATOR
MEMBER
```

---

# 36. JOB ROLE

Son roles laborales creados por una empresa.

Ejemplo:

```text
Monitor
Montador
Conductor
Coordinador
```

pero ninguno debe estar hardcodeado.

Entidad:

```text
JobRole
```

con:

```text
id
organizationId
name
description
active
createdAt
updatedAt
```

---

# 37. INVITATIONS

Implementa:

```text
Invitation
```

Debe permitir:

* enlace;
* código;
* QR posteriormente.

Campos aproximados:

```text
id
organizationId
tokenHash
createdBy
expiresAt
maxUses
uses
status
createdAt
```

Nunca guardar el token sensible en texto plano cuando pueda evitarse.

---

# 38. FLUJO INVITACIÓN

```text
ADMIN
↓
genera invitación
↓
usuario abre
↓
login/registro
↓
acepta
↓
Membership ACTIVE
```

Evitar membresías duplicadas.

Utiliza constraints.

---

# 39. GROUPS

Entidad:

```text
Group
```

Tipos:

```text
PERMANENT
SERVICE
CUSTOM
```

Ejemplos:

```text
PERMANENT
Monitores

CUSTOM
Personal con carnet

SERVICE
Evento Gijón
```

---

# 40. GROUP MEMBERS

Crear:

```text
GroupMember
```

con constraints adecuadas para evitar duplicados.

---

# 41. SERVICES

Entidad:

```text
Service
```

Campos base:

```text
id
organizationId
title
description
locationText
startsAt
endsAt
status
createdBy
createdAt
updatedAt
```

Estados aproximados:

```text
DRAFT
OPEN
SELECTION
CONFIRMATION
READY
IN_PROGRESS
COMPLETED
CANCELLED
```

Puedes mejorar nombres si documentas la decisión.

---

# 42. SERVICE POSITIONS

Un servicio puede requerir múltiples perfiles.

NO utilizar solamente:

```text
peopleNeeded
```

Crear:

```text
ServicePosition
```

Campos aproximados:

```text
id
serviceId
jobRoleId
quantity
startsAtOverride
endsAtOverride
compensation
description
createdAt
updatedAt
```

---

# 43. COMPENSATION

Puede existir un campo de compensación informativo.

NO construir:

* nóminas;
* pagos;
* cálculo fiscal.

Por ahora es únicamente información del servicio.

---

# 44. SERVICE INTEREST

Crear:

```text
ServiceInterest
```

Estados:

```text
INTERESTED
WITHDRAWN
```

Debe existir constraint que impida múltiples intereses activos duplicados para misma combinación.

No depender del frontend.

---

# 45. SERVICE ASSIGNMENT

Cuando empresa selecciona trabajador:

```text
ServiceAssignment
```

Campos aproximados:

```text
id
servicePositionId
userId
status
selectedBy
selectedAt
createdAt
updatedAt
```

Estados:

```text
SELECTED
AWAITING_CONFIRMATION
CONFIRMED
DECLINED
CANCELLED
COMPLETED
```

---

# 46. CONFIRMATIONS

Debe poder conocerse:

```text
quién
qué assignment
cuándo se solicitó
cuándo respondió
respuesta
```

No sobrescribas información histórica importante.

Considera historial/eventos.

---

# 47. LISTA DE RESERVA

Diseña el modelo de forma que trabajadores interesados no seleccionados puedan seguir estando disponibles como reserva.

No hace falta automatizar completamente las sustituciones todavía.

Debe ser posible implementarlo sin rehacer modelo.

---

# 48. CANCELACIÓN

Cuando un trabajador asignado cancela:

* Assignment debe reflejarlo;
* no eliminar registro;
* mantener histórico;
* servicio puede quedar incompleto;
* sistema debe poder generar evento/notificación.

---

# 49. CONFLICTOS

Implementa detección básica de conflictos horarios.

Ejemplo:

```text
Assignment confirmado:
17:00 → 22:00

Nuevo Service:
18:00 → 23:00
```

Backend debe detectar solapamiento.

Inicialmente puede ser warning.

No tiene por qué bloquear.

---

# 50. DISPONIBILIDAD

Diseña futura entidad:

```text
Availability
```

para:

* periodos disponibles;
* periodos no disponibles;
* recurrencia futura.

No necesitas completar calendario avanzado todavía.

Documentarlo.

---

# 51. NOTICES

Un Notice es comunicación.

NO es Service.

Entidad:

```text
Notice
```

Campos:

```text
id
organizationId
title
body
priority
createdBy
publishedAt
requiresAcknowledgement
createdAt
updatedAt
```

---

# 52. NOTICE TARGETING

Debe diseñarse para dirigir avisos a:

```text
ORGANIZATION
GROUP
ROLE
SERVICE
USERS
```

No es necesario completar todos los targets si retrasa la vertical inicial.

Pero el modelo debe contemplarlo.

---

# 53. ACKNOWLEDGEMENTS

Preparar:

```text
NoticeAcknowledgement
```

para:

```text
He leído este aviso
```

---

# 54. NOTIFICATIONS

Distingue:

```text
Notice
```

de:

```text
Notification
```

Notice = contenido de negocio.

Notification = entrega técnica.

Canales futuros:

```text
IN_APP
PUSH
EMAIL
```

---

# 55. DEVICE TOKENS

Preparar:

```text
DeviceToken
```

Campos aproximados:

```text
id
userId
platform
token
deviceIdentifier
lastSeenAt
createdAt
updatedAt
```

Plataformas:

```text
ANDROID
IOS
WEB
```

Un usuario puede tener múltiples dispositivos.

---

# 56. EVENTOS DE DOMINIO

Evita acoplar directamente acciones importantes al envío técnico.

Ejemplo:

```text
ServicePublished
↓
NotificationJob
↓
Worker
↓
PushProvider
```

No:

```text
controller
↓
FCM directamente
```

---

# 57. IDEMPOTENCIA

Los workers deben poder procesar retries sin duplicar:

* emails;
* notifications;
* confirmations;
* jobs.

Diseña claves de idempotencia cuando corresponda.

---

# 58. TRANSACTIONS

Utiliza transacciones para operaciones críticas.

Ejemplo:

```text
crear Assignment
+
cambiar estado
+
crear DomainEvent
```

Debe ser atómico cuando corresponda.

---

# 59. CUSTOM FIELDS

Diseña:

```text
CustomFieldDefinition
CustomFieldValue
```

Tipos previstos:

```text
TEXT
NUMBER
BOOLEAN
DATE
SELECT
MULTISELECT
LOCATION
USER
FILE
```

No construyas todavía un constructor de formularios complejo.

Deja modelo y documentación preparada si es razonable.

---

# 60. FEATURE FLAGS

Implementa sistema interno de feature flags por organización.

Ejemplo:

```text
groups
availability
customFields
documents
chat
timesheets
expenses
advancedAnalytics
```

No utilizar:

```text
LaunchDarkly
ConfigCat
Split
```

Guardar configuración en PostgreSQL.

---

# 61. PERSONALIZACIÓN ORGANIZACIÓN

Cada organización podrá tener:

```text
name
logo
terminology
accent configuration limitada
```

NO permitir personalización completa de UI.

Nodra debe conservar identidad coherente.

---

# 62. PRESETS FUTUROS

Diseña documentación para futuros presets:

```text
Events
Hospitality
Catering
Cleaning
Generic
```

Pero estos presets solo deben crear:

* roles;
* campos;
* nomenclatura.

Nunca lógica sectorial diferente.

---

# 63. AUDIT LOG

Crear:

```text
AuditEvent
```

Acciones importantes:

```text
ORGANIZATION_CREATED
MEMBER_INVITED
MEMBER_JOINED
MEMBER_REMOVED

SERVICE_CREATED
SERVICE_PUBLISHED
SERVICE_UPDATED
SERVICE_CANCELLED

ASSIGNMENT_CREATED
ASSIGNMENT_CONFIRMED
ASSIGNMENT_DECLINED
ASSIGNMENT_CANCELLED

ROLE_CREATED
ROLE_UPDATED
```

Registrar:

```text
actor
organization
entity
timestamp
metadata segura
```

---

# 64. SECURITY

Aplicar:

* DTO validation;
* input validation;
* authorization;
* authentication;
* rate limiting;
* CORS;
* secure headers;
* password hashing;
* protected refresh tokens;
* database constraints;
* transaction safety;
* cross-tenant isolation;
* logs sin secretos.

---

# 65. MULTI-TENANT SECURITY

NUNCA confiar únicamente en:

```text
organizationId
```

recibido desde cliente.

Siempre comprobar:

```text
currentUser
↓
Membership
↓
Organization
```

antes de acceder a datos.

---

# 66. TEST CRÍTICO

Debe existir un test donde:

```text
User A ∈ Organization A
```

intente manualmente consultar:

```text
Organization B
```

y sea rechazado.

Este test es obligatorio.

---

# 67. BASE DE DATOS

Utiliza:

* foreign keys;
* unique constraints;
* índices;
* UUIDs o IDs robustos;
* timestamps;
* soft delete únicamente donde esté justificado;
* migraciones.

---

# 68. ÍNDICES

Analiza consultas importantes:

```text
services by organization + date
active memberships
service positions
interests
assignments
pending confirmations
groups
notifications
```

Añade índices razonables.

No sobreoptimices sin medición.

---

# 69. MIGRACIONES

Nunca modificar esquema manualmente fuera del sistema de migraciones.

Todas las migraciones deben quedar versionadas.

---

# 70. SEEDS

Crear seeds de desarrollo.

Ejemplo:

```text
Organization:
Northline Events

Owner:
owner@nodra.local

Workers:
worker1@nodra.local
worker2@nodra.local
worker3@nodra.local
```

Crear:

* roles;
* grupos;
* servicios;
* posiciones;
* interesados;
* assignments;
* notices.

Credenciales solo desarrollo.

Documentarlas.

---

# 71. WEB — OBJETIVO

La web está orientada principalmente a organización/empresa.

Navegación inicial:

```text
Inicio
Servicios
Grupos
Equipo
Avisos
Calendario
Configuración
```

---

# 72. WEB DASHBOARD

Debe priorizar:

```text
Qué necesita atención
```

sobre estadísticas vacías.

Ejemplos:

```text
2 servicios incompletos

3 confirmaciones pendientes

1 servicio mañana
```

---

# 73. WEB — SERVICIOS

Debe incluir:

* listado;
* filtros básicos;
* crear;
* editar;
* detalle;
* posiciones;
* interesados;
* asignaciones;
* confirmaciones;
* cancelar.

---

# 74. WEB — EQUIPO

Debe incluir:

* listado miembros;
* estado;
* roles;
* invitación;
* grupos;
* búsqueda.

---

# 75. WEB — GROUPS

Debe permitir:

* crear;
* editar;
* miembros;
* consultar;
* eliminar/archivar cuando sea seguro.

---

# 76. WEB — AVISOS

Debe permitir:

* crear aviso;
* elegir destinatarios básicos;
* publicar;
* consultar;
* ver acknowledgement cuando exista.

---

# 77. WEB — CALENDARIO

Crear una primera visualización funcional.

No necesitas construir un calendario ultra avanzado.

Debe permitir entender próximos servicios.

---

# 78. MOBILE

La app móvil debe priorizar al trabajador.

Navegación aproximada:

```text
Inicio
Servicios
Avisos
Calendario
Perfil
```

Grupos puede integrarse dentro de avisos/inicio inicialmente si UX lo justifica.

---

# 79. MOBILE HOME

Prioridad:

```text
ACCIONES PENDIENTES

Confirmar servicio
Nuevo servicio disponible
Aviso pendiente

PRÓXIMOS

Servicio A
Servicio B
```

---

# 80. MOBILE SERVICE DETAIL

Mostrar:

```text
Título
Organización
Fecha
Horario
Ubicación
Rol
Descripción
Compensación si existe
Estado
```

Acciones:

```text
Me interesa
Retirar interés
Confirmar
Rechazar
```

según estado.

---

# 81. ORGANIZATION SWITCHER

Un usuario puede pertenecer a varias organizaciones.

Crear selector claro:

```text
Empresa A ▼
```

Al cambiar:

* limpiar/invalidate cache correcta;
* actualizar contexto;
* evitar mezclar datos;
* refrescar navegación.

---

# 82. WEB VS MOBILE

No intentes hacer exactamente la misma UI.

Web:

```text
administración
gestión
tablas
listas
detalle
filtros
```

Mobile:

```text
acciones rápidas
avisos
confirmaciones
servicios
calendario
```

---

# 83. DESIGN.MD

Existe un Design MD proporcionado por el propietario.

## LÉELO COMPLETAMENTE ANTES DE IMPLEMENTAR LA UI.

Es la fuente de verdad visual.

No lo ignores.

No sustituyas su estilo por:

* Material Design genérico;
* Bootstrap;
* SaaS azul;
* dashboard genérico;
* glassmorphism aleatorio;
* UI de plantilla.

---

# 84. IDENTIDAD VISUAL

La identidad debe sentirse:

```text
oscura
sobria
arquitectónica
moderna
premium
editorial
minimalista
profesional
```

No:

```text
gamer
cyberpunk
neón
dashboard corporativo
app Android antigua
```

---

# 85. COLORS

Mantener como base:

```text
Void
#08080a

Charcoal
#0d0d12

Graphite
#17171c

Slate
#25252d

Iron
#31313a

Ash
#62626f

Fog
#8b8e9c

Pearl
#aeaac0

Chalk
#dad7de

Lavender Beam
#ab8ff1

Iris Glow
#8960f0
```

---

# 86. SURFACE SYSTEM

Utilizar:

```text
Level 0
#08080a

Level 1
#0d0d12

Level 2
#17171c

Level 3
#25252d
```

Comunicar profundidad principalmente mediante superficies.

No mediante sombras enormes.

---

# 87. VIOLET

El violeta debe ser una señal.

Usarlo en:

* focus;
* enlaces;
* pequeños indicadores;
* selected state;
* detalles;
* aurora;
* pequeñas líneas.

NO usarlo para:

* grandes cards;
* fondo general;
* botones primarios completos;
* toda la navegación.

---

# 88. PRIMARY CTA

El CTA principal debe seguir:

```text
background: #dad7de
text: #08080a
radius: 3px
```

Mantener key-line sutil:

```text
box-shadow: #31313a 0 -1px 0 0
```

---

# 89. BORDER RADIUS

Regla:

```text
buttons = 3px
inputs = 3px
tags = 3px
cards = 10px
```

Evitar radios gigantes.

No utilizar:

```text
24px
32px
9999px
```

salvo caso concreto justificado.

---

# 90. TYPOGRAPHY

Seguir el Design MD.

Display:

preferentemente:

```text
Overused Grotesk
```

solo si está disponible legalmente.

Si no:

```text
Inter Tight
General Sans
system fallback
```

No descargues ni distribuyas fuentes sin licencia clara.

---

# 91. BODY TYPE

Para UI:

```text
Inter
system-ui
-apple-system
```

Mantener:

```text
peso 400-600
```

Evitar bold excesivo.

La jerarquía debe venir principalmente de:

* tamaño;
* spacing;
* tracking;
* contraste.

---

# 92. TRACKING

Respetar tracking negativo del Design MD en grandes headings.

No utilizarlo de forma absurda en textos pequeños.

---

# 93. CARDS

Cards:

```text
#17171c
1px border sutil
10px radius
```

Usarlas solo cuando agrupen información.

No convertir cada dato en una card.

---

# 94. INPUTS

Inputs:

```text
dark surface
1px border
3px radius
```

Focus:

```text
#ab8ff1
```

Evitar glows intensos.

---

# 95. ICONS

Iconografía:

```text
outline
stroke 1-1.5px
monocromática
```

Evitar iconos multicolor.

Preferir librerías open source.

---

# 96. SHADOWS

No utilizar sombras pesadas en elementos estáticos.

Permitidas en:

* overlays;
* popovers;
* dropdowns;
* floating elements;
* feedback interactivo.

---

# 97. AURORA

La aurora violeta del design reference puede utilizarse en:

* login;
* onboarding;
* empty states especiales;
* branding;
* landing futura.

NO utilizarla continuamente en las vistas operativas.

---

# 98. DESKTOP UX

En escritorio aprovechar:

* anchura;
* tablas;
* vistas divididas;
* panel lateral contextual;
* filtros;
* dense-but-readable information.

No hacer simplemente cards enormes.

---

# 99. MOBILE UX

Traducir el sistema visual correctamente.

No copiar literalmente la web.

Priorizar:

* legibilidad;
* touch targets;
* una mano;
* navegación clara;
* acciones rápidas.

---

# 100. ACCESSIBILITY

Implementar:

* contraste;
* focus visible;
* navegación teclado;
* semantic labels;
* touch target correcto;
* estados no dependientes únicamente del color;
* reduced motion.

---

# 101. ANIMACIONES

Solo animaciones funcionales.

Ejemplos:

* cambio de estado;
* apertura;
* navegación;
* confirmación;
* feedback.

Evitar:

* partículas;
* animaciones permanentes;
* glows;
* movimiento gratuito.

---

# 102. RESPONSIVE WEB

Prioridad:

```text
desktop/laptop
```

pero debe funcionar correctamente en:

```text
tablet
mobile browser
```

La experiencia móvil principal seguirá siendo Flutter.

---

# 103. ESTADOS UI

Cada pantalla debe contemplar:

```text
loading
empty
error
success
```

y cuando sea relevante:

```text
offline
```

---

# 104. EMPTY STATES

Deben explicar:

```text
qué ocurre
por qué está vacío
qué puede hacer el usuario
```

Ejemplo:

```text
Todavía no hay servicios.

Crea el primer servicio para empezar a organizar tu equipo.

[Crear servicio]
```

---

# 105. OFFLINE

No es necesario implementar sincronización offline completa ahora.

Pero la aplicación móvil debe:

* detectar errores de red;
* conservar sesión cuando corresponda;
* mostrar estados claros;
* no fallar silenciosamente.

Documentar offline completo como evolución futura.

---

# 106. OBSERVABILIDAD

No utilizar servicios comerciales obligatorios.

Preparar:

```text
OpenTelemetry
```

como base.

Opcionalmente local:

```text
Prometheus
Grafana
Loki
```

solo si no complica innecesariamente esta iteración.

---

# 107. LOGGING

Utiliza logging estructurado.

Preferentemente:

```text
Pino
```

o equivalente.

Cada petición debe tener:

```text
requestId
```

No registrar:

* passwords;
* JWT;
* refresh tokens;
* invitation tokens;
* secrets.

---

# 108. ERROR TRACKING

No depender de:

```text
Sentry SaaS
Datadog
New Relic
```

La aplicación debe funcionar completamente sin ellos.

---

# 109. FILE STORAGE

No guardar binarios grandes directamente en PostgreSQL.

Guardar metadatos en DB y contenido mediante StorageProvider.

---

# 110. MAPS

No implementar mapas salvo que sean realmente necesarios.

Si llegan a necesitarse:

preferir:

```text
OpenStreetMap
MapLibre
```

No introducir:

```text
Google Maps Platform
Mapbox pago
```

sin autorización explícita.

---

# 111. LOCATION

Por ahora:

```text
locationText
latitude optional
longitude optional
```

No necesitamos geocoding automático.

---

# 112. SMS

NO implementar SMS.

No utilizar:

```text
Twilio
Vonage
MessageBird
```

---

# 113. WHATSAPP

NO integrar WhatsApp Business API.

No convertir WhatsApp en dependencia.

---

# 114. PAYMENTS

NO implementar:

```text
Stripe
PayPal
Adyen
Apple Pay
Google Pay
```

No hay monetización interna todavía.

---

# 115. ANALYTICS

No introducir servicios comerciales.

No utilizar:

```text
Mixpanel
Amplitude
Heap
```

Si se necesitan métricas básicas:

crear eventos internos.

Analytics avanzado queda futuro.

---

# 116. SEARCH

Utilizar PostgreSQL inicialmente.

NO introducir:

```text
Algolia
Elastic Cloud
Meilisearch Cloud
```

Si posteriormente fuese necesario:

considerar Meilisearch self-hosted.

---

# 117. CAPTCHA

No introducir CAPTCHA comercial.

Usar inicialmente:

* rate limiting;
* email verification;
* protección backend.

---

# 118. CRON

Usar:

```text
BullMQ
NestJS Scheduler
```

o equivalente open source.

No servicios externos.

---

# 119. FEATURE FLAG SERVICES

No utilizar SaaS de feature flags.

Todo interno.

---

# 120. SECRETS

Desarrollo:

```text
.env
```

ignorado por Git.

Crear:

```text
.env.example
```

completo.

No utilizar secrets managers de pago.

---

# 121. DOCKER

Crear:

```text
docker-compose.yml
```

para levantar como mínimo:

```text
PostgreSQL
Valkey
Mailpit
MinIO
```

y si conviene:

```text
API
Worker
Web
```

---

# 122. EXPERIENCIA DEV

Objetivo:

```text
git clone
pnpm install
docker compose up -d
pnpm dev
```

y Flutter:

```text
cd apps/mobile
flutter pub get
flutter run
```

Documentar comandos exactos.

---

# 123. LOCAL ARCHITECTURE

Objetivo:

```text
                    NODRA

        ┌──────────────┴──────────────┐
        │                             │
      WEB                          MOBILE
    Next.js                        Flutter
        │                             │
        └──────────────┬──────────────┘
                       │
                    NestJS
                     API
                       │
       ┌───────────────┼──────────────┐
       │               │              │
   PostgreSQL        Valkey          MinIO
                       │
                     BullMQ
                       │
                     Worker
                 ┌─────┴─────┐
                 │           │
              Mailpit   ConsolePush
```

Coste obligatorio:

```text
0 €
```

exceptuando hardware, electricidad e Internet.

---

# 124. REVERSE PROXY

Para producción futura de bajo coste:

preferir:

```text
Caddy
```

o alternativa open source justificada.

HTTPS futuro:

```text
Let's Encrypt
```

No comprar certificados.

---

# 125. DOMINIO

No es requisito actual.

Desarrollo:

```text
localhost
```

No comprar dominio para completar esta fase.

---

# 126. DEPLOYMENT FUTURO

Documenta despliegue inicial posible en:

```text
1 VPS
```

mediante Docker Compose:

```text
Caddy
Web
API
Worker
PostgreSQL
Valkey
```

MinIO podrá estar local o separado.

---

# 127. ESCALABILIDAD

Documentar evolución:

```text
1 VPS
↓
DB separada
↓
API replicada
↓
workers separados
↓
Valkey separado
↓
object storage externo
↓
load balancer
↓
DB replicas
```

NO implementar Kubernetes.

---

# 128. NO MICROSERVICES

No utilizar microservicios inicialmente.

Justificación:

* mayor complejidad;
* despliegue;
* debugging;
* redes;
* observabilidad;
* mantenimiento.

El modular monolith debe estar limpio para permitir extracción futura.

---

# 129. CI

Crear GitHub Actions para:

```text
lint
typecheck
test
build api
build web
```

solo si puede hacerse sin servicio obligatorio de pago.

CI es comodidad.

El proyecto debe validarse también localmente.

---

# 130. IOS CI

No contratar runners Mac.

Documentar builds iOS automatizados como trabajo futuro.

---

# 131. TESTING BACKEND

Crear:

* unit tests;
* integration tests;
* authorization tests;
* multi-tenant tests.

Prioridad alta:

```text
auth
membership
service permissions
interest
assignment
confirmation
```

---

# 132. WEB TESTS

Tests de componentes/flujos importantes.

No buscar cobertura artificial del 100 %.

---

# 133. FLUTTER TESTS

Crear:

* unit tests;
* widget tests;
* tests de lógica.

---

# 134. QUALITY GATES

Antes de terminar:

```text
lint
typecheck
tests
build
```

deben pasar.

No ocultar errores.

---

# 135. TYPESCRIPT

Evitar:

```text
any
```

salvo justificación clara.

Preferir:

```text
unknown
```

y narrowing cuando corresponda.

---

# 136. ERROR HANDLING

Errores API deben tener formato consistente.

Ejemplo:

```json
{
  "code": "SERVICE_NOT_FOUND",
  "message": "Service not found",
  "requestId": "..."
}
```

No filtrar stack traces en producción.

---

# 137. TIME

Guardar fechas preferentemente en UTC.

Mostrar según timezone del usuario/organización.

Documentar estrategia.

---

# 138. INTERNATIONALIZATION

El MVP puede empezar en español.

Pero evita hardcodear arquitectura que haga imposible añadir inglés posteriormente.

Crear estructura razonable de i18n.

No hace falta traducir toda la aplicación ahora.

---

# 139. PRIVACY

Recolectar solamente información necesaria.

No guardar:

* ubicación permanente;
* tracking;
* contactos;
* información sensible innecesaria.

---

# 140. ACCOUNT DELETION

Diseña el modelo considerando futura eliminación/desactivación de cuentas.

No eliminar registros históricos necesarios indiscriminadamente.

Documentar estrategia futura de:

```text
deactivation
anonymization
deletion
```

---

# 141. SOFT DELETE

No aplicar soft-delete a todo por costumbre.

Decidir entidad por entidad.

Documentar.

---

# 142. DOCUMENTACIÓN OBLIGATORIA

Esto es CRÍTICO.

Todo conocimiento necesario debe vivir dentro del repositorio.

No depender de esta conversación.

Crear:

```text
README.md
AGENTS.md
PROJECT_STATE.md
NEXT_TODOS.md
```

y dentro de:

```text
docs/
```

crear:

```text
PRODUCT.md
ARCHITECTURE.md
DATA_MODEL.md
API.md
AUTH_AND_PERMISSIONS.md
MULTI_TENANCY.md
DESIGN_SYSTEM.md
WEB_APP.md
MOBILE_APP.md
NOTIFICATIONS.md
SECURITY.md
TESTING.md
DEPLOYMENT.md
DEVELOPMENT.md
DECISIONS.md
ROADMAP.md
DEPENDENCIES.md
```

---

# 143. README.md

Debe permitir a una persona nueva levantar el proyecto.

Incluir:

```text
Qué es Nodra
Stack
Arquitectura
Estructura
Requisitos
Instalación
Docker
Variables
DB
Migraciones
Seeds
API
Worker
Web
Flutter
Tests
Documentación
```

---

# 144. AGENTS.md

Documento específico para futuros agentes.

Debe indicar:

```text
1. Leer PROJECT_STATE.md
2. Leer NEXT_TODOS.md
3. Leer documentación afectada
4. Inspeccionar implementación real
5. No rehacer trabajo completado
6. Respetar arquitectura
7. Respetar Design System
8. Ejecutar tests
9. Actualizar documentación
10. Actualizar PROJECT_STATE.md
11. Actualizar NEXT_TODOS.md
```

Incluir explícitamente:

> El repositorio es la fuente de verdad, no la memoria de conversaciones anteriores.

---

# 145. REGLA DE COSTE EN AGENTS.md

Añadir literalmente una regla equivalente a:

> Nodra se encuentra actualmente en una fase de coste cero. Ningún agente puede introducir una tecnología, API, SaaS, servicio cloud o infraestructura de pago, trial, créditos o requisito de tarjeta bancaria sin una instrucción explícita del propietario del proyecto.

También:

> Cuando exista una alternativa self-hosted, gratuita y razonable, debe preferirse durante esta fase.

Y:

> Los adapters para proveedores comerciales futuros son válidos, pero el provider predeterminado debe ser gratuito/local.

---

# 146. PROJECT_STATE.md

Debe permitir entender Nodra en aproximadamente cinco minutos.

Incluir:

```text
Última actualización
Estado general
Qué funciona
Qué está parcial
Qué falta
Arquitectura
Servicios
Modelo de datos
Endpoints
Web
Mobile
Integraciones
Tests
Problemas conocidos
Decisiones
Siguiente objetivo
```

---

# 147. PROJECT STATE — COST

Añadir:

```text
## External dependencies

### Required paid services

None.

### Required external accounts

None.

### Optional future integrations

...
```

Y:

```text
## Zero-cost validation

Can Nodra be developed and run from scratch without purchasing any service?

YES
```

Esta respuesta debe permanecer `YES`.

---

# 148. NEXT_TODOS.md

Documento operativo principal.

Formato:

```text
## NOD-001 — Nombre

Descripción:

Prioridad:
P0 / P1 / P2 / P3

Estado:
TODO / IN_PROGRESS / REVIEW / BLOCKED / DONE

Dependencias:

Objetivo:

Criterios de aceptación:

Archivos relacionados:

Tests requeridos:

Notas técnicas:
```

---

# 149. IDS

Usar:

```text
NOD-001
NOD-002
NOD-003
...
```

Nunca reutilizar.

No eliminar DONE.

Mantener historial.

---

# 150. BLOCKED EXTERNAL COST

Cuando una futura tarea dependa de un proveedor externo potencialmente de pago:

crear:

```text
Estado:
BLOCKED
```

y explicar:

```text
Requires explicit owner decision about external provider.
```

No implementarla por iniciativa propia.

---

# 151. DECISIONS.md

Utilizar ADRs.

Formato:

```text
## ADR-001 — Title

Status:
Accepted

Context:

Decision:

Alternatives:

Consequences:
```

---

# 152. ADRS MÍNIMOS

Registrar:

```text
Modular monolith
PostgreSQL
Prisma
REST/OpenAPI
Flutter
Next.js
NestJS
Valkey
BullMQ
Multi-tenancy
Provider abstractions
Zero-cost MVP
```

---

# 153. ZERO COST ADR

Crear ADR específico:

```text
Zero-cost infrastructure during MVP
```

Explicar:

```text
PostgreSQL → local
Valkey → local
Mail → Mailpit
Storage → MinIO
Push → ConsolePushProvider
Auth → internal
Monitoring → local/open source
```

---

# 154. DEPENDENCIES.md

Crear tabla:

```text
Technology
Version
License
Purpose
Alternative considered
Reason selected
```

Revisar licencias.

Evitar:

* dependencias propietarias;
* paquetes con licencia poco clara;
* paquetes abandonados;
* dependencias comerciales obligatorias.

---

# 155. DESIGN_SYSTEM.md

Adaptar el Design MD original a Nodra.

No copiarlo sin reflexión.

Documentar:

```text
tokens
colors
surfaces
typography
spacing
radii
shadows
buttons
inputs
cards
tables
navigation
sidebar
bottom nav
modals
dialogs
dropdowns
toasts
badges
status
forms
mobile
desktop
responsive
motion
accessibility
```

---

# 156. PRODUCT.md

Explicar:

```text
Problema
Usuarios
Propuesta
No-marketplace
No-ERP
Multi-organization
Services
Groups
Notices
Assignments
Confirmations
```

---

# 157. ARCHITECTURE.md

Explicar:

```text
monorepo
API
worker
web
mobile
PostgreSQL
Valkey
BullMQ
storage
provider abstractions
domain boundaries
scaling
```

Incluye diagramas Mermaid si aportan valor.

---

# 158. DATA_MODEL.md

Documentar entidades y relaciones.

Incluye:

```text
User
Organization
Membership
Invitation
JobRole
Group
GroupMember
Service
ServicePosition
ServiceInterest
ServiceAssignment
Confirmation
Notice
Notification
DeviceToken
AuditEvent
Feature
OrganizationFeature
CustomFieldDefinition
CustomFieldValue
```

No necesariamente todas deben quedar implementadas inmediatamente.

Distingue:

```text
implemented
planned
```

---

# 159. AUTH_AND_PERMISSIONS.md

Documentar:

* login;
* JWT;
* refresh;
* organization context;
* PermissionRole;
* JobRole;
* authorization;
* invite flow.

---

# 160. MULTI_TENANCY.md

Documentar especialmente:

* aislamiento;
* organization-scoped queries;
* membership;
* security;
* tests;
* riesgos cross-tenant.

---

# 161. API.md

Documentar:

* conventions;
* versioning;
* errors;
* pagination;
* filters;
* authentication;
* organization context;
* OpenAPI.

---

# 162. NOTIFICATIONS.md

Documentar separación:

```text
DomainEvent
Notification
Delivery
Provider
```

Providers:

```text
Console
Future FCM
Future email production
```

---

# 163. WEB_APP.md

Documentar:

* arquitectura;
* routing;
* state;
* components;
* pages;
* organization switcher;
* auth;
* design.

---

# 164. MOBILE_APP.md

Documentar:

* routing;
* Riverpod;
* Dio;
* secure storage;
* organization context;
* offline error handling;
* notifications;
* iOS future setup.

---

# 165. SECURITY.md

Documentar:

* password;
* JWT;
* tokens;
* invitation security;
* rate limits;
* tenant isolation;
* logs;
* secrets;
* CORS;
* file upload;
* future threats.

---

# 166. TESTING.md

Explicar:

* backend;
* web;
* mobile;
* commands;
* test DB;
* fixtures;
* critical scenarios.

---

# 167. DEVELOPMENT.md

Explicar:

```text
setup
commands
Docker
database
migration
seed
tests
format
lint
debug
```

---

# 168. DEPLOYMENT.md

Documentar:

```text
local
single VPS
Docker Compose
Caddy
backup strategy future
scaling path
```

No contratar nada.

---

# 169. ROADMAP.md

Dividir aproximadamente:

## Phase 0 — Foundation

## Phase 1 — Coordination MVP

## Phase 2 — Availability

## Phase 3 — Customization

## Phase 4 — Documents / operations

## Phase 5 — Analytics

## Future

* chat;
* timesheets;
* expenses;
* workflows;
* integrations.

---

# 170. NO IMPLEMENTAR TODAVÍA

No implementar salvo requisito indispensable:

```text
ERP
payroll
billing
invoicing
payments
contracts
public marketplace
public jobs
AI
LLMs
recommendation algorithm
public scoring
GPS tracking
native chat
video
Kubernetes
microservices
SMS
WhatsApp API
```

---

# 171. AI

Nodra NO debe depender de:

```text
OpenAI API
Anthropic API
Gemini API
Mistral API
otros LLM APIs
```

No implementar IA.

Codex es herramienta de desarrollo, no dependencia del producto.

---

# 172. PROHIBIDO COMO DEPENDENCIA OBLIGATORIA

Durante esta fase no introducir como requisito:

```text
AWS
Azure
Google Cloud
Vercel Pro
Supabase Cloud
Neon
PlanetScale
Railway
Render
Heroku
Upstash
Redis Cloud
Firebase Database
Firebase Auth
Auth0
Clerk
Okta
Twilio
SendGrid
Mailgun
Resend
Postmark
Cloudflare R2
Sentry SaaS
Datadog
New Relic
Algolia
Elastic Cloud
Mapbox
Google Maps Platform
Stripe
PayPal
LaunchDarkly
ConfigCat
Split
```

Esto no significa que estén prohibidos para siempre.

Significa que requieren decisión explícita posterior.

---

# 173. LICENCIAS

Antes de introducir una dependencia importante:

revisar:

```text
license
maintenance
ecosystem
cost
lock-in
```

Documentar las importantes.

---

# 174. GITIGNORE

Configurar correctamente para evitar:

```text
.env
node_modules
builds
logs
IDE temp
Flutter build
coverage
database data
MinIO local data
secrets
```

---

# 175. GIT

Trabajar en cambios lógicos.

No llenar repositorio de archivos generados.

No eliminar documentación histórica.

---

# 176. FIRST IMPLEMENTATION PLAN

Sigue este orden.

---

## NOD-001 — Repository inspection

Inspeccionar:

* archivos;
* instrucciones;
* Design MD;
* versiones;
* Git;
* toolchains.

Documentar.

---

## NOD-002 — Architecture decisions

Crear:

* arquitectura;
* ADRs;
* documentación inicial;
* monorepo.

---

## NOD-003 — Development infrastructure

Configurar:

```text
Docker Compose
PostgreSQL
Valkey
Mailpit
MinIO
```

Validar health.

---

## NOD-004 — Backend foundation

Crear:

```text
NestJS
Fastify
Prisma
config
logging
validation
OpenAPI
error handling
```

---

## NOD-005 — Auth

Implementar:

* User;
* register;
* login;
* JWT;
* refresh;
* logout;
* password security.

---

## NOD-006 — Organizations and memberships

Implementar:

* Organization;
* Membership;
* PermissionRole;
* organization context.

---

## NOD-007 — Invitations

Implementar flujo completo.

---

## NOD-008 — Job roles and groups

Implementar entidades y endpoints fundamentales.

---

## NOD-009 — Services

Implementar:

* Service;
* ServicePosition;
* lifecycle.

---

## NOD-010 — Interests

Implementar trabajador interesado.

---

## NOD-011 — Assignments

Implementar selección.

---

## NOD-012 — Confirmations

Implementar confirmación.

---

## NOD-013 — Notification infrastructure

Implementar:

```text
domain event
queue
worker
ConsolePushProvider
MailProvider
```

---

## NOD-014 — Web foundation

Implementar:

* auth;
* layout;
* organization context;
* design system.

---

## NOD-015 — Web operational flow

Implementar:

```text
dashboard
services
interests
assignments
confirmations
team
```

---

## NOD-016 — Flutter foundation

Implementar:

* auth;
* networking;
* Riverpod;
* routing;
* secure storage;
* organization context;
* design system.

---

## NOD-017 — Flutter service flow

Implementar:

```text
services
interest
assignments
confirmation
```

---

## NOD-018 — Notices

Implementar base funcional.

---

## NOD-019 — Audit / security hardening

Implementar:

* audit;
* rate limits;
* permission tests;
* multi-tenant tests.

---

## NOD-020 — Final validation

Ejecutar:

```text
lint
typecheck
tests
build
migration
seed
```

y actualizar toda documentación.

---

# 177. NO INTENTES HACER TODO EL ROADMAP

Los puntos anteriores son dirección arquitectónica.

Si completar absolutamente todo correctamente en una única ejecución perjudica calidad:

prioriza:

```text
Foundation
Auth
Organizations
Memberships
Invitations
Services
Positions
Interest
Assignments
Confirmations
Web flow
Mobile flow
Documentation
```

Deja el resto correctamente especificado en:

```text
NEXT_TODOS.md
```

Nunca falsifiques estados DONE.

---

# 178. DONE

Una tarea solamente está:

```text
DONE
```

si:

* código existe;
* funciona;
* tests relevantes pasan;
* documentación está actualizada.

Si necesita comprobación manual:

```text
REVIEW
```

Si depende de algo:

```text
BLOCKED
```

---

# 179. NO INVENTAR RESULTADOS

Si una compilación no puede verificarse:

no escribas:

```text
Build successful
```

Escribe exactamente qué pudiste verificar.

---

# 180. DESIGN QUALITY

No quiero una interfaz construida rápidamente solo para cumplir.

La primera UI debe sentar las bases visuales definitivas.

Antes de crear componentes:

1. estudiar Design MD;
2. crear tokens;
3. crear primitives;
4. crear layouts;
5. después construir pantallas.

---

# 181. SHARED VISUAL LANGUAGE

Flutter y web deben sentirse como el mismo producto.

Deben compartir conceptualmente:

```text
color tokens
spacing
radius
typography hierarchy
states
icon language
interaction philosophy
```

No necesitan compartir código.

---

# 182. COMPONENT SYSTEM WEB

Crear componentes internos para:

```text
Button
Input
Textarea
Select
Checkbox
Dialog
Dropdown
Toast
Badge
Card
DataTable
EmptyState
PageHeader
SectionHeader
StatusIndicator
Skeleton
OrganizationSwitcher
```

No construir una UI library gigantesca.

---

# 183. COMPONENT SYSTEM MOBILE

Crear equivalentes coherentes:

```text
NodraButton
NodraTextField
NodraCard
NodraBadge
NodraDialog
NodraEmptyState
NodraSkeleton
NodraOrganizationSwitcher
```

Nombres pueden mejorarse.

---

# 184. STATE COLORS

El Design MD indica no depender excesivamente del color.

Estados como:

```text
CONFIRMED
PENDING
CANCELLED
```

deben comunicarse mediante:

* texto;
* iconos;
* bordes;
* forma;
* contraste.

No crear semáforo arcoíris.

---

# 185. ICON LIBRARIES

Utilizar únicamente opciones gratuitas/open source.

No comprar iconos.

---

# 186. FONTS

No introducir fuentes de pago.

Si la fuente exacta del Design MD no está disponible legalmente:

utilizar sustituto gratuito.

Preferencia:

```text
Inter Tight
Inter
system UI
```

---

# 187. CUSTOM BRANDING

No permitir que las organizaciones rompan el Design System.

Personalización futura limitada a:

```text
logo
name
small accent preference
terminology
```

---

# 188. PERFORMANCE WEB

Evitar:

* bundles innecesarios;
* client components por defecto;
* hydration innecesaria;
* consultas repetidas.

Utilizar capacidades de Next.js con criterio.

---

# 189. PERFORMANCE MOBILE

Evitar:

* rebuilds innecesarios;
* grandes listas sin virtualización;
* imágenes sin cache;
* estado global indiscriminado.

---

# 190. PAGINATION

Listados potencialmente grandes deben soportar paginación.

No cargar 50.000 miembros de golpe.

---

# 191. FILTERING

API debe preparar filtros para:

```text
status
date
role
group
search
```

cuando corresponda.

---

# 192. CONCURRENCY

Considera casos como:

```text
dos administradores seleccionando último hueco
```

No confíes únicamente en UI.

Usa transacciones/constraints.

---

# 193. SERVICE CAPACITY

Backend debe impedir inconsistencia importante.

Si posición necesita:

```text
4
```

no permitir accidentalmente 7 assignments activos salvo flujo explícito.

Documentar decisión.

---

# 194. AUDITABILITY

Operaciones administrativas importantes deben poder reconstruirse.

No eliminar historial porque sea más fácil.

---

# 195. TIMEZONE

Organization debería poder tener:

```text
timezone
```

El backend almacena UTC.

La UI muestra hora de organización/usuario según estrategia documentada.

---

# 196. USER PROFILE

Modelo inicial:

```text
id
email
firstName
lastName
status
createdAt
updatedAt
```

Añadir únicamente datos necesarios.

No recolectar información personal innecesaria.

---

# 197. FUTURE PROFILE DATA

No añadir todavía:

* DNI;
* dirección completa;
* datos bancarios;
* documentos sensibles;

salvo que exista requisito real posterior.

---

# 198. ORGANIZATION OWNER

Al crear Organization:

el creador obtiene:

```text
OWNER
```

dentro de Membership.

Debe existir al menos un owner.

---

# 199. PERMISSION MATRIX

Documentar inicialmente algo similar a:

```text
OWNER
todo

ADMIN
gestión operativa

COORDINATOR
servicios / grupos / asignaciones

MEMBER
contenido que le afecta
```

Implementar autorización centralizada.

---

# 200. SECURITY FIRST

No dispersar:

```text
if role ===
```

por todos los controladores.

Crear mecanismo coherente:

* guards;
* policies;
* permission service.

---

# 201. DOCUMENT CHANGES

Cada cambio arquitectónico debe actualizar:

```text
DECISIONS.md
ARCHITECTURE.md
```

cuando proceda.

Cada cambio de estado debe actualizar:

```text
PROJECT_STATE.md
NEXT_TODOS.md
```

---

# 202. FUTURE AGENT HANDOFF

Al finalizar la ejecución:

otro agente debe poder abrir:

```text
AGENTS.md
PROJECT_STATE.md
NEXT_TODOS.md
```

y continuar sin preguntarme:

```text
¿Qué habíais hecho?
¿Qué falta?
¿Qué stack usáis?
¿Qué decisiones se tomaron?
```

Si no puede hacerlo:

la documentación es insuficiente.

---

# 203. FINAL COST VALIDATION

Antes de dar por terminada la iteración:

revisa toda dependencia.

Responder internamente:

```text
Can Nodra be developed and run from zero without buying or subscribing to any service?
```

La respuesta debe ser:

```text
YES
```

Si es:

```text
NO
```

no finalices.

Sustituye la dependencia.

---

# 204. REQUIRED PAID SERVICES

Debe permanecer:

```text
None
```

---

# 205. REQUIRED EXTERNAL ACCOUNTS

Durante desarrollo local debe permanecer:

```text
None
```

---

# 206. FUTURE COMMERCIAL PROVIDERS

Pueden aparecer en documentación como opciones.

Nunca como requisitos actuales.

---

# 207. NO PREMATURE SCALE INFRASTRUCTURE

No implementar todavía:

```text
Kubernetes
Kafka
RabbitMQ cluster
service mesh
distributed tracing infrastructure massive
multi-region
database sharding
CQRS complejo
event sourcing global
```

La arquitectura debe permitir crecer sin convertir el MVP en infraestructura empresarial innecesaria.

---

# 208. SCALABILITY PHILOSOPHY

Diseña para que pasar de:

```text
100 usuarios
```

a:

```text
100.000 usuarios
```

requiera principalmente:

* replicar;
* separar servicios;
* optimizar;
* añadir infraestructura;

y no reescribir toda la aplicación.

Pero no pagues ahora la complejidad de 100.000 usuarios.

---

# 209. DATABASE FIRST

La consistencia importante debe estar protegida también por PostgreSQL mediante:

* constraints;
* unique indexes;
* FKs.

No asumir que API será el único consumidor para siempre.

---

# 210. DOMAIN LOGIC

Evita lógica importante dentro de:

```text
controllers
React components
Flutter widgets
```

La lógica debe vivir en servicios/dominio correspondientes.

---

# 211. NO FAKE ARCHITECTURE

No crees interfaces, factories y abstracciones inútiles únicamente porque "puedan servir".

Introduce abstracción cuando:

* exista boundary real;
* provider externo;
* testing;
* dominio lo justifique.

---

# 212. CODE QUALITY

Priorizar:

```text
clarity
maintainability
consistency
```

sobre:

```text
cleverness
```

---

# 213. COMMENTS

No llenar código de comentarios obvios.

Documentar decisiones complejas.

Preferir código autoexplicativo.

---

# 214. NAMING

Nombres del dominio y código:

preferentemente inglés.

UI inicial:

español.

Ejemplo:

```text
ServiceAssignment
```

pero UI:

```text
Asignación
```

---

# 215. DATABASE NAMING

Mantener convención consistente.

Documentarla.

---

# 216. API VERSIONING

Preparar versionado sencillo:

```text
/api/v1
```

No crear múltiples versiones ahora.

---

# 217. HEALTH ENDPOINTS

Implementar:

```text
/health
```

y si procede:

```text
/health/ready
```

Debe comprobar dependencias críticas.

---

# 218. DOCKER HEALTHCHECKS

Configurar healthchecks razonables para:

```text
PostgreSQL
Valkey
Mailpit
MinIO
```

cuando sea posible.

---

# 219. BACKUPS

No hace falta montar infraestructura de backup externa ahora.

Pero documentar estrategia para producción:

* PostgreSQL dumps;
* snapshots;
* offsite copy;
* restore testing.

---

# 220. UPLOAD SECURITY

Si implementas uploads:

* size limits;
* MIME checks;
* safe filenames;
* generated object keys;
* authorization.

No confiar en filename del usuario.

---

# 221. RATE LIMITS

Aplicar especialmente a:

```text
login
register
refresh
invite acceptance
password reset
```

---

# 222. VALIDATION

Nunca confiar en tipos TypeScript como validación runtime.

Validar DTOs.

---

# 223. EMAIL CASE

Normalizar emails apropiadamente.

Unique constraint.

Documentar estrategia.

---

# 224. SLUGS

Organization slug debe ser único.

No usar slug como authorization mechanism.

---

# 225. DATA OWNERSHIP

Casi todas las entidades operativas deben estar claramente asociadas a Organization directa o indirectamente.

Esto facilita:

* queries;
* security;
* deletion;
* audit.

---

# 226. CACHE

No introducir caché antes de necesitarla para todos los endpoints.

Valkey está disponible para:

* queues;
* rate limits;
* future cache.

Evitar complejidad prematura.

---

# 227. WORKER RETRIES

Configurar:

* retry;
* backoff;
* max attempts;
* dead/failure visibility.

Documentar jobs fallidos.

---

# 228. NOTIFICATION PREFERENCES

Diseñar futura estructura para:

```text
NotificationPreference
```

pero no construir panel avanzado aún.

---

# 229. REALTIME

No es obligatorio WebSocket en la primera vertical.

Diseña API para funcionar perfectamente sin tiempo real.

Si lo implementas:

utiliza NestJS WebSocket gateway gratuito/open source.

No introducir SaaS realtime.

---

# 230. REALTIME FUTURE

Casos:

```text
nuevo interesado
confirmación recibida
service status
```

Puede añadirse posteriormente.

---

# 231. CALENDAR

No integrar Google Calendar ni otros proveedores en MVP.

Calendario inicial usa datos propios.

Integraciones externas serán futuras.

---

# 232. EXTERNAL INTEGRATIONS

Toda integración futura debe estar detrás de adapter cuando tenga sentido.

Pero no implementar adapters vacíos para veinte servicios imaginarios.

---

# 233. PRODUCT SUCCESS

El principal objetivo del MVP no es:

```text
cantidad de usuarios registrados
```

sino:

```text
¿puede una organización coordinar servicios sin volver continuamente a WhatsApp?
```

Ten este criterio en cuenta al diseñar UX.

---

# 234. DESIGN PRIORITY

La UI debe hacer especialmente visibles:

```text
acciones pendientes
servicios incompletos
confirmaciones
cambios
avisos importantes
```

No esconder lo importante detrás de dashboards decorativos.

---

# 235. INFORMATION DENSITY

La interfaz profesional puede tener densidad moderada.

No hacer enormes espacios vacíos únicamente para parecer premium.

Equilibrar:

```text
claridad
densidad
ritmo
```

---

# 236. RESPONSIVENESS

Web debe adaptarse correctamente.

No sacrifiques desktop para intentar reemplazar Flutter.

---

# 237. ERROR COPY

Mensajes de error deben explicar qué puede hacer usuario.

No simplemente:

```text
Something went wrong
```

cuando puede darse información útil.

---

# 238. DESTRUCTIVE ACTIONS

Acciones destructivas importantes requieren:

* confirmación;
* copy claro;
* efecto visible.

---

# 239. ARCHIVING

Para entidades como JobRole o Group:

preferir archivar/desactivar cuando la eliminación rompería histórico.

---

# 240. SERVICE HISTORY

Servicios completados deben seguir siendo consultables.

No borrar assignments al completar.

---

# 241. ORGANIZATION HISTORY

Si un usuario abandona empresa:

no eliminar el historial de trabajos.

Membership puede pasar a:

```text
LEFT
```

---

# 242. INVITATION SECURITY

Los enlaces deben:

* expirar;
* poder revocarse;
* tener uso limitado opcional;
* no revelar secretos internamente.

---

# 243. INVITATION UX

El usuario debe ver claramente:

```text
Te han invitado a:
Organization X
```

antes de aceptar.

---

# 244. FIRST OWNER FLOW

Si usuario no pertenece a organización:

web debe ofrecer:

```text
Crear organización
```

o:

```text
Aceptar invitación
```

---

# 245. NO EMPTY DEAD END

Nunca dejar usuario atrapado en dashboard vacío sin explicación.

---

# 246. ORGANIZATION CONTEXT URL

Decide si usar:

```text
/org/:slug/...
```

o estrategia equivalente.

Documenta decisión.

---

# 247. MOBILE ORGANIZATION CONTEXT

Mantener organization id seleccionada de forma segura/local.

Validar backend en cada petición.

---

# 248. USER WITHOUT ACTIVE MEMBERSHIP

Debe seguir pudiendo acceder a:

* perfil;
* aceptar invitaciones;
* crear organización si procede.

---

# 249. DOCUMENT STATUS

En `PROJECT_STATE.md` registrar documentos existentes.

No crear documentación que contradiga implementación.

---

# 250. SOURCE OF TRUTH PRIORITY

En caso de contradicción:

1. implementación real;
2. migraciones/database schema;
3. tests;
4. arquitectura/documentación actualizada.

Corrige documentos desactualizados.

---

# 251. TODO QUALITY

Cada TODO debe poder asignarse a otro agente sin contexto adicional.

Evitar:

```text
Improve UI
Fix backend
Add security
```

Preferir:

```text
Implement organization-scoped authorization guard for Service endpoints
```

---

# 252. DESIGN TODO QUALITY

Mejoras visuales deben especificar:

* problema;
* componente;
* criterio;
* aceptación.

---

# 253. BUILD ORDER

Prioriza backend/domain antes de conectar UI completa.

Pero no esperes a terminar "todo backend" para validar experiencia.

Iterar verticalmente.

---

# 254. FIRST VERTICAL

Construye primero:

```text
Auth
Organization
Membership
Role
Service
Position
Interest
Assignment
Confirmation
```

y conéctalo a:

```text
Web Admin
Flutter Worker
```

---

# 255. INTERNAL EVENTS

Puede usarse EventEmitter interno o mecanismo equivalente para desacoplar dominio y side effects.

No introducir Kafka.

---

# 256. DOMAIN BOUNDARIES

Módulos backend sugeridos:

```text
auth/
users/
organizations/
memberships/
invitations/
roles/
groups/
services/
assignments/
availability/
notices/
notifications/
files/
audit/
features/
```

---

# 257. MODULE DEPENDENCIES

Evitar ciclos.

Documentar responsabilidades.

---

# 258. SHARED TYPES

No duplicar modelos TypeScript manualmente por toda la web.

Utilizar contratos o cliente generado cuando sea razonable.

Flutter puede usar generación a partir de OpenAPI posteriormente.

---

# 259. API RESPONSE

Evitar wrappers innecesarios gigantes.

Definir convención sencilla y consistente.

---

# 260. PAGINATION STYLE

Escoger:

```text
cursor
```

o:

```text
offset
```

según necesidad.

Para MVP puede usarse offset si simplifica.

Documentar.

---

# 261. SORTING

Listados principales:

por fecha/estado según contexto.

No devolver orden indeterminado.

---

# 262. SEED UX

Los seeds deben permitir probar inmediatamente:

```text
Admin web
Worker mobile
Service flow
```

---

# 263. LOCAL EMAIL UX

README debe explicar URL de Mailpit.

---

# 264. LOCAL STORAGE UX

README debe explicar MinIO únicamente si se utiliza.

---

# 265. LOCAL DATABASE UX

Incluir comandos para:

```text
migrate
reset
seed
studio opcional
```

---

# 266. PRISMA STUDIO

Puede usarse como herramienta local opcional si no genera coste.

---

# 267. DOCUMENT PROVIDER BOUNDARIES

En docs deja claro:

```text
providers/local
providers/future
```

---

# 268. PRODUCTION PROVIDERS

No seleccionar proveedor comercial definitivo.

Eso será una decisión futura basada en:

* coste;
* volumen;
* fiabilidad;
* GDPR;
* región;
* lock-in.

---

# 269. GDPR

No hace falta implementar un sistema legal completo.

Pero considera desde diseño:

* minimización;
* eliminación;
* exportación futura;
* seguridad;
* aislamiento;
* audit logs.

---

# 270. EUROPE

Diseña fechas, privacidad y arquitectura pensando en que el producto podría operar en Europa.

No introducir dependencias técnicas que hagan imposible alojar datos en UE posteriormente.

---

# 271. MOBILE IOS

Mantener proyecto iOS generado correctamente.

No borrar configuración necesaria de Flutter.

Documentar requisitos futuros:

```text
macOS
Xcode
Apple Developer
APNs
```

como futuros, no requisitos actuales.

---

# 272. MOBILE ANDROID

Mantener proyecto Android compilable.

No exigir Play Services innecesarios mientras FCM esté desactivado.

---

# 273. PUSH DEV MODE

Con:

```text
PUSH_PROVIDER=console
```

debe funcionar todo el pipeline.

---

# 274. MAIL DEV MODE

Con:

```text
MAIL_PROVIDER=mailpit
```

debe funcionar.

---

# 275. STORAGE DEV MODE

Con:

```text
STORAGE_PROVIDER=minio
```

o local equivalent.

---

# 276. CONFIG VALIDATION

Variables inválidas deben provocar fallo al iniciar con mensaje claro.

No errores posteriores misteriosos.

---

# 277. ENVIRONMENT EXAMPLE

`.env.example` debe contener todas las variables con valores seguros de ejemplo.

No secretos reales.

---

# 278. ENVIRONMENTS

Soportar conceptualmente:

```text
development
test
production
```

No añadir staging innecesario todavía.

---

# 279. TEST DATABASE

Tests deben utilizar DB separada.

Nunca ejecutar tests destructivos contra desarrollo accidentalmente.

---

# 280. CLEANUP

Tests de integración deben limpiar correctamente.

---

# 281. DETERMINISM

Seeds y tests deben ser reproducibles.

---

# 282. CLOCK

Cuando lógica temporal compleja aparezca, evita depender directamente del tiempo global en tests.

Introduce clock abstraction solo si realmente resulta útil.

---

# 283. USER EXPERIENCE FIRST

Toda tecnología debe justificar cómo mejora:

* mantenimiento;
* fiabilidad;
* UX;
* escalabilidad.

No añadir tecnologías solo por moda.

---

# 284. ZERO COST REVIEW

Antes de instalar cualquier paquete importante:

comprobar que:

```text
free
license compatible
no commercial runtime dependency
```

---

# 285. EXPLICIT OWNER APPROVAL

Cualquier futuro cambio que implique:

```text
coste
vendor lock-in significativo
API comercial
suscripción
```

debe quedar pendiente de aprobación explícita.

---

# 286. FINAL DELIVERABLE

Al terminar esta ejecución quiero encontrar:

```text
repositorio estructurado
aplicaciones inicializadas
infra local funcional
DB y migraciones
vertical MVP funcional o claramente avanzada
web
mobile
tests
docs
PROJECT_STATE
NEXT_TODOS
AGENTS
```

No quiero solamente un informe.

Implementa.

---

# 287. FINAL REVIEW

Antes de detenerte:

1. ejecuta lint;
2. ejecuta typecheck;
3. ejecuta tests;
4. intenta builds aplicables;
5. valida migraciones;
6. valida seeds;
7. valida Docker;
8. revisa seguridad multi-tenant;
9. revisa dependencias;
10. revisa coste cero;
11. revisa documentación;
12. actualiza estado;
13. actualiza TODOs.

---

# 288. FINAL RESPONSE DEL AGENTE

Tu respuesta final debe ser breve y operativa.

Incluye:

```text
Qué se implementó
Qué se verificó
Qué no pudo verificarse
Problemas encontrados
Siguiente NOD recomendado
```

No pegues cientos de líneas del código.

Toda la información detallada debe quedar dentro del repositorio.

---

# 289. PRINCIPIO FINAL DE NODRA

Cada decisión debe responder a:

> ¿Esto facilita que una organización coordine personas sin depender de mensajes manuales?

Si la respuesta es sí:

probablemente pertenece a Nodra.

Si la respuesta es:

> esto convierte Nodra en un ERP gigantesco

probablemente no pertenece todavía al producto.

---

# 290. PRINCIPIO FINAL DE ARQUITECTURA

Construye una base:

```text
simple de ejecutar hoy
+
barata de operar mañana
+
escalable si crece
+
modular
+
bien documentada
+
sin dependencias comerciales obligatorias
```

No optimices para una startup imaginaria de millones de usuarios.

Tampoco construyas un prototipo que haya que tirar cuando aparezca el primer cliente.

Construye el punto intermedio correcto.

---

# COMIENZA AHORA

Empieza inspeccionando el repositorio y leyendo completamente el Design MD.

Después crea o actualiza:

```text
PROJECT_STATE.md
NEXT_TODOS.md
AGENTS.md
```

antes de entrar en una implementación larga, de forma que el estado inicial del proyecto ya quede registrado.

Después trabaja siguiendo los IDs `NOD-*`, implementando primero la infraestructura y la vertical funcional.

No solicites confirmación por decisiones menores.

Toma decisiones técnicas razonables dentro de estas restricciones y documéntalas.

Cuando una decisión pueda introducir coste, lock-in significativo o cambiar de forma importante la dirección del producto:

NO la tomes silenciosamente.

Déjala documentada como decisión pendiente.

El objetivo final de esta primera ejecución es que **Nodra deje de ser una idea y se convierta en un proyecto real, ejecutable, documentado y preparado para continuar**.
