/**
 * @module dump_sysinfo
 * @description Gathers and caches system status metrics (Git, Docker, MongoDB, Redis) to a local cache file.
 * @constraints
 *   - Must use safe try-catch blocks to prevent system configuration discovery from blocking script execution.
 *   - Follows strict OOP patterns and JSDoc guidelines.
 * @dependencies Node fs/path, child_process
 * @lastUpdated 2026-06-11
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface DockerServiceInfo {
  Service: string;
  State: string;
}

class SysInfoDumper {
  public run(): void {
    try {
      const info = {
        timestamp: new Date().toISOString(),
        git: this.getGitStatus(),
        docker: this.getDockerStatus(),
        mongo: this.getMongoConnectivity(),
        redis: this.getRedisConnectivity()
      };

      const outPath = path.join(__dirname, '../sysinfo_cache.json');
      fs.writeFileSync(outPath, JSON.stringify(info, null, 2), 'utf-8');
      console.log(`✨ System status cached at: ${outPath}`);

      // Copy to data/agents/agy/ as requested
      const transcriptsAgyDir = path.join(__dirname, '../../data/agents/agy');
      fs.mkdirSync(transcriptsAgyDir, { recursive: true });
      const destPath = path.join(transcriptsAgyDir, 'sysinfo_cache.json');
      fs.writeFileSync(destPath, JSON.stringify(info, null, 2), 'utf-8');
      console.log(`✨ System status cached at data/agents/agy: ${destPath}`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('❌ Error dumping sysinfo:', errMsg);
      process.exit(1);
    }
  }

  private getGitStatus(): string {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
      const status = execSync('git status -s', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
      return `Branch: ${branch}${status ? ' | Changes: ' + status.replace(/\n/g, ', ') : ' | Clean'}`;
    } catch {
      return 'Not a git repo or command failed';
    }
  }

  private getDockerStatus(): string {
    try {
      const output = execSync('docker compose -p linkedin ps --format json', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      const services = JSON.parse(`[${output.trim().split('\n').join(',')}]`) as DockerServiceInfo[];
      return services.map((s: DockerServiceInfo) => `${s.Service}:${s.State}`).join(', ');
    } catch {
      return 'Docker down or command failed';
    }
  }

  private getMongoConnectivity(): string {
    try {
      const output = execSync('docker exec linkedin-mongodb-1 mongosh --eval "db.adminCommand({ping: 1})" --quiet', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      return output.includes('ok: 1') ? 'Connected (Active)' : 'Disconnected';
    } catch {
      return 'Disconnected/Unavailable';
    }
  }

  private getRedisConnectivity(): string {
    try {
      const output = execSync('docker exec linkedin-redis-1 redis-cli ping', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      return output.trim() === 'PONG' ? 'Connected (Active)' : 'Disconnected';
    } catch {
      return 'Disconnected/Unavailable';
    }
  }
}

const dumper = new SysInfoDumper();
dumper.run();
