import '../design/language_selector.dart';
import '../l10n/translation.dart';

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
      _registrationSent = false,
      _verifying = false,
      _verificationDone = false,
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
      if (_verifying) {
        await ref
            .read(apiProvider)
            .completeEmailVerification(
              accountActionToken(_resetLink.text, AccountAction.verify)!,
              password: _password.text,
            );
        _password.clear();
        _resetLink.clear();
        if (mounted) setState(() => _verificationDone = true);
        return;
      }
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
      if (_register) {
        await ref
            .read(apiProvider)
            .register(_email.text, _password.text, _first.text, _last.text);
        _password.clear();
        if (mounted) setState(() => _registrationSent = true);
        return;
      }
      await ref
          .read(sessionProvider.notifier)
          .login(_email.text, _password.text);
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
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              runSpacing: 16,
              spacing: 24,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  'nodra.',
                  style: Theme.of(context).textTheme.headlineLarge,
                ),
                const SizedBox(width: 160, child: LanguageSelector()),
              ],
            ),
            const SizedBox(height: 65),
            Text(
              _verificationDone
                  ? tr(context, 'Correo verificado.')
                  : _verifying
                  ? tr(context, 'Verifica tu correo.')
                  : _resetDone
                  ? tr(context, 'Contraseña actualizada.')
                  : _enteringReset
                  ? tr(context, 'Elige una nueva contraseña.')
                  : _recovering
                  ? tr(context, 'Recupera tu acceso.')
                  : _register
                  ? tr(context, 'Tu equipo empieza contigo.')
                  : tr(context, 'Todo listo.\nSolo faltas tú.'),
              style: Theme.of(context).textTheme.headlineLarge,
            ),
            const SizedBox(height: 16),
            Text(
              _resetDone
                  ? tr(
                      context,
                      'Ya puedes iniciar sesión. Las sesiones anteriores se han cerrado.',
                    )
                  : _enteringReset
                  ? tr(
                      context,
                      'Pega el enlace que recibiste por correo y guarda una contraseña nueva.',
                    )
                  : _recovering
                  ? tr(
                      context,
                      'Te enviaremos un enlace para elegir una nueva contraseña.',
                    )
                  : tr(
                      context,
                      'Tus servicios, tus avisos y tu próximo paso. En un solo lugar.',
                    ),
            ),
            const SizedBox(height: 32),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 20),
                child: NodraInlineError(message: _error!),
              ),
            if (_resetDone || _verificationDone) ...[
              NodraButton(
                label: tr(context, 'Iniciar sesión'),
                onPressed: () => setState(() {
                  _enteringReset = false;
                  _resetDone = false;
                  _verificationDone = false;
                  _verifying = false;
                  _register = false;
                  _error = null;
                }),
              ),
            ] else if (_sent || _registrationSent) ...[
              Text(
                _registrationSent
                    ? tr(
                        context,
                        'Si el correo puede registrarse, recibirás un enlace para verificarlo. Si ya tienes cuenta, inicia sesión o recupera tu contraseña.',
                      )
                    : tr(
                        context,
                        'Si existe una cuenta con ese correo, recibirás un enlace. Puedes abrirlo o pegarlo aquí para continuar.',
                      ),
              ),
              const SizedBox(height: 24),
              NodraButton(
                label: tr(context, 'Pegar enlace recibido'),
                onPressed: () => setState(() {
                  _sent = false;
                  _recovering = false;
                  _verifying = _registrationSent;
                  _enteringReset = !_registrationSent;
                  _registrationSent = false;
                  _error = null;
                  _password.clear();
                }),
              ),
              const SizedBox(height: 12),
              NodraButton(
                label: tr(context, 'Volver a iniciar sesión'),
                secondary: true,
                onPressed: () => setState(() {
                  _recovering = false;
                  _sent = false;
                  _registrationSent = false;
                  _register = false;
                  _verifying = false;
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
                    if (_register && !_enteringReset && !_verifying) ...[
                      NodraTextField(
                        controller: _first,
                        decoration: InputDecoration(
                          labelText: tr(context, 'Nombre'),
                        ),
                        validator: (v) => v!.trim().isEmpty
                            ? tr(context, 'Escribe tu nombre.')
                            : null,
                      ),
                      const SizedBox(height: 16),
                      NodraTextField(
                        controller: _last,
                        decoration: InputDecoration(
                          labelText: tr(context, 'Apellidos'),
                        ),
                        validator: (v) => v!.trim().isEmpty
                            ? tr(context, 'Escribe tus apellidos.')
                            : null,
                      ),
                      const SizedBox(height: 16),
                    ],
                    if (_enteringReset || _verifying) ...[
                      NodraTextField(
                        controller: _resetLink,
                        decoration: InputDecoration(
                          labelText: _verifying
                              ? tr(context, 'Enlace de verificación')
                              : tr(context, 'Enlace de recuperación'),
                          helperText: tr(
                            context,
                            'Pega el enlace completo recibido por correo.',
                          ),
                        ),
                        keyboardType: TextInputType.url,
                        textCapitalization: TextCapitalization.none,
                        autocorrect: false,
                        validator: (v) =>
                            accountActionToken(
                                  v ?? '',
                                  _verifying
                                      ? AccountAction.verify
                                      : AccountAction.reset,
                                ) ==
                                null
                            ? tr(context, 'Pega un enlace válido.')
                            : null,
                      ),
                      const SizedBox(height: 16),
                    ] else ...[
                      NodraTextField(
                        controller: _email,
                        decoration: InputDecoration(
                          labelText: tr(context, 'Email'),
                        ),
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        validator: (v) => v!.contains('@')
                            ? null
                            : tr(context, 'Escribe un email válido.'),
                      ),
                      const SizedBox(height: 16),
                    ],
                    if (!_recovering)
                      NodraTextField(
                        controller: _password,
                        decoration: InputDecoration(
                          labelText: _enteringReset
                              ? tr(context, 'Nueva contraseña')
                              : tr(context, 'Contraseña'),
                        ),
                        obscureText: true,
                        autofillHints: [
                          (_register && !_verifying) || _enteringReset
                              ? AutofillHints.newPassword
                              : AutofillHints.password,
                        ],
                        validator: (v) => v!.length < 12
                            ? tr(context, 'Utiliza al menos 12 caracteres.')
                            : null,
                      ),
                    if (_enteringReset) ...[
                      const SizedBox(height: 16),
                      NodraTextField(
                        controller: _confirmPassword,
                        decoration: InputDecoration(
                          labelText: tr(context, 'Repite la contraseña'),
                        ),
                        obscureText: true,
                        autofillHints: const [AutofillHints.newPassword],
                        validator: (v) => v != _password.text
                            ? tr(context, 'Las contraseñas no coinciden.')
                            : null,
                      ),
                    ],
                    const SizedBox(height: 24),
                    NodraButton(
                      label: _busy
                          ? tr(context, 'Un momento…')
                          : _recovering
                          ? tr(context, 'Enviar enlace')
                          : _verifying
                          ? tr(context, 'Verificar correo')
                          : _enteringReset
                          ? tr(context, 'Guardar contraseña')
                          : _register
                          ? tr(context, 'Crear mi cuenta')
                          : tr(context, 'Entrar en Nodra'),
                      onPressed: _busy ? null : _submit,
                    ),
                    const SizedBox(height: 16),
                    if (_enteringReset || _verifying)
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => setState(() {
                                _enteringReset = false;
                                _verifying = false;
                                _register = false;
                                _error = null;
                                _resetLink.clear();
                                _password.clear();
                              }),
                        child: Text(tr(context, 'Volver a iniciar sesión')),
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
                          _register
                              ? tr(context, 'Ya tengo cuenta')
                              : tr(context, 'Crear una cuenta'),
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
                          child: Text(tr(context, 'He olvidado mi contraseña')),
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
                          child: Text(tr(context, 'Ya tengo un enlace')),
                        ),
                      if (!_register)
                        TextButton(
                          onPressed: _busy
                              ? null
                              : () => setState(() {
                                  _verifying = true;
                                  _error = null;
                                  _password.clear();
                                }),
                          child: Text(tr(context, 'Verificar mi correo')),
                        ),
                    ] else
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => setState(() {
                                _recovering = false;
                                _error = null;
                              }),
                        child: Text(tr(context, 'Volver a iniciar sesión')),
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
