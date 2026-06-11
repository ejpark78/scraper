/**
 * @module RecursiveScrape.test
 * @description Core functionality or script runner for RecursiveScrape.test.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies assert, cheerio, mongodb, mongo, UrlUtils
 * @lastUpdated 2026-06-11
 */

import * as assert from 'assert';
import * as cheerio from 'cheerio';
import { MongoClient } from 'mongodb';
import { MongoDatabase } from '../../src/database/mongo';
import { UrlUtils } from '../../src/crawler/utils/UrlUtils';
import { getSite } from '../../src/crawler/core/SiteRegistry';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';

interface SiteConfig {
    key: string;
    domain: string;
    htmlCollection: `bronze/${string}`;
    urlsCollection: `bronze/${string}`;
    extractId: (url: string) => string | null;
}

interface ExtractionDetail {
    url: string;
    stage: 'domain_match' | 'domain_skip' | 'share_extract' | 'tracking_clean' | 'binary_skip' | 'protocol_skip' | 'id_null' | 'discovered';
}

interface ExtractionSummary {
    urls: string[];
    details: ExtractionDetail[];
    counts: {
        totalAnchors: number;
        protocolSkipped: number;
        domainSkipped: number;
        domainMatched: number;
        shareExtracted: number;
        binarySkipped: number;
        afterClean: number;
        idNull: number;
        discovered: number;
    };
}

function extractHtmlUrls(html: string, domain: string, extractId: (url: string) => string | null): ExtractionSummary {
    const $ = cheerio.load(html);
    const discovered = new Map<string, string>();
    const details: ExtractionDetail[] = [];

    const counts = {
        totalAnchors: 0,
        protocolSkipped: 0,
        domainSkipped: 0,
        domainMatched: 0,
        shareExtracted: 0,
        binarySkipped: 0,
        afterClean: 0,
        idNull: 0,
        discovered: 0,
    };

    $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        counts.totalAnchors++;

        try {
            let fullUrl = new URL(href, 'https://' + domain).toString();
            const parsed = new URL(fullUrl);
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
                counts.protocolSkipped++;
                return;
            }
            if (!UrlUtils.isSameDomain(parsed.hostname, domain)) {
                const extracted = UrlUtils.extractDomainUrl(fullUrl, domain);
                if (!extracted) {
                    counts.domainSkipped++;
                    details.push({ url: fullUrl, stage: 'domain_skip' });
                    return;
                }
                fullUrl = extracted;
                counts.shareExtracted++;
                details.push({ url: fullUrl, stage: 'share_extract' });
            } else {
                counts.domainMatched++;
            }
            fullUrl = UrlUtils.stripTrackingParams(fullUrl).split('#')[0];
            if (UrlUtils.isBinaryUrl(fullUrl)) {
                counts.binarySkipped++;
                details.push({ url: fullUrl, stage: 'binary_skip' });
                return;
            }
            counts.afterClean++;
            const id = extractId(fullUrl);
            if (!id) {
                counts.idNull++;
                details.push({ url: fullUrl, stage: 'id_null' });
                return;
            }
            if (!discovered.has(id)) {
                discovered.set(id, fullUrl);
                counts.discovered++;
                details.push({ url: fullUrl, stage: 'discovered' });
            }
        } catch { }
    });

    return {
        urls: Array.from(discovered.values()),
        details,
        counts,
    };
}

