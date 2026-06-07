import https from 'https';
import http, { ClientRequest } from 'http';

interface McpToolCallPayload {
  jsonrpc: string;
  id: number;
  method: string;
  params: {
    name: string;
    arguments?: Record<string, any>;
  };
}

interface McpServerContent {
  type: string;
  text: string;
}

interface McpServerResult {
  content: McpServerContent[];
}

interface McpServerResponse {
  jsonrpc: string;
  id: number;
  result?: McpServerResult;
  error?: any;
}

class McpSseClient {
  private sseUrl: string;
  private urlObj: URL;
  private agent: https.Agent;
  private req: ClientRequest | null = null;
  private pendingResolve: ((value: any) => void) | null = null;
  private pendingReject: ((reason?: any) => void) | null = null;

  constructor(sseUrl: string) {
    this.sseUrl = sseUrl;
    this.urlObj = new URL(sseUrl);
    
    // 자가 서명 인증서 검증 무시용 Agent 적용 (mcp.localhost SSL 우회용)
    this.agent = new https.Agent({
      rejectUnauthorized: false
    });
  }

  /**
   * MCP SSE 서버에 GET 요청을 보내 연결을 맺고,
   * 메시지 송신용 엔드포인트 경로(path)를 반환합니다.
   */
  connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log(`🔌 Connecting to MCP Server: ${this.sseUrl}...`);

      this.req = https.request({
        hostname: this.urlObj.hostname,
        port: this.urlObj.port ? Number(this.urlObj.port) : 443,
        path: this.urlObj.pathname + this.urlObj.search,
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream'
        },
        agent: this.agent
      }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Connection failed with status code: ${res.statusCode}`));
          return;
        }

        let messageEndpointPath = '';

        res.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (!messageEndpointPath) {
                messageEndpointPath = data;
                console.log(`✅ Message Endpoint resolved: ${messageEndpointPath}`);
                resolve(messageEndpointPath);
              } else {
                this._handleSseMessage(data);
              }
            }
          }
        });
      });

      this.req.on('error', (err: any) => {
        reject(err);
      });

      this.req.end();
    });
  }

  /**
   * 지정된 엔드포인트로 JSON-RPC 도구 호출(tools/call)을 POST로 전송하고,
   * SSE 스트림을 통해 응답이 올 때까지 대기하여 결과를 반환합니다.
   */
  callTool(endpointPath: string, toolName: string, args?: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      const payload: McpToolCallPayload = {
        jsonrpc: '2.0',
        id: 42,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      const payloadString = JSON.stringify(payload);
      console.log(`\n📤 Sending tools/call JSON-RPC payload to path: ${endpointPath}...`);

      const postReq = https.request({
        hostname: this.urlObj.hostname,
        port: this.urlObj.port ? Number(this.urlObj.port) : 443,
        path: endpointPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payloadString)
        },
        agent: this.agent
      }, (res) => {
        let responseBody = '';
        res.on('data', (chunk: Buffer) => {
          responseBody += chunk.toString();
        });
        
        res.on('end', () => {
          if (res.statusCode !== 200 && res.statusCode !== 202) {
            reject(new Error(`Failed to send tool call POST request: HTTP ${res.statusCode} - ${responseBody}`));
          } else {
            console.log(`✅ POST request sent successfully. Awaiting response from active SSE stream...`);
          }
        });
      });

      postReq.on('error', (err: any) => {
        reject(err);
      });

      postReq.write(payloadString);
      postReq.end();
    });
  }

  /**
   * SSE 데이터 이벤트를 내부적으로 파싱하여 보낸 요청 ID와 매칭되면 Promise를 해결합니다.
   */
  private _handleSseMessage(data: string): void {
    try {
      const parsed = JSON.parse(data) as McpServerResponse;
      if (parsed.id === 42 && this.pendingResolve) {
        this.pendingResolve(parsed.result);
      }
    } catch (e) {
      // 하트비트 신호 등 비JSON 포맷은 조용히 무시
    }
  }

  /**
   * 연결 및 리소스 파괴
   */
  close(): void {
    if (this.req) {
      this.req.destroy();
      console.log('🔌 Connection closed.');
    }
  }
}

// 스크립트 직접 실행 시 메인 루틴
async function main() {
  const client = new McpSseClient('https://mcp.localhost/sse');
  
  try {
    const endpointPath = await client.connect();
    
    const result = await client.callTool(endpointPath, 'search_documents', {
      collection: 'silver/linkedin.jobs',
      query: 'MLOps',
      limit: 3
    });

    console.log('\n📥 [MCP Server Response] Received successfully!');
    console.log('--------------------------------------------------');
    console.log(result.content[0].text);
    console.log('--------------------------------------------------');

  } catch (error: any) {
    console.error('❌ MCP Client Error:', error.message);
  } finally {
    client.close();
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}
