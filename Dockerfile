# syntax=docker/dockerfile:1

FROM oven/bun:1.3.4@sha256:7608db4aeb44f1fe8169cc8ec7055376b3013557b106407ccf092b00e426407d AS base
WORKDIR /usr/src/app

FROM base AS build
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=bun.lock,target=bun.lock \
    bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM base AS prod-deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS api
COPY package.json ./
COPY --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/build ./build
USER bun
EXPOSE 3000
HEALTHCHECK CMD bun -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bun", "start"]

FROM base AS demo
COPY package.json ./
COPY --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/build/config.js ./build/config.js
COPY --from=build /usr/src/app/build/demo-app.js ./build/demo-app.js
COPY --from=build /usr/src/app/build/demo.js ./build/demo.js
COPY --from=build /usr/src/app/build/demo ./build/demo
USER bun
EXPOSE 8080
HEALTHCHECK CMD bun -e "fetch('http://localhost:8080/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bun", "run", "start:demo"]
