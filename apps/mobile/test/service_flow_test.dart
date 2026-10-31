import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nodra/core/api.dart';
import 'package:nodra/core/session.dart';
import 'package:nodra/design/theme.dart';
import 'package:nodra/screens/service.dart';

class ServiceSessionController extends SessionController {
  @override
  Future<SessionState> build() async => const SessionState(
    user: {'id': 'worker', 'firstName': 'Ana', 'lastName': 'Pérez'},
    organizationId: 'org',
    memberships: [
      {
        'permissionRole': 'MEMBER',
        'organization': {'id': 'org', 'name': 'Equipo principal'},
      },
    ],
  );
}

Json serviceFixture({bool interested = false, String? assignmentStatus}) => {
  'id': 'svc',
  'title': 'Servicio de montaje',
  'status': 'OPEN',
  'localStartDay': '2026-09-29',
  'localStartTime': '10:00',
  'localEndDay': '2026-09-29',
  'localEndTime': '18:00',
  'timezone': 'Europe/Madrid',
  'locationText': 'Centro de eventos',
  'description': 'Preparación del espacio.',
  'positions': [
    {
      'id': 'pos',
      'quantity': 1,
      'description': 'Montaje de sala',
      'compensation': null,
      'jobRole': {'name': 'Montaje'},
      'interests': interested
          ? [
              {'userId': 'worker', 'status': 'INTERESTED'},
            ]
          : <Json>[],
      'assignments': assignmentStatus == null
          ? <Json>[]
          : [
              {
                'id': 'assignment',
                'userId': 'worker',
                'status': assignmentStatus,
              },
            ],
    },
  ],
};

void main() {
  testWidgets('worker enrolls and the detail reflects the new interest', (
    tester,
  ) async {
    var interested = false;
    final posts = <String>[];
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path == '/organizations/org/services/svc') {
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: serviceFixture(interested: interested),
              ),
            );
            return;
          }
          posts.add(options.path);
          expect(options.path, '/organizations/org/positions/pos/interest');
          expect(options.data, {'interested': true});
          interested = true;
          handler.resolve(
            Response(requestOptions: options, statusCode: 201, data: {}),
          );
        },
      ),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiProvider.overrideWithValue(NodraApi(client: client)),
          sessionProvider.overrideWith(ServiceSessionController.new),
        ],
        child: MaterialApp(
          theme: nodraTheme(),
          home: const ServiceScreen(id: 'svc'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Inscribirme'));
    await tester.tap(find.text('Inscribirme'));
    await tester.pumpAndSettle();
    expect(posts, ['/organizations/org/positions/pos/interest']);
    expect(find.text('Ya estás inscrito en esta posición'), findsOneWidget);
    expect(find.text('Inscribirme'), findsNothing);
  });

  testWidgets('worker confirms assignment and sees the confirmed state', (
    tester,
  ) async {
    var status = 'AWAITING_CONFIRMATION';
    final posts = <String>[];
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path == '/organizations/org/services/svc') {
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: serviceFixture(
                  interested: true,
                  assignmentStatus: status,
                ),
              ),
            );
            return;
          }
          posts.add(options.path);
          expect(
            options.path,
            '/organizations/org/assignments/assignment/respond',
          );
          expect(options.data, {'response': 'CONFIRMED'});
          status = 'CONFIRMED';
          handler.resolve(
            Response(requestOptions: options, statusCode: 201, data: {}),
          );
        },
      ),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiProvider.overrideWithValue(NodraApi(client: client)),
          sessionProvider.overrideWith(ServiceSessionController.new),
        ],
        child: MaterialApp(
          theme: nodraTheme(),
          home: const ServiceScreen(id: 'svc'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Confirmar participación'));
    await tester.tap(find.text('Confirmar participación'));
    await tester.pumpAndSettle();
    expect(posts, ['/organizations/org/assignments/assignment/respond']);
    expect(find.text('Tu participación está confirmada'), findsOneWidget);
    expect(find.text('Confirmar participación'), findsNothing);
  });
}
