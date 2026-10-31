# Producto

Estado: primera vertical implementada; ampliaciones señaladas como pendientes.

Nodra sustituye la coordinación dispersa de servicios entre mensajes y hojas de cálculo por un flujo con responsabilidad y respuesta explícitas. Sirve a organizaciones privadas y a personas que pueden pertenecer a varias organizaciones con permisos distintos.

## Flujo

Una organización define roles operativos y publica un servicio con fechas, ubicación y posiciones. Una persona expresa interés sin ocupar capacidad. Un coordinador selecciona participantes; cada seleccionado confirma o declina. La cancelación conserva historial, actualiza asignaciones activas y registra un evento para el equipo. La cancelación es válida en todos los estados anteriores a COMPLETED; completado y cancelado son terminales. Interés, asignación y confirmación son conceptos separados.

Al seleccionar a una persona, la API advierte si tiene otra asignación confirmada que se solapa en el calendario, incluso si pertenece a otra organización. La advertencia no bloquea la selección y no revela datos del otro tenant. Dos servicios contiguos por hora no se consideran solapados.

PermissionRole gobierna administración; JobRole describe la función de una posición. No se confunden permisos con profesión. Groups reúne Memberships de la misma organización. Notices comunica información interna y puede exigir acuse de lectura.

## Límites

No existe un directorio público de personas, contratación abierta, pujas ni intermediación. No se procesan pagos, nóminas o facturas. Compensación, cuando aparece, es un dato informativo, nunca una transacción.

El MVP prioriza autenticar, crear/unirse a organizaciones, publicar servicios, interesarse, seleccionar y confirmar desde web/móvil. Grupos y avisos tienen base funcional; targeting avanzado, disponibilidad, campos personalizados y documentos pertenecen a etapas posteriores. La portada consulta totales completos por organización y pagina próximos, borradores y pendientes; los miembros sólo ven sus propias confirmaciones pendientes.

La referencia visual vigente es clara y está en design.md. El vocabulario de producto es neutral y no presupone un sector.

Avisos: el MVP se limita explícitamente a difusión de toda la organización. No hay targeting por grupo. Prueba PostgreSQL comprueba que los dos miembros reciben el mismo aviso, cada MEMBER sólo recibe su propia confirmación y OWNER ve ambos acuses. Web y Flutter incluyen lectura/acuse; la prueba automatizada real de UI en dispositivos queda pendiente.
