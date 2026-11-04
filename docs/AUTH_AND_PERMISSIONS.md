# Autenticación y permisos

Registro/login internos. Contraseñas Argon2id, sin proveedor de identidad externo. Access JWT de 15 minutos; sesión activa comprobada en cada solicitud protegida. Refresh de 30 días con hash persistido y rotación. Reutilizar refresh revoca la familia; cambiar contraseña revoca sesiones. Logout revoca la familia asociada al refresh recibido, sin cerrar otros inicios de sesión independientes.

El email de registro y login se recorta y pasa a minúsculas antes de comprobar su formato y consultar la clave única. El login verifica un hash Argon2id también cuando el correo no existe; una cuenta inactiva, una contraseña incorrecta y un correo inexistente devuelven el mismo código y mensaje públicos. La prueba integrada comprueba esos tres casos y que no se crean sesiones. Esto reduce una diferencia de tiempo evidente, sin garantizar tiempo constante para toda la petición. El registro duplicado sigue devolviendo 409 y puede revelar que un correo ya existe; NOD-005 permanece en REVIEW.

La API y web incluyen solicitud y consumo de recuperación de contraseña y verificación de email. Registrar una cuenta encola un enlace de verificación; un usuario autenticado puede pedir otro. Solicitar recuperación devuelve la misma respuesta aunque el correo no exista. Cada acción tiene un token aleatorio de un solo uso: la base conserva su hash y una copia cifrada temporal para que el worker local entregue el enlace mediante MailProvider. Tras entregar o descartar el correo se borra esa copia cifrada. Los enlaces llevan el token en el fragmento URL y la web exige acción explícita antes de consumirlo. Restablecer la contraseña revoca las sesiones. Flutter permite solicitar y consumir los enlaces de recuperación y verificación mediante pegado explícito; en Perfil recarga el estado de correo después de verificar. Abrir el enlace directamente desde el correo continúa llevando a la web mientras no exista un deep link de producción. Las pruebas PostgreSQL cubren entrega, consumo único, replay, expiración y reintento; una prueba opt-in verificó SMTP real con Mailpit. Falta el recorrido desde un correo abierto en un dispositivo móvil.

Web conserva tokens en cookies HttpOnly SameSite Strict y valida Origin en BFF. Si SharedWorker está disponible, el transporte comparte renovación y cambios de sesión entre las pestañas participantes del mismo origen y partición del navegador. Móvil usa FlutterSecureStorage y Dio con refresh compartido. Tokens no pertenecen a localStorage.

El transporte web captura una generación local por petición. Antes de intentar login, registro, logout, cambio o restablecimiento de contraseña, invalida esa generación y aborta sus peticiones. Respuestas, errores y 401 tardíos no pueden entregar datos ni reintentar operaciones con la cuenta nueva. El cambio de sesión espera una renovación conocida en curso antes de enviar su petición, y bloquea otras peticiones de la pestaña hasta terminar. Cambiar contraseña conserva su renovación ante un 401; las subidas JPEG comparten el mismo transporte y admiten una renovación y un reintento dentro de la generación vigente.

El coordinador web añade una generación compartida y una revisión de renovación. Dos 401 de la misma revisión comparten un refresh; un 401 tardío no vuelve a rotar credenciales ya renovadas. Un cambio de autenticación invalida las peticiones anteriores antes de enviarse, espera el refresh conocido y recarga las otras pestañas participantes. La pestaña nueva espera a que termine la transición. El documento antiguo no adopta la cuenta nueva ni reenvía su operación con ella. El worker usa las cookies del navegador y no almacena tokens ni contraseñas.

