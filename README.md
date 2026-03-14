# TIM

Contabilidade para Portugal. Faturas entram, OCR extrai, banco reconcilia.

## Stack

Python 3.11 · FastAPI · PostgreSQL 16 · Paperless-ngx · React 18 · Vite · Clerk · Stripe

## Desenvolvimento

```
cp .env.example .env          # preencher chaves Clerk/Stripe
make dev                      # docker compose up --build
make test                     # pytest + vite build + vitest
make clean                    # docker compose down -v
```

Frontend com hot reload:
```
cd frontend && npm run dev    # Vite :3000, proxy /api → :8080
```

## Deploy

### 1. Preparar servidor (uma vez)

```bash
ssh root@IP 'bash -s' < bin/setup-server
```

Instala Docker, firewall, swap, cria user `cc`, gera `.env` com passwords aleatórias, gera chave SSH para CI.

### 2. Primeiro deploy (manual)

```bash
make deploy HOST=cc@IP
```

Envia `docker-compose.yml`, `Caddyfile`, `bin/post-consume` para `/opt/cc/`, puxa imagem do GHCR, levanta tudo.

### 3. Token Paperless (uma vez, depois de arrancar)

```bash
ssh cc@IP
cd /opt/cc && docker compose exec paperless python3 manage.py shell -c \
  "from rest_framework.authtoken.models import Token; from django.contrib.auth.models import User; t,_=Token.objects.get_or_create(user=User.objects.get(username='admin')); print(t.key)"
# colar em /opt/cc/.env como PAPERLESS_TOKEN=...
docker compose restart app
```

### 4. CI automático

GitHub → Settings → Secrets → Actions:

| Secret | Valor |
|--------|-------|
| `DEPLOY_HOST` | `cc@IP` |
| `DEPLOY_KEY` | chave privada SSH (gerada pelo setup-server) |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_...` ou `pk_live_...` |

Push em `main` → testa (`bin/test`) → build imagem → push GHCR → deploy (pull + restart).

## Fluxo

```
git push main
  → CI: bin/test (pytest + vite build + vitest)
  → CI: docker build → ghcr.io/xzero-ai/cc:latest
  → CI: scp config → ssh pull → docker compose up
```

```
make deploy HOST=cc@IP    # manual (mesma coisa, sem build)
```

## Ficheiros no servidor

```
/opt/cc/
  docker-compose.yml      # enviado por deploy
  Caddyfile               # enviado por deploy
  .env                    # gerado pelo setup-server (nunca sai do servidor)
  bin/post-consume        # webhook Paperless → app
```

Sem repo. Sem código. Só config + imagem Docker.

## Preço

150 €/mês + IVA. Plano Empresa sob consulta.

## Licença

Privado.