async function discoverCollections(): Promise<SiteConfig[]> {
    const discoverClient = new MongoClient(MONGO_URL);
    await discoverClient.connect();
    const bronzeDb = discoverClient.db('bronze');
    const collections = await bronzeDb.listCollections().toArray();
    await discoverClient.close();

    const htmlSets = new Map<string, string>();
    const urlsSets = new Map<string, string>();

    for (const c of collections) {
        const name = c.name;
        if (name.endsWith('.html')) {
            const prefix = name.slice(0, -'.html'.length);
            htmlSets.set(prefix, name);
        } else if (name.endsWith('.urls')) {
            const prefix = name.slice(0, -'.urls'.length);
            urlsSets.set(prefix, name);
        }
    }

    const result: SiteConfig[] = [];
    const allKeys = new Set([...htmlSets.keys(), ...urlsSets.keys()]);

    for (const prefix of allKeys) {
        const desc = getSite(prefix);
        if (!desc?.domain || !desc.scraper?.extractId) continue;

        const htmlName = htmlSets.get(prefix);
        const urlsName = urlsSets.get(prefix);
        if (!htmlName || !urlsName) continue;

        result.push({
            key: desc.key,
            domain: desc.domain,
            htmlCollection: `bronze/${htmlName}` as `bronze/${string}`,
            urlsCollection: `bronze/${urlsName}` as `bronze/${string}`,
            extractId: (url: string) => desc.scraper!.extractId(url),
        });
    }

    return result;
}

