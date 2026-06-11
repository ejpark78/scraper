import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AgentSession {
  id: string;
  title: string;
  agent: string | null;
  model: string | null;
  timeCreated: number;
  timeUpdated: number;
  tokensInput: number;
  tokensOutput: number;
  tokensReasoning: number;
  cost: number;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls: AgentToolCall[];
  stepIndex: number;
}

export interface AgentToolCall {
  name: string;
  arguments: Record<string, any>;
  result?: string;
}

export interface SessionDetail {
  session: AgentSession;
  messages: AgentMessage[];
}

export interface AgentAdapter {
  getName(): string;
  getSessions(all: boolean): AgentSession[];
  getSessionDetail(sessionId: string): SessionDetail;
}

// ─── agy adapter ──────────────────────────────────────────

class AgyAdapter implements AgentAdapter {
  private readonly baseBrainDir: string;

  constructor() {
    this.baseBrainDir = path.join(os.homedir(), '.gemini/antigravity-cli/brain');
  }

  getName(): string { return 'agy'; }

  getSessions(all: boolean): AgentSession[] {
    if (!fs.existsSync(this.baseBrainDir)) {
      throw new Error(`agy brain directory not found: ${this.baseBrainDir}`);
    }

    const dirs = fs.readdirSync(this.baseBrainDir)
      .map(name => ({
        name,
        fullPath: path.join(this.baseBrainDir, name),
        mtime: fs.statSync(path.join(this.baseBrainDir, name)).mtimeMs,
      }))
      .filter(item => {
        try { return fs.statSync(item.fullPath).isDirectory() && item.name !== 'scratch' && item.name !== '.system_generated'; }
        catch { return false; }
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (dirs.length === 0) throw new Error('No agy sessions found.');

    const selected = all ? dirs : [dirs[0]];
    return selected.map(d => ({
      id: d.name,
      title: d.name,
      agent: 'agy',
      model: null,
      timeCreated: d.mtime,
      timeUpdated: d.mtime,
      tokensInput: 0,
      tokensOutput: 0,
      tokensReasoning: 0,
      cost: 0,
    }));
  }

  getSessionDetail(sessionId: string): SessionDetail {
    const logPath = path.join(this.baseBrainDir, sessionId, '.system_generated/logs/transcript_full.jsonl');

    if (!fs.existsSync(logPath)) {
      throw new Error(`Transcript log not found for session ${sessionId}: ${logPath}`);
    }

    const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
    const messages: AgentMessage[] = [];
    let stepIndex = 0;
    let lastAssistantMsg: AgentMessage | null = null;

    lines.forEach((line) => {
      try {
        const step = JSON.parse(line);
        if (step.type === 'USER_INPUT') {
          messages.push({ role: 'user', content: step.content || '', toolCalls: [], stepIndex: stepIndex++ });
          lastAssistantMsg = null;
        } else if (step.type === 'PLANNER_RESPONSE') {
          const toolCalls: AgentToolCall[] = (step.tool_calls || []).map((t: any) => ({
            name: t.name || t.tool || 'unknown',
            arguments: t.arguments || t.input || {},
          }));
          const newMsg: AgentMessage = { role: 'assistant', content: step.content || '', toolCalls, stepIndex: stepIndex++ };
          messages.push(newMsg);
          lastAssistantMsg = newMsg;
        } else {
          if (lastAssistantMsg && lastAssistantMsg.toolCalls.length > 0) {
            const pendingTool = lastAssistantMsg.toolCalls.find(tc => tc.result === undefined);
            if (pendingTool) {
              pendingTool.result = step.content || '';
            }
          }
        }
      } catch { /* skip malformed lines */ }
    });

    const session: AgentSession = {
      id: sessionId,
      title: sessionId,
      agent: 'agy',
      model: null,
      timeCreated: Date.now(),
      timeUpdated: Date.now(),
      tokensInput: 0,
      tokensOutput: 0,
      tokensReasoning: 0,
      cost: 0,
    };

    return { session, messages };
  }
}

// ─── opencode adapter ──────────────────────────────────────

class OpencodeAdapter implements AgentAdapter {
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(os.homedir(), '.local/share/opencode/opencode.db');
  }

  getName(): string { return 'opencode'; }

  private getDb(): any {
    const { DatabaseSync } = require('node:sqlite') as any;
    return new DatabaseSync(this.dbPath);
  }

  getSessions(all: boolean): AgentSession[] {
    if (!fs.existsSync(this.dbPath)) {
      throw new Error(`opencode DB not found: ${this.dbPath}`);
    }

    const db = this.getDb();
    const rows = db.prepare(
      `SELECT id, title, time_created, time_updated, agent, model,
              tokens_input, tokens_output, tokens_reasoning, cost
       FROM session
       ORDER BY time_updated DESC`
    ).all();

    db.close();

    const sessions: AgentSession[] = rows.map((r: any) => ({
      id: r.id,
      title: r.title || r.id,
      agent: r.agent,
      model: r.model ? (() => { try { return JSON.parse(r.model).id; } catch { return r.model; } })() : null,
      timeCreated: r.time_created,
      timeUpdated: r.time_updated,
      tokensInput: r.tokens_input || 0,
      tokensOutput: r.tokens_output || 0,
      tokensReasoning: r.tokens_reasoning || 0,
      cost: r.cost || 0,
    }));

    return all ? sessions : sessions.slice(0, 1);
  }

  getSessionDetail(sessionId: string): SessionDetail {
    const db = this.getDb();

    // Session info
    const sessionRow = db.prepare(
      `SELECT id, title, time_created, time_updated, agent, model,
              tokens_input, tokens_output, tokens_reasoning, cost
       FROM session WHERE id = ?`
    ).get(sessionId);

    if (!sessionRow) {
      db.close();
      throw new Error(`Session not found: ${sessionId}`);
    }

    const modelStr = sessionRow.model;
    const session: AgentSession = {
      id: sessionRow.id,
      title: sessionRow.title || sessionRow.id,
      agent: sessionRow.agent,
      model: modelStr ? (() => { try { return JSON.parse(modelStr).id; } catch { return modelStr; } })() : null,
      timeCreated: sessionRow.time_created,
      timeUpdated: sessionRow.time_updated,
      tokensInput: sessionRow.tokens_input || 0,
      tokensOutput: sessionRow.tokens_output || 0,
      tokensReasoning: sessionRow.tokens_reasoning || 0,
      cost: sessionRow.cost || 0,
    };

    // Messages
    const msgRows = db.prepare(
      `SELECT id, data, time_created FROM message WHERE session_id = ? ORDER BY time_created ASC`
    ).all(sessionId);

    const messages: AgentMessage[] = [];
    let stepIndex = 0;

    msgRows.forEach((msgRow: any) => {
      const msgData = JSON.parse(msgRow.data || '{}');
      const role = msgData.role;

      if (role === 'user') {
        // Get the user prompt from message content or parts
        const parts = db.prepare(
          `SELECT data FROM part WHERE session_id = ? AND message_id = ? ORDER BY time_created ASC`
        ).all(sessionId, msgRow.id);

        const texts = parts.map((p: any) => { try { const pd = JSON.parse(p.data); return pd.text || ''; } catch { return ''; } }).filter(Boolean);
        messages.push({ role: 'user', content: texts.join('\n') || msgData.content || '', toolCalls: [], stepIndex: stepIndex++ });
      }

      if (role === 'assistant') {
        const parts = db.prepare(
          `SELECT data FROM part WHERE session_id = ? AND message_id = ? ORDER BY time_created ASC`
        ).all(sessionId, msgRow.id);

        const toolCalls: AgentToolCall[] = [];
        let contentParts: string[] = [];

        parts.forEach((p: any) => {
          try {
            const pd = JSON.parse(p.data);
            if (pd.type === 'reasoning' || pd.type === 'text') {
              if (pd.text) contentParts.push(pd.text);
            }
            if (pd.type === 'tool') {
              const toolName = pd.tool || 'unknown';
              const input = pd.state?.input || {};
              const output = pd.state?.output || '';
              toolCalls.push({ name: toolName, arguments: input, result: output });
            }
          } catch { /* skip */ }
        });

        messages.push({ role: 'assistant', content: contentParts.join('\n'), toolCalls, stepIndex: stepIndex++ });
      }
    });

    db.close();
    return { session, messages };
  }
}

// ─── Factory ────────────────────────────────────────────────

export function createAdapter(agentName: string): AgentAdapter {
  switch (agentName) {
    case 'agy':
      return new AgyAdapter();
    case 'opencode':
      return new OpencodeAdapter();
    default:
      throw new Error(`Unknown agent: ${agentName}. Supported: agy, opencode`);
  }
}

export function parseAgentsFromArg(raw: string): string[] {
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

// ─── Output path helpers ────────────────────────────────────

export function formatTimestampDir(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function assignSessionNumbers(sessions: AgentSession[]): Map<string, { dateDir: string; seqNum: string; tag: string }> {
  // Group by second-level timestamp
  const groups = new Map<string, AgentSession[]>();
  for (const s of sessions) {
    const dir = formatTimestampDir(s.timeCreated);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir)!.push(s);
  }

  const result = new Map<string, { dateDir: string; seqNum: string; tag: string }>();
  for (const [dateDir, group] of groups) {
    // Sort by timeCreated (ms) ascending for stable numbering
    group.sort((a, b) => a.timeCreated - b.timeCreated);
    group.forEach((s, i) => {
      const seqNum = String(i + 1).padStart(4, '0');
      result.set(s.id, { dateDir, seqNum, tag: `${seqNum}-${s.id}` });
    });
  }

  return result;
}
