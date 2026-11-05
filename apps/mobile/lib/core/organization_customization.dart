enum OrganizationAccent { violet, indigo, ink }

class OrganizationCustomization {
  const OrganizationCustomization({
    this.service = (singular: 'Servicio', plural: 'Servicios'),
    this.jobRole = (singular: 'Rol', plural: 'Roles'),
    this.accent = OrganizationAccent.violet,
  });

  final ({String singular, String plural}) service;
  final ({String singular, String plural}) jobRole;
  final OrganizationAccent accent;
  static const defaults = OrganizationCustomization();
  static final _words = RegExp(
    r'\b(servicios|servicio|services|service|roles|rol|role)\b',
    caseSensitive: false,
    unicode: true,
  );

  static OrganizationCustomization fromJson(Object? value) {
    if (value case {
      'terminology': {
        'service': {
          'singular': final String service,
          'plural': final String services,
        },
        'jobRole': {
          'singular': final String role,
          'plural': final String roles,
        },
      },
      'accent': final String token,
    }) {
      final accent = switch (token) {
        'VIOLET' => OrganizationAccent.violet,
        'INDIGO' => OrganizationAccent.indigo,
        'INK' => OrganizationAccent.ink,
        _ => null,
      };
      if (accent == null) return defaults;
      return OrganizationCustomization(
        service: (singular: service, plural: services),
        jobRole: (singular: role, plural: roles),
        accent: accent,
      );
    }
    return defaults;
  }

  // Interface copy only: do not pass names, messages or other user content.
  String text(String message) => message.replaceAllMapped(_words, (match) {
    final word = match[0]!;
    var label = switch (word.toLowerCase()) {
      'servicio' || 'service' => service.singular,
      'servicios' || 'services' => service.plural,
      'rol' || 'role' => jobRole.singular,
      'roles' => jobRole.plural,
      _ => word,
    };
    final original = switch (word.toLowerCase()) {
      'servicio' || 'service' => defaults.service.singular,
      'servicios' || 'services' => defaults.service.plural,
      'rol' || 'role' => defaults.jobRole.singular,
      'roles' => defaults.jobRole.plural,
      _ => word,
    };
    if (label == original) return word;
    label = label.trim();
    if (label.isEmpty) return word;
    if (word == word.toUpperCase()) return label.toUpperCase();
    return word[0] == word[0].toUpperCase()
        ? label[0].toUpperCase() + label.substring(1)
        : label.toLowerCase();
  });
}
