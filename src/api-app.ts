import { createChallenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { deriveHmacKeySecret, verify as verifyPayload } from "altcha-lib/frameworks/shared";
import cors from "cors";
import express, { type Express, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import type { ApiConfig } from "./config";
import { createInMemoryReplayStore, createRedisReplayStore } from "./replay-store";

const addMinutesToDate = (date: Date, n: number) => {
  const d = new Date(date);
  d.setTime(d.getTime() + n * 60_000);
  return d;
};

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

export const createApiApp = async (config: ApiConfig): Promise<Express> => {
  const app: Express = express();
  const hmacKeySignatureSecret = await deriveHmacKeySecret(config.hmacKey);

  const replayStore = config.redisUrl
    ? await (async () => {
        const store = createRedisReplayStore(config.redisUrl!, config.expireMinutes * 60);
        await store.get("__connection_check__");
        return store;
      })()
    : createInMemoryReplayStore(config.maxRecords);

  console.log(
    config.redisUrl
      ? "[ALTCHA]: replay store initialised — redis"
      : "[ALTCHA]: replay store initialised — in-memory, cleared on restart"
  );

  app.use(helmet());
  app.use(express.json());
  app.use(cors({ origin: config.corsOrigin }));

  if (process.env.NODE_ENV !== "test") {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on("finish", () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
      });
      next();
    });
  }

  app.get("/", (_req: Request, res: Response) => {
    res.sendStatus(204);
  });

  const challengeRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get("/challenge", challengeRateLimit, asyncHandler(async (_req: Request, res: Response) => {
    const challenge = await createChallenge({
      algorithm: config.algorithm,
      cost: config.maxNumber,
      deriveKey,
      expiresAt: addMinutesToDate(new Date(), config.expireMinutes),
      hmacSignatureSecret: config.hmacKey,
      hmacKeySignatureSecret,
    });

    res.status(200).json(challenge);
  }));

  const handleVerify = async (payload: unknown, res: Response) => {
    if (typeof payload !== "string" || !payload.length) {
      res.status(417).json({ error: "invalid" });
      return;
    }

    const result = await verifyPayload(payload, deriveKey, config.hmacKey, hmacKeySignatureSecret, replayStore);
    if (result.error) {
      const error = result.error === "ALTCHA payload has been already used." ? "replayed" : "invalid";
      res.status(417).json({ error });
    } else {
      res.sendStatus(202);
    }
  };

  app.get("/verify", asyncHandler(async (req: Request, res: Response) => {
    await handleVerify(req.query.altcha, res);
  }));

  app.post("/verify", asyncHandler(async (req: Request, res: Response) => {
    await handleVerify(req.body.altcha, res);
  }));

  return app;
};
