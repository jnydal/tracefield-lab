# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (package-lock.json optional; frontend/.gitignore may exclude it)
COPY frontend/package.json ./
RUN npm install

# Copy source and build (VITE_API_BASE_URL baked in at build time)
COPY frontend/ ./
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
