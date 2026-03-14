.PHONY: dev test deploy clean

dev:
	bin/dev

test:
	bin/test

deploy:
	bin/deploy $(HOST)

clean:
	bin/clean
