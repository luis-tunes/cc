# CC

Accounting for Portugal. Ingests invoices, extracts data, reconciles with bank.

```
make dev                     # local
make test                    # test
make deploy HOST=user@ip     # ship
```

Python 3.11 · FastAPI · PostgreSQL · Paperless-ngx · invoice2data · Docker

## Deploy to Linode

### 1. Create the box

Linode dashboard → Create Linode:
- Image: **Ubuntu 24.04 LTS**
- Region: **Frankfurt** (closest to Portugal)
- Plan: **Nanode 1GB** ($5/mo) — enough for MVP
- Root password: save it
- SSH key: paste your `~/.ssh/id_ed25519.pub`

Copy the IP address.

### 2. First-time server setup

```bash
ssh root@YOUR_IP

# secure it
apt update && apt upgrade -y
ufw allow 22 && ufw allow 8080 && ufw allow 8000 && ufw enable

# docker (bin/deploy does this too, but do it once manually)
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin
ln -sf /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose

# create the app dir and .env
mkdir -p /opt/cc
cat > /opt/cc/.env << 'EOF'
POSTGRES_DB=cc
POSTGRES_USER=cc
POSTGRES_PASSWORD=CHANGE_THIS_TO_RANDOM_32_CHARS
PAPERLESS_SECRET_KEY=CHANGE_THIS_TO_RANDOM_32_CHARS
PAPERLESS_ADMIN_USER=admin
PAPERLESS_ADMIN_PASSWORD=CHANGE_THIS_TOO
PAPERLESS_TOKEN=
EOF
```

### 3. Get the Paperless token

After first deploy, Paperless needs to be running to generate a token:
```bash
# on the server, after first deploy
cd /opt/cc
docker-compose exec paperless python3 manage.py shell -c \
  "from rest_framework.authtoken.models import Token; from django.contrib.auth.models import User; t,_=Token.objects.get_or_create(user=User.objects.get(username='admin')); print(t.key)"
```
Add the output to `/opt/cc/.env` as `PAPERLESS_TOKEN=<the key>`, then:
```bash
docker-compose up -d
```

### 4. Deploy from your machine

```bash
make deploy HOST=root@YOUR_IP
```

### 5. Wire CI auto-deploy

GitHub repo → Settings → Secrets → add:
- `DEPLOY_HOST`: `root@YOUR_IP`
- `DEPLOY_KEY`: contents of `~/.ssh/id_ed25519` (private key)

Now every push to main: tests → deploy. No manual steps.