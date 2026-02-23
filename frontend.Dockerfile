# Build Stage
FROM node:20-alpine AS builder

ARG PORTAL_PATH
# Build-time env variables for Vite
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_HERE_API_KEY

WORKDIR /app

# Copy root configs (if any)
COPY package*.json ./

# Copy specific portal code
WORKDIR /app/${PORTAL_PATH}
COPY ${PORTAL_PATH}/package*.json ./
RUN npm install

WORKDIR /app
COPY ${PORTAL_PATH}/ ./${PORTAL_PATH}/

# Set ENVs for the build process and generate .env file for Vite
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_HERE_API_KEY=$VITE_HERE_API_KEY

# Build the app with explicit .env creation to bypass layer caching issues
WORKDIR /app/${PORTAL_PATH}
RUN echo "VITE_API_URL=${VITE_API_URL}" > .env && \
    echo "VITE_SOCKET_URL=${VITE_SOCKET_URL}" >> .env && \
    echo "VITE_HERE_API_KEY=${VITE_HERE_API_KEY}" >> .env && \
    npm run build

# Production Stage - Nginx
FROM nginx:stable-alpine

ARG PORTAL_PATH
COPY --from=builder /app/${PORTAL_PATH}/dist /usr/share/nginx/html

# Standard Nginx config for SPA routing
RUN printf 'server {\n\
    listen 80;\n\
    location / {\n\
    root /usr/share/nginx/html;\n\
    index index.html index.htm;\n\
    try_files $uri $uri/ /index.html;\n\
    }\n\
    }' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
