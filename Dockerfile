FROM node:18.14.2-alpine3.17

WORKDIR /app
COPY package.json package-lock.json ./

RUN npm ci

RUN mkdir /presentations
ENV PRESENTATION_PRESENTATION_PATH /presentations
COPY . .

USER 65534
CMD ["node", "/app/index.js"]
