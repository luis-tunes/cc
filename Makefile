.PHONY: dev test clean deploy

dev:
	bin/dev

test:
	bin/test

clean:
	bin/clean

deploy:
	bin/deploy $(HOST)
