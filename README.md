# 💕 Dating App - Express.js

Una moderna applicazione di dating sviluppata con Express.js, PostgreSQL, Redis e Socket.IO. Include autenticazione JWT, profili utente, matching e chat real-time.

## ✨ Caratteristiche

- 🔐 **Autenticazione sicura** con JWT e bcrypt
- 👤 **Profili utente** con foto e preferenze
- 💬 **Chat real-time** con Socket.IO
- 🛡️ **Sicurezza avanzata** (Helmet, Rate Limiting, CORS)
- 📱 **Design responsive** con colori caldi moderni
- 🚀 **Performance ottimizzate** con caching Redis
- 📊 **Logging strutturato** con Winston
- 🧪 **Test automatizzati** con Jest

## 🛠️ Tecnologie Utilizzate

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Cache**: Redis
- **Real-time**: Socket.IO
- **Autenticazione**: JWT + bcrypt
- **Sicurezza**: Helmet, express-rate-limit
- **Logging**: Winston
- **Testing**: Jest + Supertest
- **Frontend**: HTML5, CSS3 moderno, JavaScript ES6+

## 🚀 Avvio Rapido

### Opzione 1: Con Docker (Raccomandato)
```bash
# Avvia tutti i servizi (app, PostgreSQL, Redis)
docker-compose up -d

# Vedi i logs
docker-compose logs -f app
```

L'app sarà disponibile su `http://localhost:3000`

### Opzione 2: Installazione Manuale

#### Prerequisiti
- Node.js 16+
- PostgreSQL 12+
- Redis 6+

#### Installazione

1. **Clona il repository**
```bash
git clone https://github.com/tuo-username/dating-app.git
cd dating-app
```

2. **Installa dipendenze**
```bash
npm install
```

3. **Configura ambiente**
```bash
cp .env.example .env
# Modifica .env con le tue configurazioni
```

4. **Configura database**
```bash
# Crea database PostgreSQL
createdb dating_app

# Esegui schema
psql -d dating_app -f schema.sql
```

5. **Avvia l'applicazione**
```bash
npm start
```

L'app sarà disponibile su `http://localhost:3000`

## 📋 API Endpoints

### Autenticazione
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Registrazione utente |
| POST | `/api/auth/login` | Login utente |
| POST | `/api/auth/forgot-password` | Recupero password |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/auth/verify-email` | Verifica email |

### Profili
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/profile/me` | Profilo personale |
| GET | `/api/profile/:id` | Profilo pubblico |
| POST | `/api/profile` | Aggiorna profilo |
| POST | `/api/profile/photo` | Carica foto profilo |

### Sistema
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/status` | Stato DB + Redis |
| GET | `/api/users` | Lista utenti (cached) |

## 🧪 Testing

```bash
# Esegui tutti i test
npm test

# Test con coverage
npm run test:coverage
```

## 📁 Struttura Progetto

```
.
├── index.js              # Entry point principale
├── config.js             # Configurazioni centralizzate
├── logger.js             # Sistema di logging
├── auth.js               # Autenticazione e autorizzazione
├── profiles.js           # Gestione profili utente
├── db.js                 # Connessione PostgreSQL
├── cache.js              # Client Redis
├── schema.sql            # Schema database
├── OPTIMIZATIONS.md      # Documentazione ottimizzazioni
├── public/               # Frontend statico
│   ├── index.html        # Homepage
│   ├── login.html        # Pagina login
│   ├── signup.html       # Pagina registrazione
│   ├── style.css         # CSS homepage
│   ├── auth-style.css    # CSS autenticazione
│   ├── modern-effects.css # Effetti CSS moderni
│   └── script.js         # JavaScript frontend
├── __tests__/            # Test suite
└── logs/                 # File di log
```

## 🔧 Configurazione Ambiente

Crea un file `.env` basato su `.env.example`:

```env
# Server
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# JWT
JWT_SECRET=your-super-secret-key-here

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dating_app
DB_USER=postgres
DB_PASSWORD=your-password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@yourapp.com

# App
APP_URL=https://yourdomain.com
```

## 🚀 Deployment

### Con Docker
```bash
# Build immagine
docker build -t dating-app .

# Avvia container
docker run -p 3000:3000 --env-file .env dating-app
```

### Con Docker Compose (Produzione)
```bash
# Per produzione, modifica docker-compose.yml
docker-compose -f docker-compose.yml up -d
```

### Con PM2 (Produzione)
```bash
# Installa PM2 globalmente
npm install -g pm2

# Avvia con PM2
pm2 start index.js --name "dating-app"

# Salva configurazione PM2
pm2 save
pm2 startup
```

### Piattaforme Cloud
- **Railway**: Deploy diretto da GitHub
- **Render**: Servizio gratuito con PostgreSQL
- **Vercel**: Per il frontend statico
- **Heroku**: Classico ma a pagamento

## 🤝 Contributi

1. Fork il progetto
2. Crea un branch per la tua feature (`git checkout -b feature/AmazingFeature`)
3. Committa le modifiche (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

## 📄 Licenza

Questo progetto è distribuito sotto licenza MIT. Vedi il file `LICENSE` per maggiori dettagli.

## 👨‍💻 Autore

**Erik9** - [Il tuo GitHub](https://github.com/eryk9)

## 🙏 Ringraziamenti

- Express.js team
- Socket.IO team
- PostgreSQL community
- Redis community

---

⭐ Se questo progetto ti è utile, metti un like!

## Struttura del Progetto

```
.
├── index.js            - Entry point dell'app
├── db.js               - Pool di connessione PostgreSQL
├── cache.js            - Client Redis
├── schema.sql          - Schema database
├── package.json        - Dipendenze
└── .env.example        - Template variabili
```

## Database Schema

Tabelle principali:
- **users** - Profili utenti
- **profiles** - Dettagli profilo (genere, interessi)
- **matches** - Matching tra utenti
- **messages** - Messaggistica tra matched

Vedi `schema.sql` per i dettagli completi.
