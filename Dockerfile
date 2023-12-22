FROM node:18.18.2-alpine as base

# ---------------
# Install Dependencies
# ---------------
FROM base as deps

WORKDIR /app

ENV DISABLE_OPENCOLLECTIVE=true

COPY package*.json ./

# Install app dependencies
RUN npm install

# ---------------
# Build App
# ---------------
FROM base as builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build NestJS application
RUN npm run build

# Remove non production necessary modules
RUN npm prune --production

# ---------------
# Final App
# ---------------
FROM base as runner

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist/ ./dist/

EXPOSE 3000

ENTRYPOINT ["npm", "run", "start:prod"]