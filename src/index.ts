import dotenv from "dotenv";

import { createApiApp } from "./api-app";
import { parseApiConfig } from "./config";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const start = async () => {
  const config = parseApiConfig();

  if (config.hmacKey === "$ecret.key") console.log(" [WARNING] CHANGE ALTCHA SECRET KEY - its still default !!! ");

  const app = await createApiApp(config);

  const server = app.listen(config.port, () => {
    console.log(`[ALTCHA]: Captcha Server is running at http://localhost:${config.port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[ALTCHA]: received ${signal}, shutting down gracefully`);
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

start().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
