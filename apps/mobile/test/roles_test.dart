import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nodra/core/api.dart';
import 'package:nodra/core/session.dart';
import 'package:nodra/design/theme.dart';
import 'package:nodra/screens/roles.dart';

SessionState fixture(String permission, {String org = 'org'}) => SessionState(
  organizationId: org,
  user: const {'id': 'me'},
  memberships: [
    {
      'permissionRole': permission,
      'organization': {'id': org},
    },
  ],
);

class RoleSession extends SessionController {
  @override
  Future<SessionState> build() async => fixture('OWNER');
  void switchOrg() => state = AsyncData(fixture('OWNER', org: 'other'));
}

class MemberSession extends SessionController {
  @override
  Future<SessionState> build() async => fixture('MEMBER');
}

void main() {
  testWidgets(
    'catalog reaches roles beyond one hundred and recovers a failed search',
    (tester) async {
      final catalog = List.generate(
        105,
        (index) => <String, dynamic>{
          'id': 'role-$index',
          'name': 'Rol ${index.toString().padLeft(3, '0')}',
          'description': '',
          'active': index != 104,
        },
      );
      final reads = <Uri>[];
      var failSearch = true;
      final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
      client.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            final uri = options.uri;
            expect(uri.path, '/organizations/org/roles/catalog');
            expect(uri.queryParameters['limit'], '10');
            reads.add(uri);
            final search = uri.queryParameters['search'] ?? '';
            if (search.isNotEmpty && failSearch) {
              failSearch = false;
              handler.reject(
                DioException(
                  requestOptions: options,
                  type: DioExceptionType.connectionError,
                ),
              );
              return;
            }
            final page = int.parse(uri.queryParameters['page']!);
            final found = catalog
                .where((role) => (role['name'] as String).contains(search))
                .toList();
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'items': found.skip((page - 1) * 10).take(10).toList(),
                  'total': found.length,
                  'page': page,
                  'limit': 10,
                },
              ),
            );
          },
        ),
      );
      final container = ProviderContainer(
        retry: (_, _) => null,
        overrides: [
          sessionProvider.overrideWith(RoleSession.new),
          apiProvider.overrideWithValue(NodraApi(client: client)),
        ],
      );
      await container.read(sessionProvider.future);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            theme: nodraTheme(),
            home: const RolesScreen(organizationId: 'org'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      for (var page = 1; page < 11; page++) {
        await tester.tap(find.text('Siguiente'));
        await tester.pumpAndSettle();
      }
      expect(find.widgetWithText(ListTile, 'Rol 104'), findsOneWidget);
      expect(find.text('Archivado'), findsOneWidget);
      expect(reads.last.queryParameters['page'], '11');
      await tester.enterText(find.byType(TextField).first, 'Rol 104');
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pumpAndSettle();
      expect(find.text('Reintentar'), findsOneWidget);
      expect(reads.last.queryParameters['page'], '1');
      await tester.tap(find.text('Reintentar'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(ListTile, 'Rol 104'), findsOneWidget);
      expect(reads.last.queryParameters['search'], 'Rol 104');
      expect(find.text('Rol 000'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      container.dispose();
      client.close();
    },
  );
  testWidgets(
    'role editor validates names and retries a failed save without losing input',
    (tester) async {
      var role = <String, dynamic>{
        'id': 'role',
        'name': 'Apoyo',
        'description': '',
        'active': true,
      };
      final writes = <Json>[];
      final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
      client.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            if (options.method == 'PATCH') {
              writes.add(Map<String, dynamic>.from(options.data as Map));
              if (writes.length == 1) {
                handler.reject(
                  DioException(
                    requestOptions: options,
                    type: DioExceptionType.connectionError,
                  ),
                );
                return;
              }
              role = {...role, ...writes.last};
            }
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: options.method == 'GET'
                    ? {
                        'items': [role],
                        'total': 1,
                        'page': 1,
                        'limit': 10,
                      }
                    : role,
              ),
            );
          },
        ),
      );
      final container = ProviderContainer(
        overrides: [
          sessionProvider.overrideWith(RoleSession.new),
          apiProvider.overrideWithValue(NodraApi(client: client)),
        ],
      );
      await container.read(sessionProvider.future);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            theme: nodraTheme(),
            home: const RolesScreen(organizationId: 'org'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Apoyo'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).first, ' ');
      await tester.tap(find.text('Guardar cambios'));
      await tester.pumpAndSettle();
      expect(writes, isEmpty);
      expect(find.text('Escribe al menos dos caracteres.'), findsOneWidget);
      await tester.enterText(find.byType(TextFormField).first, '  Montaje  ');
      await tester.enterText(
        find.byType(TextFormField).last,
        'Preparar material',
      );
      await tester.tap(find.text('Guardar cambios'));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      expect(
        (tester.widget(
          find.byType(TextFormField).first,
        ) as TextFormField).controller!.text,
        '  Montaje  ',
      );
      await tester.tap(find.text('Guardar cambios'));
      await tester.pumpAndSettle();
      expect(writes, [
        {'name': 'Montaje', 'description': 'Preparar material'},
        {'name': 'Montaje', 'description': 'Preparar material'},
      ]);
      expect(find.byType(AlertDialog), findsNothing);
      expect(find.text('Montaje'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      container.dispose();
      client.close();
    },
  );
  testWidgets(
    'archive requires confirmation and archived role can be reactivated',
    (tester) async {
      var role = <String, dynamic>{
        'id': 'role',
        'name': 'Apoyo',
        'description': '',
        'active': true,
      };
      final writes = <Json>[];
      final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
      client.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            if (options.method == 'PATCH') {
              expect(options.path, '/organizations/org/roles/role');
              writes.add(Map<String, dynamic>.from(options.data as Map));
              role = {...role, ...writes.last};
            }
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: options.method == 'GET'
                    ? {
                        'items': [role],
                        'total': 1,
                        'page': 1,
                        'limit': 10,
                      }
                    : role,
              ),
            );
          },
        ),
      );
      final container = ProviderContainer(
        overrides: [
          sessionProvider.overrideWith(RoleSession.new),
          apiProvider.overrideWithValue(NodraApi(client: client)),
        ],
      );
      await container.read(sessionProvider.future);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            theme: nodraTheme(),
            home: const RolesScreen(organizationId: 'org'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Opciones del rol'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Archivar'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(writes, isEmpty);
      await tester.tap(find.byTooltip('Opciones del rol'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Archivar'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Archivar rol'));
      await tester.pumpAndSettle();
      expect(writes, [
        {'active': false},
      ]);
      expect(find.text('Archivado'), findsOneWidget);
      await tester.tap(find.byTooltip('Opciones del rol'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Reactivar'));
      await tester.pumpAndSettle();
      expect(writes.last, {'active': true});
      expect(find.text('Archivado'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      container.dispose();
      client.close();
    },
  );
  testWidgets('member cannot open role management or fetch the catalog', (
    tester,
  ) async {
    var requests = 0;
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests++;
          handler.resolve(Response(requestOptions: options, data: []));
        },
      ),
    );
    final container = ProviderContainer(
      retry: (_, _) => null,
      overrides: [
        sessionProvider.overrideWith(MemberSession.new),
        apiProvider.overrideWithValue(NodraApi(client: client)),
      ],
    );
    await container.read(sessionProvider.future);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(home: const RolesScreen(organizationId: 'org')),
      ),
    );
    await tester.pumpAndSettle();
    expect(requests, 0);
    expect(find.text('No tienes acceso a esta organización.'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    container.dispose();
    client.close();
  });
  testWidgets('open editor rejects a save after changing organization', (
    tester,
  ) async {
    var writes = 0;
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.method != 'GET') writes++;
          handler.resolve(
            Response(
              requestOptions: options,
              data: {
                'items': [
                  {
                    'id': 'role',
                    'name': 'Apoyo',
                    'description': '',
                    'active': true,
                  },
                ],
                'total': 1,
                'page': 1,
                'limit': 10,
              },
            ),
          );
        },
      ),
    );
    final container = ProviderContainer(
      overrides: [
        sessionProvider.overrideWith(RoleSession.new),
        apiProvider.overrideWithValue(NodraApi(client: client)),
      ],
    );
    await container.read(sessionProvider.future);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(home: const RolesScreen(organizationId: 'org')),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Apoyo'));
    await tester.pumpAndSettle();
    (container.read(sessionProvider.notifier) as RoleSession).switchOrg();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar cambios'));
    await tester.pumpAndSettle();
    expect(writes, 0);
    expect(
      find.text('No tienes acceso a esta organización.'),
      findsNWidgets(2),
    );
    await tester.pumpWidget(const SizedBox());
    container.dispose();
    client.close();
  });
}
