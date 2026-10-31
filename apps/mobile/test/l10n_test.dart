import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nodra/core/session.dart';
import 'package:nodra/l10n/app_localizations.dart';
import 'package:nodra/main.dart';
import 'package:nodra/screens/auth.dart';

class _SignedOutSession extends SessionController {
  @override
  Future<SessionState> build() async => const SessionState();
}

void main() {
  testWidgets('Spanish app copy and native Material controls share a locale', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [sessionProvider.overrideWith(_SignedOutSession.new)],
        child: const NodraApp(),
      ),
    );
    await tester.pumpAndSettle();

    final context = tester.element(find.byType(AuthScreen));
    expect(Localizations.localeOf(context).languageCode, 'es');
    expect(AppLocalizations.of(context).navHome, 'Inicio');
    expect(MaterialLocalizations.of(context).cancelButtonLabel, 'Cancelar');
  });
}
