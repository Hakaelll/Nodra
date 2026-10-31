enum AccountAction { reset, verify }

String? accountActionToken(String value, AccountAction action) {
  final input = value.trim();
  if (input.length > 4096) return null;
  final token = RegExp(r'^[a-f0-9]{64}$');
  if (token.hasMatch(input)) return input;
  final uri = Uri.tryParse(input);
  if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https')) {
    return null;
  }
  try {
    final fromLink = Uri.splitQueryString(uri.fragment)[action.name];
    return fromLink != null && token.hasMatch(fromLink) ? fromLink : null;
  } on FormatException {
    return null;
  }
}
