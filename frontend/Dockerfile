# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy source and build (VITE_* baked in at build time)
COPY frontend/ ./
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ARG VITE_BUILD_ID=dev
ENV VITE_BUILD_ID=${VITE_BUILD_ID}
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
