import { describe, expect, test } from "bun:test";
import { parseApiConfig, parseDemoConfig } from "./config";

const LONG_SECRET = "this-is-a-very-long-secret-key-that-is-at-least-32-chars";

describe("parseApiConfig", () => {
  test("uses defaults for optional API config", () => {
    const config = parseApiConfig({ SECRET: LONG_SECRET });

    expect(config).toEqual({
      algorithm: "PBKDF2/SHA-256",
      corsOrigin: "*",
      expireMinutes: 10,
      hmacKey: LONG_SECRET,
      maxNumber: 5000,
      maxRecords: 1000,
      port: 3000,
    });
  });

  test("parses numeric and string API config", () => {
    const config = parseApiConfig({
      ALGORITHM: "PBKDF2/SHA-256",
      CORS_ORIGIN: "https://example.com, https://admin.example.com",
      EXPIREMINUTES: "5",
      MAXNUMBER: "9000",
      MAXRECORDS: "25",
      PORT: "4000",
      SECRET: LONG_SECRET,
    });

    expect(config.algorithm).toBe("PBKDF2/SHA-256");
    expect(config.corsOrigin).toEqual(["https://example.com", "https://admin.example.com"]);
    expect(config.expireMinutes).toBe(5);
    expect(config.maxNumber).toBe(9000);
    expect(config.maxRecords).toBe(25);
    expect(config.port).toBe(4000);
    expect(config.hmacKey).toBe(LONG_SECRET);
  });

  test("supports COST as legacy fallback when MAXNUMBER is absent", () => {
    const config = parseApiConfig({ COST: "7000", SECRET: LONG_SECRET });

    expect(config.maxNumber).toBe(7000);
  });

  test("rejects missing secret", () => {
    expect(() => parseApiConfig({})).toThrow("SECRET is required");
  });

  test("rejects short secret", () => {
    expect(() => parseApiConfig({ SECRET: "short" })).toThrow("SECRET must be at least 32 characters");
  });

  test("rejects invalid numbers", () => {
    expect(() => parseApiConfig({ PORT: "abc", SECRET: LONG_SECRET })).toThrow("PORT must be a positive integer");
    expect(() => parseApiConfig({ EXPIREMINUTES: "0", SECRET: LONG_SECRET })).toThrow("EXPIREMINUTES must be a positive integer");
    expect(() => parseApiConfig({ MAXRECORDS: "-1", SECRET: LONG_SECRET })).toThrow("MAXRECORDS must be a positive integer");
    expect(() => parseApiConfig({ MAXNUMBER: "1.5", SECRET: LONG_SECRET })).toThrow("MAXNUMBER must be a positive integer");
  });

  test("rejects unsupported algorithm", () => {
    expect(() => parseApiConfig({ SECRET: LONG_SECRET, ALGORITHM: "SHA-256" })).toThrow(
      "ALGORITHM must be one of: PBKDF2/SHA-256, PBKDF2/SHA-384, PBKDF2/SHA-512"
    );
  });

  test("accepts all supported algorithms", () => {
    expect(parseApiConfig({ SECRET: LONG_SECRET, ALGORITHM: "PBKDF2/SHA-256" }).algorithm).toBe("PBKDF2/SHA-256");
    expect(parseApiConfig({ SECRET: LONG_SECRET, ALGORITHM: "PBKDF2/SHA-384" }).algorithm).toBe("PBKDF2/SHA-384");
    expect(parseApiConfig({ SECRET: LONG_SECRET, ALGORITHM: "PBKDF2/SHA-512" }).algorithm).toBe("PBKDF2/SHA-512");
  });
});

describe("parseDemoConfig", () => {
  test("uses defaults for optional demo config", () => {
    const config = parseDemoConfig({});

    expect(config).toEqual({
      apiBaseUrl: "http://server:3000",
      port: 8080,
    });
  });

  test("parses demo config", () => {
    const config = parseDemoConfig({ API_BASE_URL: "http://api:3333", DEMO_PORT: "9090" });

    expect(config.apiBaseUrl).toBe("http://api:3333");
    expect(config.port).toBe(9090);
  });

  test("rejects invalid API_BASE_URL", () => {
    expect(() => parseDemoConfig({ API_BASE_URL: "not a url" })).toThrow("API_BASE_URL must be a valid URL");
  });
});
