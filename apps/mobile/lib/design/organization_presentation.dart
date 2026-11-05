import 'package:flutter/widgets.dart';

import '../core/organization_customization.dart';
import '../l10n/translation.dart';

class OrganizationPresentation extends InheritedWidget {
  const OrganizationPresentation({
    super.key,
    required this.value,
    required super.child,
  });
  final OrganizationCustomization value;

  static OrganizationCustomization of(BuildContext context) =>
      context
          .dependOnInheritedWidgetOfExactType<OrganizationPresentation>()
          ?.value ??
      OrganizationCustomization.defaults;

  @override
  bool updateShouldNotify(OrganizationPresentation oldWidget) =>
      value != oldWidget.value;
}

String organizationText(BuildContext context, String message) =>
    OrganizationPresentation.of(context).text(tr(context, message));
