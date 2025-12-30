FROM node:18-alpine AS base

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --silent

# Development stage
FROM base AS development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host"]

# Production stage (optional, for static builds)
FROM base AS production
COPY . .
RUN npm run build
RUN npm install -g serve
ENV PORT=3000
EXPOSE 3000
CMD serve -s dist -l $PORT