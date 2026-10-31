import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api.dart';
import '../core/services.dart';
import '../core/zoned_time.dart';
import '../design/zoned_date_picker.dart';
import '../design/widgets.dart';
import 'roles.dart';

class ServiceFilters extends ConsumerStatefulWidget {
  const ServiceFilters({
    super.key,
    required this.org,
    required this.timezone,
    required this.initial,
    required this.onApply,
  });
  final String org;
  final String timezone;
  final ServicesQuery initial;
  final void Function(ServicesQuery query) onApply;
  @override
  ConsumerState<ServiceFilters> createState() => _ServiceFiltersState();
}

class _ServiceFiltersState extends ConsumerState<ServiceFilters> {
  final search = TextEditingController();
  final roleSearch = TextEditingController();
  String status = '', roleId = '', roleName = '', catalogSearch = '';
  int rolePage = 1;
  Timer? timer;
  String from = '', to = '';
  String? fromError, toError, scheduleError;
  int dateReset = 0;
  @override
  void initState() {
    super.initState();
    search.text = widget.initial.search;
    status = widget.initial.status;
    roleId = widget.initial.jobRoleId;
    roleName = roleId.isEmpty ? '' : 'Rol seleccionado';
    from = widget.initial.from;
    to = widget.initial.to;
  }

  @override
  void dispose() {
    timer?.cancel();
    search.dispose();
    roleSearch.dispose();
    super.dispose();
  }

  void apply() {
    String? failure;
    try {
      organizationZone(widget.timezone);
    } catch (_) {
      failure = 'La zona horaria de la organización no está disponible.';
    }
    failure ??= fromError ?? toError;
    if (failure == null &&
        from.isNotEmpty &&
        to.isNotEmpty &&
        !DateTime.parse(from).isBefore(DateTime.parse(to))) {
      failure = 'La fecha hasta debe ser posterior a la fecha desde.';
    }
    setState(() => scheduleError = failure);
    if (failure != null) return;
    widget.onApply((
      page: 1,
      search: search.text.trim(),
      status: status,
      jobRoleId: roleId,
      from: from,
      to: to,
    ));
  }

  void clear() {
    timer?.cancel();
    search.clear();
    roleSearch.clear();
    setState(() {
      status = '';
      roleId = '';
      roleName = '';
      catalogSearch = '';
      rolePage = 1;
      from = '';
      to = '';
      fromError = null;
      toError = null;
      scheduleError = null;
      dateReset++;
    });
    apply();
  }

