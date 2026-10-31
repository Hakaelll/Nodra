import { expect, it } from "vitest";
import { devOrigins } from "./dev-origins";
it("allows the configured LAN origin without granting wildcard access", () => {
  expect(devOrigins({ WEB_ORIGIN: "http://192.168.1.133:3000" })).toEqual([
    "192.168.1.133",
  ]);
  expect(
    devOrigins({
      NODRA_LAN_HOST: "192.168.1.133",
      WEB_ORIGIN: "http://192.168.1.133:3000",
    }),
  ).toEqual(["192.168.1.133"]);
  expect(devOrigins({ WEB_ORIGIN: "invalid" })).toEqual([]);
});
