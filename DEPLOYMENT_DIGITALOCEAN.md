# MO SaaS POS - DigitalOcean Deployment Checklist

## Server Shape

- Ubuntu LTS Droplet, 1-2 GB RAM for first production release.
- DigitalOcean Managed MySQL recommended.
- Domain/subdomain pointed to the Droplet, for example `app.example.com`.
- TLS with Nginx and Let's Encrypt.
- PM2 process manager using `ecosystem.config.js`.

## One-Time Server Setup

```bash
sudo apt update
sudo apt install -y nginx git ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## App Setup

```bash
git clone <your-repo-url> /var/www/mo-saas-pos
cd /var/www/mo-saas-pos/backend
npm ci --omit=dev
cp .env.production.example .env
nano .env
npm run check:prod
npm run migrate
npm run seed:boss
cd ..
mkdir -p backend/logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Nginx Proxy

Create `/etc/nginx/sites-available/mo-saas-pos`:

```nginx
server {
    listen 80;
    server_name app.example.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/mo-saas-pos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Then install SSL:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.example.com
```

## Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Pre-Go-Live Verification

```bash
cd /var/www/mo-saas-pos/backend
npm run check
npm run check:prod
curl https://app.example.com/health
curl https://app.example.com/ready
```

Also test in browser:

- Boss Admin login.
- Admin signup and login.
- Expired/suspended admin blocked.
- Staff POS sale.
- Staff daily expense add/edit/delete.
- Daily/weekly/monthly reports.
- PWA install button.
- Dark/light mode.
- API endpoints without token return `401/403`.

## Backups

- Turn on DigitalOcean Managed Database automatic backups.
- Take a Droplet snapshot before major updates.
- Export app data from Settings before risky migrations.

## Secrets

Never commit `backend/.env`. Generate long random values for:

- `JWT_SECRET`
- `OTP_HASH_SECRET`
- `WEBHOOK_SECRET`
- `SEED_BOSS_PASSWORD`
- `DB_PASSWORD`
