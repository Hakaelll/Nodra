// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get navHome => 'Home';

  @override
  String get navServices => 'Services';

  @override
  String get navNotices => 'Notices';

  @override
  String get navCalendar => 'Calendar';

  @override
  String get navProfile => 'Profile';

  @override
  String get actionRefresh => 'Refresh';

  @override
  String get labelOrganization => 'Your organization';

  @override
  String get logoutTitle => 'Sign out?';

  @override
  String get logoutBody =>
      'You will need to enter your details again to sign in on this device.';

  @override
  String get logoutStay => 'Stay signed in';

  @override
  String get logoutConfirm => 'Sign out';
}
