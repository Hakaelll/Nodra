import '../design/organization_presentation.dart';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/session.dart';
import '../core/services.dart';
import '../core/chats.dart';
import '../design/widgets.dart';
import '../design/theme.dart';
import '../l10n/app_localizations.dart';
import 'calendar.dart';
import 'profile.dart';
import 'worker_home.dart';
import 'service_filters.dart';

String formatServiceDate(Json service, {bool includeZone = false}) {
  final day = service['localStartDay'] as String;
  final time = service['localStartTime'] as String;
  final timezone = service['timezone'] as String;
  return '${day.substring(8, 10)}/${day.substring(5, 7)} · $time${includeZone ? ' · $timezone' : ''}';
}

String formatServiceEndDate(Json service) {
  final day = service['localEndDay'] as String;
  final time = service['localEndTime'] as String;
  return '${day.substring(8, 10)}/${day.substring(5, 7)} · $time';
}

String? serviceParticipation(Json service, String userId) {
  if (service['status'] == 'CANCELLED') return null;
  final positions = (service['positions'] as List).cast<Json>();
  final assignments = positions
      .expand((position) => (position['assignments'] as List).cast<Json>())
      .where((assignment) => assignment['userId'] == userId)
      .toList();
  if (assignments.any((assignment) => assignment['status'] == 'CONFIRMED')) {
    return 'Participación confirmada';
  }
  if (assignments.any(
    (assignment) => assignment['status'] == 'AWAITING_CONFIRMATION',
  )) {
    return 'Seleccionado · confirma tu plaza';
  }
  final interested = positions.any(
    (position) => (position['interests'] as List).any(
      (interest) =>
          interest['userId'] == userId && interest['status'] == 'INTERESTED',
    ),
  );
  if (!interested) return null;
  return service['status'] == 'SELECTION'
      ? 'Inscrito · en selección'
      : 'Inscrito';
}

