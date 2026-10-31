import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import 'roles.dart';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../core/account_action.dart';
import '../core/api.dart';
import '../core/session.dart';
import '../design/theme.dart';
import '../design/widgets.dart';
import 'avatar_crop_sheet.dart';

class ProfilePanel extends ConsumerStatefulWidget {
  const ProfilePanel({
    super.key,
    required this.session,
    required this.onLogout,
    this.onJoin,
  });

  final SessionState session;
  final Future<void> Function() onLogout;
  final VoidCallback? onJoin;

  @override
  ConsumerState<ProfilePanel> createState() => _ProfilePanelState();
}

class _ProfilePanelState extends ConsumerState<ProfilePanel> {
  final firstName = TextEditingController();
  final lastName = TextEditingController();
  final form = GlobalKey<FormState>();
  final picker = ImagePicker();
  Uint8List? avatar;
  bool editing = false, busy = false, verificationSent = false;
  String? error, success;

  @override
  void initState() {
    super.initState();
    _loadAvatar();
    _recoverLostPick();
  }

  @override
  void didUpdateWidget(covariant ProfilePanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session.user?['avatarUrl'] !=
            widget.session.user?['avatarUrl'] ||
        oldWidget.session.user?['id'] != widget.session.user?['id']) {
      avatar = null;
      _loadAvatar();
    }
  }

  @override
  void dispose() {
    firstName.dispose();
    lastName.dispose();
    super.dispose();
  }

  Future<void> _loadAvatar() async {
    if (widget.session.user?['avatarUrl'] == null) return;
    try {
      final bytes = await ref.read(apiProvider).ownAvatar();
      if (mounted) setState(() => avatar = bytes);
    } catch (_) {
      // A missing or unavailable photo leaves the initials usable.
    }
  }

  Future<void> _issueInvitation() async {
    final organizationId = widget.session.organizationId;
    if (organizationId == null) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final invitation =
          await ref
                  .read(apiProvider)
                  .request(
                    '/organizations/$organizationId/invitations',
                    method: 'POST',
                    data: {'maxUses': 1, 'expiresInHours': 72},
                  )
              as Json;
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (_) => InvitationCodeSheet(
          organizationId: organizationId,
          invitation: invitation,
        ),
      );
    } catch (cause) {
      if (mounted) setState(() => error = cause.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _recoverLostPick() async {
    try {
      final lost = await picker.retrieveLostData();
      if (mounted && !lost.isEmpty && lost.files?.isNotEmpty == true) {
        await _preparePhoto(lost.files!.first);
      }
    } catch (_) {
      // The gallery remains available for a new selection.
    }
  }

  void _startEditing() {
    firstName.text = widget.session.user?['firstName'] as String? ?? '';
    lastName.text = widget.session.user?['lastName'] as String? ?? '';
    setState(() {
      editing = true;
      error = null;
      success = null;
    });
  }

  Future<void> _saveName() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
      success = null;
    });
    try {
      await ref
          .read(apiProvider)
          .request(
            '/auth/me',
            method: 'PATCH',
            data: {
              'firstName': firstName.text.trim(),
              'lastName': lastName.text.trim(),
            },
          );
      await ref.read(sessionProvider.notifier).reload();
      if (mounted) {
        setState(() {
          editing = false;
          success = 'Cambios guardados.';
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _choosePhoto() async {
    try {
      final chosen = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 2048,
        maxHeight: 2048,
        imageQuality: 95,
        requestFullMetadata: false,
      );
      if (chosen != null && mounted) {
        await _preparePhoto(chosen);
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => error = 'No se pudo abrir la galería. Inténtalo de nuevo.',
        );
      }
    }
  }

  Future<void> _preparePhoto(XFile chosen) async {
    final bytes = await chosen.readAsBytes();
    if (bytes.length > 12 * 1024 * 1024) {
      setState(() => error = 'Elige una imagen de hasta 12 MB.');
      return;
    }
    ui.Codec? codec;
    ui.Image? decoded;
    try {
      codec = await ui.instantiateImageCodec(bytes);
      final frame = await codec.getNextFrame();
      decoded = frame.image;
      final raw = await decoded.toByteData(format: ui.ImageByteFormat.rawRgba);
      if (raw == null) throw const FormatException('Imagen no disponible');
      if (!mounted) return;
      final jpeg = await showModalBottomSheet<Uint8List>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: canvasColor,
        showDragHandle: true,
        builder: (_) => AvatarCropSheet(
          preview: bytes,
          rgba: raw.buffer.asUint8List(),
          width: decoded!.width,
          height: decoded.height,
        ),
      );
      if (jpeg == null || !mounted) return;
      setState(() {
        busy = true;
        error = null;
        success = null;
      });
      await ref.read(apiProvider).uploadAvatar(jpeg);
      await ref.read(sessionProvider.notifier).reload();
      if (mounted) setState(() => success = 'Foto actualizada.');
    } catch (e) {
      if (mounted) {
        setState(
          () => error = e is ApiFailure
              ? e.toString()
              : 'No se pudo preparar la foto. Elige otra imagen.',
        );
      }
    } finally {
      decoded?.dispose();
      codec?.dispose();
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _requestVerification() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref.read(apiProvider).requestEmailVerification();
      if (mounted) setState(() => verificationSent = true);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _verifyFromLink() async {
    final verified = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: canvasColor,
      showDragHandle: true,
      builder: (_) => const VerifyEmailSheet(),
    );
    if (verified != true || !mounted) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref.read(sessionProvider.notifier).reload();
      if (mounted) setState(() => success = 'Correo verificado.');
    } catch (_) {
      if (mounted) {
        setState(
          () => error = 'El correo se verificó, pero no se pudo actualizar el perfil. Vuelve a abrir la aplicación.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.session.user ?? const <String, dynamic>{};
    final name = '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim();
    final initials = [user['firstName'], user['lastName']]
        .whereType<String>()
        .where((part) => part.isNotEmpty)
        .map((part) => part[0].toUpperCase())
        .join();
    final membership = widget.session.memberships.where(
      (item) =>
          (item['organization'] as Json)['id'] == widget.session.organizationId,
    );
    final role = membership.isEmpty
        ? null
        : membership.first['permissionRole'] as String?;
    final organization = widget.session.organization;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Perfil', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 6),
        Text(
          'Tu cuenta y actividad en Nodra.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 28),
        Row(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                CircleAvatar(
                  radius: 43,
                  backgroundColor: const Color(0xffe8e9ff),
                  foregroundColor: accentColor,
                  backgroundImage: avatar == null ? null : MemoryImage(avatar!),
                  child: avatar == null
                      ? Text(initials, style: const TextStyle(fontSize: 25))
                      : null,
                ),
                Positioned(
                  right: -8,
                  bottom: -8,
                  child: IconButton.filledTonal(
                    tooltip: 'Cambiar foto de perfil',
                    onPressed: busy ? null : _choosePhoto,
                    icon: const Icon(Icons.photo_camera_outlined, size: 20),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 24),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: Theme.of(context).textTheme.titleLarge),
                  if (role != null)
                    Text(
                      role == 'OWNER'
                          ? 'Propietario'
                          : role == 'COORDINATOR'
                          ? 'Coordinador'
                          : role == 'ADMIN'
                          ? 'Administrador'
                          : 'Miembro',
                    ),
                  if (organization != null)
                    Text(
                      organization['name'] as String,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        if (error != null) ...[
          NodraInlineError(message: error!),
          const SizedBox(height: 16),
        ],
        if (success != null) ...[
          Text(success!, style: const TextStyle(color: Color(0xff187a77))),
          const SizedBox(height: 16),
        ],
        if (!editing) ...[
          NodraButton(
            label: 'Editar perfil',
            secondary: true,
            onPressed: busy ? null : _startEditing,
          ),
        ] else
          NodraCard(
            child: Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Datos personales',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 18),
                  TextFormField(
                    controller: firstName,
                    decoration: const InputDecoration(labelText: 'Nombre'),
                    textCapitalization: TextCapitalization.words,
                    autofillHints: const [AutofillHints.givenName],
                    maxLength: 80,
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Escribe tu nombre.'
                        : null,
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: lastName,
                    decoration: const InputDecoration(labelText: 'Apellidos'),
                    textCapitalization: TextCapitalization.words,
                    autofillHints: const [AutofillHints.familyName],
                    maxLength: 80,
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Escribe tus apellidos.'
                        : null,
                  ),
                  const SizedBox(height: 18),
                  NodraButton(
                    label: busy ? 'Guardando…' : 'Guardar cambios',
                    onPressed: busy ? null : _saveName,
                  ),
                  TextButton(
                    onPressed: busy
                        ? null
                        : () => setState(() => editing = false),
                    child: const Text('Cancelar'),
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 28),
        NodraCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Información de la cuenta',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 18),
              Text(
                'Correo electrónico',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 4),
              Text(user['email'] as String? ?? ''),
              if (organization != null) ...[
                const Divider(height: 28),
                Text('Espacio', style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 4),
                Text(organization['name'] as String),
              ],
              const Divider(height: 28),
              Text(
                user['emailVerifiedAt'] == null
                    ? 'Correo pendiente de verificación'
                    : 'Correo verificado',
              ),
              if (user['emailVerifiedAt'] == null) ...[
                const SizedBox(height: 12),
                NodraButton(
                  label: verificationSent
                      ? 'Enviar otro enlace'
                      : 'Verificar mi correo',
                  secondary: true,
                  onPressed: busy ? null : _requestVerification,
                ),
                const SizedBox(height: 10),
                NodraButton(
                  label: 'Ya tengo el enlace',
                  secondary: true,
                  onPressed: busy ? null : _verifyFromLink,
                ),
                if (verificationSent) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Te hemos enviado un enlace. Ábrelo en el navegador o pégalo aquí.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),
        if (widget.onJoin != null) ...[
          NodraButton(
            label: organization == null
                ? 'Unirme con un código'
                : 'Unirme a otra organización',
            secondary: true,
            onPressed: busy ? null : widget.onJoin,
          ),
          const SizedBox(height: 12),
        ],
        if (widget.session.organizationId != null &&
            ['OWNER', 'ADMIN', 'COORDINATOR'].contains(role))
          ListTile(
            title: const Text('Roles laborales'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) =>
                    RolesScreen(organizationId: widget.session.organizationId!),
              ),
            ),
          ),
        if (role == 'OWNER' || role == 'ADMIN') ...[
          NodraButton(
            label: busy ? 'Creando código…' : 'Crear código de invitación',
            secondary: true,
            onPressed: busy ? null : _issueInvitation,
          ),
          const SizedBox(height: 12),
        ],
        NodraButton(
          label: 'Cerrar sesión',
          secondary: true,
          onPressed: busy ? null : widget.onLogout,
        ),
      ],
    );
  }
}

class InvitationCodeSheet extends ConsumerStatefulWidget {
  const InvitationCodeSheet({
    super.key,
    required this.organizationId,
    required this.invitation,
  });

  final String organizationId;
  final Json invitation;

  @override
  ConsumerState<InvitationCodeSheet> createState() =>
      _InvitationCodeSheetState();
}

class _InvitationCodeSheetState extends ConsumerState<InvitationCodeSheet> {
  bool copied = false, busy = false;
  String? error;

  Future<void> _copyCode() async {
    try {
      await Clipboard.setData(
        ClipboardData(text: widget.invitation['code'] as String),
      );
      if (mounted) setState(() => copied = true);
    } catch (_) {
      if (mounted) {
        setState(
          () => error =
              'No se pudo copiar. Mantén pulsado el código para seleccionarlo.',
        );
      }
    }
  }

  Future<void> _revoke() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref
          .read(apiProvider)
          .request(
            '/organizations/${widget.organizationId}/invitations/${widget.invitation['id']}/revoke',
            method: 'POST',
            data: <String, dynamic>{},
          );
      if (mounted) Navigator.of(context).pop();
    } catch (cause) {
      if (mounted) setState(() => error = cause.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final code = widget.invitation['code'] as String;
    final grouped = code.length == 12
        ? '${code.substring(0, 4)} ${code.substring(4, 8)} ${code.substring(8)}'
        : code;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        18,
        24,
        MediaQuery.viewInsetsOf(context).bottom + 28,
      ),
      child: SingleChildScrollView(
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Código de invitación',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 10),
              const Text(
                'Compártelo con una persona. Es válido durante 72 horas y sólo permite unirse una vez.',
              ),
              const SizedBox(height: 20),
              SelectableText(
                grouped,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontFeatures: const [ui.FontFeature.tabularFigures()],
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 8),
              const Text('Guárdalo ahora: no volverá a mostrarse.'),
              if (error != null) ...[
                const SizedBox(height: 14),
                NodraInlineError(message: error!),
              ],
              const SizedBox(height: 22),
              NodraButton(
                label: copied ? 'Código copiado' : 'Copiar código',
                onPressed: busy ? null : _copyCode,
              ),
              const SizedBox(height: 10),
              NodraButton(
                label: 'Revocar invitación',
                secondary: true,
                onPressed: busy ? null : _revoke,
              ),
              TextButton(
                onPressed: busy ? null : () => Navigator.of(context).pop(),
                child: const Text('Cerrar'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class VerifyEmailSheet extends ConsumerStatefulWidget {
  const VerifyEmailSheet({super.key});

  @override
  ConsumerState<VerifyEmailSheet> createState() => _VerifyEmailSheetState();
}

class _VerifyEmailSheetState extends ConsumerState<VerifyEmailSheet> {
  final form = GlobalKey<FormState>();
  final link = TextEditingController();
  bool busy = false;
  String? error;

  @override
  void dispose() {
    link.dispose();
    super.dispose();
  }

  Future<void> _complete() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref
          .read(apiProvider)
          .completeEmailVerification(
            accountActionToken(link.text, AccountAction.verify)!,
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (cause) {
      if (mounted) setState(() => error = cause.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      24,
      12,
      24,
      MediaQuery.viewInsetsOf(context).bottom + 28,
    ),
    child: SingleChildScrollView(
      child: Form(
        key: form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Verifica tu correo',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 10),
            const Text('Pega el enlace que recibiste en tu correo.'),
            const SizedBox(height: 22),
            if (error != null) ...[
              NodraInlineError(message: error!),
              const SizedBox(height: 16),
            ],
            TextFormField(
              controller: link,
              decoration: const InputDecoration(
                labelText: 'Enlace de verificación',
              ),
              keyboardType: TextInputType.url,
              textCapitalization: TextCapitalization.none,
              autocorrect: false,
              validator: (value) =>
                  accountActionToken(value ?? '', AccountAction.verify) == null
                  ? 'Pega un enlace de verificación válido.'
                  : null,
            ),
            const SizedBox(height: 22),
            NodraButton(
              label: busy ? 'Verificando…' : 'Verificar correo',
              onPressed: busy ? null : _complete,
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: busy ? null : () => Navigator.of(context).pop(false),
              child: const Text('Cancelar'),
            ),
          ],
        ),
      ),
    ),
  );
}