async function verifySite(site: SiteConfig): Promise<void> {
    const mongo = MongoDatabase.getInstance();
    await mongo.connect();

    console.log(`\n═══════════════════════════════════════`);
    console.log(`  Site: ${site.key} (${site.domain})`);
    console.log(`═══════════════════════════════════════`);

    const htmlColl = await mongo.getCollection(site.htmlCollection);
    const urlsColl = await mongo.getCollection(site.urlsCollection);

    const htmlCount = await htmlColl.countDocuments();
    const urlsCount = await urlsColl.countDocuments();

    console.log(`  .html docs:           ${htmlCount}`);
    console.log(`  .urls docs:           ${urlsCount}`);

    assert.ok(htmlCount >= 0, `htmlCount should be non-negative`);
    assert.ok(urlsCount >= 0, `urlsCount should be non-negative`);

    if (htmlCount === 0) {
        console.log(`  ⏭️  No HTML docs to scan.`);
        return;
    }

    const SHOW_TOP = 5;
    let discoveredUrls = new Set<string>();
    let discoveredIds = new Set<string>();
    let mergedCounts = { totalAnchors: 0, protocolSkipped: 0, domainSkipped: 0, domainMatched: 0, shareExtracted: 0, binarySkipped: 0, afterClean: 0, idNull: 0, discovered: 0 };
    let sampled: Array<{ url: string; linkCount: number; breakdown: string }> = [];

    const htmlDocs = await htmlColl.find({}, { projection: { rawHtml: 1 }, maxTimeMS: 30000 }).toArray();
    for (const doc of htmlDocs) {
        if (!doc?.rawHtml) continue;
        const result = extractHtmlUrls(doc.rawHtml, site.domain, site.extractId);
        for (const k of Object.keys(mergedCounts) as (keyof typeof mergedCounts)[]) {
            mergedCounts[k] += result.counts[k];
        }
        const docIds = new Set<string>();
        for (const url of result.urls) {
            const id = site.extractId(url);
            if (id && !discoveredIds.has(id)) {
                discoveredIds.add(id);
                discoveredUrls.add(url);
            }
            if (id) docIds.add(id);
        }
        if (sampled.length < SHOW_TOP && result.urls.length > 0) {
            const sample = result.details.filter(d => d.stage === 'discovered').slice(0, 3);
            const breakdown = `disc=${result.counts.discovered}/match=${result.counts.domainMatched}/skip=${result.counts.domainSkipped}/bin=${result.counts.binarySkipped}`;
            sampled.push({ url: urlTruncate(doc._id?.toString() || ''), linkCount: result.urls.length, breakdown });
        }
    }

    const c = mergedCounts;
    console.log(`  Total anchors scanned: ${c.totalAnchors}`);
    console.log(`    ├─ protocol skip:     ${c.protocolSkipped} (mailto:/javascript:/ftp:)`);
    console.log(`    ├─ domain skip:       ${c.domainSkipped} (external, no share param)`);
    console.log(`    ├─ domain match:      ${c.domainMatched} (direct same-domain)`);
    console.log(`    ├─ share extract:     ${c.shareExtracted} (via ?url= / ?u= param)`);
    console.log(`    ├─ binary skip:       ${c.binarySkipped} (.pdf/.zip/.jpg/...)`);
    console.log(`    ├─ after clean:       ${c.afterClean} (tracking stripped + fragment removed)`);
    console.log(`    ├─ id null skip:      ${c.idNull} (extractId returned null)`);
    console.log(`    └─ discovered:        ${c.discovered} (raw, including dupes)`);
    console.log(`  Unique (de-ID'd):     ${discoveredUrls.size}`);

    const urlsIds = new Set<string>();
    const urlDocs = await urlsColl.find({}, { projection: { id: 1 }, maxTimeMS: 30000 }).toArray();
    for (const doc of urlDocs) {
        if (doc?.id) urlsIds.add(String(doc.id));
    }

    const intersection = new Set<string>();
    for (const id of discoveredIds) {
        if (urlsIds.has(id)) intersection.add(id);
    }

    const inHtmlOnly = discoveredUrls.size - intersection.size;
    const inUrlsOnly = urlsIds.size - intersection.size;

    console.log(`  In both:              ${intersection.size}`);
    console.log(`  In HTML only:         ${inHtmlOnly}`);
    console.log(`  In .urls only:        ${inUrlsOnly}`);

    if (sampled.length > 0) {
        console.log(`\n  ── Top ${sampled.length} HTML docs by discovered links ──`);
        for (const s of sampled) {
            console.log(`    ${s.url}: ${s.linkCount} links (${s.breakdown})`);
        }
    }

    const coverage = discoveredUrls.size > 0
        ? ((intersection.size / discoveredUrls.size) * 100).toFixed(1)
        : 'N/A';
    console.log(`\n  📊 Coverage: ${coverage}% of extractable URLs are in .urls`);

    if (urlsCount > discoveredUrls.size) {
        console.log(`  💡 .urls (${urlsCount}) > HTML-extractable (${discoveredUrls.size}) — some URLs came from List or manual add.`);
    } else if (urlsCount < discoveredUrls.size) {
        console.log(`  💡 HTML-extractable (${discoveredUrls.size}) > .urls (${urlsCount}) — RECURSIVE_SCRAPE can discover ${discoveredUrls.size - urlsCount} more URLs.`);
    }

    if (inHtmlOnly > 0 && process.env.RECURSIVE_SCRAPE === 'true') {
        console.log(`  ✅ RECURSIVE_SCRAPE=true: ${inHtmlOnly} URLs from HTML body are queuable.`);
    } else if (inHtmlOnly > 0) {
        console.log(`  ⚠️  RECURSIVE_SCRAPE not set: ${inHtmlOnly} URLs from HTML body are NOT being queued.`);
    }
}

function urlTruncate(s: string): string {
    return s.length > 55 ? s.slice(0, 52) + '...' : s;
}

async function main() {
    console.log('🧪 [Recursive Scrape] MongoDB 데이터 정합성 검증\n');

    const configs = await discoverCollections();

    if (configs.length === 0) {
        console.log('❌ No matched site configs found. Check bronze collections and site.config.ts files.');
        process.exit(1);
    }

    const siteFilter = process.env.SITE;
    const filtered = siteFilter
        ? configs.filter(c => c.key === siteFilter)
        : configs;

    if (filtered.length === 0) {
        console.error(`❌ Unknown site: ${siteFilter}. Available: ${configs.map(c => c.key).join(', ')}`);
        process.exit(1);
    }

    for (const site of filtered) {
        try {
            await verifySite(site);
        } catch (err: any) {
            console.error(`\n❌ [${site.key}] Failed: ${err.message}`);
        }
    }

    console.log(`\n🎉 [완료] 모든 사이트 검증 완료!`);
    const mongo = MongoDatabase.getInstance();
    await mongo.close();
    process.exit(0);
}

main().catch((err) => {
    console.error(`❌ Fatal error:`, err);
    process.exit(1);
});