String serviceActivityLabel(String kind) => switch (kind) {
  'ServiceCANCELLED' => 'Cancelación de servicio',
  'ServiceOPEN' => 'Publicación de servicio',
  'AssignmentSelected' => 'Selección de participantes',
  'AssignmentCONFIRMED' => 'Participación confirmada',
  'AssignmentDECLINED' => 'Participación declinada',
  'AssignmentCANCELLED' => 'Participación cancelada',
  _ => 'Cambios en la agenda',
};

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key, required this.session});
  final SessionState session;
  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int tab = 0, page = 1, activityPage = 1;
  String? error;
  String serviceSearch = '', serviceStatus = '', serviceRole = '';
  String serviceFrom = '', serviceTo = '';
  ServicesQuery get serviceQuery => (
    page: page,
    search: serviceSearch,
    status: serviceStatus,
    jobRoleId: serviceRole,
    from: serviceFrom,
    to: serviceTo,
  );
  @override
  void didUpdateWidget(covariant HomeScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session.organizationId != widget.session.organizationId) {
      page = 1;
      serviceSearch = '';
      serviceStatus = '';
      serviceRole = '';
      serviceFrom = '';
      serviceTo = '';
    }
  }

  Future<void> confirmLogout() async {
    final strings = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => NodraDialog(
        title: Text(strings.logoutTitle),
        content: Text(strings.logoutBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(strings.logoutStay),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(strings.logoutConfirm),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await run(() => ref.read(sessionProvider.notifier).logout());
    }
  }

  Future<void> run(Future<void> Function() fn) async {
    try {
      await fn();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final strings = AppLocalizations.of(context);
    final canManageNotices = session.memberships.any(
      (membership) =>
          (membership['organization'] as Json)['id'] ==
              session.organizationId &&
          membership['permissionRole'] != 'MEMBER',
    );
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'nodra.',
          style: TextStyle(letterSpacing: -1, fontWeight: FontWeight.w500),
        ),
        actions: [
          if (session.organizationId != null && session.chatEnabled)
            IconButton(
              tooltip: 'Chat',
              onPressed: () => context.push('/chats'),
              icon: Badge(
                alignment: Alignment.topLeft,
                isLabelVisible: (ref.watch(chatUnreadProvider).value ?? 0) > 0,
                label: Text('${ref.watch(chatUnreadProvider).value ?? 0}'),
                child: const Icon(Icons.chat_bubble_outline_rounded),
              ),
            ),
          IconButton(
            tooltip: strings.actionRefresh,
            onPressed: () {
              ref.invalidate(servicesProvider);
              ref.invalidate(dashboardProvider);
              ref.invalidate(pendingNoticesProvider);
              ref.invalidate(noticesProvider);
              ref.invalidate(serviceActivityProvider);
            },
            icon: const Icon(Icons.refresh, size: 21),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (i) => setState(() {
          tab = i;
          page = 1;
          activityPage = 1;
          error = null;
        }),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            label: strings.navHome,
          ),
          NavigationDestination(
            icon: const Icon(Icons.work_outline),
            label: organizationText(context, strings.navServices),
          ),
          NavigationDestination(
            icon: const Icon(Icons.notifications_none_rounded),
            label: strings.navNotices,
          ),
          NavigationDestination(
            icon: const Icon(Icons.calendar_today_outlined),
            label: strings.navCalendar,
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline),
            label: strings.navProfile,
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            if (session.memberships.length > 1 && tab != 4) ...[
              NodraOrganizationSwitcher(
                value: session.organizationId,
                label: strings.labelOrganization,
                organizations: session.memberships.map((membership) {
                  final org = membership['organization'] as Json;
                  return (id: org['id'] as String, name: org['name'] as String);
                }).toList(),
                onChanged: (id) =>
                    run(() => ref.read(sessionProvider.notifier).select(id)),
              ),
              const SizedBox(height: 30),
            ],
            if (error != null) ...[
              NodraError(
                message: error!,
                retry: () => setState(() => error = null),
                actionLabel: 'Cerrar aviso',
              ),
              const SizedBox(height: 20),
            ],
            if (tab == 4)
              ProfilePanel(
                session: session,
                onLogout: confirmLogout,
                onJoin: () {
                  showModalBottomSheet<void>(
                    context: context,
                    isScrollControlled: true,
                    builder: (sheetContext) => Padding(
                      padding: EdgeInsets.fromLTRB(
                        16,
                        16,
                        16,
                        MediaQuery.viewInsetsOf(sheetContext).bottom + 16,
                      ),
                      child: SingleChildScrollView(
                        child: JoinCard(
                          onAccepted: () => Navigator.pop(sheetContext),
                        ),
                      ),
                    ),
                  );
                },
              )
            else if (session.organizationId == null) ...[
              Text(
                'Encuentra a tu equipo.',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 16),
              Text(session.user?['email'] as String? ?? ''),
              const SizedBox(height: 24),
              const JoinCard(),
              const SizedBox(height: 24),
              NodraButton(
                label: 'Cerrar sesión',
                secondary: true,
                onPressed: confirmLogout,
              ),
            ] else if (tab == 2) ...[
              Text(
                'Lo que necesitas saber.',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 24),
              Text(
                organizationText(context, "Novedades de servicios"),
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 4),
              Text(
                "Selecciones y cambios que te afectan.",
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 18),
              ref
                  .watch(serviceActivityProvider(activityPage))
                  .when(
                    loading: () =>
                        const Center(child: CircularProgressIndicator()),
                    error: (e, _) => NodraError(
                      message: e.toString(),
                      retry: () =>
                          ref.invalidate(serviceActivityProvider(activityPage)),
                    ),
                    data: (data) {
                      final items = (data['items'] as List).cast<Json>();
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (items.isEmpty)
                            Padding(
                              padding: EdgeInsets.symmetric(vertical: 20),
                              child: Text(
                                organizationText(
                                  context,
                                  "Aquí aparecerán cambios de servicios.",
                                ),
                              ),
                            ),
                          ...items.map((item) {
                            final cancelled =
                                item['serviceStatus'] == 'CANCELLED';
                            final status =
                                statusLabels[item['serviceStatus']] ??
                                item['serviceStatus'] as String;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: NodraCard(
                                status: item['serviceStatus'] as String,
                                onTap: () => context.push(
                                  '/services/${item['serviceId']}',
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 3,
                                      height: 60,
                                      decoration: BoxDecoration(
                                        color: cancelled
                                            ? mutedColor
                                            : Theme.of(context)
                                                  .colorScheme
                                                  .primary,
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                    ),
                                    const SizedBox(width: 15),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            organizationText(
                                              context,
                                              serviceActivityLabel(
                                                item['kind'] as String,
                                              ),
                                            ),
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodySmall
                                                ?.copyWith(
                                                  color: cancelled
                                                      ? mutedColor
                                                      : Theme.of(context)
                                                            .colorScheme
                                                            .primary,
                                                  fontWeight: FontWeight.w600,
                                                ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            item['title'] as String,
                                            style: Theme.of(context)
                                                .textTheme
                                                .titleMedium
                                                ?.copyWith(
                                                  color: cancelled
                                                      ? mutedColor
                                                      : inkColor,
                                                ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            status,
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodySmall,
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Icon(
                                      Icons.arrow_forward_ios_rounded,
                                      size: 15,
                                      color: cancelled ? mutedColor : inkColor,
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }),
                          if ((data['total'] as int? ?? 0) > 25)
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                TextButton(
                                  onPressed: activityPage > 1
                                      ? () => setState(() => activityPage--)
                                      : null,
                                  child: const Text('Anterior'),
                                ),
                                Text(
                                  '$activityPage / ${((data['total'] as int) / 25).ceil()}',
                                ),
                                TextButton(
                                  onPressed:
                                      activityPage * 25 < (data['total'] as int)
                                      ? () => setState(() => activityPage++)
                                      : null,
                                  child: const Text('Siguiente'),
                                ),
                              ],
                            ),
                        ],
                      );
                    },
                  ),
              const SizedBox(height: 30),
              Text(
                'Mensajes del equipo',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 4),
              Text(
                'Comunicaciones publicadas para toda la organización.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 18),
              ref
                  .watch(noticesProvider(page))
                  .when(
                    loading: () =>
                        const Center(child: CircularProgressIndicator()),
                    error: (e, _) => NodraError(
                      message: e.toString(),
                      retry: () => ref.invalidate(noticesProvider(page)),
                    ),
                    data: (data) {
                      final notices = (data['items'] as List).cast<Json>();
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (notices.isEmpty)
                            const NodraEmptyState(
                              title: 'Todavía no hay mensajes.',
                              message: 'Los avisos de tu organización aparecerán aquí.',
                            ),
                          ...notices.map(
                            (n) => Padding(
                              padding: const EdgeInsets.only(bottom: 18),
                              child: NodraCard(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      n['title'] as String,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleLarge,
                                    ),
                                    const SizedBox(height: 12),
                                    Text(n['body'] as String),
                                    const SizedBox(height: 18),
                                    if (n['requiresAcknowledgement'] == true &&
                                        n['isRecipient'] != false)
                                      (n['acknowledgements'] as List).any(
                                            (a) =>
                                                a['userId'] ==
                                                session.user!['id'],
                                          )
                                          ? const NodraBadge(status: 'Leído')
                                          : NodraButton(
                                              label: 'He leído este aviso',
                                              secondary: true,
                                              onPressed: () => run(() async {
                                                await CoordinationRepository(
                                                  ref.read(apiProvider),
                                                  session.organizationId!,
                                                ).acknowledge(
                                                  n['id'] as String,
                                                );
                                                ref.invalidate(noticesProvider);
                                                ref.invalidate(
                                                  pendingNoticesProvider,
                                                );
                                              }),
                                            ),
                                    if (canManageNotices &&
                                        n['requiresAcknowledgement'] ==
                                            true) ...[
                                      const SizedBox(height: 14),
                                      if ((n['acknowledgements'] as List)
                                          .isEmpty)
                                        Text(
                                          'Aún no hay confirmaciones de lectura.',
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall,
                                        )
                                      else
                                        ExpansionTile(
                                          tilePadding: EdgeInsets.zero,
                                          childrenPadding: EdgeInsets.zero,
                                          title: Text(
                                            (n['acknowledgements'] as List)
                                                        .length ==
                                                    1
                                                ? '1 persona confirmó la lectura'
                                                : '${(n['acknowledgements'] as List).length} personas confirmaron la lectura',
                                          ),
                                          children: [
                                            ...(n['acknowledgements'] as List)
                                                .cast<Json>()
                                                .map((ack) {
                                                  final person =
                                                      ack['user'] as Json;
                                                  final firstName =
                                                      person['firstName']
                                                          as String;
                                                  final lastName =
                                                      person['lastName']
                                                          as String;
                                                  return ListTile(
                                                    contentPadding:
                                                        EdgeInsets.zero,
                                                    leading: CircleAvatar(
                                                      radius: 17,
                                                      backgroundColor:
                                                          Theme.of(context)
                                                              .colorScheme
                                                              .primaryContainer,
                                                      child: Text(
                                                        '${firstName[0]}${lastName[0]}',
                                                      ),
                                                    ),
                                                    title: Text(
                                                      '$firstName $lastName',
                                                    ),
                                                  );
                                                }),
                                          ],
                                        ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          ),
                          pagination(data['total'] as int? ?? 0),
                        ],
                      );
                    },
                  ),
            ] else if (tab == 3) ...[
              CalendarScreen(key: ValueKey(session.organizationId)),
            ] else if (tab == 0) ...[
              WorkerHome(
                key: ValueKey(session.organizationId),
                session: session,
              ),
            ] else ...[
              Text(
                tab == 0
                    ? 'Hola, ${session.user!['firstName']}.'
                    : organizationText(context, "Servicios."),
                style: Theme.of(context).textTheme.headlineLarge,
              ),
              const SizedBox(height: 12),
              Text(
                tab == 0
                    ? 'Tu próximo paso, sin perderte nada.'
                    : organizationText(
                        context,
                        "Consulta servicios de tu organización.",
                      ),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 28),
              ServiceFilters(
                key: ValueKey(session.organizationId),
                org: session.organizationId!,
                timezone: session.organization?['timezone'] as String? ?? 'UTC',
                initial: serviceQuery,
                onApply: (query) => setState(() {
                  page = 1;
                  serviceSearch = query.search;
                  serviceStatus = query.status;
                  serviceRole = query.jobRoleId;
                  serviceFrom = query.from;
                  serviceTo = query.to;
                }),
              ),
              ref
                  .watch(servicesProvider(serviceQuery))
                  .when(
                    loading: () =>
                        const Center(child: CircularProgressIndicator()),
                    error: (e, _) => NodraError(
                      message: e.toString(),
                      retry: () =>
                          ref.invalidate(servicesProvider(serviceQuery)),
                    ),
                    data: (data) {
                      final services = (data['items'] as List).cast<Json>();
                      final visible = [...services];
                      if (tab == 0) {
                        visible.sort((a, b) {
                          final cancelled = (a['status'] == 'CANCELLED' ? 1 : 0)
                              .compareTo(b['status'] == 'CANCELLED' ? 1 : 0);
                          if (cancelled != 0) return cancelled;
                          final attention = pending(b).compareTo(pending(a));
                          if (attention != 0) return attention;
                          final start = (a['startsAt'] as String).compareTo(
                            b['startsAt'] as String,
                          );
                          return start != 0
                              ? start
                              : (a['id'] as String).compareTo(
                                  b['id'] as String,
                                );
                        });
                      }
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (visible.isEmpty)
                            NodraEmptyState(
                              title:
                                  serviceSearch.isNotEmpty ||
                                      serviceStatus.isNotEmpty ||
                                      serviceRole.isNotEmpty ||
                                      serviceFrom.isNotEmpty ||
                                      serviceTo.isNotEmpty
                                  ? organizationText(
                                      context,
                                      "No hay servicios que coincidan.",
                                    )
                                  : organizationText(
                                      context,
                                      "Sin servicios por ahora.",
                                    ),
                              message:
                                  serviceSearch.isNotEmpty ||
                                      serviceStatus.isNotEmpty ||
                                      serviceRole.isNotEmpty ||
                                      serviceFrom.isNotEmpty ||
                                      serviceTo.isNotEmpty
                                  ? 'Prueba con otros filtros.'
                                  : organizationText(
                                      context,
                                      "Consulta fechas y participa cuando haya servicios disponibles.",
                                    ),
                            ),
                          ...visible.map(
                            (s) => Padding(
                              padding: const EdgeInsets.only(bottom: 18),
                              child: NodraCard(
                                status: s['status'] as String,
                                onTap: () =>
                                    context.push('/services/${s['id']}'),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (pending(s) > 0) ...[
                                      const NodraBadge(
                                        status:
                                            'Tu confirmación está pendiente',
                                      ),
                                      const SizedBox(height: 14),
                                    ],
                                    Text(
                                      s['title'] as String,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleLarge
                                          ?.copyWith(
                                            color: s['status'] == 'CANCELLED'
                                                ? mutedColor
                                                : inkColor,
                                          ),
                                    ),
                                    if (serviceParticipation(
                                          s,
                                          session.user!['id'] as String,
                                        )
                                        case final label?) ...[
                                      const SizedBox(height: 8),
                                      Row(
                                        children: [
                                          const Icon(
                                            Icons.check_rounded,
                                            size: 16,
                                            color: Color(0xff187a77),
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            label,
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodySmall
                                                ?.copyWith(
                                                  color: const Color(
                                                    0xff187a77,
                                                  ),
                                                ),
                                          ),
                                        ],
                                      ),
                                    ],
                                    const SizedBox(height: 12),
                                    Text(formatServiceDate(s)),
                                    const SizedBox(height: 6),
                                    Text(
                                      s['locationText'] as String,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall,
                                    ),
                                    const SizedBox(height: 20),
                                    Row(
                                      children: [
                                        NodraBadge(
                                          status: s['status'] as String,
                                        ),
                                        const Spacer(),
                                        Icon(
                                          Icons.arrow_forward,
                                          color: s['status'] == 'CANCELLED'
                                              ? mutedColor
                                              : inkColor,
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          pagination(data['total'] as int? ?? 0),
                        ],
                      );
                    },
                  ),
            ],
          ],
        ),
      ),
    );
  }

  int pending(Json service) => (service['positions'] as List)
      .expand((p) => p['assignments'] as List)
      .where(
        (a) =>
            a['userId'] == widget.session.user!['id'] &&
            a['status'] == 'AWAITING_CONFIRMATION',
      )
      .length;
  Widget pagination(int total) => total > 25
      ? Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton(
              onPressed: page > 1 ? () => setState(() => page--) : null,
              child: const Text('Anterior'),
            ),
            Text('$page / ${(total / 25).ceil()}'),
            TextButton(
              onPressed: page * 25 < total
                  ? () => setState(() => page++)
                  : null,
              child: const Text('Siguiente'),
            ),
          ],
        )
      : const SizedBox.shrink();
}

class JoinCard extends ConsumerStatefulWidget {
  const JoinCard({super.key, this.onAccepted});
  final VoidCallback? onAccepted;
  @override
  ConsumerState<JoinCard> createState() => _JoinCardState();
}

class _JoinCardState extends ConsumerState<JoinCard> {
  final code = TextEditingController();
  String? preview, error;
  bool busy = false;
  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!RegExp(r'^\d{12}$').hasMatch(code.text)) {
      setState(() => error = 'Introduce un código válido de 12 cifras.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final api = ref.read(apiProvider);
      if (preview == null) {
        final result = await api.request(
          '/invitations/preview',
          method: 'POST',
          data: {'token': code.text.trim()},
        ) as Json;
        if (mounted) {
          setState(() => preview = result['organizationName'] as String);
        }
      } else {
        final joined = await api.request(
          '/invitations/accept',
          method: 'POST',
          data: {'token': code.text.trim()},
        ) as Json;
        final session = ref.read(sessionProvider.notifier);
        await session.reload();
        await session.select(joined['organizationId'] as String);
        if (mounted) widget.onAccepted?.call();
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => NodraCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Aceptar invitación',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 12),
        const Text(
          'Introduce el código de 12 cifras que te ha enviado tu organización.',
        ),
        const SizedBox(height: 20),
        TextField(
          controller: code,
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.oneTimeCode],
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(12),
          ],
          decoration: const InputDecoration(labelText: 'Código de 12 cifras'),
          onChanged: (_) => setState(() => preview = null),
        ),
        const SizedBox(height: 20),
        if (preview != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text('Te han invitado a $preview.'),
          ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: NodraInlineError(message: error!),
          ),
        NodraButton(
          label: busy
              ? 'Un momento…'
              : preview == null
              ? 'Consultar invitación'
              : 'Unirme a la organización',
          onPressed: busy ? null : submit,
        ),
      ],
    ),
  );
}