Si SharedWorker no existe o su constructor falla, el documento conserva el transporte por pestaña. Una conexión compartida ya iniciada que falla exige recargar; no cambia silenciosamente a peticiones independientes. La garantía entre pestañas requiere que todas usen el coordinador del mismo origen y partición; clientes antiguos, HTTP directo y navegadores sin esta capacidad quedan fuera. No se certifican cierres abruptos del navegador, compatibilidad en dispositivos ni el orden de respuestas que eludan este transporte. Tampoco se revierten operaciones que el servidor ya haya aceptado. La autorización efectiva sigue siendo la sesión y Membership del backend. Ver [ADR-015](DECISIONS.md#adr-015--coordinación-web-entre-pestañas).

## Permisos

La fuente de verdad es packages/shared/src/index.ts (permits) y organizations/policy.ts. OWNER y ADMIN administran equipo; COORDINATOR opera servicios; MEMBER participa. Consultar la matriz ejecutable antes de ampliar un endpoint. JobRole nunca concede un permiso administrativo. Cada organización puede asignar un PermissionRole diferente al mismo User.

| Membership role | read | operate | team | settings |
| --------------- | ---- | ------- | ---- | -------- |
| OWNER           | ✓    | ✓       | ✓    | ✓        |
| ADMIN           | ✓    | ✓       | ✓    | ✓        |
| COORDINATOR     | ✓    | ✓       | —    | —        |
| MEMBER          | ✓    | —       | —    | —        |

La matriz define las 16 combinaciones role/permission. La prueba unitaria que las recorría se retiró al reducir la suite; la evidencia histórica está en TESTING. El caso esencial actual contrasta las 47 operaciones tenant con OpenAPI y comprueba rechazo sin sesión o Membership activa, también para ADMIN suspendido/dado de baja. Los casos de personalización y logo conservan verificaciones de permisos activos en sus operaciones.

Los acuses de lectura de Avisos se limitan a la Membership activa en la organización solicitada. OWNER, ADMIN y COORDINATOR reciben los nombres de quienes confirmaron dentro de ese tenant; MEMBER recibe exclusivamente su propio acuse, sin nombres ajenos. No se devuelven correos en el listado de acuses.

Policy valida UUID, busca Membership por organizationId/userId y exige ACTIVE. Las escrituras sensibles vuelven a comprobar autorización dentro de la transacción. No basta con ocultar botones.

GET /organizations/:org/settings exige el permiso settings: sólo OWNER/ADMIN de esa organización. La pantalla web «Configuración» contiene opciones personales y permanece accesible a todos los roles; no consulta ese endpoint. Una integración con la misma cuenta OWNER en un tenant y COORDINATOR en otro verifica que el permiso se toma de la Membership del tenant solicitado.

## Invitación

OWNER y ADMIN pueden crear una invitación con enlace y código numérico de 12 cifras. Son dos credenciales de la misma invitación: se muestran sólo al crearla y se guardan únicamente sus hashes. El código, de menor entropía que el enlace, se guarda como HMAC-SHA-256 con la clave local del servidor; al rotar esa clave, los códigos pendientes dejan de funcionar y deben emitirse de nuevo. El código se puede introducir manualmente, con o sin espacios entre bloques de cuatro cifras. Preview requiere sesión y muestra la organización antes de entrar; accept comprueba expiración, revocación, usos y Membership previa. Ambas credenciales comparten el límite de usos y el consumo/alta de Membership es atómico. Revocar invalida las dos. COORDINATOR y MEMBER no pueden emitir invitaciones. Preview y accept tienen limitación de intentos por IP; el código no se registra en logs.

Pendientes: apertura directa de enlaces en Flutter desde el correo, edición de otros campos del perfil y transferencia de propiedad en un flujo dedicado. emailVerifiedAt sólo se fija al consumir correctamente el token. No implementar cambios que permitan dejar una organización sin propietario.

## Revocación de sesiones

La rotación de refresh se ejecuta en una transacción serializable. Si se detecta la reutilización de un refresh consumido, se revoca la familia completa, incluido el token que haya ganado una carrera simultánea. Cambiar la contraseña invalida todas las sesiones activas de la cuenta; la sesión actual también requiere volver a iniciar sesión. La integración PostgreSQL prueba reutilización secuencial y concurrente, acceso rechazado con los JWT previos, credencial antigua inválida y credencial nueva válida. El logout idempotente se verifica sin afectar sesiones de otras familias. Vencimiento de refresh y cuenta desactivada también tienen pruebas PostgreSQL.

## Edición de acceso (22/09)

PATCH organizations/:org/members/:id recibe permissionRole, status, expectedPermissionRole y expectedStatus. OWNER puede gestionar todos los roles. ADMIN sólo COORDINATOR/MEMBER y no puede cambiar OWNER/ADMIN. Estado editable: ACTIVE/SUSPENDED/LEFT. El backend rechaza referencias de otro tenant, cambios basados en valores obsoletos y retirar al último propietario activo. No permite dar propiedad activa a una cuenta global desactivada. Cuenta propietarios activos dentro de transacción serializable; reintenta conflictos de Prisma y del adapter pg, también al commit.

La edición web tiene etiquetas, estado busy y confirmación antes de guardar. Suspender o dar de baja retira acceso sin cancelar asignaciones ni borrar historial; la interfaz lo explica. La API comprueba Membership en cada petición posterior. Pasar a LEFT desde otro estado registra MEMBER_REMOVED; el resto de cambios genera MEMBERSHIP_UPDATED. No es una eliminación de cuenta.

Privacidad de participación: MEMBER recibe únicamente sus propias asignaciones tanto en listado de servicios (incluido upcoming=true) como en detalle. La coordinación conserva las asignaciones del equipo. La cobertura del dashboard sigue siendo agregada. Prueba PostgreSQL verifica ausencia de UUID de otro usuario y su asignación, además de conservar ambos registros visibles para OWNER.

## Perfil propio (23/09/2026)

El usuario autenticado puede modificar su nombre y apellidos y reemplazar su foto. Email, rol, Membership y zona horaria no se editan desde Perfil. El endpoint de foto siempre usa la identidad del token, sin aceptar identificadores de terceros. La mención histórica a «edición completa de perfil» como pendiente se refiere a otros campos y flujos.

Para mostrar participantes en servicios existe una ruta distinta, GET /organizations/:org/users/:id/avatar. Requiere Membership activa del solicitante en el tenant; sólo coordinación (`operate`) puede leer la foto de otra persona, y el objetivo debe pertenecer a esa organización. La foto propia también se puede consultar desde esa ruta con permiso `read`. La integración verifica acceso propio, coordinación, rechazo de MEMBER para una foto ajena y rechazo de un id de otro tenant.

02/10 — Avisos dirigidos: OWNER/ADMIN/COORDINATOR buscan destinatarios y publican para organización/personas; sólo el backend resuelve Membership activas del tenant. MEMBER únicamente consulta los avisos recibidos y su propio acuse. Operadores pueden revisar publicaciones y acuses del tenant, pero no confirmar lectura si no son destinatarios. Suspensión/baja sigue impidiendo acceso y entrega; reactivación recupera los avisos de su snapshot, sin añadir publicaciones de su ausencia. Legacy audienceVersion=0 conserva difusión anterior. NoticeRecipient usa FKs compuestas Notice/Organization y Membership/Organization.

31/10 — OWNER/ADMIN pueden editar nombre y zona IANA mediante PATCH organizations/:org. Policy settings y comprobación del snapshot expected ocurren dentro de la misma transacción Serializable que escribe ORGANIZATION_UPDATED. COORDINATOR/MEMBER, suspendidos y usuarios de otro tenant no pueden editar. No se modifica el slug ni se desplazan instantes UTC de servicios.

02/11 — Cliente Flutter: generaciones de sesión descartan respuestas antiguas y evitan reintentar una petición anterior con credenciales de otra cuenta. Los tokens y la selección de organización se persisten mediante una cola local ordenada. Logout limpia primero el estado y los datos locales y después intenta revocar la familia del refresh capturado antes del cierre. Si la red no permite revocarla, el cierre local sigue efectivo, pero no se afirma revocación remota: se mantiene el vencimiento del servidor. El aislamiento y la autorización reales siguen comprobándose por Membership en el backend.

03/11 — Chat de servicio: abrirlo exige operate y feature chat dentro de la transacción. Si ya existe, incluye al operador solicitante además de los confirmados activos, deduplica participantes y restaura sólo su visibilidad. Ser COORDINATOR no permite leer directamente un chat del que todavía no se participa: debe abrirlo mediante la acción autorizada del servicio. MEMBER recibe 403 en esa acción. No cambia la privacidad de chats manuales.

04/11 — Matriz de roles activos conservada en el caso esencial de personalización: OWNER/ADMIN/COORDINATOR/MEMBER, ocho operaciones HTTP por rol, 32 peticiones. Servicios/avisos legibles por todos; creación de servicio/rol/aviso para los tres operativos; equipo/ajustes/invitaciones sólo OWNER/ADMIN. Recuentos finales de roles/avisos/servicios/invitaciones = 3/3/3/2, sin creaciones por peticiones rechazadas. Expectativas literales independientes de permits. Trece integraciones y lint aprobados; no se añaden casos a la suite de veinte ni se cambia runtime.
