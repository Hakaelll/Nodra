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

class DelayedOrganizationStorage extends Fake implements FlutterSecureStorage {
  final values = <String, String>{'nodra_session': jsonEncode(savedTokens)};
  final entered = Completer<void>();
  final release = Completer<void>();
  bool _delayNextSelection = true;

  Future<void> _write(String key, String? value) async {
    if (key == 'nodra_organization' && _delayNextSelection) {
      _delayNextSelection = false;
      entered.complete();
      await release.future;
    }
    if (value == null) {
      values.remove(key);
    } else {
      values[key] = value;
    }
  }

  @override
  dynamic noSuchMethod(Invocation invocation) {
    final key = invocation.namedArguments[#key] as String;
    switch (invocation.memberName) {
      case #read:
        return Future<String?>.value(values[key]);
      case #write:
        return _write(key, invocation.namedArguments[#value] as String?);
      case #delete:
        values.remove(key);
        return Future<void>.value();
      default:
        throw UnsupportedError('Unexpected secure-storage operation');
    }
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(
    () => FlutterSecureStorage.setMockInitialValues({
      'nodra_session': jsonEncode(savedTokens),
    }),
  );

  test(
    'a late refresh cannot restore the account replaced after logout',
    () async {
      final entered = Completer<void>();
      final release = Completer<void>();
      final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
      var expireOldAccess = false;
      const replacementTokens = {
        'accessToken': 'bob-access',
        'refreshToken': 'bob-refresh',
      };
      client.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            if (options.path == '/auth/refresh') {
              entered.complete();
              release.future.then(
                (_) => succeed(options, handler, {
                  'accessToken': 'alice-rotated-access',
                  'refreshToken': 'alice-rotated-refresh',
                }),
              );
              return;
            }
            if (options.path == '/auth/logout') {
              succeed(options, handler, {'ok': true});
              return;
            }
            if (options.path == '/auth/login') {
              succeed(options, handler, {
                ...replacementTokens,
                'user': {'id': 'bob'},
              });
              return;
            }
            final isBob =
                options.headers['Authorization'] == 'Bearer bob-access';
            if (options.path == '/auth/me') {
              if (expireOldAccess &&
                  options.headers['Authorization'] ==
                      'Bearer test-access-old') {
                fail(options, handler, 401);
              } else {
                succeed(options, handler, {'id': isBob ? 'bob' : 'alice'});
              }
            } else {
              expect(options.path, '/organizations');
              succeed(options, handler, [
                {
                  'organization': {'id': isBob ? 'bob-team' : 'alice-team'},
                },
              ]);
            }
          },
        ),
      );
      final api = NodraApi(client: client);
      final container = ProviderContainer(
        overrides: [apiProvider.overrideWithValue(api)],
      );
      addTearDown(container.dispose);
      await container.read(sessionProvider.future);
      final session = container.read(sessionProvider.notifier);
      expireOldAccess = true;
      final staleLoad = session.reload().then<Object?>(
        (_) => null,
        onError: (Object error) => error,
      );
      await entered.future;
      await session.logout();
      expect(container.read(sessionProvider).requireValue.signedIn, isFalse);
      await session.login('bob@nodra.test', 'Local-test-password');
      release.complete();
      await staleLoad;
      expect(container.read(sessionProvider).requireValue.user?['id'], 'bob');
      expect(
        container.read(sessionProvider).requireValue.organizationId,
        'bob-team',
      );
      expect(
        jsonDecode((await api.storage.read(key: 'nodra_session'))!),
        replacementTokens,
      );
    },
  );

  test(
    'the latest organization selection wins delayed storage writes',
    () async {
      final storage = DelayedOrganizationStorage();
      final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
      client.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            succeed(
              options,
              handler,
              options.path == '/auth/me'
                  ? {'id': 'alice'}
                  : [
                      {
                        'organization': {'id': 'team-a'},
                      },
                      {
                        'organization': {'id': 'team-b'},
                      },
                    ],
            );
          },
        ),
      );
      final api = NodraApi(client: client, storage: storage);
      final container = ProviderContainer(
        overrides: [apiProvider.overrideWithValue(api)],
      );
      addTearDown(container.dispose);
      await container.read(sessionProvider.future);
      final session = container.read(sessionProvider.notifier);
      final earlier = session.select('team-b');
      await storage.entered.future;
      final latest = session.select('team-a');
      await Future<void>.delayed(Duration.zero);
      storage.release.complete();
      await Future.wait([earlier, latest]);
      expect(
        container.read(sessionProvider).requireValue.organizationId,
        'team-a',
      );
      expect(storage.values['nodra_organization'], 'team-a');
    },
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
}
