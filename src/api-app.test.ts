import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { solveChallenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { createApiApp } from "./api-app";
import type { ApiConfig } from "./config";

const TEST_SECRET = "this-is-a-very-long-secret-key-that-is-at-least-32-chars";

const testConfig: ApiConfig = {
  algorithm: "PBKDF2/SHA-256",
  corsOrigin: "*",
  expireMinutes: 10,
  hmacKey: TEST_SECRET,
  maxNumber: 100,
  maxRecords: 1000,
  port: 0,
};

describe("createApiApp", () => {
  let app: Awaited<ReturnType<typeof createApiApp>>;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    app = await createApiApp(testConfig);
    server = app.listen(0) as Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;
  });

  afterAll(() => {
    server.close();
  });

  test("GET / returns 204", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(204);
  });

  test("GET /challenge returns 200 with challenge shape", async () => {
    const res = await fetch(`${baseUrl}/challenge`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("parameters");
    expect(body).toHaveProperty("signature");
    expect(typeof body.parameters).toBe("object");
    expect(typeof body.signature).toBe("string");
    expect(body.parameters).toHaveProperty("algorithm");
    expect(body.parameters).toHaveProperty("nonce");
    expect(body.parameters).toHaveProperty("salt");
  });

  test("GET /verify with valid payload returns 202", async () => {
    const challengeRes = await fetch(`${baseUrl}/challenge`);
    const challenge = await challengeRes.json();

    const solution = await solveChallenge({
      challenge,
      deriveKey,
    });
    expect(solution).not.toBeNull();

    const payload = btoa(JSON.stringify({ challenge, solution }));
    const verifyRes = await fetch(`${baseUrl}/verify?altcha=${encodeURIComponent(payload)}`);
    expect(verifyRes.status).toBe(202);
  });

  test("GET /verify with invalid base64 returns 417 and error invalid", async () => {
    const res = await fetch(`${baseUrl}/verify?altcha=not-valid-base64!!!`);
    expect(res.status).toBe(417);
    const body = await res.json();
    expect(body).toEqual({ error: "invalid" });
  });

  test("GET /verify without altcha query returns 417 and error invalid", async () => {
    const res = await fetch(`${baseUrl}/verify`);
    expect(res.status).toBe(417);
    const body = await res.json();
    expect(body).toEqual({ error: "invalid" });
  });

  test("GET /verify with replayed payload returns 417 and error replayed", async () => {
    const challengeRes = await fetch(`${baseUrl}/challenge`);
    const challenge = await challengeRes.json();

    const solution = await solveChallenge({
      challenge,
      deriveKey,
    });
    expect(solution).not.toBeNull();

    const payload = btoa(JSON.stringify({ challenge, solution }));

    const first = await fetch(`${baseUrl}/verify?altcha=${encodeURIComponent(payload)}`);
    expect(first.status).toBe(202);

    const second = await fetch(`${baseUrl}/verify?altcha=${encodeURIComponent(payload)}`);
    expect(second.status).toBe(417);
    const body = await second.json();
    expect(body).toEqual({ error: "replayed" });
  });
});
