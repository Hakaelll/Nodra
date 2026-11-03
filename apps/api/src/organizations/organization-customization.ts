import type { OrganizationSettings } from "@prisma/client";
import type { OrganizationCustomization } from "@nodra/contracts";

export function customizationView(
  settings: OrganizationSettings,
): OrganizationCustomization {
  return {
    terminology: {
      service: {
        singular: settings.serviceLabel,
        plural: settings.servicePluralLabel,
      },
      jobRole: {
        singular: settings.jobRoleLabel,
        plural: settings.jobRolePluralLabel,
      },
    },
    accent: settings.accentPreset,
  };
}

export function settingsView(settings: OrganizationSettings) {
  return {
    organizationId: settings.organizationId,
    serviceLabel: settings.serviceLabel,
    features: settings.features,
    customization: customizationView(settings),
  };
}

export function sameCustomization(
  a: OrganizationCustomization,
  b: OrganizationCustomization,
) {
  return (
    a.accent === b.accent &&
    a.terminology.service.singular === b.terminology.service.singular &&
    a.terminology.service.plural === b.terminology.service.plural &&
    a.terminology.jobRole.singular === b.terminology.jobRole.singular &&
    a.terminology.jobRole.plural === b.terminology.jobRole.plural
  );
}
