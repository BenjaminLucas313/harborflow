# Nginx + SSL (Let's Encrypt) — Configuración completa

---

## 1. Instalar nginx y certbot

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
```

---

## 2. Configuración nginx

Crear `/etc/nginx/sites-available/harborflow`:

```nginx
# Redirigir todo HTTP → HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name harborflow.app www.harborflow.app;

    # Forzar HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name harborflow.app www.harborflow.app;

    # SSL — Let's Encrypt manejará estas líneas automáticamente con certbot
    # ssl_certificate /etc/letsencrypt/live/harborflow.app/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/harborflow.app/privkey.pem;
    # include /etc/letsencrypt/options-ssl-nginx.conf;
    # ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # ── Headers de seguridad ──────────────────────────────────────────────
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options    "nosniff" always;
    add_header X-Frame-Options           "DENY" always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy        "camera=(), microphone=(), geolocation=()" always;

    # ── Tamaño máximo de upload ───────────────────────────────────────────
    client_max_body_size 10M;

    # ── Compresión ────────────────────────────────────────────────────────
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # ── Proxy a Next.js ───────────────────────────────────────────────────
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
    }

    # ── Health check sin logs (evita ruido en access.log) ────────────────
    location /api/health {
        proxy_pass http://127.0.0.1:3000;
        access_log off;
    }

    # ── Archivos estáticos de Next.js ─────────────────────────────────────
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # ── Bloquear acceso a archivos sensibles ─────────────────────────────
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

---

## 3. Activar el sitio y verificar sintaxis

```bash
# Activar el sitio
sudo ln -s /etc/nginx/sites-available/harborflow /etc/nginx/sites-enabled/

# Eliminar el sitio default si existe
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar sintaxis
sudo nginx -t

# Recargar nginx
sudo systemctl reload nginx
```

---

## 4. Obtener certificado SSL con Let's Encrypt

```bash
# Asegurarse de que el dominio apunta a la IP de la VPS antes de correr esto
sudo certbot --nginx -d harborflow.app -d www.harborflow.app

# Certbot modificará automáticamente el bloque SSL del nginx.conf
```

---

## 5. Verificar auto-renovación

```bash
# Simular renovación (no renueva realmente)
sudo certbot renew --dry-run

# Ver cuándo vence el certificado
sudo certbot certificates
```

La renovación automática ya viene configurada en `/etc/cron.d/certbot` o en un timer de systemd. Verificar:

```bash
systemctl list-timers | grep certbot
```

---

## 6. Verificación final

```bash
# Probar HTTPS desde afuera:
curl -I https://harborflow.app/api/health

# Verificar headers de seguridad:
curl -I https://harborflow.app | grep -E "(Strict|X-Content|X-Frame|Referrer)"

# SSL Labs (desde navegador):
# https://www.ssllabs.com/ssltest/analyze.html?d=harborflow.app
```

---

## Checklist

- [ ] Nginx instalado y corriendo (`systemctl status nginx`)
- [ ] Sitio activado en sites-enabled
- [ ] Sintaxis verificada con `nginx -t`
- [ ] Certificado SSL obtenido con certbot
- [ ] HTTPS funcionando en harborflow.app y www.harborflow.app
- [ ] HTTP redirige a HTTPS (301)
- [ ] Headers de seguridad presentes en respuestas
- [ ] Auto-renovación probada con `--dry-run`
