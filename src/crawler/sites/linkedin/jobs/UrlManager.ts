/**
 * @module UrlManager
 * @description Core functionality or script runner for UrlManager.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies url
 * @lastUpdated 2026-06-11
 */

import { URLSearchParams } from 'url';

// ⚙️ LinkedIn URL 생성, 검색 조건 빌드 및 중복 필터링 통합 OOP 매니저 (TypeScript)

export interface GlobalSettings {
    max_page?: number;
    f_TPR?: string | string[];
    sortBy?: string | string[];
    distance?: string | number | (string | number)[];
    spellCorrectionEnabled?: boolean;
    start?: number;
}

export interface SearchTarget {
    keywords?: string[];
    location?: string;
    geoId?: string;
    max_page?: number;
    start?: number;
    enabled?: boolean;
}

export interface Config {
    global_settings?: GlobalSettings;
    search_targets?: SearchTarget[];
    direct_urls?: string[];
    geo_registry?: Record<string, string>;
    parameter_registry?: Record<string, Record<string, string>>;
}

export interface GenerateUrlsOptions {
    skipDirectUrls?: boolean;
}

export interface IUrlManager {
    generateUrls(config: Config, options?: GenerateUrlsOptions): string[];
}

export class LinkedInUrlManager implements IUrlManager {
    /**
     * Generates absolute LinkedIn job search URLs based on a structured config object.
     */
    public generateUrls(config: Config, options: GenerateUrlsOptions = {}): string[] {
        const skipDirectUrls = !!options.skipDirectUrls;
        const urls: string[] = [];
        const { global_settings, search_targets, direct_urls } = config;
        const globalSettings = global_settings || {};

        const geoRegistry = config.geo_registry || {};
        const parameterRegistry = config.parameter_registry || {};

        // f_TPR 값을 배열로 표준화 및 레디스트리 파라미터 변환
        const raw_f_TPRs = globalSettings.f_TPR 
            ? (Array.isArray(globalSettings.f_TPR) ? globalSettings.f_TPR : [globalSettings.f_TPR])
            : [undefined];
            
        const f_TPRs = raw_f_TPRs.map(val => {
            if (val && parameterRegistry.f_TPR && parameterRegistry.f_TPR[val] !== undefined) {
                return parameterRegistry.f_TPR[val];
            }
            return val;
        });

        // sortBy 값을 배열로 표준화 및 레디스트리 파라미터 변환
        const raw_sortBys = globalSettings.sortBy
            ? (Array.isArray(globalSettings.sortBy) ? globalSettings.sortBy : [globalSettings.sortBy])
            : [undefined];

        const sortBys = raw_sortBys.map(val => {
            if (val && parameterRegistry.sortBy && parameterRegistry.sortBy[val] !== undefined) {
                return parameterRegistry.sortBy[val];
            }
            return val;
        });

        // distance 값을 배열로 표준화
        const distances = globalSettings.distance
            ? (Array.isArray(globalSettings.distance) ? globalSettings.distance : [globalSettings.distance])
            : [undefined];

        // 1. Compile search targets
        if (search_targets && Array.isArray(search_targets)) {
            search_targets.filter(target => target.enabled !== false).forEach(target => {
                if (!target.keywords || !Array.isArray(target.keywords)) return;
                
                target.keywords.forEach(keyword => {
                    const maxPage = (target.max_page !== undefined) ? target.max_page : globalSettings.max_page;
                    const pageCount = (maxPage && Number.isInteger(maxPage) && maxPage > 0) ? maxPage : 1;

                    // f_TPR, sortBy, distance의 모든 데카르트 곱 조합 순회
                    f_TPRs.forEach(resolved_f_TPR => {
                        sortBys.forEach(resolved_sortBy => {
                            distances.forEach(resolved_distance => {
                                for (let i = 0; i < pageCount; i++) {
                                    const params = new URLSearchParams();
                                    params.append('keywords', keyword);
                                    
                                    const resolvedGeoId = target.location ? geoRegistry[target.location] : null;
                                    
                                    if (resolvedGeoId) {
                                        params.append('geoId', resolvedGeoId);
                                    } else if (target.geoId) {
                                        params.append('geoId', target.geoId);
                                    } else if (target.location) {
                                        params.append('location', target.location);
                                    }

                                    if (resolved_distance !== undefined && resolved_distance !== null) {
                                        params.append('distance', String(resolved_distance));
                                    }
                                    if (resolved_f_TPR && resolved_f_TPR !== 'any time' && resolved_f_TPR !== '') {
                                        params.append('f_TPR', resolved_f_TPR);
                                    }
                                    if (resolved_sortBy) params.append('sortBy', resolved_sortBy);
                                    if (globalSettings.spellCorrectionEnabled !== undefined) {
                                        params.append('spellCorrectionEnabled', String(globalSettings.spellCorrectionEnabled));
                                    }
                                    
                                    const startVal = i * 25;
                                    if (startVal > 0) {
                                        params.append('start', String(startVal));
                                    } else {
                                        const explicitStart = (target.start !== undefined) ? target.start : globalSettings.start;
                                        if (explicitStart !== undefined && explicitStart > 0) {
                                            params.append('start', String(explicitStart));
                                        }
                                    }

                                    urls.push(`https://www.linkedin.com/jobs/search/?${params.toString()}`);
                                }
                            });
                        });
                    });
                });
            });
        }

        // 2. Direct URLs 컴파일
        if (!skipDirectUrls && direct_urls && Array.isArray(direct_urls)) {
            direct_urls.forEach(url => {
                if (url && url.trim()) {
                    urls.push(url.trim());
                }
            });
        }

        return urls;
    }
}
