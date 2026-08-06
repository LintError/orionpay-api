# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (including dev) for the build.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies.
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the compiled output from the build stage.
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main"]
