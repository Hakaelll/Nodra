# Nodra para Android e iOS

Cliente Flutter del monorepo Nodra. Comparte la API y sus permisos con la web: el servidor comprueba la Membership y el rol en cada operación. La app guarda la sesión en el almacenamiento seguro del dispositivo y permite trabajar con servicios, calendario, avisos y perfil.

## Requisitos y arranque local

1. Arranca PostgreSQL, la API y, para los correos, el worker y Mailpit siguiendo el [README de la raíz](../../README.md) y [desarrollo local](../../docs/DEVELOPMENT.md). Comprueba `http://localhost:4000/health/ready`.
2. Instala Flutter 3.47.5 con Dart 3.13.4. Android necesita además JDK y Android SDK compatibles; iOS necesita macOS y Xcode. Ejecuta `flutter doctor -v` para ver lo que falta en tu equipo.
3. Desde `apps/mobile`, ejecuta:

   ```sh
   flutter pub get
   flutter analyze
   flutter test
   flutter run --dart-define=API_URL=http://10.0.2.2:4000/api/v1
   ```

`10.0.2.2` apunta al host desde el emulador Android. En un simulador iOS sobre macOS, usa `http://localhost:4000/api/v1` en `API_URL`. La dirección por defecto del código es la del emulador Android, así que define siempre `API_URL` al usar otro entorno. El tráfico HTTP sin cifrar está permitido sólo en la configuración Android de **debug**; una distribución real requiere HTTPS y configuración de firma.

Para un teléfono **Android en modo debug** conectado a la misma red privada, configura `API_BIND_HOST=0.0.0.0` al arrancar la API y restringe el puerto 4000 a la subred local en el firewall. Ejecuta `flutter run --dart-define=API_URL=http://<IP-del-ordenador>:4000/api/v1`. El manifiesto Android sólo permite HTTP sin cifrar en debug; no uses esta configuración en una red pública ni en una distribución. La web del puerto 3000 no expone por sí sola la API móvil. El acceso desde un segundo dispositivo aún requiere una prueba física; iOS y cualquier distribución necesitan HTTPS y su configuración de plataforma.

## Estructura y funciones

- `lib/core`: cliente REST, sesión, tokens, contexto de organización y modelos.
- `lib/screens`: acceso, inicio, servicios, calendario, avisos y perfil.
- `lib/design`: tema y controles compartidos.
- `test`: pruebas de lógica y widgets. Los tests no sustituyen una ejecución en emulador o dispositivo.

La navegación principal está abajo. La tarjeta completa abre el servicio y distingue inscripción, selección, confirmación y cancelación. El calendario agrupa los eventos por día con horarios de la zona de la organización y un color estable por evento; los cancelados conservan su historial con una presentación gris. En Perfil se editan nombre y apellidos, se elige una foto del dispositivo y se ajusta con recorte circular antes de subirla. La salida pide confirmación centrada. Los enlaces de verificación y recuperación recibidos por correo pueden pegarse en la app; abrirlos directamente desde el correo todavía lleva a la web.

La interfaz usa español como único idioma soportado por ahora. `lib/l10n/app_es.arb` es la fuente de los textos de navegación y salida; Flutter genera `AppLocalizations` con `flutter gen-l10n` y localiza los controles Material/Cupertino. Para añadir otro idioma, agregar su ARB y migrar los textos restantes antes de incluirlo en las locales soportadas. La prueba específica `l10n_test.dart` se retiró al reducir la suite el 31/10; su resultado previo es histórico. La prueba esencial de recuperación sigue configurando explícitamente el locale español.

## Estado de validación

03/11: Flutter aplica terminología/acento de la Membership activa y recupera defaults al salir o ante datos incompatibles. La edición administrativa está en la web. Analyze --no-pub y las tres pruebas esenciales pasan, con aserciones de configuración tras cambios de cuenta/organización. APK debug actualizado para la API LAN, firma v2 verificada; no ejecución física ni build iOS. Evidencia y hash en TESTING. No CI/CD de GitHub configurado.

## Historial de validación

El 02/10/2026 se compiló el primer APK **debug** en Windows con Flutter local, JDK 21 y Android SDK/NDK. `apksigner verify --verbose` comprobó su firma v2 y `aapt2 dump badging` confirmó paquete `dev.nodra.nodra`, Android mínimo 24, target 36 y arquitecturas arm64-v8a, armeabi-v7a y x86_64. El archivo queda en `build/app/outputs/flutter-apk/app-debug.apk` (ignorado por Git), configurado para `http://192.168.1.133:4000/api/v1`; no se ha instalado ni recorrido en un teléfono. Para reproducirlo, usar los scripts PowerShell de [DEVELOPMENT.md](../../docs/DEVELOPMENT.md).

`flutter analyze` y 43 tests Flutter pasaron en la revisión anterior; no se repitieron por preparar el entorno de build. No se ha hecho un build iOS, que requiere macOS/Xcode, ni una distribución Android release. El workflow de GitHub que ejecutaba análisis/tests fue retirado el 31/10 por instrucción del propietario; se conservan verificaciones locales. Las comprobaciones pendientes y sus límites están en [TESTING.md](../../docs/TESTING.md); el comportamiento móvil se documenta en [MOBILE_APP.md](../../docs/MOBILE_APP.md).
Chat: acceso desde cabecera con contador de conversaciones sin leer, creación individual/grupo o desde servicio confirmado, historial cronológico y reintentos idempotentes. Sin push ni adjuntos; la prueba en dispositivo queda pendiente.

El 02/11 se recompiló y verificó la firma del APK debug con la corrección de sesiones concurrentes. `flutter analyze --no-pub` y las tres pruebas esenciales Flutter pasaron. Se descartan respuestas antiguas al cambiar de cuenta y se ordena la persistencia de la organización seleccionada. Detalles y límites de cierre local/remoto en [MOBILE_APP](../../docs/MOBILE_APP.md). No se ha probado este APK en hardware ni se ha compilado iOS.

04/11 — Preparación iOS: flutter_secure_storage_darwin 0.4.3 exige Keychain Sharing en su README instalado. Añadidos DebugProfile.entitlements y Release.entitlements con keychain-access-groups vacío, enlazados por CODE_SIGN_ENTITLEMENTS en las tres configuraciones Runner. No se configuran App Groups ni credenciales de firma. XML y mapeo Debug/Profile/Release comprobados estáticamente; falta compilar y probar persistencia de tokens en macOS/iOS. La ausencia de Podfile en Windows es prevista: setupPodfile del SDK Flutter instalado lo genera cuando Xcode está disponible.
