FROM node:20-alpine

WORKDIR /app

# Copy package files from backend-ts folder (context is repo root)
COPY backend-ts/package*.json ./
COPY backend-ts/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code from backend-ts folder
COPY backend-ts/src ./src

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 8000

# Start the application
CMD ["npm", "start"]
