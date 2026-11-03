import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/session.dart';
import 'l10n/app_localizations.dart';
import 'design/theme.dart';
import 'core/organization_customization.dart';
import 'design/organization_presentation.dart';
import 'design/widgets.dart';
import 'screens/auth.dart';
import 'screens/home.dart';
import 'screens/service.dart';
import 'screens/chat.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: NodraApp()));
}

final routerProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (context, state) => const SessionGate()),
      GoRoute(
        path: '/chats',
        builder: (context, state) => const ChatRouteScreen(),
      ),
      GoRoute(
        path: '/chats/:id',
        builder: (context, state) =>
            ChatRouteScreen(chatId: state.pathParameters['id']),
      ),
      GoRoute(
        path: '/services/:id',
        builder: (context, state) =>
            ServiceScreen(id: state.pathParameters['id']!),
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});

class NodraApp extends ConsumerWidget {
  const NodraApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final customization =
        ref.watch(sessionProvider).asData?.value.customization ??
        OrganizationCustomization.defaults;
    return MaterialApp.router(
      title: 'Nodra',
      debugShowCheckedModeBanner: false,
      theme: nodraTheme(accent: customization.accent),
      builder: (context, child) => OrganizationPresentation(
        value: customization,
        child: child ?? const SizedBox.shrink(),
      ),
      locale: const Locale('es'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: ref.watch(routerProvider),
    );
  }
}

class SessionGate extends ConsumerWidget {
  const SessionGate({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(sessionProvider)
      .when(
        loading: () =>
            const Scaffold(body: Center(child: CircularProgressIndicator())),
        error: (error, _) => Scaffold(
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: NodraError(
                message: error.toString(),
                retry: () => ref.invalidate(sessionProvider),
              ),
            ),
          ),
        ),
        data: (session) => session.signedIn
            ? HomeScreen(
                key: ValueKey(session.organizationId),
                session: session,
              )
            : const AuthScreen(),
      );
}
