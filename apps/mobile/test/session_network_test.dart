import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nodra/core/api.dart';
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
}
