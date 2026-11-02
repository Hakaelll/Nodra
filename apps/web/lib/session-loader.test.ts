import { expect, it } from "vitest";
import { createSessionLoader } from "./session-loader";

it("discards old session snapshots and failures after logout or a newer load", async () => {
  const loader = createSessionLoader();
  let visible = "signed out";
  const oldResult = Promise.withResolvers<string>();
  const old = loader.load(
    () => oldResult.promise,
    (value) => {
      visible = value;
    },
  );
  loader.reset(false);
  expect(
    await loader.load(
      async () => "Alice",
      (value) => {
        visible = value;
      },
    ),
  ).toBe(false);
  loader.reset(true);
  await loader.load(
    async () => "Bob",
    (value) => {
      visible = value;
    },
  );
  oldResult.resolve("Alice");
  expect(await old).toBe(false);
  expect(visible).toBe("Bob");

  const oldFailure = Promise.withResolvers<string>();
  const failure = loader.load(
    () => oldFailure.promise,
    (value) => {
      visible = value;
    },
  );
  await loader.load(
    async () => "Bob updated",
    (value) => {
      visible = value;
    },
  );
  oldFailure.reject(new Error("old account failure"));
  expect(await failure).toBe(false);
  expect(visible).toBe("Bob updated");
  await expect(
    loader.load(
      async () => {
        throw new Error("current failure");
      },
      () => {},
    ),
  ).rejects.toThrow("current failure");
});
