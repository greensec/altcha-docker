export type CorsOrigin = "*" | string[];

export type SupportedAlgorithm = "PBKDF2/SHA-256" | "PBKDF2/SHA-384" | "PBKDF2/SHA-512";

export type ApiConfig = {
  algorithm: SupportedAlgorithm;
  corsOrigin: CorsOrigin;
  expireMinutes: number;
  hmacKey: string;
  maxNumber: number;
  maxRecords: number;
  port: number;
};

export type DemoConfig = {
  apiBaseUrl: string;
  port: number;
};

type Env = Record<string, string | undefined>;

const parsePositiveInteger = (env: Env, name: string, defaultValue: number): number => {
  const rawValue = env[name];
  const value = rawValue === undefined || rawValue.trim() === "" ? defaultValue : Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
};

const parseCorsOrigin = (value: string | undefined): CorsOrigin => {
  const origin = (value || "*").trim();
  if (origin === "*") return "*";

  const origins = origin.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (!origins.length) return "*";

  return origins;
};

const parseUrl = (value: string, name: string): string => {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
};

const SUPPORTED_ALGORITHMS: SupportedAlgorithm[] = [
  "PBKDF2/SHA-256",
  "PBKDF2/SHA-384",
  "PBKDF2/SHA-512",
];

const parseAlgorithm = (value: string | undefined): SupportedAlgorithm => {
  const algorithm = (value || "PBKDF2/SHA-256").trim() as SupportedAlgorithm;
  if (!SUPPORTED_ALGORITHMS.includes(algorithm)) {
    throw new Error(`ALGORITHM must be one of: ${SUPPORTED_ALGORITHMS.join(", ")}`);
  }
  return algorithm;
};

export const parseApiConfig = (env: Env = process.env): ApiConfig => {
  const hmacKey = env.SECRET?.trim();
  if (!hmacKey) throw new Error("SECRET is required");
  if (hmacKey.length < 32) throw new Error("SECRET must be at least 32 characters");

  const maxNumberSource = env.MAXNUMBER === undefined || env.MAXNUMBER.trim() === "" ? "COST" : "MAXNUMBER";

  return {
    algorithm: parseAlgorithm(env.ALGORITHM),
    corsOrigin: parseCorsOrigin(env.CORS_ORIGIN),
    expireMinutes: parsePositiveInteger(env, "EXPIREMINUTES", 10),
    hmacKey,
    maxNumber: parsePositiveInteger(env, maxNumberSource, 5000),
    maxRecords: parsePositiveInteger(env, "MAXRECORDS", 1000),
    port: parsePositiveInteger(env, "PORT", 3000),
  };
};

export const parseDemoConfig = (env: Env = process.env): DemoConfig => ({
  apiBaseUrl: parseUrl(env.API_BASE_URL?.trim() || "http://server:3000", "API_BASE_URL"),
  port: parsePositiveInteger(env, "DEMO_PORT", 8080),
});
