.PHONY: dev install lint

dev:
	cd docs && pnpm run dev

install:
	cd docs && pnpm i

lint:
	cd docs && pnpm run lint
