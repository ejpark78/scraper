---
trigger: always_on
---

# 🚨 Failure Detection & Isolation Rules

This document defines the rules for systematically detecting and isolating exception cases across the scraper and converter pipelines.

---

## 1. 📂 File System & Identifier Constraint Rules

1. **File Name Length Limitation (ENAMETOOLONG)**:
   - The maximum file name length on Linux file systems is **255 characters**.
   - If you use target URLs or encoded values (e.g., Base64) as part of file names, Korean encoding and accumulated URL parameters will easily exceed this limit.
   - When designing new crawlers, the identifier (ID) generation algorithm **must adopt a fixed length (e.g., MD5 32-character hash)**.

2. **Existing Data Migration**:
   - If the ID generation algorithm changes (e.g., Base64 ➡️ MD5), existing crawled data might still be registered as completed (`urls.status = 'completed'`) under the old ID scheme.
   - Consequently, during the conversion stage ([ConverterWorker.ts](src/crawler/workers/ConverterWorker.ts)), looking up HTML files using the new MD5 IDs will result in massive `Raw document not found` errors.
   - After modifying ID generation logic, you must map the consistency of existing DB data, or reset/migrate the previous crawling history.

---

## 2. 🔍 Pipeline Reverse Error Tracing Rules

1. **Tracing Causes of Converter Failures**:
   - If a `[Converter] Conversion failed` error occurs in the `ConverterWorker` (defined in [ConverterWorker.ts](src/crawler/workers/ConverterWorker.ts)), verify first if the document exists in the `bronze.html` collection.
   - If the raw document is missing, it suggests a silent failure or interruption at the scraping stage ([ScraperWorker.ts](src/crawler/workers/ScraperWorker.ts)) rather than a bug in the converter.
   - In this case, trace the target document's `status` and `error` metadata in the `bronze.urls` collection.
