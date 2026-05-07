# Hardening del servidor — Pre-deploy

> Ejecutar en orden. Cada sección tiene un comando de verificación al final.

---

## 1. SSH con clave privada (sin contraseña)

En tu PC Windows (PowerShell):

```powershell
ssh-keygen -t ed25519 -C "harborflow-deploy"
# Guardar en: C:\Users\TU_USUARIO\.ssh\harborflow_ed25519
# No usar passphrase si va a usarse en scripts de CI

# Copiar la clave pública a la VPS:
type $env:USERPROFILE\.ssh\harborflow_ed25519.pub | ssh root@TU_IP_VPS "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

En la VPS, editar `/etc/ssh/sshd_config`:

```
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
```

```bash
sudo systemctl restart ssh

# Verificar (desde otra terminal, sin cerrar la actual):
ssh -i ~/.ssh/harborflow_ed25519 harborflow@TU_IP_VPS
```

> **IMPORTANTE:** No cerrar la sesión actual hasta verificar que la nueva clave funciona.

---

## 2. Firewall UFW

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw enable

# Verificar:
sudo ufw status verbose
```

---

## 3. Fail2ban contra brute force SSH

```bash
sudo apt install fail2ban -y

# Crear /etc/fail2ban/jail.local:
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Verificar:
sudo fail2ban-client status sshd
```

---

## 4. Usuario no-root para deploy

```bash
# Crear usuario harborflow sin sudo
sudo adduser harborflow --disabled-password --gecos ""
sudo mkdir -p /home/harborflow/app
sudo chown harborflow:harborflow /home/harborflow/app

# Crear directorio de logs
sudo mkdir -p /var/log/harborflow
sudo chown harborflow:harborflow /var/log/harborflow

# El usuario harborflow NO debe tener acceso sudo
# Verificar que no esté en el grupo sudo:
id harborflow
# No debe aparecer "sudo" en los grupos
```

---

## 5. PostgreSQL hardening

```bash
# Ver configuración actual de pg_hba.conf:
sudo -u postgres psql -c "SHOW hba_file;"

# Editar pg_hba.conf — solo permitir conexiones locales (socket unix):
# host  all  all  127.0.0.1/32  md5   <-- si necesitás TCP local
# local all  all               md5    <-- socket unix (recomendado)

# Cambiar contraseña del usuario de la app:
sudo -u postgres psql
ALTER USER harborflow WITH PASSWORD 'NUEVA_PASSWORD_FUERTE_GENERADA';
\q

# Si el puerto 5432 está expuesto públicamente, bloquear con UFW:
sudo ufw deny 5432/tcp

# Verificar que PostgreSQL solo escucha en localhost:
sudo -u postgres psql -c "SHOW listen_addresses;"
# Debe mostrar 'localhost' o '127.0.0.1', nunca '*'
```

Si `listen_addresses` es `*`, editar `/etc/postgresql/*/main/postgresql.conf`:

```
listen_addresses = 'localhost'
```

```bash
sudo systemctl restart postgresql
```

---

## 6. Actualizaciones de seguridad automáticas

```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure --priority=low unattended-upgrades
# Seleccionar "Yes"

# Verificar:
sudo systemctl status unattended-upgrades
```

---

## Checklist de verificación final

- [ ] SSH con clave — acceso por contraseña deshabilitado
- [ ] Root SSH deshabilitado
- [ ] UFW activo con solo puertos 22, 80, 443
- [ ] Fail2ban corriendo y monitoreando SSH
- [ ] Usuario `harborflow` sin sudo
- [ ] PostgreSQL solo escucha en localhost
- [ ] Contraseña fuerte en usuario DB de producción
- [ ] Unattended-upgrades activo
