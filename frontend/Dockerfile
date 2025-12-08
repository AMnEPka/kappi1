# Frontend Dockerfile for SSH Script Runner
FROM node:20-alpine

# Set working directory
WORKDIR /app/frontend

# Install dependencies for node-gyp
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 415

# Set environment to development
ENV NODE_ENV=development

# Run the application
CMD ["sh", "-c", "PORT=415 HOST=0.0.0.0 npm start"]
