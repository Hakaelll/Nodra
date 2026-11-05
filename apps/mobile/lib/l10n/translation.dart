import 'package:flutter/widgets.dart';

import 'messages_en.dart';

String _normalize(String message) =>
    message.replaceAll(RegExp(r'\s+'), ' ').trim();
final _folded = {
  for (final entry in englishMessages.entries)
    entry.key.toLowerCase(): entry.value,
};
final _templates =
    englishMessages.entries
        .where(
          (entry) =>
              entry.key.contains('{value') &&
              entry.key
                      .replaceAll(RegExp(r'\{value\d+\}'), '')
                      .replaceAll(RegExp(r'[^A-Za-zÁÉÍÓÚÑáéíóúñ]'), '')
                      .length >=
                  3,
        )
        .toList()
      ..sort((left, right) => right.key.length.compareTo(left.key.length));
final _patterns = [
  for (final entry in _templates)
    (
      pattern: RegExp(
        '^${entry.key.split(RegExp(r'\{value\d+\}')).map(RegExp.escape).join(r'([\s\S]*?)')}\$',
        caseSensitive: false,
      ),
      value: entry.value,
    ),
];

String translateMessage(String language, String message) {
  if (language != 'en' || message.isEmpty || message.length > 8192) return message;
  final key = _normalize(message);
  var result = englishMessages[key];
  if (result == null) {
    for (final template in _patterns) {
      final match = template.pattern.firstMatch(key);
      if (match == null) continue;
      result = template.value.replaceAllMapped(
        RegExp(r'\{value(\d+)\}'),
        (part) => match.group(int.parse(part[1]!) + 1) ?? '',
      );
      break;
    }
  }
  if (result == null) {
    result = _folded[key.toLowerCase()];
    if (result != null && key == key.toUpperCase()) {
      result = result.toUpperCase();
    } else if (result != null && key[0] == key[0].toLowerCase()) {
      result = result[0].toLowerCase() + result.substring(1);
    }
  }
  if (result == null && RegExp(r'[.:]$').hasMatch(key)) {
    final base = key.substring(0, key.length - 1);
    final translated = translateMessage(language, base);
    if (translated != base) result = translated + key.substring(key.length - 1);
  }
  if (result == null && key.contains('; ')) {
    final translated = key
        .split('; ')
        .map((part) => translateMessage(language, part))
        .join('; ');
    if (translated != key) result = translated;
  }
  if (result == null && key.contains(': ')) {
    final split = key.indexOf(': ');
    final detail = key.substring(split + 2);
    final translated = translateMessage(language, detail);
    if (translated != detail) result = key.substring(0, split + 2) + translated;
  }
  if (result == null) return message;
  return '${RegExp(r'^\s*').firstMatch(message)![0]}$result${RegExp(r'\s*$').firstMatch(message)![0]}';
}

String tr(BuildContext context, String message) =>
    translateMessage(Localizations.localeOf(context).languageCode, message);
