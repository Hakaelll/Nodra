import '../l10n/translation.dart';

import 'package:flutter/material.dart';

import 'theme.dart';

class NodraTextField extends TextFormField {
  NodraTextField({
    super.key,
    super.controller,
    super.initialValue,
    super.focusNode,
    super.decoration,
    super.keyboardType,
    super.textInputAction,
    super.textCapitalization,
    super.obscureText,
    super.autofillHints,
    super.autocorrect,
    super.enableSuggestions,
    super.enabled,
    super.readOnly,
    super.maxLength,
    super.minLines,
    super.maxLines,
    super.onChanged,
    super.onFieldSubmitted,
    super.validator,
    super.autovalidateMode,
  });
}

class NodraDialog extends AlertDialog {
  const NodraDialog({
    super.key,
    super.title,
    super.content,
    super.actions,
    super.scrollable,
  });
}

class NodraOrganizationSwitcher extends StatelessWidget {
  const NodraOrganizationSwitcher({
    super.key,
    required this.value,
    required this.label,
    required this.organizations,
    required this.onChanged,
  });
  final String? value;
  final String label;
  final List<({String id, String name})> organizations;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => DropdownButtonFormField<String>(
    key: ValueKey(value),
    initialValue: value,
    isExpanded: true,
    decoration: InputDecoration(labelText: label),
    items: organizations
        .map(
          (org) => DropdownMenuItem(
            value: org.id,
            child: Text(org.name, overflow: TextOverflow.ellipsis),
          ),
        )
        .toList(),
    onChanged: (id) {
      if (id != null) onChanged(id);
    },
  );
}

class NodraSkeleton extends StatelessWidget {
  const NodraSkeleton({super.key});

  @override
  Widget build(BuildContext context) => Semantics(
    label: tr(context, 'Cargando'),
    liveRegion: true,
    child: ExcludeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final width in [0.55, 1.0, 0.8])
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: FractionallySizedBox(
                widthFactor: width,
                child: Container(
                  height: 18,
                  decoration: BoxDecoration(
                    color: Theme.of(context)
                        .colorScheme
                        .surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(6),
                  ),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

class NodraButton extends StatelessWidget {
  const NodraButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.secondary = false,
  });
  final String label;
  final VoidCallback? onPressed;
  final bool secondary;
  @override
  Widget build(BuildContext context) => secondary
      ? OutlinedButton(onPressed: onPressed, child: Text(label))
      : FilledButton(onPressed: onPressed, child: Text(label));
}

class NodraCard extends StatelessWidget {
  const NodraCard({super.key, required this.child, this.onTap, this.status});
  final Widget child;
  final VoidCallback? onTap;
  final String? status;
  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    color: status == 'CANCELLED' ? const Color(0xfff6f7fa) : null,
    shape: status == 'CANCELLED'
        ? RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(26),
            side: const BorderSide(color: Color(0xffd9dee8)),
          )
        : null,
    child: onTap == null
        ? Padding(padding: const EdgeInsets.all(20), child: child)
        : InkWell(
            onTap: onTap,
            child: Padding(padding: const EdgeInsets.all(20), child: child),
          ),
  );
}

class NodraEmptyState extends StatelessWidget {
  const NodraEmptyState({
    super.key,
    required this.title,
    required this.message,
  });
  final String title, message;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 50, horizontal: 15),
    child: Column(
      children: [
        const Icon(Icons.inbox_outlined, color: mutedColor, size: 32),
        const SizedBox(height: 16),
        Text(
          tr(context, title),
          style: Theme.of(context).textTheme.titleLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 10),
        Text(tr(context, message), textAlign: TextAlign.center),
      ],
    ),
  );
}

const statusLabels = {
  'DRAFT': 'Borrador',
  'OPEN': 'Abierto',
  'SELECTION': 'En selección',
  'CONFIRMATION': 'En confirmación',
  'READY': 'Preparado',
  'IN_PROGRESS': 'En curso',
  'COMPLETED': 'Completado',
  'CANCELLED': 'Cancelado',
  'AWAITING_CONFIRMATION': 'Pendiente de confirmar',
  'CONFIRMED': 'Confirmado',
  'DECLINED': 'Rechazado',
};

class NodraBadge extends StatelessWidget {
  const NodraBadge({super.key, required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'CONFIRMED' || 'READY' || 'COMPLETED' => const Color(0xff187a77),
      'IN_PROGRESS' => const Color(0xff9c5a18),
      'OPEN' ||
      'SELECTION' ||
      'CONFIRMATION' ||
      'AWAITING_CONFIRMATION' => const Color(0xff5944db),
      _ => const Color(0xff50617a),
    };
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 2,
          height: 14,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 9),
        Text(
          tr(context, statusLabels[status] ?? status),
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: color, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }
}

class NodraError extends StatelessWidget {
  const NodraError({
    super.key,
    required this.message,
    required this.retry,
    this.actionLabel = 'Volver a intentar',
  });
  final String message;
  final VoidCallback retry;
  final String actionLabel;
  @override
  Widget build(BuildContext context) => NodraCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: const Color(0xfffff4ee),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.error_outline_rounded,
                size: 20,
                color: Color(0xffa3573d),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tr(context, 'No se pudo completar'),
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    tr(context, message),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 15),
        NodraButton(
          label: tr(context, actionLabel),
          onPressed: retry,
          secondary: true,
        ),
      ],
    ),
  );
}

class NodraInlineError extends StatelessWidget {
  const NodraInlineError({super.key, required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
      decoration: BoxDecoration(
        color: const Color(0xfffff9f6),
        border: Border.all(color: const Color(0xffefd9cf)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.error_outline_rounded,
            size: 20,
            color: Color(0xff9b543f),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Text(
              tr(context, message),
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: const Color(0xff713c32), height: 1.4),
            ),
          ),
        ],
      ),
    ),
  );
}
