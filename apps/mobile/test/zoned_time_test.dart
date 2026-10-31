import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nodra/core/zoned_time.dart';
import 'package:nodra/design/zoned_date_picker.dart';

void main() {
  test('Madrid spring gap is rejected instead of silently moved forward', () {
    expect(
      wallTimeOptions(DateTime.utc(2026, 3, 29, 2, 30), 'Europe/Madrid'),
      isEmpty,
    );
  });
  test('Madrid autumn hour offers both real UTC instants in order', () {
    final options = wallTimeOptions(
      DateTime.utc(2026, 10, 25, 2, 30),
      'Europe/Madrid',
    );
    expect(options, [
      DateTime.utc(2026, 10, 25, 0, 30),
      DateTime.utc(2026, 10, 25, 1, 30),
    ]);
    expect(utcOffset(options.first, 'Europe/Madrid'), 'UTC+02:00');
    expect(utcOffset(options.last, 'Europe/Madrid'), 'UTC+01:00');
  });
  test('Lord Howe repeated hour handles thirty minute transitions', () {
    final options = wallTimeOptions(
      DateTime.utc(2026, 4, 5, 1, 45),
      'Australia/Lord_Howe',
    );
    expect(options.length, 2);
    expect(options.last.difference(options.first), const Duration(minutes: 30));
  });
  test('fractional timezone offset and skipped calendar day are supported', () {
    expect(wallTimeOptions(DateTime.utc(2026, 10, 2, 9), 'Asia/Kathmandu'), [
      DateTime.utc(2026, 10, 2, 3, 15),
    ]);
    expect(
      wallTimeOptions(DateTime.utc(2011, 12, 30, 9), 'Pacific/Apia'),
      isEmpty,
    );
  });
  test('unknown zone is rejected rather than treated as device time', () {
    expect(
      () => wallTimeOptions(DateTime.utc(2026, 10, 2, 9), 'Invalid/Zone'),
      throwsA(anything),
    );
  });
  testWidgets(
    'picker restores second occurrence and changes it only on explicit choice',
    (tester) async {
      final values = <String>[];
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ZonedDatePicker(
              label: 'Desde',
              zone: 'Europe/Madrid',
              initial: '2026-10-25T01:30:23.456Z',
              onChanged: values.add,
              onError: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(values, isEmpty);
      expect(
        tester
            .widget<RadioGroup<DateTime>>(find.byType(RadioGroup<DateTime>))
            .groupValue,
        DateTime.utc(2026, 10, 25, 1, 30),
      );
      await tester.tap(find.text('Primera ocurrencia · UTC+02:00'));
      await tester.pumpAndSettle();
      expect(values.single, '2026-10-25T00:30:00.000Z');
      await tester.tap(find.byTooltip('Quitar desde'));
      await tester.pumpAndSettle();
      expect(values.last, '');
    },
  );
}
