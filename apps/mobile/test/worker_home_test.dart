import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nodra/core/api.dart';
import 'package:nodra/core/services.dart';
import 'package:nodra/core/session.dart';
import 'package:nodra/design/theme.dart';
import 'package:nodra/screens/worker_home.dart';

const session = SessionState(
  user: {'id': 'worker', 'firstName': 'Ana'},
  organizationId: 'org',
);

class HomeSession extends SessionController {
  @override
  Future<SessionState> build() async => session;
  @override
  Future<void> select(String id) async =>
      state = AsyncData(SessionState(user: session.user, organizationId: id));
}

Json item(String title) => {
  'id': title,
  'title': title,
  'status': 'OPEN',
  'timezone': 'Europe/Madrid',
  'localStartDay': '2026-10-01',
  'localStartTime': '09:00',
};

void main() {
  testWidgets(
    'home paginates global attention separately and removes an acknowledged notice',
    (tester) async {
      final requests = <Uri>[];
      var acknowledged = false;
      final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
      client.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            final uri = options.uri;
            requests.add(uri);
            Json data;
            if (options.method == 'POST') {
              expect(uri.path, '/organizations/org/notices/notice/acknowledge');
              acknowledged = true;
              data = {};
            } else if (uri.path.endsWith('/notices')) {
              expect(uri.queryParameters['pendingAcknowledgement'], 'true');
              data = {
                'items': acknowledged
                    ? <Json>[]
                    : [
                        {
                          'id': 'notice',
                          'title': 'Lee el acceso',
                          'body': 'Entrada por la puerta norte.',
                        },
                      ],
                'total': acknowledged ? 0 : 1,
              };
            } else {
              expect(uri.path, '/organizations/org/dashboard');
              final attention = uri.queryParameters['filter'] == 'attention';
              final second = uri.queryParameters['page'] == '2';
              data = {
                'items': [
                  item(
                    attention
                        ? second
                              ? 'Confirmación fuera de la primera página'
                              : 'Primera confirmación'
                        : 'Nuevo servicio disponible',
                  ),
                ],
                'total': attention ? 6 : 1,
              };
            }
            handler.resolve(
              Response(requestOptions: options, statusCode: 200, data: data),
            );
          },
        ),
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiProvider.overrideWithValue(NodraApi(client: client)),
            sessionProvider.overrideWith(HomeSession.new),
          ],
          child: MaterialApp(
            theme: nodraTheme(),
            home: const Scaffold(
              body: SingleChildScrollView(child: WorkerHome(session: session)),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Primera confirmación'), findsOneWidget);
      await tester.ensureVisible(find.text('Siguiente'));
      await tester.tap(find.text('Siguiente'));
      await tester.pumpAndSettle();
      expect(
        find.text('Confirmación fuera de la primera página'),
        findsOneWidget,
      );
      expect(find.text('Primera confirmación'), findsNothing);
      await tester.ensureVisible(find.text('He leído'));
      await tester.tap(find.text('He leído'));
      await tester.pumpAndSettle();
      expect(find.text('Lee el acceso'), findsNothing);
      expect(find.text('No hay notificaciones pendientes.'), findsOneWidget);
      expect(requests.any((uri) => uri.path.endsWith('/services')), isFalse);
      expect(
        requests
            .where((uri) => uri.queryParameters['filter'] == 'upcoming')
            .every((uri) => uri.queryParameters['page'] == '1'),
        isTrue,
      );
    },
  );

  test('late dashboard response from previous organization cannot replace current data', () async {
    final oldRequest = Completer<void>();
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (options.uri.path.contains('/org/')) await oldRequest.future;
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'items': [],
                'total': 0,
                'organization': options.uri.path.contains('/org/')
                    ? 'org'
                    : 'new',
              },
            ),
          );
        },
      ),
    );
    final container = ProviderContainer(
      overrides: [
        apiProvider.overrideWithValue(NodraApi(client: client)),
        sessionProvider.overrideWith(HomeSession.new),
      ],
    );
    addTearDown(container.dispose);
    await container.read(sessionProvider.future);
    final query = (filter: 'attention', page: 1);
    final subscription = container.listen(dashboardProvider(query), (_, _) {});
    addTearDown(subscription.close);
    await Future<void>.delayed(Duration.zero);
    await container.read(sessionProvider.notifier).select('new');
    expect(
      (await container.read(dashboardProvider(query).future))['organization'],
      'new',
    );
    oldRequest.complete();
    await Future<void>.delayed(Duration.zero);
    expect(
      container.read(dashboardProvider(query)).requireValue['organization'],
      'new',
    );
  });
}
