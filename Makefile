.PHONY: dev test ship deploy sync-env clean backup lint format type-check logs db frontend hooks setup-prod setup-cron setup-monitoring

dev:
	bin/dev
test:
	bin/test
ship:
	bin/ship
deploy:
	bin/deploy $(HOST)
sync-env:
	bin/sync-env $(HOST)
clean:
	bin/clean
backup:
	bash bin/backup

lint:
	cd app && ruff check .
format:
	cd app && ruff format .
type-check:
	cd app && python -m mypy . --ignore-missing-imports
logs:
	docker compose logs -f --tail=100
db:
	docker compose exec db psql -U cc cc
frontend:
	cd frontend && npm test -- --run && npm run build
hooks:
	cp bin/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
	@echo "pre-commit hook installed"
setup-prod:
	bin/setup-production
setup-cron:
	bin/setup-cron $(HOST)
setup-monitoring:
	bin/setup-monitoring $(HOST) $(WEBHOOK)
