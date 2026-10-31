import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/account_action.dart';
import '../core/api.dart';
import '../core/session.dart';
import '../design/widgets.dart';
import '../design/theme.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});
  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController(),
      _password = TextEditingController(),
      _confirmPassword = TextEditingController(),
      _resetLink = TextEditingController(),
      _first = TextEditingController(),
      _last = TextEditingController();
  bool _register = false,
      _recovering = false,
      _sent = false,
      _enteringReset = false,
      _resetDone = false,
      _busy = false;
  String? _error;
  @override
  void dispose() {
    for (final c in [
      _email,
      _password,
      _confirmPassword,
      _resetLink,
      _first,
      _last,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_enteringReset) {
        await ref
            .read(apiProvider)
            .completePasswordReset(
              accountActionToken(_resetLink.text, AccountAction.reset)!,
              _password.text,
            );
        _password.clear();
        _confirmPassword.clear();
        _resetLink.clear();
        if (mounted) setState(() => _resetDone = true);
        return;
      }
      if (_recovering) {
        await ref.read(apiProvider).requestPasswordReset(_email.text);
        if (mounted) setState(() => _sent = true);
        return;
      }
      await ref
          .read(sessionProvider.notifier)
          .login(
            _email.text,
            _password.text,
            firstName: _register ? _first.text.trim() : null,
            lastName: _register ? _last.text.trim() : null,
          );
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Container(
      color: canvasColor,
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(28),
          children: [
            const SizedBox(height: 36),
            Text('nodra.', style: Theme.of(context).textTheme.headlineLarge),
            const SizedBox(height: 65),
            Text(
              _resetDone
                  ? 'Contraseña actualizada.'
                  : _enteringReset
                  ? 'Elige una nueva contraseña.'
                  : _recovering
                  ? 'Recupera tu acceso.'
                  : _register
                  ? 'Tu equipo empieza contigo.'
                  : 'Todo listo.\nSolo faltas tú.',
              style: Theme.of(context).textTheme.headlineLarge,
            ),
            const SizedBox(height: 16),
            Text(
              _resetDone
                  ? 'Ya puedes iniciar sesión. Las sesiones anteriores se han cerrado.'
                  : _enteringReset
                  ? 'Pega el enlace que recibiste por correo y guarda una contraseña nueva.'
                  : _recovering
                  ? 'Te enviaremos un enlace para elegir una nueva contraseña.'
                  : 'Tus servicios, tus avisos y tu próximo paso. En un solo lugar.',
            ),
            const SizedBox(height: 32),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 20),
                child: NodraInlineError(message: _error!),
              ),
            if (_resetDone) ...[
              NodraButton(
                label: 'Iniciar sesión',
                onPressed: () => setState(() {
                  _enteringReset = false;
                  _resetDone = false;
                  _error = null;
                }),
              ),
            ] else if (_sent) ...[
              const Text(
                'Si existe una cuenta con ese correo, recibirás un enlace. Puedes abrirlo o pegarlo aquí para continuar.',
              ),
              const SizedBox(height: 24),
              NodraButton(
                label: 'Pegar enlace recibido',
                onPressed: () => setState(() {
                  _sent = false;
                  _recovering = false;
                  _enteringReset = true;
                  _error = null;
                  _password.clear();
                }),
              ),
              const SizedBox(height: 12),
              NodraButton(
                label: 'Volver a iniciar sesión',
                secondary: true,
                onPressed: () => setState(() {
                  _recovering = false;
                  _sent = false;
                  _enteringReset = false;
                  _error = null;
                }),
              ),
            ] else
              Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_register && !_enteringReset) ...[
                      TextFormField(
                        controller: _first,
                        decoration: const InputDecoration(labelText: 'Nombre'),
                        validator: (v) =>
                            v!.trim().isEmpty ? 'Escribe tu nombre.' : null,
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _last,
                        decoration: const InputDecoration(
                          labelText: 'Apellidos',
                        ),
                        validator: (v) =>
                            v!.trim().isEmpty ? 'Escribe tus apellidos.' : null,
                      ),
                      const SizedBox(height: 16),
                    ],
                    if (_enteringReset) ...[
                      TextFormField(
                        controller: _resetLink,
                        decoration: const InputDecoration(
                          labelText: 'Enlace de recuperación',
                          helperText:
                              'Pega el enlace completo recibido por correo.',
                        ),
                        keyboardType: TextInputType.url,
                        textCapitalization: TextCapitalization.none,
                        autocorrect: false,
                        validator: (v) =>
                            accountActionToken(v ?? '', AccountAction.reset) ==
                                null
                            ? 'Pega un enlace de recuperación válido.'
                            : null,
                      ),
                      const SizedBox(height: 16),
                    ] else ...[
                      TextFormField(
                        controller: _email,
                        decoration: const InputDecoration(labelText: 'Email'),
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        validator: (v) => v!.contains('@')
                            ? null
                            : 'Escribe un email válido.',
                      ),
                      const SizedBox(height: 16),
                    ],
                    if (!_recovering)
                      TextFormField(
                        controller: _password,
                        decoration: InputDecoration(
                          labelText: _enteringReset
                              ? 'Nueva contraseña'
                              : 'Contraseña',
                        ),
                        obscureText: true,
                        autofillHints: [
                          _register || _enteringReset
                              ? AutofillHints.newPassword
                              : AutofillHints.password,
                        ],
                        validator: (v) => v!.length < 12
                            ? 'Utiliza al menos 12 caracteres.'
                            : null,
                      ),
                    if (_enteringReset) ...[
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _confirmPassword,
                        decoration: const InputDecoration(
                          labelText: 'Repite la contraseña',
                        ),
                        obscureText: true,
                        autofillHints: const [AutofillHints.newPassword],
                        validator: (v) => v != _password.text
                            ? 'Las contraseñas no coinciden.'
                            : null,
                      ),
                    ],
                    const SizedBox(height: 24),
                    NodraButton(
                      label: _busy
                          ? 'Un momento…'
                          : _recovering
                          ? 'Enviar enlace'
                          : _enteringReset
                          ? 'Guardar contraseña'
                          : _register
                          ? 'Crear mi cuenta'
                          : 'Entrar en Nodra',
                      onPressed: _busy ? null : _submit,
                    ),
                    const SizedBox(height: 16),
                    if (_enteringReset)
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => setState(() {
                                _enteringReset = false;
                                _error = null;
                                _resetLink.clear();
                                _password.clear();
                              }),
                        child: const Text('Volver a iniciar sesión'),
                      )
                    else if (!_recovering) ...[
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => setState(() {
                                _register = !_register;
                                _error = null;
                              }),
                        child: Text(
                          _register ? 'Ya tengo cuenta' : 'Crear una cuenta',
                        ),
                      ),
                      if (!_register)
                        TextButton(
                          onPressed: _busy
                              ? null
                              : () => setState(() {
                                  _recovering = true;
                                  _error = null;
                                }),
                          child: const Text('He olvidado mi contraseña'),
                        ),
                      if (!_register)
                        TextButton(
                          onPressed: _busy
                              ? null
                              : () => setState(() {
                                  _enteringReset = true;
                                  _error = null;
                                  _password.clear();
                                }),
                          child: const Text('Ya tengo un enlace'),
                        ),
                    ] else
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => setState(() {
                                _recovering = false;
                                _error = null;
                              }),
                        child: const Text('Volver a iniciar sesión'),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    ),
  );
}