  @override
  Widget build(BuildContext context) {
    final query = (org: widget.org, page: rolePage, search: catalogSearch);
    return ExpansionTile(
      title: const Text('Filtrar servicios'),
      tilePadding: EdgeInsets.zero,
      childrenPadding: const EdgeInsets.only(bottom: 16),
      children: [
        TextField(
          controller: search,
          maxLength: 120,
          decoration: const InputDecoration(
            labelText: 'Buscar servicios',
            counterText: '',
          ),
          onSubmitted: (_) => apply(),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          key: ValueKey('status-$status'),
          initialValue: status,
          decoration: const InputDecoration(labelText: 'Estado'),
          items: const [
            DropdownMenuItem(value: '', child: Text('Todos los estados')),
            DropdownMenuItem(value: 'DRAFT', child: Text('Borrador')),
            DropdownMenuItem(value: 'OPEN', child: Text('Abierto')),
            DropdownMenuItem(value: 'SELECTION', child: Text('En selección')),
            DropdownMenuItem(
              value: 'CONFIRMATION',
              child: Text('En confirmación'),
            ),
            DropdownMenuItem(value: 'READY', child: Text('Preparado')),
            DropdownMenuItem(value: 'IN_PROGRESS', child: Text('En curso')),
            DropdownMenuItem(value: 'CANCELLED', child: Text('Cancelado')),
            DropdownMenuItem(value: 'COMPLETED', child: Text('Completado')),
          ],
          onChanged: (value) => setState(() => status = value ?? ''),
        ),
        const SizedBox(height: 12),
        ref
            .watch(rolesProvider(query))
            .when(
              loading: () => const Padding(
                padding: EdgeInsets.all(12),
                child: CircularProgressIndicator(),
              ),
              error: (failure, _) => Column(
                children: [
                  NodraInlineError(message: failure.toString()),
                  TextButton(
                    onPressed: () => ref.invalidate(rolesProvider(query)),
                    child: const Text('Reintentar roles'),
                  ),
                ],
              ),
              data: (result) {
                final roles = (result['items'] as List).cast<Json>();
                final total = result['total'] as int;
                return Column(
                  children: [
                    DropdownButtonFormField<String>(
                      key: ValueKey('role-$roleId-$rolePage-$catalogSearch'),
                      initialValue: roleId,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Rol laboral',
                      ),
                      items: [
                        const DropdownMenuItem(
                          value: '',
                          child: Text('Todos los roles'),
                        ),
                        if (roleId.isNotEmpty &&
                            !roles.any((role) => role['id'] == roleId))
                          DropdownMenuItem(
                            value: roleId,
                            child: Text(roleName),
                          ),
                        for (final role in roles)
                          DropdownMenuItem(
                            value: role['id'] as String,
                            child: Text(
                              '${role['name']}${role['active'] == false ? ' · Archivado' : ''}',
                            ),
                          ),
                      ],
                      onChanged: (value) => setState(() {
                        roleId = value ?? '';
                        if (roleId.isEmpty) {
                          roleName = '';
                        } else {
                          roleName =
                              roles.firstWhere(
                                    (role) => role['id'] == roleId,
                                    orElse: () => {'name': roleName},
                                  )['name']
                                  as String;
                        }
                      }),
                    ),
                    if (total > 10 || rolePage > 1)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          TextButton(
                            onPressed: rolePage == 1
                                ? null
                                : () => setState(() => rolePage--),
                            child: const Text('Anterior rol'),
                          ),
                          Text('Página $rolePage'),
                          TextButton(
                            onPressed: rolePage * 10 >= total
                                ? null
                                : () => setState(() => rolePage++),
                            child: const Text('Siguiente rol'),
                          ),
                        ],
                      ),
                  ],
                );
              },
            ),
        const SizedBox(height: 12),
        TextField(
          controller: roleSearch,
          maxLength: 120,
          decoration: const InputDecoration(
            labelText: 'Buscar roles',
            counterText: '',
          ),
          onChanged: (value) {
            timer?.cancel();
            timer = Timer(const Duration(milliseconds: 180), () {
              if (mounted) {
                setState(() {
                  catalogSearch = value.trim();
                  rolePage = 1;
                });
              }
            });
          },
        ),
        if (roleId.isNotEmpty)
          TextButton(
            onPressed: () => setState(() {
              roleId = '';
              roleName = '';
            }),
            child: const Text('Quitar rol'),
          ),
        const SizedBox(height: 12),
        ZonedDatePicker(
          key: ValueKey('from-$dateReset-${widget.timezone}'),
          label: 'Desde',
          zone: widget.timezone,
          initial: from,
          onChanged: (value) => setState(() {
            from = value;
            scheduleError = null;
          }),
          onError: (error) => setState(() => fromError = error),
        ),
        const SizedBox(height: 12),
        ZonedDatePicker(
          key: ValueKey('to-$dateReset-${widget.timezone}'),
          label: 'Hasta',
          zone: widget.timezone,
          initial: to,
          onChanged: (value) => setState(() {
            to = value;
            scheduleError = null;
          }),
          onError: (error) => setState(() => toError = error),
        ),
        if (scheduleError != null) NodraInlineError(message: scheduleError!),
        const SizedBox(height: 12),
        Row(
          children: [
            FilledButton(
              onPressed: apply,
              child: const Text('Aplicar filtros'),
            ),
            const SizedBox(width: 8),
            TextButton(onPressed: clear, child: const Text('Limpiar filtros')),
          ],
        ),
      ],
    );
  }
}
