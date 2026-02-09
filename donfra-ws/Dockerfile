FROM node:18-alpine

WORKDIR /app

# Install deps first to leverage Docker layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the server code
COPY . .

ENV PORT=6789
EXPOSE 6789

CMD ["npm", "start"]
