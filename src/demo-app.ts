import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import path from "node:path";

import type { DemoConfig } from "./config";

const proxyStatus = (status: number, fallback: number): number => {
  if (status >= 100 && status <= 599) return status;
  return fallback;
};

export const createDemoApp = (config: DemoConfig): Express => {
  const app: Express = express();

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": ["'self'", "'unsafe-eval'", "'sha256-ZswfTY7H35rbv8WC7NXBoiC7WNu86vSzCDChNWwZZDM='"],
        "connect-src": ["'self'", "blob:"],
        "worker-src": ["'self'", "blob:"],
      },
    },
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, "demo")));

  app.get("/", (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "demo/index.html"));
  });

  app.get("/challenge", async (_req: Request, res: Response) => {
    try {
      const upstream = await fetch(`${config.apiBaseUrl}/challenge`, { signal: AbortSignal.timeout(5000) });
      const body = Buffer.from(await upstream.arrayBuffer());
      const contentType = upstream.headers.get("content-type");

      if (contentType) res.set("content-type", contentType);
      res.status(proxyStatus(upstream.status, 502)).send(body);
    } catch (error: unknown) {
      console.error("[ALTCHA]: demo challenge proxy failed", error);
      res.sendStatus(502);
    }
  });

  app.post("/test", async (req: Request, res: Response) => {
    try {
      const upstream = await fetch(`${config.apiBaseUrl}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ altcha: req.body.altcha }),
        signal: AbortSignal.timeout(5000),
      });
      res.sendStatus(proxyStatus(upstream.status, 417));
    } catch (error: unknown) {
      console.error("[ALTCHA]: demo verify proxy failed", error);
      res.sendStatus(417);
    }
  });

  return app;
};
