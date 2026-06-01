const { URLSearchParams } = require('url');

/**
 * Generates absolute LinkedIn job search URLs based on a structured config object.
 * @param {Object} config The structured config object (from config.json)
 * @param {Object} options Options to customize generation (e.g. skipDirectUrls)
 * @returns {Array<string>} An array of compiled absolute LinkedIn URLs
 */
function generateUrls(config, options = {}) {
    const skipDirectUrls = !!options.skipDirectUrls;
    const urls = [];
    const { global_settings, search_targets, direct_urls } = config;
    const globalSettings = global_settings || {};

    const geoRegistry = config.geo_registry || {};
    const parameterRegistry = config.parameter_registry || {};

    // Pre-resolve global parameter aliases using parameter_registry
    let resolved_f_TPR = globalSettings.f_TPR;
    if (resolved_f_TPR && parameterRegistry.f_TPR && parameterRegistry.f_TPR[resolved_f_TPR] !== undefined) {
        resolved_f_TPR = parameterRegistry.f_TPR[resolved_f_TPR];
    }

    let resolved_sortBy = globalSettings.sortBy;
    if (resolved_sortBy && parameterRegistry.sortBy && parameterRegistry.sortBy[resolved_sortBy] !== undefined) {
        resolved_sortBy = parameterRegistry.sortBy[resolved_sortBy];
    }

    // 1. Compile search targets
    if (search_targets && Array.isArray(search_targets)) {
        search_targets.forEach(target => {
            if (!target.keywords || !Array.isArray(target.keywords)) return;
            
            target.keywords.forEach(keyword => {
                // Determine how many pages to generate
                const maxPage = (target.max_page !== undefined) ? target.max_page : globalSettings.max_page;
                const pageCount = (maxPage && Number.isInteger(maxPage) && maxPage > 0) ? maxPage : 1;

                for (let i = 0; i < pageCount; i++) {
                    const params = new URLSearchParams();
                    params.append('keywords', keyword);
                    
                    // Dynamic lookup of geoId from geo_registry
                    const resolvedGeoId = target.location ? geoRegistry[target.location] : null;
                    
                    if (resolvedGeoId) {
                        params.append('geoId', resolvedGeoId);
                    } else if (target.geoId) {
                        params.append('geoId', target.geoId);
                    } else if (target.location) {
                        params.append('location', target.location);
                    }

                    if (globalSettings.distance) params.append('distance', globalSettings.distance);
                    if (resolved_f_TPR) params.append('f_TPR', resolved_f_TPR);
                    if (resolved_sortBy) params.append('sortBy', resolved_sortBy);
                    if (globalSettings.spellCorrectionEnabled !== undefined) {
                        params.append('spellCorrectionEnabled', globalSettings.spellCorrectionEnabled);
                    }
                    
                    // Calculate start parameter for pagination (start = pageIndex * 25)
                    const startVal = i * 25;
                    if (startVal > 0) {
                        params.append('start', startVal);
                    } else {
                        // For the first page, fallback to explicit start parameter if provided
                        const explicitStart = (target.start !== undefined) ? target.start : globalSettings.start;
                        if (explicitStart !== undefined && explicitStart > 0) {
                            params.append('start', explicitStart);
                        }
                    }

                    urls.push(`https://www.linkedin.com/jobs/search/?${params.toString()}`);
                }
            });
        });
    }

    // 2. Add direct URLs
    if (!skipDirectUrls && direct_urls && Array.isArray(direct_urls)) {
        direct_urls.forEach(url => {
            if (url && typeof url === 'string' && url.startsWith('http')) {
                urls.push(url);
            }
        });
    }

    return urls;
}

module.exports = {
    generateUrls
};
