/**
 * @module agent_adapter
 * @description Provides unified adapters to fetch and query session information from agy, codex, and opencode sessions.
 * @constraints
 *   - Strictly typed, avoiding 'any' except where library-specific types are undefined.
 *   - Dynamically resolves log paths and queries SQLite databases.
 * @dependencies Node fs/path/os/sqlite, IConverter
 * @lastUpdated 2026-06-11
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

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
  arguments: Record<string, unknown>;
  result?: string;
}

export interface SessionDetail {
  session: AgentSession;
  messages: AgentMessage[];
  taskLogs?: { id: string; localPath: string }[];
  sessionDir?: string;
}

export interface AgentAdapter {
  getName(): string;
  getSessions(all: boolean): AgentSession[];
  getSessionDetail(sessionId: string): SessionDetail;
  baseBrainDir?: string;
}

interface LogToolCall {
  name?: string;
  tool?: string;
  args?: Record<string, unknown>;
  arguments?: Record<string, unknown>;
  input?: Record<string, unknown>;
  result?: string;
  output?: string;
}

interface LogStep {
  type: string;
  source?: string;
  content?: string;
  tool_calls?: LogToolCall[];
}

interface CodexLogRow {
  id: number;
  ts: number;
  ts_nanos: number;
  level: string;
  target: string;
  feedback_log_body: string | null;
  thread_id: string | null;
}

interface CodexSessionRow {
  id: string;
  first_ts: number;
  last_ts: number;
}

interface CodexHandlerRow {
  ts: number;
  ts_nanos: number;
  target: string;
  feedback_log_body: string | null;
}

interface CodexHistoryRow {
  body: string;
}

// ─── agy adapter ──────────────────────────────────────────

class AgyAdapter implements AgentAdapter {
  public readonly baseBrainDir: string;

  constructor() {
    this.baseBrainDir = path.join(os.homedir(), '.gemini/antigravity-cli/brain');
  }

  getName(): string { return 'agy'; }

  getSessions(all: boolean): AgentSession[] {
    const cliBrainDir = path.join(os.homedir(), '.gemini/antigravity-cli/brain');
    const ideBrainDir = path.join(os.homedir(), '.gemini/antigravity-ide/brain');
    const dirs: { name: string; fullPath: string; mtime: number }[] = [];

    [cliBrainDir, ideBrainDir].forEach(baseDir => {
      if (fs.existsSync(baseDir)) {
        try {
          fs.readdirSync(baseDir).forEach(name => {
            const fullPath = path.join(baseDir, name);
            try {
              if (fs.statSync(fullPath).isDirectory() && name !== 'scratch' && name !== '.system_generated') {
                dirs.push({
                  name,
                  fullPath,
                  mtime: fs.statSync(fullPath).mtimeMs,
                });
              }
            } catch { /* skip */ }
          });
        } catch { /* skip */ }
      }
    });

    if (dirs.length === 0) throw new Error('No agy sessions found in cli or ide brain directories.');

    dirs.sort((a, b) => b.mtime - a.mtime);

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
    const cliBrainDir = path.join(os.homedir(), '.gemini/antigravity-cli/brain');
    const ideBrainDir = path.join(os.homedir(), '.gemini/antigravity-ide/brain');
    let logPath = '';
    let foundBaseDir = '';

    for (const baseDir of [cliBrainDir, ideBrainDir]) {
      for (const logName of ['transcript_full.jsonl', 'transcript.jsonl']) {
        const p = path.join(baseDir, sessionId, '.system_generated/logs', logName);
        if (fs.existsSync(p)) {
          logPath = p;
          foundBaseDir = baseDir;
          break;
        }
      }
      if (logPath) break;
    }

    if (!logPath) {
      throw new Error(`Transcript log not found for session ${sessionId} in cli or ide directories.`);
    }

    const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
    const messages: AgentMessage[] = [];
    let stepIndex = 0;
    let lastAssistantMsg: AgentMessage | null = null;

    lines.forEach((line) => {
      try {
        const step = JSON.parse(line) as LogStep;
        if (step.type === 'USER_INPUT') {
          messages.push({ role: 'user', content: step.content || '', toolCalls: [], stepIndex: stepIndex++ });
          lastAssistantMsg = null;
        } else if (step.type === 'PLANNER_RESPONSE') {
          const toolCalls: AgentToolCall[] = (step.tool_calls || []).map((t: LogToolCall) => ({
            name: t.name || t.tool || 'unknown',
            arguments: t.args || t.arguments || t.input || {},
          }));
          const newMsg: AgentMessage = { role: 'assistant', content: step.content || '', toolCalls, stepIndex: stepIndex++ };
          messages.push(newMsg);
          lastAssistantMsg = newMsg;
        } else if (step.type === 'SYSTEM_MESSAGE' || step.source === 'SYSTEM') {
          const content = step.content || '';
          const taskMatch = content.match(/task-\d+/);
          if (taskMatch) {
            const taskId = taskMatch[0];
            const resultIdx = content.indexOf('finished with result:');
            if (resultIdx !== -1) {
              const logFile = path.join(foundBaseDir, sessionId, '.system_generated', 'tasks', `${taskId}.log`);
              let taskResult = '';
              if (fs.existsSync(logFile)) {
                taskResult = fs.readFileSync(logFile, 'utf-8');
              } else {
                taskResult = content.substring(resultIdx + 'finished with result:'.length).trim();
              }
              for (const msg of messages) {
                if (msg.role === 'assistant' && msg.toolCalls) {
                  const matchingTool = msg.toolCalls.find(tc => 
                    tc.name === 'run_command' && 
                    tc.result && 
                    tc.result.includes(taskId)
                  );
                  if (matchingTool) {
                    matchingTool.result = `[Background Task ${taskId} finished]\n${taskResult}`;
                  }
                }
              }
            }
          }
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

    return { session, messages, sessionDir: path.join(foundBaseDir, sessionId) };
  }
}

// ─── codex adapter ─────────────────────────────────────────

class CodexAdapter implements AgentAdapter {
  public readonly baseBrainDir: string;
  private readonly dbPath: string;

  constructor() {
    this.baseBrainDir = path.join(os.homedir(), '.codex');
    this.dbPath = path.join(this.baseBrainDir, 'logs_2.sqlite');
  }

  getName(): string { return 'codex'; }

  private getDb(): string {
    if (!fs.existsSync(this.dbPath)) {
      throw new Error(`Codex log DB not found: ${this.dbPath}`);
    }
    return this.dbPath;
  }

  private query<T>(sql: string): T[] {
    const dbPath = this.getDb();
    const safeSql = sql.replace(/"/g, '\\"');
    const cmd = `sqlite3 -json "${dbPath}" "${safeSql}"`;
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 20 * 1024 * 1024,
    }).trim();
    if (!output) return [];
    return JSON.parse(output) as T[];
  }

  getSessions(all: boolean): AgentSession[] {
    const rows = this.query<CodexSessionRow>(`
      SELECT
        thread_id as id,
        MIN(ts) as first_ts,
        MAX(ts) as last_ts,
        COUNT(*) as log_count
      FROM logs
      WHERE thread_id IS NOT NULL AND trim(thread_id) != ''
      GROUP BY thread_id
      ORDER BY last_ts DESC
    `);

    if (rows.length === 0) {
      throw new Error('No codex sessions found in logs_2.sqlite.');
    }

    const selected = all ? rows : rows.slice(0, 1);
    return selected.map((r) => ({
      id: r.id,
      title: `Codex Session ${r.id}`,
      agent: 'codex',
      model: null,
      timeCreated: Number(r.first_ts || 0) * 1000,
      timeUpdated: Number(r.last_ts || 0) * 1000,
      tokensInput: 0,
      tokensOutput: 0,
      tokensReasoning: 0,
      cost: 0,
    }));
  }

  getSessionDetail(sessionId: string): SessionDetail {
    const rows = this.query<CodexLogRow>(`
      SELECT id, ts, ts_nanos, level, target, feedback_log_body, thread_id
      FROM logs
      WHERE thread_id = '${sessionId.replace(/'/g, "''")}'
      ORDER BY ts ASC, ts_nanos ASC, id ASC
    `);
    const handlerRows = this.query<CodexHandlerRow>(`
      SELECT ts, ts_nanos, target, feedback_log_body
      FROM logs
      WHERE thread_id = '${sessionId.replace(/'/g, "''")}' AND target = 'codex_core::session::handlers'
      ORDER BY ts ASC, ts_nanos ASC, id ASC
    `);

    if (rows.length === 0) {
      throw new Error(`Codex session not found: ${sessionId}`);
    }

    const messages: AgentMessage[] = [];
    let stepIndex = 0;
    let firstUserText = '';
    let activeAssistant: AgentMessage | null = null;
    const seenUserTexts = new Set<string>();

    const userTextFrom = (body: string): string => {
      const match = body.match(/UserInput \{ items: \[Text \{ text: "([\s\S]*?)", text_elements: \[\] \}\]/);
      return match ? match[1] : body;
    };

    const opTypeFrom = (body: string): string | null => {
      const match = body.match(/op:\s*([A-Za-z0-9_]+)/);
      return match ? match[1] : null;
    };

    const execApprovalFrom = (body: string): { id: string; decision: string; turnId: string | null } | null => {
      const idMatch = body.match(/op: ExecApproval \{ id: "([^"]+)"/);
      const turnMatch = body.match(/turn_id: Some\("([^"]+)"\)/);
      const decisionMatch = body.match(/decision: ([A-Za-z]+)/);
      if (!idMatch || !decisionMatch) return null;
      return { id: idMatch[1], decision: decisionMatch[1], turnId: turnMatch ? turnMatch[1] : null };
    };

    for (const row of handlerRows) {
      const body = (row.feedback_log_body || '').trim();
      if (!body) continue;

      if (body.includes('op: UserInput')) {
        const text = userTextFrom(body);
        if (!firstUserText) {
          firstUserText = text;
        }
        seenUserTexts.add(text);
        messages.push({
          role: 'user',
          content: text,
          toolCalls: [],
          stepIndex: stepIndex++,
        });
        activeAssistant = null;
        continue;
      }

      if (body.includes('op: ExecApproval')) {
        const approval = execApprovalFrom(body);
        const toolCall: AgentToolCall = {
          name: 'ExecApproval',
          arguments: {
            approvalId: approval?.id || '',
            turnId: approval?.turnId || '',
            decision: approval?.decision || '',
          },
          result: body,
        };
        if (activeAssistant) {
          activeAssistant.toolCalls.push(toolCall);
        } else {
          const assistantMessage: AgentMessage = {
            role: 'assistant',
            content: body,
            toolCalls: [toolCall],
            stepIndex: stepIndex++,
          };
          messages.push(assistantMessage);
          activeAssistant = assistantMessage;
        }
        continue;
      }

      const opType = opTypeFrom(body);
      if (opType) {
        const toolCall: AgentToolCall = {
          name: opType,
          arguments: { target: row.target, ts: row.ts, tsNanos: row.ts_nanos },
          result: body,
        };
        const assistantMessage: AgentMessage = {
          role: 'assistant',
          content: body,
          toolCalls: [toolCall],
          stepIndex: stepIndex++,
        };
        messages.push(assistantMessage);
        activeAssistant = assistantMessage;
        continue;
      }

      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content: body,
        toolCalls: [],
        stepIndex: stepIndex++,
      };
      messages.push(assistantMessage);
      activeAssistant = assistantMessage;
    }

    const historyPath = path.join(os.homedir(), '.codex', 'history.jsonl');
    if (fs.existsSync(historyPath)) {
      const historyLines = fs.readFileSync(historyPath, 'utf-8').split('\n');
      for (const line of historyLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as { role?: string; content?: string; text?: string };
          if (parsed.role === 'user') {
            const text = parsed.content || parsed.text || '';
            if (text && !seenUserTexts.has(text)) {
              messages.unshift({
                role: 'user',
                content: text,
                toolCalls: [],
                stepIndex: 0,
              });
              seenUserTexts.add(text);
            }
          }
        } catch {
          // history.jsonl가 세션 메타 일부를 포함하지 않을 수 있어 무시
        }
      }
    }

    const session: AgentSession = {
      id: sessionId,
      title: firstUserText ? `Codex: ${firstUserText.slice(0, 40)}` : `Codex Session ${sessionId}`,
      agent: 'codex',
      model: this.resolveModel(),
      timeCreated: Number(rows[0].ts || 0) * 1000,
      timeUpdated: Number(rows[rows.length - 1].ts || 0) * 1000,
      tokensInput: 0,
      tokensOutput: 0,
      tokensReasoning: 0,
      cost: 0,
    };

    return { session, messages };
  }

  private resolveModel(): string {
    const configPath = path.join(this.baseBrainDir, 'config.toml');
    if (!fs.existsSync(configPath)) {
      return 'gpt-5.4-mini';
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const match = content.match(/^\s*model\s*=\s*"([^"]+)"/m);
    return match ? match[1] : 'gpt-5.4-mini';
  }
}

