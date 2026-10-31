import 'package:timezone/data/latest_all.dart' as data;
import 'package:timezone/timezone.dart' as tz;

bool _initialized = false;
tz.Location organizationZone(String name) {
  if (!_initialized) {
    data.initializeTimeZones();
    _initialized = true;
  }
  return tz.getLocation(name);
}

/// Enumerate real instants matching wall-clock fields; never normalize DST gaps.
List<DateTime> wallTimeOptions(DateTime wall, String zone) {
  final location = organizationZone(zone);
  final fields = DateTime.utc(
    wall.year,
    wall.month,
    wall.day,
    wall.hour,
    wall.minute,
  );
  final options = <DateTime>[];
  for (final offset in location.zones.map((zone) => zone.offset).toSet()) {
    final candidate = fields.subtract(offset);
    final local = tz.TZDateTime.from(candidate, location);
    if (local.year == wall.year &&
        local.month == wall.month &&
        local.day == wall.day &&
        local.hour == wall.hour &&
        local.minute == wall.minute &&
        local.second == 0 &&
        local.millisecond == 0) {
      options.add(candidate);
    }
  }
  options.sort();
  return options;
}

tz.TZDateTime organizationTime(DateTime instant, String zone) =>
    tz.TZDateTime.from(instant, organizationZone(zone));
String utcOffset(DateTime instant, String zone) {
  final minutes = organizationTime(instant, zone).timeZoneOffset.inMinutes;
  return 'UTC${minutes < 0 ? '-' : '+'}${(minutes.abs() ~/ 60).toString().padLeft(2, '0')}:${(minutes.abs() % 60).toString().padLeft(2, '0')}';
}
