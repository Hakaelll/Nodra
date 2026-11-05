import '../l10n/translation.dart';
import '../design/organization_presentation.dart';

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api.dart';
import '../core/session.dart';
import '../design/widgets.dart';

typedef RolesQuery = ({String org, int page, String search});
final rolesProvider = FutureProvider.autoDispose.family<Json, RolesQuery>((
  ref,
  query,
) async {
  final session = ref.watch(sessionProvider).value;
  if (session?.organizationId != query.org) {
    throw const ApiFailure('Selecciona la organización de nuevo.');
  }
  final params = Uri(
    queryParameters: {
      'page': '${query.page}',
      'limit': '10',
      if (query.search.isNotEmpty) 'search': query.search,
    },
  ).query;
  return await ref
          .read(apiProvider)
          .request('/organizations/${query.org}/roles/catalog?$params')
      as Json;
});

class RolesScreen extends ConsumerStatefulWidget {
  const RolesScreen({super.key, required this.organizationId});
  final String organizationId;
  @override
  ConsumerState<RolesScreen> createState() => _RolesScreenState();
}

class _RolesScreenState extends ConsumerState<RolesScreen> {
  bool busy = false;
  String? error;
  int page = 1;
  String search = '';
  Timer? searchTimer;
  final searchController = TextEditingController();
  RolesQuery get query =>
      (org: widget.organizationId, page: page, search: search);
  @override
  void dispose() {
    searchTimer?.cancel();
    searchController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant RolesScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.organizationId != widget.organizationId) {
      searchTimer?.cancel();
      searchController.clear();
      search = '';
      page = 1;
      error = null;
    }
  }

  bool get canManage {
    final session = ref.read(sessionProvider).value;
    return session?.organizationId == widget.organizationId &&
        (session?.memberships.any(
              (member) =>
                  (member['organization'] as Json)['id'] ==
                      widget.organizationId &&
                  [
                    'OWNER',
                    'ADMIN',
                    'COORDINATOR',
                  ].contains(member['permissionRole']),
            ) ??
            false);
  }

  Future<void> update(Json? role, Json fields) async {
    if (!canManage) {
      throw const ApiFailure('No tienes acceso a esta organización.');
    }
    await ref
        .read(apiProvider)
        .request(
          '/organizations/${widget.organizationId}/roles${role == null ? '' : '/${role['id']}'}',
          method: role == null ? 'POST' : 'PATCH',
          data: fields,
        );
    if (mounted) ref.invalidate(rolesProvider(query));
  }

  Future<void> edit(Json? role) => showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) =>
        _RoleEditor(role: role, save: (fields) => update(role, fields)),
  );
  Future<void> toggle(Json role) async {
    if (busy) return;
    final active = role['active'] == true;
    if (active) {
      final accepted = await showDialog<bool>(
        context: context,
        builder: (ctx) => NodraDialog(
          title: Text(tr(context, '¿Archivar ${role['name']}?')),
          content: Text(
            tr(
              context,
              'Dejará de estar disponible para nuevas posiciones. El historial se conservará.',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(tr(context, 'Cancelar')),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(organizationText(ctx, "Archivar rol")),
            ),
          ],
        ),
      );
      if (accepted != true || !mounted) return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await update(role, {'active': !active});
    } catch (failure) {
      if (mounted) setState(() => error = failure.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(sessionProvider);
    if (!canManage) {
      return Scaffold(
        appBar: AppBar(title: Text(organizationText(context, "Roles"))),
        body: Center(
          child: Text(tr(context, 'No tienes acceso a esta organización.')),
        ),
      );
    }
    final roles = ref.watch(rolesProvider(query));
    return Scaffold(
      appBar: AppBar(
        title: Text(organizationText(context, "Roles")),
        actions: [
          IconButton(
            tooltip: organizationText(context, "Crear rol"),
            onPressed: busy ? null : () => edit(null),
            icon: const Icon(Icons.add),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: searchController,
              enabled: !busy,
              maxLength: 120,
              decoration: InputDecoration(
                labelText: organizationText(context, "Buscar roles"),
                counterText: '',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (value) {
                searchTimer?.cancel();
                searchTimer = Timer(const Duration(milliseconds: 180), () {
                  if (mounted) {
                    setState(() {
                      search = value.trim();
                      page = 1;
                    });
                  }
                });
              },
            ),
          ),
          Expanded(
            child: roles.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (failure, _) => Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    NodraInlineError(message: failure.toString()),
                    TextButton(
                      onPressed: () => ref.invalidate(rolesProvider(query)),
                      child: Text(tr(context, 'Reintentar')),
                    ),
                  ],
                ),
              ),
              data: (result) {
                final items = (result['items'] as List).cast<Json>();
                final total = result['total'] as int;
                return ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (error != null) NodraInlineError(message: error!),
                    if (total > 10 || page > 1)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          TextButton(
                            onPressed: busy || page == 1
                                ? null
                                : () => setState(() => page--),
                            child: Text(tr(context, 'Anterior')),
                          ),
                          Text(
                            tr(
                              context,
                              'Página $page de ${((total / 10).ceil()).clamp(1, 100000)}',
                            ),
                          ),
                          TextButton(
                            onPressed: busy || page * 10 >= total
                                ? null
                                : () => setState(() => page++),
                            child: Text(tr(context, 'Siguiente')),
                          ),
                        ],
                      ),
                    if (items.isEmpty)
                      Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          search.isEmpty
                              ? organizationText(
                                  context,
                                  "Todavía no hay roles disponibles.",
                                )
                              : organizationText(
                                  context,
                                  "No hay roles que coincidan.",
                                ),
                        ),
                      ),
                    for (final role in items)
                      ListTile(
                        title: Text(role['name'] as String),
                        subtitle: Text(
                          role['active'] == true
                              ? role['description'] as String
                              : tr(context, 'Archivado'),
                        ),
                        onTap: busy ? null : () => edit(role),
                        trailing: PopupMenuButton<String>(
                          enabled: !busy,
                          tooltip: organizationText(context, "Opciones de rol"),
                          onSelected: (action) =>
                              action == 'edit' ? edit(role) : toggle(role),
                          itemBuilder: (_) => [
                            PopupMenuItem(
                              value: 'edit',
                              child: Text(tr(context, 'Editar')),
                            ),
                            PopupMenuItem(
                              value: 'toggle',
                              child: Text(
                                role['active'] == true
                                    ? tr(context, 'Archivar')
                                    : tr(context, 'Reactivar'),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _RoleEditor extends StatefulWidget {
  const _RoleEditor({required this.role, required this.save});
  final Json? role;
  final Future<void> Function(Json fields) save;
  @override
  State<_RoleEditor> createState() => _RoleEditorState();
}

class _RoleEditorState extends State<_RoleEditor> {
  final form = GlobalKey<FormState>();
  late final name = TextEditingController(
    text: widget.role?['name'] as String? ?? '',
  );
  late final description = TextEditingController(
    text: widget.role?['description'] as String? ?? '',
  );
  bool busy = false;
  String? error;
  @override
  void dispose() {
    name.dispose();
    description.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (busy) return;
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.save({
        'name': name.text.trim(),
        'description': description.text,
      });
      if (mounted) Navigator.pop(context);
    } catch (failure) {
      if (mounted) setState(() => error = failure.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy,
    child: NodraDialog(
      title: Text(
        widget.role == null
            ? organizationText(context, "Crear rol")
            : organizationText(context, "Editar rol"),
      ),
      content: SingleChildScrollView(
        child: Form(
          key: form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              NodraTextField(
                controller: name,
                enabled: !busy,
                maxLength: 80,
                decoration: InputDecoration(
                  labelText: organizationText(context, "Rol: nombre"),
                ),
                validator: (value) => (value?.trim().length ?? 0) < 2
                    ? tr(context, 'Escribe al menos dos caracteres.')
                    : null,
              ),
              NodraTextField(
                controller: description,
                enabled: !busy,
                maxLength: 1000,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: tr(context, 'Descripción'),
                ),
              ),
              if (error != null) NodraInlineError(message: error!),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: busy ? null : () => Navigator.pop(context),
          child: Text(tr(context, 'Cancelar')),
        ),
        FilledButton(
          onPressed: busy ? null : save,
          child: Text(
            busy ? tr(context, 'Guardando…') : tr(context, 'Guardar cambios'),
          ),
        ),
      ],
    ),
  );
}
