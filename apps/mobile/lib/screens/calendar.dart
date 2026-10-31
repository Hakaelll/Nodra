import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/services.dart';
import '../design/theme.dart';
import '../design/widgets.dart';

const _months = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const _weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const _weekdayNames = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
];

List<Json> calendarEventsForDay(List<Json> events, String day) => events
    .where(
      (event) =>
          (event['localStartDay'] as String).compareTo(day) <= 0 &&
          (event['localEndDay'] as String).compareTo(day) >= 0,
    )
    .toList();

const _eventColors = [
  Color(0xff5944db),
  Color(0xff167571),
  Color(0xff9c5a18),
  Color(0xffa24665),
  Color(0xff376aa5),
  Color(0xff7650a2),
];

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  String? month;
  String? selectedDay;

  String changeMonth(String source, int delta) {
    final date = DateTime.utc(
      int.parse(source.substring(0, 4)),
      int.parse(source.substring(5, 7)) + delta,
      1,
    );
    return '${date.year}-${date.month.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) => ref
      .watch(calendarProvider(month))
      .when(
        loading: () => const Center(
          child: Padding(
            padding: EdgeInsets.all(40),
            child: CircularProgressIndicator(),
          ),
        ),
        error: (error, _) => NodraError(
          message: error.toString(),
          retry: () => ref.invalidate(calendarProvider(month)),
        ),
        data: (data) {
          final visibleMonth = data['month'] as String;
          final today = data['today'] as String;
          final timezone = data['timezone'] as String;
          final events = (data['events'] as List).cast<Json>();
          final eventColors = {
            for (var index = 0; index < events.length; index++)
              events[index]['id']
                  as String: events[index]['status'] == 'CANCELLED'
                  ? const Color(0xff79869a)
                  : _eventColors[index % _eventColors.length],
          };
          final selected = selectedDay?.startsWith('$visibleMonth-') == true
              ? selectedDay!
              : today.startsWith('$visibleMonth-')
              ? today
              : '$visibleMonth-01';
          final selectedEvents = calendarEventsForDay(events, selected);
          final selectedDate = DateTime.parse('${selected}T12:00:00Z');
          final first = DateTime.utc(
            int.parse(visibleMonth.substring(0, 4)),
            int.parse(visibleMonth.substring(5, 7)),
            1,
          );
          final days = DateTime.utc(first.year, first.month + 1, 0).day;
          final offset = first.weekday - 1;
          final upcoming = events
              .where((event) {
                final status = event['status'] as String;
                return status != 'DRAFT' &&
                    status != 'COMPLETED' &&
                    status != 'CANCELLED' &&
                    DateTime.parse(event['endsAt'] as String)
                        .isAfter(DateTime.now());
              })
              .take(4)
              .toList();
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Calendario',
                style: Theme.of(context).textTheme.headlineLarge,
              ),
              const SizedBox(height: 5),
              Text(
                'Horarios en $timezone',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${_months[first.month - 1]} ${first.year}',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  TextButton(
                    onPressed: () => setState(() {
                      month = null;
                      selectedDay = null;
                    }),
                    child: const Text('Hoy'),
                  ),
                  IconButton(
                    tooltip: 'Mes anterior',
                    onPressed: visibleMonth == '1900-01'
                        ? null
                        : () => setState(() {
                            month = changeMonth(visibleMonth, -1);
                            selectedDay = null;
                          }),
                    icon: const Icon(Icons.chevron_left),
                  ),
                  IconButton(
                    tooltip: 'Mes siguiente',
                    onPressed: visibleMonth == '2199-12'
                        ? null
                        : () => setState(() {
                            month = changeMonth(visibleMonth, 1);
                            selectedDay = null;
                          }),
                    icon: const Icon(Icons.chevron_right),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: _weekdays
                    .map(
                      (label) => Expanded(
                        child: Center(
                          child: Text(
                            label,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 8),
              LayoutBuilder(
                builder: (context, constraints) {
                  final cellWidth = constraints.maxWidth / 7;
                  return Wrap(
                    children: List.generate(offset + days, (index) {
                      if (index < offset) {
                        return SizedBox(width: cellWidth, height: 57);
                      }
                      final number = index - offset + 1;
                      final day =
                          '$visibleMonth-${number.toString().padLeft(2, '0')}';
                      final dayEvents = calendarEventsForDay(events, day);
                      return SizedBox(
                        width: cellWidth,
                        height: 57,
                        child: Semantics(
                          button: true,
                          selected: selected == day,
                          label:
                              '$number de ${_months[first.month - 1]}, ${dayEvents.length} servicios',
                          child: InkWell(
                            borderRadius: BorderRadius.circular(14),
                            onTap: () => setState(() => selectedDay = day),
                            child: Container(
                              margin: const EdgeInsets.all(2),
                              decoration: BoxDecoration(
                                color: selected == day
                                    ? const Color(0xffe8e9ff)
                                    : panelColor,
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  CircleAvatar(
                                    radius: 14,
                                    backgroundColor: today == day
                                        ? accentColor
                                        : Colors.transparent,
                                    child: Text(
                                      '$number',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: today == day
                                            ? Colors.white
                                            : inkColor,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: dayEvents
                                        .take(3)
                                        .map(
                                          (event) => Container(
                                            width: 5,
                                            height: 5,
                                            margin: const EdgeInsets.symmetric(
                                              horizontal: 1,
                                            ),
                                            decoration: BoxDecoration(
                                              color: eventColors[event['id']]!,
                                              shape: BoxShape.circle,
                                            ),
                                          ),
                                        )
                                        .toList(),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                  );
                },
              ),
              const SizedBox(height: 27),
              Text(
                '${_weekdayNames[selectedDate.weekday - 1]} ${selectedDate.day} de ${_months[selectedDate.month - 1]}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              if (selectedEvents.isEmpty)
                const NodraEmptyState(
                  title: 'Tu agenda está libre este día.',
                  message: 'Elige otro día para consultar sus servicios.',
                ),
              ...selectedEvents.map(
                (event) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: NodraCard(
                    status: event['status'] as String,
                    child: InkWell(
                      onTap: () => context.push('/services/${event['id']}'),
                      child: Row(
                        children: [
                          Container(
                            width: 4,
                            height: 68,
                            decoration: BoxDecoration(
                              color: eventColors[event['id']]!,
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  event['localStartDay'] == selected
                                      ? '${event['localStartTime']} – ${event['localEndDay'] == selected ? event['localEndTime'] : 'continúa'}'
                                      : 'Continúa – ${event['localEndDay'] == selected ? event['localEndTime'] : 'día siguiente'}',
                                  style: TextStyle(
                                    color: eventColors[event['id']]!,
                                    fontSize: 12,
                                  ),
                                ),
                                const SizedBox(height: 5),
                                Text(
                                  event['title'] as String,
                                  style: Theme.of(context).textTheme.titleLarge
                                      ?.copyWith(
                                        color: event['status'] == 'CANCELLED'
                                            ? mutedColor
                                            : inkColor,
                                      ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  event['locationText'] as String,
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                                const SizedBox(height: 5),
                                Text(
                                  statusLabels[event['status']] ??
                                      event['status'] as String,
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_right, size: 18),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              if (upcoming.isNotEmpty) ...[
                const SizedBox(height: 20),
                Text(
                  'Próximos servicios',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 10),
                ...upcoming.map(
                  (event) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Container(
                      width: 3,
                      height: 36,
                      decoration: BoxDecoration(
                        color: eventColors[event['id']]!,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                    title: Text(event['title'] as String),
                    subtitle: Text(
                      '${event['localStartDay']} · ${event['localStartTime']}',
                    ),
                    trailing: const Icon(Icons.chevron_right, size: 18),
                    onTap: () => context.push('/services/${event['id']}'),
                  ),
                ),
              ],
            ],
          );
        },
      );
}
