FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm install -g ts-node typescript

EXPOSE 3000

CMD ["npx", "ts-node", "server.ts"]
