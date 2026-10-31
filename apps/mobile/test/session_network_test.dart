import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nodra/core/api.dart';
import 'package:nodra/core/session.dart';
import 'package:nodra/design/theme.dart';
import 'package:nodra/l10n/app_localizations.dart';
import 'package:nodra/main.dart';

const savedTokens = {
  'accessToken': 'test-access-old',
  'refreshToken': 'test-refresh-old',
};
const newTokens = {
  'accessToken': 'test-access-new',
  'refreshToken': 'test-refresh-new',
};
void fail(
  RequestOptions options,
  RequestInterceptorHandler handler,
  int? status,
) {
  handler.reject(
    DioException(
      requestOptions: options,
      type: status == null
          ? DioExceptionType.connectionError
          : DioExceptionType.badResponse,
      response: status == null
          ? null
          : Response(requestOptions: options, statusCode: status),
    ),
  );
}

void succeed(
  RequestOptions options,
  RequestInterceptorHandler handler,
  Object data,
) => handler.resolve(
  Response(requestOptions: options, statusCode: 200, data: data),
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(
    () => FlutterSecureStorage.setMockInitialValues({
      'nodra_session': jsonEncode(savedTokens),
    }),
  );

  testWidgets(
    'cold start offline offers retry and restores the saved session without login',
    (tester) async {
      var online = false;
      final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
      client.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            if (!online) {
              fail(options, handler, null);
              return;
            }
            expect(options.headers['Authorization'], 'Bearer test-access-old');
            if (options.path == '/auth/me') {
              succeed(options, handler, {
                'id': 'me',
                'firstName': 'Ana',
                'lastName': 'Pérez',
              });
            } else {
              expect(options.path, '/organizations');
              succeed(options, handler, []);
            }
          },
        ),
      );
      final api = NodraApi(client: client);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [apiProvider.overrideWithValue(api)],
          child: MaterialApp(
            theme: nodraTheme(),
            locale: const Locale('es'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const SessionGate(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('Tu sesión se conserva'), findsOneWidget);
      expect(
        jsonDecode((await api.storage.read(key: 'nodra_session'))!),
        savedTokens,
      );
      online = true;
      await tester.tap(find.text('Volver a intentar'));
      await tester.pumpAndSettle();
      expect(find.text('Encuentra a tu equipo.'), findsOneWidget);
      expect(find.textContaining('Sin conexión'), findsNothing);
      expect(
        jsonDecode((await api.storage.read(key: 'nodra_session'))!),
        savedTokens,
      );
    },
  );

  for (final status in <int?>[null, 503]) {
    test(
      'refresh failure $status preserves credentials and can be retried on the same client',
      () async {
        var recovered = false, rotations = 0;
        final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
        client.interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              if (options.path == '/auth/refresh') {
                rotations++;
                expect(options.data, {'token': 'test-refresh-old'});
                if (!recovered) {
                  fail(options, handler, status);
                  return;
                }
                succeed(options, handler, newTokens);
              } else if (options.headers['Authorization'] ==
                  'Bearer test-access-new') {
                succeed(options, handler, {'ok': true});
              } else {
                fail(options, handler, 401);
              }
            },
          ),
        );
        final api = NodraApi(client: client);
        expect(await api.restore(), isTrue);
        await expectLater(
          api.request('/auth/me'),
          throwsA(
            isA<ApiFailure>().having(
              (failure) => failure.unauthorized,
              'unauthorized',
              isFalse,
            ),
          ),
        );
        expect(
          jsonDecode((await api.storage.read(key: 'nodra_session'))!),
          savedTokens,
        );
        recovered = true;
        expect(await api.request('/auth/me'), {'ok': true});
        expect(rotations, 2);
        expect(
          jsonDecode((await api.storage.read(key: 'nodra_session'))!),
          newTokens,
        );
      },
    );
  }

  test('definitively rejected refresh clears credentials and presents a signed-out session', () async {
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) => fail(options, handler, 401),
      ),
    );
    final api = NodraApi(client: client);
    final container = ProviderContainer(
      overrides: [apiProvider.overrideWithValue(api)],
    );
    addTearDown(container.dispose);
    expect((await container.read(sessionProvider.future)).signedIn, isFalse);
    expect(await api.storage.read(key: 'nodra_session'), isNull);
    expect(await api.restore(), isFalse);
  });

  test('concurrent expired requests share a single refresh and both retry with new credentials', () async {
    final rotation = Completer<void>();
    final refreshEntered = Completer<void>();
    final bothExpired = Completer<void>();
    var rotations = 0;
    var expired = 0;
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (options.path == '/auth/refresh') {
            rotations++;
            if (!refreshEntered.isCompleted) refreshEntered.complete();
            await rotation.future;
            succeed(options, handler, newTokens);
          } else if (options.headers['Authorization'] ==
              'Bearer test-access-new') {
            succeed(options, handler, {'path': options.path});
          } else {
            fail(options, handler, 401);
            if (++expired == 2) bothExpired.complete();
          }
        },
      ),
    );
    final api = NodraApi(client: client);
    await api.restore();
    final requests = Future.wait([
      api.request('/auth/me'),
      api.request('/organizations'),
    ]);
    await Future.wait([refreshEntered.future, bothExpired.future]);
    expect(rotations, 1);
    rotation.complete();
    expect(await requests, [
      {'path': '/auth/me'},
      {'path': '/organizations'},
    ]);
    expect(rotations, 1);
    expect(
      jsonDecode((await api.storage.read(key: 'nodra_session'))!),
      newTokens,
    );
  });
}
