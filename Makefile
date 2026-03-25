.PHONY: dev test deploy clean sync-env

dev:
	bin/dev

test:
	bin/test

deploy:
	bin/deploy $(HOST)

sync-env:
	bin/sync-env $(HOST)

clean:
	bin/clean
