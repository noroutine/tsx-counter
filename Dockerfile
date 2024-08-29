FROM node:lts-alpine

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
# WORKDIR /app

# Enable corepack
RUN corepack enable

ENV YARN_VERSION=4.4.0
RUN yarn policies set-version $YARN_VERSION

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .yarnrc.yml tsconfig.json ./



# Install TypeScript
RUN npm install -g typescript

# RUN yarn install

USER node

ENV PORT=3000

EXPOSE ${PORT}

# CMD [ "node", "server.js" ]
CMD ["yarn", "start"]