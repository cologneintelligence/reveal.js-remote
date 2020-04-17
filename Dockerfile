FROM node:lts-slim

WORKDIR /app
COPY package.json package-lock.json ./

RUN npm install

RUN mkdir /presentations
ENV PRESENTATION_PRESENTATION_PATH /presentations
COPY . .

USER 65534
CMD ["node", "/app/index.js"]
