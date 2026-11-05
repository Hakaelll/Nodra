import { expect, it } from "vitest";
import { defaultOrganizationCustomization } from "@nodra/contracts";
import { dictionaries, translate } from "./i18n";
import { createOrganizationText } from "./organization-customization";

it("translates interface copy while preserving interpolated names and custom terminology", () => {
  expect(translate("es-ES", "Hola, Inicio.")).toBe("Hola, Inicio.");
  expect(translate("en-GB", "Hola, Inicio.")).toBe("Hello, Inicio.");
  expect(dictionaries["en-GB"].views.Inicio).toBe("Home");
  expect(translate("en-GB", "Inicio")).toBe("Start");
  expect(translate("en-GB", "  Guardar cambios  ")).toBe("  Save changes  ");
  expect(translate("en-GB", "toString")).toBe("toString");
  expect(translate("en-GB", "constructor")).toBe("constructor");
  expect(translate("en-GB", "Equipo Español")).toBe("Equipo Español");
  const text = createOrganizationText(
    {
      ...defaultOrganizationCustomization,
      terminology: {
        ...defaultOrganizationCustomization.terminology,
        service: { singular: "guardia", plural: "guardias" },
      },
    },
    "en-GB",
  );
  expect(text("Crear servicio")).toBe("Create guardia");
});
