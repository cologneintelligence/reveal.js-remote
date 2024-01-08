FROM node:20-alpine3.19 as build

WORKDIR /app
COPY package.json package-lock.json ./

RUN npm ci

COPY . .
RUN npx gulp app

FROM node:20-alpine3.19

WORKDIR /app
COPY package.json package-lock.json ./

RUN npm ci --omit dev

RUN mkdir /presentations
ENV PRESENTATION_PRESENTATION_PATH /presentations
COPY --from=build /app/dist .

USER 65534
CMD ["node", "/app/index.js"]
