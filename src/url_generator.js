const { URLSearchParams } = require('url');

/**
 * Generates absolute LinkedIn job search URLs based on a structured config object.
 * @param {Object} config The structured config object (from config.json)
 * @returns {Array<string>} An array of compiled absolute LinkedIn URLs
 */
function generateUrls(config) {
    const urls = [];
    const { global_settings, search_targets, direct_urls } = config;
    const globalSettings = global_settings || {};

    // 1. Compile search targets
    if (search_targets && Array.isArray(search_targets)) {
        search_targets.forEach(target => {
            if (!target.keywords || !Array.isArray(target.keywords)) return;
            
            target.keywords.forEach(keyword => {
                const params = new URLSearchParams();
                params.append('keywords', keyword);
                
                if (target.geoId) {
                    params.append('geoId', target.geoId);
                } else if (target.location) {
                    params.append('location', target.location);
                }

                if (globalSettings.distance) params.append('distance', globalSettings.distance);
                if (globalSettings.f_TPR) params.append('f_TPR', globalSettings.f_TPR);
                if (globalSettings.sortBy) params.append('sortBy', globalSettings.sortBy);
                if (globalSettings.spellCorrectionEnabled !== undefined) {
                    params.append('spellCorrectionEnabled', globalSettings.spellCorrectionEnabled);
                }

                urls.push(`https://www.linkedin.com/jobs/search/?${params.toString()}`);
            });
        });
    }

    // 2. Add direct URLs
    if (direct_urls && Array.isArray(direct_urls)) {
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
