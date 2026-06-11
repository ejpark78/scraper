/**
 * @module prune_session
 * @description Automatically audits and cleans up empty session directories from the agent local database directory.
 * @constraints
 *   - Must verify the existence of `transcript_full.jsonl` log file before deciding to delete.
 *   - Removes corresponding transcript markdown outputs if deleted from brain database.
 *   - Follows strict OOP patterns and JSDoc guidelines.
 * @dependencies Node fs/path/os
 * @lastUpdated 2026-06-11
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

class SessionPruner {
  private readonly baseBrainDir: string;
  private readonly transcriptsDir: string;

  constructor() {
    this.baseBrainDir = path.join(os.homedir(), '.gemini/antigravity-cli/brain');
    this.transcriptsDir = path.join(__dirname, '../transcripts');
  }

  public run(): void {
    console.log('🧹 Pruning empty brain sessions...');
    let removed = 0;

    if (!fs.existsSync(this.baseBrainDir)) {
      console.log('ℹ️  No brain directory found.');
      return;
    }

    const brainSessions = fs.readdirSync(this.baseBrainDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== 'scratch' && d.name !== '.system_generated')
      .map(d => d.name);

    for (const sessionId of brainSessions) {
      const brainDir = path.join(this.baseBrainDir, sessionId);
      const logsDir = path.join(brainDir, '.system_generated/logs');
      const transcriptPath = path.join(logsDir, 'transcript_full.jsonl');

      if (fs.existsSync(transcriptPath)) {
        console.log(`  ✅ Keep (has data): ${sessionId}`);
        continue;
      }

      this.removeDir(brainDir, `🧠 Empty session removed: ${sessionId}`);
      removed++;

      const transcriptDir = path.join(this.transcriptsDir, sessionId);
      const transcriptFile = path.join(this.transcriptsDir, `${sessionId}.md`);
      if (fs.existsSync(transcriptDir)) {
        fs.rmSync(transcriptDir, { recursive: true, force: true });
        console.log(`     📄 Also removed: transcripts/${sessionId}/`);
      }
      if (fs.existsSync(transcriptFile)) {
        fs.rmSync(transcriptFile, { force: true });
        console.log(`     📄 Also removed: transcripts/${sessionId}.md`);
      }
    }

    if (removed === 0) {
      console.log('✅ Nothing to prune.');
    } else {
      console.log(`✨ Pruned ${removed} empty session(s) from brain.`);
    }
  }

  private removeDir(dirPath: string, label: string): void {
    if (!fs.existsSync(dirPath)) return;
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`  🗑️  ${label}`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Failed to remove ${dirPath}: ${errMsg}`);
    }
  }
}

new SessionPruner().run();
