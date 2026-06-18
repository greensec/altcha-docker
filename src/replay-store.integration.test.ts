import { describe, expect, test } from "bun:test";
import { createRedisReplayStore } from "./replay-store";

const REDIS_URL = process.env.REDIS_URL;

describe.skipIf(!REDIS_URL)("createRedisReplayStore", () => {
  const store = createRedisReplayStore(REDIS_URL!, 60);

  test("get returns false for unknown key", async () => {
    expect(await store.get("integration-unknown-key")).toBe(false);
  });

  test("set stores a key and get returns true", async () => {
    await store.set("integration-key-1", true);
    expect(await store.get("integration-key-1")).toBe(true);
  });

  test("set on duplicate key throws", async () => {
    await store.set("integration-key-2", true);
    await expect(store.set("integration-key-2", true)).rejects.toThrow(
      "ALTCHA payload has been already used."
    );
  });

  test("set with false does nothing", async () => {
    await store.set("integration-key-3", false);
    expect(await store.get("integration-key-3")).toBe(false);
  });
});