// ─── opencode adapter ──────────────────────────────────────

interface SQLiteSessionRow {
  id: string;
  title: string | null;
  time_created: number;
  time_updated: number;
  agent: string | null;
  model: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  tokens_reasoning: number | null;
  cost: number | null;
}

interface SQLiteMessageRow {
  id: string;
  data: string;
  time_created: number;
}

interface SQLitePartRow {
  data: string;
}

interface SQLiteDatabase {
  prepare(sql: string): {
    all(...args: unknown[]): unknown[];
    get(...args: unknown[]): unknown;
  };
  close(): void;
}

class OpencodeAdapter implements AgentAdapter {
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(os.homedir(), '.local/share/opencode/opencode.db');
  }

  getName(): string { return 'opencode'; }

  private getDb(): SQLiteDatabase {
    // DatabaseSync is imported dynamically because it is only available in node standard library in specific runtimes.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqlite = require('node:sqlite');
    return new sqlite.DatabaseSync(this.dbPath) as SQLiteDatabase;
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
    ).all() as SQLiteSessionRow[];

    db.close();

    const sessions: AgentSession[] = rows.map((r) => ({
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
    ).get(sessionId) as SQLiteSessionRow | undefined;

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
    ).all(sessionId) as SQLiteMessageRow[];

    const messages: AgentMessage[] = [];
    let stepIndex = 0;

    msgRows.forEach((msgRow) => {
      interface MessageData {
        role?: string;
        content?: string;
      }
      const msgData = JSON.parse(msgRow.data || '{}') as MessageData;
      const role = msgData.role;

      if (role === 'user') {
        const parts = db.prepare(
          `SELECT data FROM part WHERE session_id = ? AND message_id = ? ORDER BY time_created ASC`
        ).all(sessionId, msgRow.id) as SQLitePartRow[];

        const texts = parts.map((p) => {
          try {
            interface PartData {
              text?: string;
            }
            const pd = JSON.parse(p.data) as PartData;
            return pd.text || '';
          } catch { return ''; }
        }).filter(Boolean);
        messages.push({ role: 'user', content: texts.join('\n') || msgData.content || '', toolCalls: [], stepIndex: stepIndex++ });
      }

      if (role === 'assistant') {
        const parts = db.prepare(
          `SELECT data FROM part WHERE session_id = ? AND message_id = ? ORDER BY time_created ASC`
        ).all(sessionId, msgRow.id) as SQLitePartRow[];

        const toolCalls: AgentToolCall[] = [];
        const contentParts: string[] = [];

        parts.forEach((p) => {
          try {
            interface PartData {
              type?: string;
              text?: string;
              tool?: string;
              state?: {
                input?: Record<string, unknown>;
                output?: string;
              };
            }
            const pd = JSON.parse(p.data) as PartData;
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
    case 'codex':
      return new CodexAdapter();
    case 'opencode':
      return new OpencodeAdapter();
    default:
      throw new Error(`Unknown agent: ${agentName}. Supported: agy, codex, opencode`);
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
