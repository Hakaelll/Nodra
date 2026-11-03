import '../design/organization_presentation.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/session.dart';
import '../core/services.dart';
import '../core/chats.dart';
import '../design/theme.dart';
import '../design/widgets.dart';
import 'home.dart';

class ServiceScreen extends ConsumerStatefulWidget {
  const ServiceScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<ServiceScreen> createState() => _ServiceScreenState();
}

class _ServiceScreenState extends ConsumerState<ServiceScreen> {
  bool busy = false;
  String? error;
  Future<void> act(Future<void> Function(CoordinationRepository) action) async {
    final org = ref.read(sessionProvider).value?.organizationId;
    if (org == null) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await action(CoordinationRepository(ref.read(apiProvider), org));
      ref.invalidate(serviceProvider(widget.id));
      ref.invalidate(servicesProvider);
      ref.invalidate(dashboardProvider);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  bool canOpenChat(Json service, SessionState? session) {
    if (session == null ||
        !session.chatEnabled ||
        ['DRAFT', 'CANCELLED'].contains(service['status'])) {
      return false;
    }
    final membership = session.memberships
        .where(
          (m) => (m['organization'] as Json)['id'] == session.organizationId,
        )
        .firstOrNull;
    if (membership == null || membership['permissionRole'] == 'MEMBER') {
      return false;
    }
    final assignments = (service['positions'] as List).cast<Json>().expand(
      (p) => (p['assignments'] as List).cast<Json>(),
    );
    return assignments.any((a) => a['status'] == 'CONFIRMED') &&
        !assignments.any((a) => a['status'] == 'AWAITING_CONFIRMATION');
  }

  Future<void> openChat() async {
    final org = ref.read(sessionProvider).value?.organizationId;
    if (org == null) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final chat = await ChatRepository(
        ref.read(apiProvider),
        org,
      ).createForService(widget.id);
      if (mounted) await context.push('/chats/${chat['id']}');
    } catch (failure) {
      if (mounted) setState(() => error = failure.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider).value;
    return Scaffold(
      appBar: AppBar(
        title: Text(organizationText(context, "Detalle de servicio")),
      ),
      body: ref
          .watch(serviceProvider(widget.id))
          .when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Padding(
              padding: const EdgeInsets.all(24),
              child: NodraError(
                message: e.toString(),
                retry: () => ref.invalidate(serviceProvider(widget.id)),
              ),
            ),
            data: (service) => ListView(
              padding: const EdgeInsets.all(24),
              children: [
                Text(
                  session?.organization?['name'] as String? ?? '',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 12),
                Text(
                  service['title'] as String,
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                    color: service['status'] == 'CANCELLED'
                        ? mutedColor
                        : inkColor,
                  ),
                ),
                const SizedBox(height: 20),
                Align(
                  alignment: Alignment.centerLeft,
                  child: NodraBadge(status: service['status'] as String),
                ),
                if (service['status'] == 'CANCELLED') ...[
                  const SizedBox(height: 12),
                  const Text(
                    "Registro cancelado. El historial se conserva para consulta.",
                    style: TextStyle(color: mutedColor),
                  ),
                ],
                const SizedBox(height: 24),
                Text(
                  '${formatServiceDate(service)} — ${formatServiceEndDate(service)}',
                ),
                Text(
                  'Horario de ${service['timezone']}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 8),
                Text(service['locationText'] as String),
                const SizedBox(height: 20),
                Text(service['description'] as String),
                const SizedBox(height: 24),
                if (error != null) ...[
                  NodraInlineError(message: error!),
                  const SizedBox(height: 20),
                ],
                if (canOpenChat(service, session)) ...[
                  OutlinedButton.icon(
                    onPressed: busy ? null : openChat,
                    icon: const Icon(Icons.chat_bubble_outline),
                    label: const Text("Abrir chat"),
                  ),
                  const SizedBox(height: 20),
                ],
                ...(service['positions'] as List).cast<Json>().map((p) {
                  final interested = (p['interests'] as List).any(
                    (i) =>
                        i['userId'] == session?.user?['id'] &&
                        i['status'] == 'INTERESTED',
                  );
                  final mine = (p['assignments'] as List)
                      .cast<Json>()
                      .where(
                        (a) =>
                            a['userId'] == session?.user?['id'] &&
                            [
                              'AWAITING_CONFIRMATION',
                              'CONFIRMED',
                              'COMPLETED',
                            ].contains(a['status']),
                      )
                      .toList();
                  final selected = mine.isEmpty ? null : mine.first;
                  final acceptsEntries = [
                    'OPEN',
                    'SELECTION',
                    'CONFIRMATION',
                  ].contains(service['status']);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 20),
                    child: NodraCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            (p['jobRole'] as Json)['name'] as String,
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 10),
                          Text('${p['quantity']} plazas · ${p['description']}'),
                          if (p['compensation'] != null)
                            Text('Compensación: ${p['compensation']}'),
                          const SizedBox(height: 20),
                          if ((selected != null || interested) &&
                              service['status'] != 'CANCELLED') ...[
                            Row(
                              children: [
                                const Icon(
                                  Icons.check_rounded,
                                  size: 18,
                                  color: Color(0xff187a77),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    selected?['status'] == 'CONFIRMED'
                                        ? 'Tu participación está confirmada'
                                        : selected != null
                                        ? 'Has sido seleccionado'
                                        : 'Ya estás inscrito en esta posición',
                                  ),
                                ),
                              ],
                            ),
                            if (selected == null && acceptsEntries)
                              Align(
                                alignment: Alignment.centerLeft,
                                child: TextButton(
                                  onPressed: busy
                                      ? null
                                      : () => act(
                                          (r) => r.interest(
                                            p['id'] as String,
                                            false,
                                          ),
                                        ),
                                  child: const Text('Cancelar inscripción'),
                                ),
                              ),
                          ] else if (acceptsEntries)
                            NodraButton(
                              label: 'Inscribirme',
                              onPressed: busy
                                  ? null
                                  : () => act(
                                      (r) =>
                                          r.interest(p['id'] as String, true),
                                    ),
                            ),
                          ...(p['assignments'] as List)
                              .cast<Json>()
                              .where((a) => a['userId'] == session?.user?['id'])
                              .map(
                                (a) => Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    const SizedBox(height: 20),
                                    NodraBadge(status: a['status'] as String),
                                    if (a['status'] ==
                                        'AWAITING_CONFIRMATION') ...[
                                      const SizedBox(height: 16),
                                      NodraButton(
                                        label: 'Confirmar participación',
                                        onPressed: busy
                                            ? null
                                            : () => act(
                                                (r) => r.respond(
                                                  a['id'] as String,
                                                  'CONFIRMED',
                                                ),
                                              ),
                                      ),
                                      const SizedBox(height: 10),
                                      NodraButton(
                                        label: 'No puedo asistir',
                                        secondary: true,
                                        onPressed: busy
                                            ? null
                                            : () => act(
                                                (r) => r.respond(
                                                  a['id'] as String,
                                                  'DECLINED',
                                                ),
                                              ),
                                      ),
                                    ],
                                    if (a['status'] == 'CONFIRMED') ...[
                                      const SizedBox(height: 16),
                                      NodraButton(
                                        label: 'Cancelar participación',
                                        secondary: true,
                                        onPressed: busy
                                            ? null
                                            : () async {
                                                final accepted =
                                                    await showDialog<bool>(
                                                      context: context,
                                                      builder: (ctx) => AlertDialog(
                                                        title: const Text(
                                                          '¿Cancelar tu participación?',
                                                        ),
                                                        content: const Text(
                                                          'Se avisará a tu organización y la plaza quedará libre. El historial se conservará.',
                                                        ),
                                                        actions: [
                                                          TextButton(
                                                            onPressed: () =>
                                                                Navigator.pop(
                                                                  ctx,
                                                                  false,
                                                                ),
                                                            child: const Text(
                                                              'Volver',
                                                            ),
                                                          ),
                                                          TextButton(
                                                            onPressed: () =>
                                                                Navigator.pop(
                                                                  ctx,
                                                                  true,
                                                                ),
                                                            child: const Text(
                                                              'Cancelar participación',
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    );
                                                if (accepted == true &&
                                                    mounted) {
                                                  await act(
                                                    (r) => r.respond(
                                                      a['id'] as String,
                                                      'CANCELLED',
                                                    ),
                                                  );
                                                }
                                              },
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                        ],
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
    );
  }
}
