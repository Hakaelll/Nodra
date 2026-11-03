import {
  defaultOrganizationCustomization,
  organizationCustomizationOutput,
  type OrganizationCustomization,
} from "@nodra/contracts";

export const organizationAccents = {
  VIOLET: {
    label: "Violeta",
    color: "#533afd",
    hover: "#4328e8",
    wash: "#e8e9ff",
    outline: "#b9b9f9",
  },
  INDIGO: {
    label: "Índigo",
    color: "#3448a8",
    hover: "#263987",
    wash: "#e9edff",
    outline: "#bbc6ef",
  },
  INK: {
    label: "Tinta",
    color: "#182659",
    hover: "#101c43",
    wash: "#eceef6",
    outline: "#b9bfd8",
  },
} satisfies Record<
  OrganizationCustomization["accent"],
  { label: string; color: string; hover: string; wash: string; outline: string }
>;

export function resolveOrganizationCustomization(
  value: unknown,
): OrganizationCustomization {
  const parsed = organizationCustomizationOutput.safeParse(value);
  return parsed.success ? parsed.data : defaultOrganizationCustomization;
}

// Apply only to interface copy, never to titles, messages or other user content.
export function createOrganizationText(
  customization: OrganizationCustomization,
) {
  return (message: string) =>
    message.replace(/\b(servicios|servicio|roles|rol)\b/giu, (word) => {
      let label: string;
      switch (word.toLocaleLowerCase("es")) {
        case "servicio":
          label = customization.terminology.service.singular;
          break;
        case "servicios":
          label = customization.terminology.service.plural;
          break;
        case "rol":
          label = customization.terminology.jobRole.singular;
          break;
        case "roles":
          label = customization.terminology.jobRole.plural;
          break;
        default:
          return word;
      }
      label = label.trim() || word;
      if (word === word.toLocaleUpperCase("es"))
        return label.toLocaleUpperCase("es");
      return word.charAt(0) === word.charAt(0).toLocaleUpperCase("es")
        ? label.charAt(0).toLocaleUpperCase("es") + label.slice(1)
        : label.toLocaleLowerCase("es");
    });
}
