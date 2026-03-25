.PHONY: dev test ship deploy sync-env clean

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
