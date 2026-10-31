import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:nodra/core/account_action.dart';
import 'package:nodra/core/api.dart';
import 'package:nodra/core/session.dart';
import 'package:nodra/design/theme.dart';
import 'package:nodra/design/widgets.dart';
import 'package:nodra/screens/auth.dart';
import 'package:nodra/screens/calendar.dart';
import 'package:nodra/screens/home.dart';

void main() {
  test('network errors retain a clear offline explanation', () {
    final failure = ApiFailure.from(
      DioException(
        requestOptions: RequestOptions(path: '/services'),
        type: DioExceptionType.connectionError,
      ),
    );
    expect(failure.message, contains('Tu sesión se conserva'));
    expect(failure.unauthorized, isFalse);
  });
  test('rate limit errors never appear as an offline failure', () {
    final failure = ApiFailure.from(
      DioException(
        requestOptions: RequestOptions(path: '/auth/login'),
        response: Response(
          requestOptions: RequestOptions(path: '/auth/login'),
          statusCode: 429,
          data: '<html>rate limited</html>',
        ),
        type: DioExceptionType.badResponse,
      ),
    );
    expect(failure.message, contains('Demasiados intentos'));
    expect(failure.message, isNot(contains('Sin conexión')));
  });
  test('service dates use organization wall time instead of device time', () {
    final service = <String, dynamic>{
      'localStartDay': '2027-03-28',
      'localStartTime': '01:30',
      'localEndDay': '2027-03-28',
      'localEndTime': '04:30',
      'timezone': 'Europe/Madrid',
    };
    expect(formatServiceDate(service), '28/03 · 01:30');
    expect(formatServiceEndDate(service), '28/03 · 04:30');
  });
  test('service list names enrollment and selection independently of service status', () {
    final service = <String, dynamic>{
      'status': 'SELECTION',
      'positions': [
        <String, dynamic>{
          'assignments': <Map<String, dynamic>>[],
          'interests': [
            <String, dynamic>{'userId': 'me', 'status': 'INTERESTED'},
          ],
        },
      ],
    };
    expect(serviceParticipation(service, 'me'), 'Inscrito · en selección');
    (service['positions'] as List).first['assignments'] = [
      <String, dynamic>{'userId': 'me', 'status': 'CONFIRMED'},
    ];
    expect(serviceParticipation(service, 'me'), 'Participación confirmada');
  });
  test('selected organization never leaks another membership', () {
    const session = SessionState(
      organizationId: 'b',
      memberships: [
        {
          'organization': {'id': 'a', 'name': 'A'},
        },
        {
          'organization': {'id': 'b', 'name': 'B'},
        },
      ],
    );
    expect(session.organization?['name'], 'B');
    expect(const SessionState().organization, isNull);
  });
  test('calendar includes both local days of an overnight service', () {
    final events = <Json>[
      {
        'id': 'overnight',
        'localStartDay': '2026-09-30',
        'localEndDay': '2026-10-01',
      },
    ];
    expect(calendarEventsForDay(events, '2026-09-30'), hasLength(1));
    expect(calendarEventsForDay(events, '2026-10-01'), hasLength(1));
    expect(calendarEventsForDay(events, '2026-10-02'), isEmpty);
  });
  testWidgets('authentication validates fields before a network request', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(theme: nodraTheme(), home: const AuthScreen()),
      ),
    );
    await tester.ensureVisible(find.text('Entrar en Nodra'));
    await tester.tap(find.text('Entrar en Nodra'));
    await tester.pump();
    expect(find.text('Escribe un email válido.'), findsOneWidget);
    expect(find.text('Utiliza al menos 12 caracteres.'), findsOneWidget);
  });
  testWidgets('recovery only asks for a valid email', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(theme: nodraTheme(), home: const AuthScreen()),
      ),
    );
    await tester.ensureVisible(find.text('He olvidado mi contraseña'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('He olvidado mi contraseña'));
    await tester.pumpAndSettle();
    expect(find.text('Enviar enlace'), findsOneWidget);
    expect(find.text('Contraseña'), findsNothing);
    await tester.tap(find.text('Enviar enlace'));
    await tester.pump();
    expect(find.text('Escribe un email válido.'), findsOneWidget);
  });
  test('recovery normalizes email before sending the public request', () async {
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    String? path, email;
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          path = options.path;
          email = (options.data as Map<String, dynamic>)['email'] as String;
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 201,
              data: {'ok': true},
            ),
          );
        },
      ),
    );
    await NodraApi(client: client)
        .requestPasswordReset('  PERSONA@EJEMPLO.COM  ');
    expect(path, '/auth/reset/request');
    expect(email, 'persona@ejemplo.com');
  });
  test('reset accepts only the token or the reset fragment of a link', () {
    final token = 'a' * 64;
    expect(accountActionToken(token, AccountAction.reset), token);
    expect(
      accountActionToken(
        'https://nodra.test/#reset=$token',
        AccountAction.reset,
      ),
      token,
    );
    expect(
      accountActionToken(
        'https://nodra.test/#verify=$token',
        AccountAction.reset,
      ),
      isNull,
    );
    expect(
      accountActionToken(
        'https://nodra.test/#reset=invalid',
        AccountAction.reset,
      ),
      isNull,
    );
    expect(
      accountActionToken('https://nodra.test/#reset=%ZZ', AccountAction.reset),
      isNull,
    );
  });
  test('mobile completes reset through the public endpoint', () async {
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    String? path;
    Map<String, dynamic>? payload;
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          path = options.path;
          payload = Map<String, dynamic>.from(options.data as Map);
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 201,
              data: {'ok': true},
            ),
          );
        },
      ),
    );
    await NodraApi(client: client)
        .completePasswordReset('a' * 64, 'a new secret 123');
    expect(path, '/auth/reset/complete');
    expect(payload, {'token': 'a' * 64, 'newPassword': 'a new secret 123'});
  });
  testWidgets('reset checks link and matching passwords before submitting', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(theme: nodraTheme(), home: const AuthScreen()),
      ),
    );
    await tester.ensureVisible(find.text('Ya tengo un enlace'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ya tengo un enlace'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Guardar contraseña'));
    await tester.tap(find.text('Guardar contraseña'));
    await tester.pump();
    expect(find.text('Pega un enlace de recuperación válido.'), findsOneWidget);
    expect(find.text('Utiliza al menos 12 caracteres.'), findsOneWidget);
  });
  testWidgets('reset submits once after confirmation and shows the next step', (
    tester,
  ) async {
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    var submissions = 0;
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          submissions++;
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 201,
              data: {'ok': true},
            ),
          );
        },
      ),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiProvider.overrideWithValue(NodraApi(client: client))],
        child: MaterialApp(theme: nodraTheme(), home: const AuthScreen()),
      ),
    );
    await tester.ensureVisible(find.text('Ya tengo un enlace'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ya tengo un enlace'));
    await tester.pumpAndSettle();
    final fields = find.byType(TextFormField);
    await tester.enterText(
      fields.at(0),
      'https://nodra.test/#reset=${'a' * 64}',
    );
    await tester.enterText(fields.at(1), 'new password 123');
    await tester.enterText(fields.at(2), 'different password');
    await tester.ensureVisible(find.text('Guardar contraseña'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar contraseña'));
    await tester.pump();
    expect(find.text('Las contraseñas no coinciden.'), findsOneWidget);
    expect(submissions, 0);
    await tester.enterText(fields.at(2), 'new password 123');
    await tester.tap(find.text('Guardar contraseña'));
    await tester.pumpAndSettle();
    expect(submissions, 1);
    expect(find.text('Contraseña actualizada.'), findsOneWidget);
    expect(find.text('Iniciar sesión'), findsOneWidget);
  });
  testWidgets('confirmation is communicated with text, not only color', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: nodraTheme(),
        home: const Scaffold(body: NodraBadge(status: 'CONFIRMED')),
      ),
    );
    expect(find.text('Confirmado'), findsOneWidget);
  });
}
