# Sri Krishna Department Store - website + admin portal
# Stage 1 builds the React site; stage 2 serves it with nginx, which also passes
# /api, /uploads and /socket.io to the backend container (one address for everything).
# Built and started by docker-compose.yml in the project root.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Public address of the site, baked into the build, e.g. https://srikrishnastore.in
# (the API is reached through the same address, via nginx)
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN test -n "$VITE_API_URL" || (echo "Build arg VITE_API_URL is required (set SITE_URL in the root .env)" && exit 1)
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
