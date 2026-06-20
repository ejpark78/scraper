.PHONY: build run shell down

build:
	docker compose build

run:
	docker compose run --rm exporter npm run start -- $(ARGS)

shell:
	docker compose run --rm exporter sh

down:
	docker compose down
