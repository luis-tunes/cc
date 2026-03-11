# TIM

Contabilidade para Portugal. Faturas entram, OCR extrai, banco reconcilia.

## Usar

```
make dev                     # arrancar tudo (Docker)
make test                    # testes + build frontend
make deploy HOST=user@ip     # testar → enviar → levantar
make clean                   # limpar tudo
```

## Stack

Python 3.11 · FastAPI · PostgreSQL 16 · Paperless-ngx · React 18 · Vite · Clerk · Stripe

## Preço

150 €/mês + IVA. Plano Empresa sob consulta.

## Primeiro deploy

```bash
ssh root@IP
apt update && apt upgrade -y
ufw allow 22 && ufw allow 8080 && ufw allow 8000 && ufw enable
curl -fsSL https://get.docker.com | sh
mkdir -p /opt/cc
cp .env.example /opt/cc/.env
# editar /opt/cc/.env com valores reais
```

Da máquina local:

```bash
make deploy HOST=root@IP
```

## CI

GitHub → Settings → Secrets:
- `DEPLOY_HOST`: `root@IP`
- `DEPLOY_KEY`: chave privada SSH
- `VITE_CLERK_PUBLISHABLE_KEY`: `pk_test_...` ou `pk_live_...`

Push em `main` → testes → build imagem → push GHCR → deploy (pull + up).

## Licença

Privado.