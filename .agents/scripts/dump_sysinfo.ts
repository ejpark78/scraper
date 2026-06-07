import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

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
    } catch (err: any) {
      console.error('❌ Error dumping sysinfo:', err.message);
      process.exit(1);
    }
  }

  private getGitStatus(): string {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
      const status = execSync('git status -s', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
      return `Branch: ${branch}${status ? ' | Changes: ' + status.replace(/\n/g, ', ') : ' | Clean'}`;
    } catch (e) {
      return 'Not a git repo or command failed';
    }
  }

  private getDockerStatus(): string {
    try {
      const output = execSync('docker compose -p linkedin ps --format json', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      const services = JSON.parse(`[${output.trim().split('\n').join(',')}]`);
      return services.map((s: any) => `${s.Service}:${s.State}`).join(', ');
    } catch (e) {
      return 'Docker down or command failed';
    }
  }

  private getMongoConnectivity(): string {
    try {
      const output = execSync('docker exec linkedin-mongodb-1 mongosh --eval "db.adminCommand({ping: 1})" --quiet', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      return output.includes('ok: 1') ? 'Connected (Active)' : 'Disconnected';
    } catch (e) {
      return 'Disconnected/Unavailable';
    }
  }

  private getRedisConnectivity(): string {
    try {
      const output = execSync('docker exec linkedin-redis-1 redis-cli ping', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      return output.trim() === 'PONG' ? 'Connected (Active)' : 'Disconnected';
    } catch (e) {
      return 'Disconnected/Unavailable';
    }
  }
}

const dumper = new SysInfoDumper();
dumper.run();
