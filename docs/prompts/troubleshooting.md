# Troubleshooting Guide

A quick reference manual for debugging common container, volume, and scraping environment errors.

---

## 1. Local node_modules Mount Troubleshooting
### Symptom:
When launching tests or scrapers using docker volume mount mapping `-v $(pwd):/app`, you get dependency version mismatches or "module not found" errors because host directories override container ones.

### Resolution:
Add an anonymous volume mount targeting the container's `/app/node_modules` directory:
```bash
docker compose -p scraper run --rm -v $(pwd):/app -v /app/node_modules worker npx ts-node ...
```

---

## 2. Playwright Browser Executable Mismatch
### Symptom:
```
browserType.launch: Executable doesn't exist at /ms-playwright/chromium-...
```

### Resolution:
1. Rebuild the worker container image to align node module versions:
   ```bash
   docker compose build worker
   ```
2. Or temporarily install matching playwright browser binaries in the runner:
   ```bash
   docker compose run --rm worker npx playwright install
   ```

---

## 3. Redis Completed Cache Inconsistencies (All Items Re-queued)
### Symptom:
Running `task app:crawler:site SITE=<site> CMD=list` repeatedly queues all documents to Redis scraper queues even if they exist in MongoDB.

### Resolution:
1. Check if the site key's `completedSetKey` is shared with other sites in `site.config.ts`. (All sites must have unique `sites:${siteKey}:completed` keys).
2. Reset or flush the specific site's Redis completion cache to enforce seed initialization:
   ```bash
   docker compose -p scraper exec -T redis redis-cli SADD sites:${siteKey}:completed "init-dummy-id"
   ```

---

## 4. DB Diagnostics inside Docker Network
### Symptom:
Unable to connect to MongoDB (`27017`) or Redis (`6379`) from the host terminal.

### Resolution:
Ports are intentionally not exposed to the host for security. Target them inside Traefik networks or use ephemeral netshoot/cli sessions:
```bash
docker compose -p scraper exec -T mongodb mongosh bronze --eval "db['uppity.html'].countDocuments()"
```

---

## 5. Malformed Noise IDs in DB (Trailing Korean Particles)
### Symptom:
Articles failed to crawl with HTTP 400 Bad Request error because trailing Korean particles (e.g. `를`, `에` or `%EB%A5%BC`) are appended to the scraped URLs.

### Resolution:
1. Run the legacy noise cleaning migration script to prune malformed IDs and schedule clean re-crawling:
   ```bash
   docker compose -p scraper run --rm -v $(pwd)/src:/app/src worker npx ts-node src/scripts/clean_legacy_noise_ids.ts
   ```
2. Check MongoDB directly to ensure no malformed IDs remain:
   ```bash
   docker compose -p scraper exec -T mongodb mongosh bronze --eval "db['geeknews.urls'].find({id: /.*[가-힣%].*/})"
   ```
