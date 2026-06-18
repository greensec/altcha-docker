import Redis from "ioredis";

export type ReplayStore = {
  get: (key: string) => boolean | Promise<boolean>;
  set: (key: string, value: boolean) => void | Promise<void>;
};

export const createInMemoryReplayStore = (maxRecords: number): ReplayStore => {
  const usedChallengeIds = new Set<string>();
  const challengeOrder: string[] = [];

  return {
    get: (key: string) => usedChallengeIds.has(key),
    set: (key: string, value: boolean) => {
      if (!value || usedChallengeIds.has(key)) return;

      usedChallengeIds.add(key);
      challengeOrder.push(key);

      if (challengeOrder.length > maxRecords) {
        const oldest = challengeOrder.shift();
        if (oldest !== undefined) usedChallengeIds.delete(oldest);
      }
    },
  };
};

const REDIS_KEY_PREFIX = "altcha:replay:";

export const createRedisReplayStore = (redisUrl: string, ttlSeconds: number): ReplayStore => {
  const redis = new Redis(redisUrl, { lazyConnect: true });

  return {
    get: async (key: string) => {
      const result = await redis.get(`${REDIS_KEY_PREFIX}${key}`);
      return result !== null;
    },
    set: async (key: string, value: boolean) => {
      if (!value) return;
      const fullKey = `${REDIS_KEY_PREFIX}${key}`;
      const result = await redis.set(fullKey, "1", "EX", ttlSeconds, "NX");
      if (result === null) {
        throw new Error("ALTCHA payload has been already used.");
      }
    },
  };
};
