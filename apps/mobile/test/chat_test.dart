import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nodra/core/api.dart';
import 'package:nodra/core/chats.dart';
import 'package:nodra/core/session.dart';
import 'package:nodra/design/theme.dart';
import 'package:nodra/screens/chat.dart';

const session = SessionState(
  user: {'id': 'me', 'firstName': 'Ana', 'lastName': 'Pérez'},
  organizationId: 'org',
);

class DisabledChatSession extends SessionController {
  @override
  Future<SessionState> build() async => const SessionState(
    user: {'id': 'me'},
    organizationId: 'org',
    memberships: [
      {
        'organization': {
          'id': 'org',
          'features': {'chat': false},
        },
      },
    ],
  );
}

Json chatFixture({List<Json>? participants}) => {
  'id': 'chat',
  'kind': 'MANUAL',
  'title': 'Coordinación',
  'unreadCount': 2,
  'lastMessage': {'body': 'Mensaje reciente'},
  'participants':
      participants ??
      [
        {'userId': 'me', 'firstName': 'Ana', 'lastName': 'Pérez'},
        {'userId': 'other', 'firstName': 'Luis', 'lastName': 'García'},
      ],
};
Json message(String id, String body, String date, {String sender = 'other'}) =>
    {
      'id': id,
      'chatId': 'chat',
      'senderId': sender,
      'body': body,
      'createdAt': date,
    };

void main() {
  testWidgets('disabled chat route and unread counter make no chat requests', (
    tester,
  ) async {
    var requests = 0;
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests++;
          handler.resolve(
            Response(requestOptions: options, statusCode: 200, data: {}),
          );
        },
      ),
    );
    final container = ProviderContainer(
      overrides: [
        sessionProvider.overrideWith(DisabledChatSession.new),
        apiProvider.overrideWithValue(NodraApi(client: client)),
      ],
    );
    await container.read(sessionProvider.future);
    expect(await container.read(chatUnreadProvider.future), 0);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: nodraTheme(),
          home: const ChatRouteScreen(chatId: 'chat'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.text('Chat no disponible en esta organización.'),
      findsOneWidget,
    );
    expect(requests, 0);
    await tester.pumpWidget(const SizedBox());
    container.dispose();
    client.close();
  });
  test('navigation counts unread chats rather than messages', () async {
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          expect(options.uri.path, '/organizations/org/chats/unread-count');
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {'count': 7, 'chatsCount': 2},
            ),
          );
        },
      ),
    );
    expect(
      await ChatRepository(NodraApi(client: client), 'org').unreadCount(),
      2,
    );
    client.close();
  });
  test(
    'conversation names and ordering use people, group and service data',
    () {
      final chat = chatFixture();
      expect(chatDisplayTitle(chat, 'me'), 'Luis García');
      expect(
        chatDisplayTitle({
          ...chat,
          'kind': 'SERVICE',
          'title': 'Montaje',
        }, 'me'),
        'Montaje',
      );
      final sorted = chronologicalMessages([
        message('b', 'Nuevo', '2026-09-30T11:00:00Z'),
        message('a', 'Antiguo', '2026-09-30T10:00:00Z'),
      ]);
      expect(sorted.map((item) => item['body']), ['Antiguo', 'Nuevo']);
      final nonces = List.generate(30, (_) => newChatNonce());
      expect(nonces.toSet().length, 30);
      expect(
        nonces.first,
        matches(
          RegExp(
            r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',
          ),
        ),
      );
    },
  );

  testWidgets(
    'opens unread chat, orders messages and retries sending with the same nonce',
    (tester) async {
      final items = [
        message('new', 'Mensaje reciente', '2026-09-30T11:00:00Z'),
        message('old', 'Mensaje antiguo', '2026-09-30T10:00:00Z'),
      ];
      final sends = <Json>[];
      var reads = 0;
      var deleted = false;
      final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
      client.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            dynamic data;
            if (options.method == 'DELETE') {
              deleted = true;
              data = {'ok': true};
            } else if (options.uri.path.endsWith('/read')) {
              reads++;
              data = {'ok': true};
            } else if (options.method == 'POST' &&
                options.uri.path.endsWith('/messages')) {
              sends.add(Map<String, dynamic>.from(options.data as Map));
              if (sends.length == 1) {
                handler.reject(
                  DioException(
                    requestOptions: options,
                    type: DioExceptionType.connectionError,
                  ),
                );
                return;
              }
              data = message(
                'sent',
                options.data['body'] as String,
                '2026-09-30T12:00:00Z',
                sender: 'me',
              );
              items.insert(0, data as Json);
            } else if (options.uri.path.endsWith('/messages')) {
              data = {'items': items, 'total': items.length};
            } else if (options.uri.path.endsWith('/chat')) {
              data = chatFixture();
            } else {
              data = {
                'items': deleted ? [] : [chatFixture()],
                'total': deleted ? 0 : 1,
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
          overrides: [apiProvider.overrideWithValue(NodraApi(client: client))],
          child: MaterialApp(
            theme: nodraTheme(),
            home: const ChatScreen(session: session),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('2'), findsOneWidget);
      await tester.tap(find.text('Luis García'));
      await tester.pumpAndSettle();
      expect(reads, 1);
      expect(
        tester.getTopLeft(find.text('Mensaje antiguo')).dy,
        lessThan(tester.getTopLeft(find.text('Mensaje reciente')).dy),
      );
      await tester.enterText(find.byType(TextField), 'Nos vemos allí');
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Enviar mensaje'));
      await tester.pumpAndSettle();
      expect(find.text('Nos vemos allí'), findsOneWidget);
      await tester.tap(find.byTooltip('Enviar mensaje'));
      await tester.pumpAndSettle();
      expect(sends.length, 2);
      expect(sends[0]['clientNonce'], sends[1]['clientNonce']);
      expect(find.text('Nos vemos allí'), findsOneWidget);
      expect(find.text('Tú'), findsOneWidget);
      await tester.tap(find.byTooltip('Opciones del chat'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Borrar de mi lista'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(deleted, isFalse);
      await tester.tap(find.byTooltip('Opciones del chat'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Borrar de mi lista'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Borrar de mi lista'));
      await tester.pumpAndSettle();
      expect(deleted, isTrue);
      expect(find.text('No hay chats'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('manual group requires and sends its name and selected members', (
    tester,
  ) async {
    Json? payload;
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.method == 'POST') {
            payload = Map<String, dynamic>.from(options.data as Map);
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 201,
                data: chatFixture(),
              ),
            );
          } else {
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'items': [
                    {
                      'userId': 'one',
                      'firstName': 'Luis',
                      'lastName': 'García',
                    },
                    {'userId': 'two', 'firstName': 'Eva', 'lastName': 'López'},
                  ],
                  'total': 2,
                },
              ),
            );
          }
        },
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: nodraTheme(),
        home: Scaffold(
          body: ChatCreateSheet(
            repository: ChatRepository(NodraApi(client: client), 'org'),
            userId: 'me',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Luis García'));
    await tester.tap(find.text('Eva López'));
    await tester.pumpAndSettle();
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Nombre del grupo'),
      'Equipo de montaje',
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Crear chat'));
    await tester.pumpAndSettle();
    expect(payload, {
      'kind': 'MANUAL',
      'title': 'Equipo de montaje',
      'participantIds': ['one', 'two'],
    });
    await tester.pumpWidget(const SizedBox());
  });
}
