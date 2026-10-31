// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Spanish Castilian (`es`).
class AppLocalizationsEs extends AppLocalizations {
  AppLocalizationsEs([String locale = 'es']) : super(locale);

  @override
  String get navHome => 'Inicio';

  @override
  String get navServices => 'Servicios';

  @override
  String get navNotices => 'Avisos';

  @override
  String get navCalendar => 'Calendario';

  @override
  String get navProfile => 'Perfil';

  @override
  String get actionRefresh => 'Actualizar';

  @override
  String get labelOrganization => 'Tu organización';

  @override
  String get logoutTitle => '¿Cerrar sesión?';

  @override
  String get logoutBody =>
      'Tendrás que volver a introducir tus datos para entrar en este dispositivo.';

  @override
  String get logoutStay => 'Seguir aquí';

  @override
  String get logoutConfirm => 'Cerrar sesión';
}
