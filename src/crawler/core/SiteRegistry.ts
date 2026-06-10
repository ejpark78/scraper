import * as fs from 'fs';
import * as path from 'path';
import type { IConverter } from './IConverter';

export interface SiteDescriptor {
  key: string;
  name: string;
  domain?: string;

  scraper?: {
    collectionName: `bronze/${string}`;
    targetCollection: string;
    updateFilterKey: string;
    defaultSlack: number;
    extractId: (url: string) => string;
    urlsCollectionName?: `bronze/${string}`;
    scrape: (url: string, tempPath: string) => Promise<void>;
  };

  transformer?: {
    converter: IConverter<any>;
    targetCollection: string;
    filter: (id: string) => Record<string, any>;
    statusCollection?: string;
    statusFilterField?: string;
    completedSetKey: string;
  };

  targetLoader?: {
    collectionName: `silver/${string}`;
    filterField: string;
    buildDocument: (id: string, meta: any) => Record<string, any>;
  };
}

const registry = new Map<string, SiteDescriptor>();

function discoverSites(): void {
  const sitesDir = path.resolve(__dirname, '..', 'sites');

  if (!fs.existsSync(sitesDir)) return;

  for (const dir of fs.readdirSync(sitesDir)) {
    const dirPath = path.join(sitesDir, dir);
    if (!fs.statSync(dirPath).isDirectory()) continue;

    const configPath = path.join(dirPath, 'site.config');
    if (fs.existsSync(configPath + '.ts') || fs.existsSync(configPath + '.js')) {
      try {
        const mod = require(configPath) as { descriptor: SiteDescriptor };
        if (mod.descriptor) {
          registry.set(mod.descriptor.key, mod.descriptor);
        }
      } catch (err: any) {
        console.error(`[SiteRegistry] Failed to load config: ${configPath} - ${err.message}`);
      }
    }

    for (const subDir of fs.readdirSync(dirPath)) {
      const subDirPath = path.join(dirPath, subDir);
      if (!fs.statSync(subDirPath).isDirectory()) continue;

      const subConfigPath = path.join(subDirPath, 'site.config');
      if (fs.existsSync(subConfigPath + '.ts') || fs.existsSync(subConfigPath + '.js')) {
        try {
          const mod = require(subConfigPath) as { descriptor: SiteDescriptor };
          if (mod.descriptor) {
            registry.set(mod.descriptor.key, mod.descriptor);
          }
        } catch (err: any) {
          console.error(`[SiteRegistry] Failed to load config: ${subConfigPath} - ${err.message}`);
        }
      }
    }
  }
}

discoverSites();

export function getSite(key: string): SiteDescriptor | undefined {
  return registry.get(key);
}

export function getAllSites(): SiteDescriptor[] {
  return Array.from(registry.values());
}
