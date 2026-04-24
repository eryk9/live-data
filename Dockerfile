# Usa Node.js 18 LTS
FROM node:18-alpine

# Imposta directory di lavoro
WORKDIR /app

# Copia package files
COPY package*.json ./

# Installa dipendenze
RUN npm ci --only=production

# Copia il resto del codice
COPY . .

# Crea directory per uploads
RUN mkdir -p public/uploads logs

# Espone la porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/status || exit 1

# Avvia l'applicazione
CMD ["npm", "start"]