import 'package:flutter/material.dart';

import '../core/zoned_time.dart';
import 'widgets.dart';

class ZonedDatePicker extends StatefulWidget {
  const ZonedDatePicker({
    super.key,
    required this.label,
    required this.zone,
    required this.initial,
    required this.onChanged,
    required this.onError,
  });
  final String label, zone, initial;
  final ValueChanged<String> onChanged;
  final ValueChanged<String?> onError;
  @override
  State<ZonedDatePicker> createState() => _ZonedDatePickerState();
}

class _ZonedDatePickerState extends State<ZonedDatePicker> {
  DateTime? day, instant;
  TimeOfDay time = const TimeOfDay(hour: 9, minute: 0);
  List<DateTime> options = [];
  String? error;
  bool supported = true;
  @override
  void initState() {
    super.initState();
    try {
      organizationZone(widget.zone);
    } catch (_) {
      supported = false;
      error = 'La zona horaria no está disponible.';
      return;
    }
    if (widget.initial.isNotEmpty) {
      instant = DateTime.parse(widget.initial).toUtc();
      final local = organizationTime(instant!, widget.zone);
      day = DateTime(local.year, local.month, local.day);
      time = TimeOfDay(hour: local.hour, minute: local.minute);
      options = wallTimeOptions(
        DateTime.utc(
          local.year,
          local.month,
          local.day,
          time.hour,
          time.minute,
        ),
        widget.zone,
      );
    }
  }

  void resolve() {
    options = wallTimeOptions(
      DateTime.utc(day!.year, day!.month, day!.day, time.hour, time.minute),
      widget.zone,
    );
    instant = options.length == 1 ? options.single : null;
    error = options.isEmpty
        ? 'Esta hora no existe por el cambio horario. Elige otra.'
        : options.length > 1
        ? 'Esta hora ocurre dos veces. Elige una opción.'
        : null;
    widget.onError(error);
    if (instant != null) {
      widget.onChanged(instant!.toIso8601String());
    }
  }

  Future<void> chooseDay() async {
    final now = organizationTime(DateTime.now().toUtc(), widget.zone);
    final chosen = await showDatePicker(
      context: context,
      initialDate: day ?? DateTime(now.year, now.month, now.day),
      firstDate: DateTime(1970),
      lastDate: DateTime(2100, 12, 31),
      helpText: widget.label,
    );
    if (chosen == null || !mounted) return;
    setState(() {
      day = chosen;
      resolve();
    });
  }

  Future<void> chooseTime() async {
    final chosen = await showTimePicker(
      context: context,
      initialTime: time,
      helpText: widget.label,
    );
    if (chosen == null || !mounted) return;
    setState(() {
      time = chosen;
      resolve();
    });
  }

  void clear() {
    setState(() {
      day = null;
      instant = null;
      options = [];
      error = null;
    });
    widget.onChanged('');
    widget.onError(null);
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        '${widget.label} · ${widget.zone}',
        style: Theme.of(context).textTheme.bodySmall,
      ),
      Wrap(
        spacing: 8,
        children: [
          OutlinedButton.icon(
            onPressed: supported ? chooseDay : null,
            icon: const Icon(Icons.calendar_today_outlined, size: 18),
            label: Text(
              day == null
                  ? 'Elegir fecha'
                  : '${day!.day}/${day!.month}/${day!.year}',
            ),
          ),
          if (day != null)
            OutlinedButton(
              onPressed: chooseTime,
              child: Text(time.format(context)),
            ),
          if (day != null)
            IconButton(
              tooltip: 'Quitar ${widget.label.toLowerCase()}',
              onPressed: clear,
              icon: const Icon(Icons.close),
            ),
        ],
      ),
      if (options.length > 1)
        RadioGroup<DateTime>(
          groupValue: instant == null
              ? null
              : DateTime.fromMillisecondsSinceEpoch(
                  instant!.millisecondsSinceEpoch ~/ 60000 * 60000,
                  isUtc: true,
                ),
          onChanged: (chosen) {
            setState(() {
              instant = chosen;
              error = null;
            });
            widget.onChanged(chosen!.toIso8601String());
            widget.onError(null);
          },
          child: Column(
            children: [
              for (var index = 0; index < options.length; index++)
                RadioListTile<DateTime>(
                  title: Text(
                    '${index == 0 ? 'Primera' : 'Segunda'} ocurrencia · ${utcOffset(options[index], widget.zone)}',
                  ),
                  value: options[index],
                ),
            ],
          ),
        ),
      if (error != null) NodraInlineError(message: error!),
    ],
  );
}
