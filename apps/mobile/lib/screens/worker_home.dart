import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/session.dart';
import '../core/services.dart';
import '../design/widgets.dart';

class WorkerHome extends ConsumerStatefulWidget {
  const WorkerHome({super.key, required this.session});
  final SessionState session;
  @override
  ConsumerState<WorkerHome> createState() => _WorkerHomeState();
}

class _WorkerHomeState extends ConsumerState<WorkerHome> {
  int attentionPage = 1, upcomingPage = 1, noticePage = 1;
  String? busyNotice, error;

  Future<void> acknowledge(String id) async {
    if (busyNotice != null) return;
    setState(() {
      busyNotice = id;
      error = null;
    });
    try {
      await CoordinationRepository(
        ref.read(apiProvider),
        widget.session.organizationId!,
      ).acknowledge(id);
      ref.invalidate(pendingNoticesProvider);
      ref.invalidate(noticesProvider);
      if (mounted) setState(() => noticePage = 1);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busyNotice = null);
    }
  }

  Widget pages(int page, int total, void Function(int) change) => total > 5
      ? Row(
          children: [
            TextButton(
              onPressed: page > 1 ? () => change(page - 1) : null,
              child: const Text('Anterior'),
            ),
            Expanded(
              child: Text(
                '$page / ${(total / 5).ceil()}',
                textAlign: TextAlign.center,
              ),
            ),
            TextButton(
              onPressed: page * 5 < total ? () => change(page + 1) : null,
              child: const Text('Siguiente'),
            ),
          ],
        )
      : const SizedBox.shrink();

  Widget serviceRow(Json service, {required bool attention}) {
    final day = service['localStartDay'] as String;
    final time = service['localStartTime'] as String;
    final zone = service['timezone'] as String;
    final label = attention
        ? service['status'] == 'DRAFT'
              ? 'Revisar borrador'
              : 'Confirmación pendiente'
        : service['status'] == 'OPEN'
        ? 'Disponible'
        : statusLabels[service['status']] ?? service['status'];
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(service['title'] as String),
      subtitle: Text(
        '$label · ${day.substring(8, 10)}/${day.substring(5, 7)} · $time\n$zone',
      ),
      isThreeLine: true,
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: () => context.push('/services/${service['id']}'),
    );
  }

  Widget section(
    String title,
    AsyncValue<Json> state,
    VoidCallback retry,
    Widget Function(Json) content,
  ) => Padding(
    padding: const EdgeInsets.only(bottom: 28),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        state.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => NodraError(message: e.toString(), retry: retry),
          data: content,
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final attention = (filter: 'attention', page: attentionPage);
    final upcoming = (filter: 'upcoming', page: upcomingPage);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Hola, ${widget.session.user!['firstName']}.',
          style: Theme.of(context).textTheme.headlineLarge,
        ),
        const SizedBox(height: 28),
        if (error != null)
          NodraError(
            message: error!,
            retry: () => setState(() => error = null),
            actionLabel: 'Cerrar aviso',
          ),
        section(
          'Acciones pendientes',
          ref.watch(dashboardProvider(attention)),
          () => ref.invalidate(dashboardProvider(attention)),
          (data) {
            final items = (data['items'] as List).cast<Json>();
            return Column(
              children: [
                if (items.isEmpty)
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Text('Sin confirmaciones pendientes.'),
                  ),
                ...items.map((item) => serviceRow(item, attention: true)),
                pages(
                  attentionPage,
                  data['total'] as int,
                  (page) => setState(() => attentionPage = page),
                ),
              ],
            );
          },
        ),
        section(
          'Avisos pendientes',
          ref.watch(pendingNoticesProvider(noticePage)),
          () => ref.invalidate(pendingNoticesProvider(noticePage)),
          (data) {
            final items = (data['items'] as List).cast<Json>();
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (items.isEmpty)
                  const Text('No hay notificaciones pendientes.'),
                ...items.map(
                  (notice) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          notice['title'] as String,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 6),
                        Text(notice['body'] as String),
                        TextButton(
                          onPressed: busyNotice == null
                              ? () => acknowledge(notice['id'] as String)
                              : null,
                          child: Text(
                            busyNotice == notice['id']
                                ? 'Guardando…'
                                : 'He leído',
                          ),
                        ),
                        const Divider(),
                      ],
                    ),
                  ),
                ),
                pages(
                  noticePage,
                  data['total'] as int,
                  (page) => setState(() => noticePage = page),
                ),
              ],
            );
          },
        ),
        section(
          'Próximos servicios',
          ref.watch(dashboardProvider(upcoming)),
          () => ref.invalidate(dashboardProvider(upcoming)),
          (data) {
            final items = (data['items'] as List).cast<Json>();
            return Column(
              children: [
                if (items.isEmpty)
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Text('No hay servicios próximos.'),
                  ),
                ...items.map((item) => serviceRow(item, attention: false)),
                pages(
                  upcomingPage,
                  data['total'] as int,
                  (page) => setState(() => upcomingPage = page),
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}
