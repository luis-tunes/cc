.PHONY: dev test clean deploy mcp

dev:
	bin/dev

test:
	bin/test

clean:
	bin/clean

deploy:
	bin/deploy $(HOST)

mcp:
	cd mcp && npm install && npm run build
