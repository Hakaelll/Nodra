import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:nodra/core/account_action.dart';
import 'package:nodra/core/api.dart';
import 'package:nodra/core/session.dart';
import 'package:nodra/design/theme.dart';
import 'package:nodra/screens/home.dart';
import 'package:nodra/screens/profile.dart';

class InvitationSessionController extends SessionController {
  int reloads = 0;
  String? selectedOrganization;

  @override
  Future<SessionState> build() async => const SessionState();

  @override
  Future<void> reload() async {
    reloads++;
  }

  @override
  Future<void> select(String id) async {
    selectedOrganization = id;
  }
}

void main() {
  test('verification link accepts only its own fragment', () {
    final token = 'b' * 64;
    expect(
      accountActionToken(
        'https://nodra.test/#verify=$token',
        AccountAction.verify,
      ),
      token,
    );
    expect(
      accountActionToken(
        'https://nodra.test/#reset=$token',
        AccountAction.verify,
      ),
      isNull,
    );
    expect(
      accountActionToken('javascript:x#verify=$token', AccountAction.verify),
      isNull,
    );
  });
  testWidgets('verification sheet validates and consumes the pasted link', (
    tester,
  ) async {
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    var submissions = 0;
    String? path, sentToken;
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          submissions++;
          path = options.path;
          sentToken = (options.data as Map<String, dynamic>)['token'] as String;
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
    bool? verified;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiProvider.overrideWithValue(NodraApi(client: client))],
        child: MaterialApp(
          theme: nodraTheme(),
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () async {
                  verified = await showModalBottomSheet<bool>(
                    context: context,
                    builder: (_) => const VerifyEmailSheet(),
                  );
                },
                child: const Text('Abrir'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Abrir'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Verificar correo'));
    await tester.pump();
    expect(find.text('Pega un enlace de verificación válido.'), findsOneWidget);
    expect(submissions, 0);
    await tester.enterText(
      find.byType(TextFormField),
      'https://nodra.test/#verify=${'b' * 64}',
    );
    await tester.tap(find.text('Verificar correo'));
    await tester.pumpAndSettle();
    expect(submissions, 1);
    expect(path, '/auth/verify/complete');
    expect(sentToken, 'b' * 64);
    expect(verified, isTrue);
  });
  testWidgets(
    'mobile profile exposes device photo and editable personal data',
    (tester) async {
      const session = SessionState(
        user: {
          'id': 'user',
          'firstName': 'Yago',
          'lastName': 'Fernández',
          'email': 'yago@example.com',
          'avatarUrl': null,
          'emailVerifiedAt': '2026-09-20T12:00:00Z',
        },
        organizationId: 'org',
        memberships: [
          {
            'permissionRole': 'OWNER',
            'organization': {'id': 'org', 'name': 'Equipo principal'},
          },
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: nodraTheme(),
            home: Scaffold(
              body: SingleChildScrollView(
                child: ProfilePanel(session: session, onLogout: () async {}),
              ),
            ),
          ),
        ),
      );
      expect(find.text('Yago Fernández'), findsOneWidget);
      expect(find.byTooltip('Cambiar foto de perfil'), findsOneWidget);
      await tester.tap(find.text('Editar perfil'));
      await tester.pump();
      expect(find.widgetWithText(TextFormField, 'Nombre'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Apellidos'), findsOneWidget);
      expect(find.text('Guardar cambios'), findsOneWidget);
    },
  );
  testWidgets('unverified profile opens the verification form', (tester) async {
    const session = SessionState(
      user: {
        'id': 'user',
        'firstName': 'Yago',
        'lastName': 'Fernández',
        'email': 'yago@example.com',
        'avatarUrl': null,
        'emailVerifiedAt': null,
      },
    );
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: nodraTheme(),
          home: Scaffold(
            body: SingleChildScrollView(
              child: ProfilePanel(session: session, onLogout: () async {}),
            ),
          ),
        ),
      ),
    );
    await tester.ensureVisible(find.text('Ya tengo el enlace'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ya tengo el enlace'));
    await tester.pumpAndSettle();
    expect(find.text('Enlace de verificación'), findsOneWidget);
    expect(find.text('Verificar correo'), findsOneWidget);
  });
  testWidgets('owner can issue a one-use invitation code from profile', (
    tester,
  ) async {
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    var requests = 0;
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests++;
          expect(options.path, '/organizations/org/invitations');
          expect(options.method, 'POST');
          expect(options.data, {'maxUses': 1, 'expiresInHours': 72});
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 201,
              data: {'id': 'invitation', 'code': '123456789012'},
            ),
          );
        },
      ),
    );
    const session = SessionState(
      user: {'id': 'user', 'firstName': 'Yago', 'lastName': 'Fernández'},
      organizationId: 'org',
      memberships: [
        {
          'permissionRole': 'OWNER',
          'organization': {'id': 'org', 'name': 'Equipo principal'},
        },
      ],
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiProvider.overrideWithValue(NodraApi(client: client))],
        child: MaterialApp(
          theme: nodraTheme(),
          home: Scaffold(
            body: SingleChildScrollView(
              child: ProfilePanel(session: session, onLogout: () async {}),
            ),
          ),
        ),
      ),
    );
    await tester.ensureVisible(find.text('Crear código de invitación'));
    await tester.tap(find.text('Crear código de invitación'));
    await tester.pumpAndSettle();
    expect(requests, 1);
    expect(find.text('1234 5678 9012'), findsOneWidget);
    expect(find.text('Revocar invitación'), findsOneWidget);
  });

  testWidgets('member cannot issue invitation codes', (tester) async {
    const session = SessionState(
      user: {'id': 'user', 'firstName': 'Yago', 'lastName': 'Fernández'},
      organizationId: 'org',
      memberships: [
        {
          'permissionRole': 'MEMBER',
          'organization': {'id': 'org', 'name': 'Equipo principal'},
        },
      ],
    );
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: nodraTheme(),
          home: Scaffold(
            body: SingleChildScrollView(
              child: ProfilePanel(session: session, onLogout: () async {}),
            ),
          ),
        ),
      ),
    );
    expect(find.text('Crear código de invitación'), findsNothing);
  });

  testWidgets('joining with a code requires twelve digits', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: nodraTheme(),
          home: const Scaffold(body: JoinCard()),
        ),
      ),
    );
    await tester.enterText(find.byType(TextField), '1234');
    await tester.tap(find.text('Consultar invitación'));
    await tester.pump();
    expect(
      find.text('Introduce un código válido de 12 cifras.'),
      findsOneWidget,
    );
  });

  testWidgets('joining by code previews the organization before selecting it', (
    tester,
  ) async {
    final client = Dio(BaseOptions(baseUrl: 'http://localhost'));
    final paths = <String>[];
    client.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          paths.add(options.path);
          expect(options.method, 'POST');
          expect(options.data, {'token': '123456789012'});
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 201,
              data: options.path == '/invitations/preview'
                  ? {'organizationName': 'Nuevo equipo'}
                  : {'organizationId': 'new-org'},
            ),
          );
        },
      ),
    );
    final session = InvitationSessionController();
    var accepted = false;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiProvider.overrideWithValue(NodraApi(client: client)),
          sessionProvider.overrideWith(() => session),
        ],
        child: MaterialApp(
          theme: nodraTheme(),
          home: Scaffold(body: JoinCard(onAccepted: () => accepted = true)),
        ),
      ),
    );
    await tester.enterText(find.byType(TextField), '123456789012');
    await tester.tap(find.text('Consultar invitación'));
    await tester.pumpAndSettle();
    expect(paths, ['/invitations/preview']);
    expect(find.text('Te han invitado a Nuevo equipo.'), findsOneWidget);
    expect(session.reloads, 0);
    await tester.tap(find.text('Unirme a la organización'));
    await tester.pumpAndSettle();
    expect(paths, ['/invitations/preview', '/invitations/accept']);
    expect(session.reloads, 1);
    expect(session.selectedOrganization, 'new-org');
    expect(accepted, isTrue);
  });
}
