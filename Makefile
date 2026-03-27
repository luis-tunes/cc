.PHONY: dev test ship deploy sync-env clean backup

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
