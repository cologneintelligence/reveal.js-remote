FROM node:lts-slim

WORKDIR /app
COPY package.json package-lock.json ./

RUN npm install

RUN mkdir /presentations
ENV PRESENTATION_PRESENTATION_PATH /presentations
COPY . .

CMD ["node", "/app/index.js"]
