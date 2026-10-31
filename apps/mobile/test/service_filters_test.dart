import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nodra/core/api.dart';
import 'package:nodra/core/session.dart';
import 'package:nodra/core/services.dart';
import 'package:nodra/screens/service_filters.dart';

class FilterSession extends SessionController {
  @override
  Future<SessionState> build() async =>
      const SessionState(organizationId: 'org');
  void switchOrg() =>
      state = const AsyncData(SessionState(organizationId: 'other'));
}

void main() {
  testWidgets('invalid date interval blocks application until cleared', (
    tester,
  ) async {
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          handler.resolve(
            Response(requestOptions: options, data: {'items': [], 'total': 0}),
          );
        },
      ),
    );
    final container = ProviderContainer(
      overrides: [
        sessionProvider.overrideWith(FilterSession.new),
        apiProvider.overrideWithValue(NodraApi(client: dio)),
      ],
    );
    await container.read(sessionProvider.future);
    final applied = <ServicesQuery>[];
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ServiceFilters(
                org: 'org',
                timezone: 'Europe/Madrid',
                initial: (
                  page: 1,
                  search: '',
                  status: '',
                  jobRoleId: '',
                  from: '2026-10-25T01:30:00Z',
                  to: '2026-10-25T00:30:00Z',
                ),
                onApply: applied.add,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Filtrar servicios'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Aplicar filtros'));
    await tester.tap(find.text('Aplicar filtros'));
    await tester.pumpAndSettle();
    expect(applied, isEmpty);
    expect(
      find.text('La fecha hasta debe ser posterior a la fecha desde.'),
      findsOneWidget,
    );
    await tester.ensureVisible(find.text('Limpiar filtros'));
    await tester.tap(find.text('Limpiar filtros'));
    await tester.pumpAndSettle();
    expect(applied.single.from, '');
    expect(applied.single.to, '');
    await tester.pumpWidget(const SizedBox());
    container.dispose();
    dio.close();
  });
  test(
    'service query combines encoded filters and reloads under the new tenant',
    () async {
      final requests = <Uri>[];
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options.uri);
            handler.resolve(
              Response(
                requestOptions: options,
                data: {'items': [], 'total': 0},
              ),
            );
          },
        ),
      );
      final container = ProviderContainer(
        overrides: [
          sessionProvider.overrideWith(FilterSession.new),
          apiProvider.overrideWithValue(NodraApi(client: dio)),
        ],
      );
      await container.read(sessionProvider.future);
      const query = (
        page: 2,
        search: 'Montaje & apoyo',
        status: 'OPEN',
        jobRoleId: 'role',
        from: '2026-10-25T00:30:23.456Z',
        to: '2026-10-25T01:30:23.456Z',
      );
      final subscription = container.listen(servicesProvider(query), (_, _) {});
      await container.read(servicesProvider(query).future);
      expect(requests.single.path, '/organizations/org/services');
      expect(requests.single.queryParameters, {
        'page': '2',
        'search': 'Montaje & apoyo',
        'status': 'OPEN',
        'jobRoleId': 'role',
        'from': '2026-10-25T00:30:23.456Z',
        'to': '2026-10-25T01:30:23.456Z',
      });
      (container.read(sessionProvider.notifier) as FilterSession).switchOrg();
      await container.read(servicesProvider(query).future);
      expect(requests.last.path, '/organizations/other/services');
      subscription.close();
      container.dispose();
      dio.close();
    },
  );
  testWidgets(
    'filters restore selection, apply from page one and clear explicitly',
    (tester) async {
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            expect(options.uri.path, '/organizations/org/roles/catalog');
            handler.resolve(
              Response(
                requestOptions: options,
                data: {
                  'items': [
                    {'id': 'role', 'name': 'Apoyo', 'active': false},
                  ],
                  'total': 1,
                },
              ),
            );
          },
        ),
      );
      final container = ProviderContainer(
        overrides: [
          sessionProvider.overrideWith(FilterSession.new),
          apiProvider.overrideWithValue(NodraApi(client: dio)),
        ],
      );
      await container.read(sessionProvider.future);
      final applied = <ServicesQuery>[];
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: ServiceFilters(
                  org: 'org',
                  timezone: 'Europe/Madrid',
                  initial: (
                    page: 4,
                    search: 'Montaje',
                    status: 'OPEN',
                    jobRoleId: 'role',
                    from: '2026-10-25T00:30:23.456Z',
                    to: '2026-10-25T01:30:23.456Z',
                  ),
                  onApply: applied.add,
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Filtrar servicios'));
      await tester.pumpAndSettle();
      expect(find.text('Apoyo · Archivado'), findsWidgets);
      final apply = find.text('Aplicar filtros');
      await tester.ensureVisible(apply);
      await tester.tap(apply);
      await tester.pumpAndSettle();
      expect(applied.single, (
        page: 1,
        search: 'Montaje',
        status: 'OPEN',
        jobRoleId: 'role',
        from: '2026-10-25T00:30:23.456Z',
        to: '2026-10-25T01:30:23.456Z',
      ));
      await tester.tap(find.text('Limpiar filtros'));
      await tester.pumpAndSettle();
      expect(applied.last, (
        page: 1,
        search: '',
        status: '',
        jobRoleId: '',
        from: '',
        to: '',
      ));
      await tester.pumpWidget(const SizedBox());
      container.dispose();
      dio.close();
    },
  );
}
