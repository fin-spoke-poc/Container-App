FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
COPY test ./test

RUN npm ci --no-fund --no-audit
RUN npm run build

FROM node:24-alpine AS runtime

ARG APP_VERSION=0.1.0
ARG GIT_SHA=local
ARG BUILD_TIMESTAMP=unknown

ENV NODE_ENV=production \
    PORT=3000 \
    APP_NAME=container-app \
    APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA} \
    IMAGE_TAG=${GIT_SHA} \
    BUILD_TIMESTAMP=${BUILD_TIMESTAMP} \
    WORKFLOW_NAME=local-container \
    WORKFLOW_REF=local \
    RULESET_IDS=local-bootstrap \
    COVERAGE_THRESHOLD_PCT=60

LABEL org.opencontainers.image.title="container-app" \
      org.opencontainers.image.description="Governed test container app for CI/CD ruleset validation" \
      org.opencontainers.image.version=${APP_VERSION} \
      org.opencontainers.image.revision=${GIT_SHA} \
      org.opencontainers.image.created=${BUILD_TIMESTAMP}

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY package.json ./package.json

USER node

EXPOSE 3000

CMD ["node", "dist/src/index.js"]
