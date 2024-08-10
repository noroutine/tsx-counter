FROM node:lts-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV YARN_VERSION=4.4.0
RUN yarn policies set-version $YARN_VERSION

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .yarnrc.yml ./

RUN corepack enable
RUN yarn --immutable

# Rebuild the source code only when needed
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

USER node

ENV PORT=3000

EXPOSE ${PORT}

CMD [ "node", "server.js" ]