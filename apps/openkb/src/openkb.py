import os
import json
import re
import urllib.request
import urllib.error
import subprocess
from pathlib import Path

# 환경에 따른 경로 및 Ollama 호스트 동적 감지
if Path("/data").exists():
    PROJECT_ROOT = Path("/data")
    OLLAMA_HOST = "host.docker.internal"
else:
    PROJECT_ROOT = Path("/Users/ejpark/workspace/scraper/data")
    OLLAMA_HOST = "127.0.0.1"

DUMP_DIR = (PROJECT_ROOT / "agents").resolve()
JOPLIN_DIR = (PROJECT_ROOT / "joplin").resolve()
OPENKB_DIR = (PROJECT_ROOT / "openkb").resolve()
RAW_STORE = OPENKB_DIR / "raw"
CACHE_PATH = OPENKB_DIR / ".openkb_cache.json"

OLLAMA_ENDPOINT = f"http://{OLLAMA_HOST}:11434/api/generate"
OLLAMA_TAGS_ENDPOINT = f"http://{OLLAMA_HOST}:11434/api/tags"

# Ensure runtime working directory is set to openkb base directory for sqlite/settings lookup
import os
if OPENKB_DIR.exists():
    os.chdir(OPENKB_DIR)

class OpenKbCache:
    def __init__(self, cache_path: Path):
        self.cache_path = cache_path
        self.cache_data = {}
        self.load()

    def load(self):
        if self.cache_path.exists():
            try:
                with open(self.cache_path, "r", encoding="utf-8") as f:
                    self.cache_data = json.load(f)
            except Exception:
                self.cache_data = {}

    def is_up_to_date(self, file_path: str, mtime_ms: float) -> bool:
        return self.cache_data.get(file_path) == mtime_ms

    def update(self, file_path: str, mtime_ms: float):
        self.cache_data[file_path] = mtime_ms
        try:
            with open(self.cache_path, "w", encoding="utf-8") as f:
                json.dump(self.cache_data, f, indent=2)
        except Exception:
            pass

class OllamaClient:
    @staticmethod
    def get_available_model() -> str:
        try:
            req = urllib.request.Request(OLLAMA_TAGS_ENDPOINT)
            with urllib.request.urlopen(req, timeout=3) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    models = [m["name"] for m in data.get("models", [])]
                    # 경량 모델 우선순위 배치
                    preferred = ['gemma4:e4b', 'gemma4:26b']
                    for model in preferred:
                        if model in models:
                            return model
                    if models:
                        return models[0]
        except Exception:
            pass
        return 'gemma4:e4b'

    @staticmethod
    def summarize(agent_res: str, model: str) -> str:
        try:
            prompt = (
                "Below is the list of key response summaries and conclusions from an agent during a session.\n"
                "Please generate a very brief Korean summary (under 45 characters, using Korean, English, numbers, spaces, and underscores)\n"
                "representing the core resolution or actions taken during this session.\n"
                "Output ONLY the summary text, with no extra explanation, quotes, or markdown.\n\n"
                f"Agent Response:\n{agent_res[:1500]}"
            )
            
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": False
            }
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                OLLAMA_ENDPOINT,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=180) as response:
                if response.status == 200:
                    res_data = json.loads(response.read().decode("utf-8"))
                    raw_summary = res_data.get("response", "").strip()
                    # 공백(\s)을 제거하거나 대체하지 않고 그대로 보존하도록 정규식 변경
                    clean = re.sub(r"[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s_]", "", raw_summary)
                    clean = re.sub(r"\s+", " ", clean).strip()[:50]
                    return clean
        except Exception as e:
            print(f"⚠️ Ollama 요약 생성 실패: {str(e)}")
        return ""

def extract_title(content: str, date_folder: str, model: str) -> str:
    date_part = date_folder.split("T")[0]

    # frontmatter 기반 메타데이터가 있으면 우선 사용
    frontmatter_title = re.search(r"^title:\s*(.+)$", content, re.MULTILINE)
    frontmatter_model = re.search(r"^model:\s*(.+)$", content, re.MULTILINE)
    if frontmatter_title:
        title_value = frontmatter_title.group(1).strip()
        if title_value:
            return f"{date_part}_{re.sub(r'[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s]', '', title_value)[:40]}.md"
    if frontmatter_model:
        model_value = frontmatter_model.group(1).strip()
        if model_value:
            model = model_value

    # 세션 전체에서 이슈 번호 감지 시도 (가장 먼저 나오는 것을 대표로 설정)
    issue_match = re.search(r"(?:#|이슈\s*|버그\s*|feature/)([0-9]{3})", content, re.IGNORECASE)
    
    # 모든 에이전트 단계의 설명 문장(자연어 보고내용) 추출 및 노이즈 제거
    agent_blocks = re.findall(
        r"(?:### \[Step \d+\] 🤖 Agent|## 🤖 Agent Answer)([\s\S]*?)(?=### \[Step \d+\]|# 📌 Turn \d+|$)", 
        content
    )
    agent_summaries = []
    for block in agent_blocks:
        # Tool Call, Result 등의 아티팩트 구역 제거
        cleaned = re.sub(r">\s*\*\*🛠️ Tool Call\*\*[\s\S]*?(?=> \*\*Result\*\*|$)", "", block)
        cleaned = re.sub(r">\s*\*\*Result\*\*[\s\S]*?(?=\n\n|$)", "", cleaned)
        cleaned = cleaned.strip()
        if cleaned:
            # 툴 호출이나 실행 로그를 제거한 후 남은 문장 중에서
            # 각 턴의 '마지막 1~2문장'(결론/Verdicts)만 추출
            lines = [l.strip() for l in cleaned.split("\n") if l.strip() and not l.strip().startswith(">")]
            if lines:
                # 마지막에 위치한 핵심 결과 문장(최대 3라인)만 추출하여 턴별 결론으로 설정
                verdict_lines = lines[-3:]
                agent_summaries.append(" ".join(verdict_lines))
            
    agent_response_combined = "\n".join(agent_summaries).strip()
    
    # 요약용 입력을 위해 빈 텍스트 대체
    if not agent_response_combined:
        # Fallback: 만약 포맷이 완전히 다르면 사용자 요청과 에이전트 답변 본문에서 앞부분이라도 추출
        agent_response_combined = content[:2000]

    # Ollama 요약 활용
    summary = OllamaClient.summarize(agent_response_combined, model)
    if summary:
        if issue_match:
            issue_no = f"#{issue_match.group(1)}"
            if issue_no not in summary:
                return f"{date_part}_{issue_no}_{summary}.md"
        return f"{date_part}_{summary}.md"
    
    # Ollama 요약 실패 시 Fallback 로직
    first_request_match = re.search(r"<USER_REQUEST>([\s\S]*?)</USER_REQUEST>", content)
    first_request_text = first_request_match.group(1).strip() if first_request_match else ""
    if not first_request_text:
        first_request_text = content[:500]

    if issue_match:
        issue_no = f"_#{issue_match.group(1)}"
        first_line = first_request_text.split("\n")[0] if first_request_text else "issue_task"
        first_line = re.sub(r"[#*`~\[\]\(\)<>\-_]", " ", first_line)
        first_line = re.sub(r"https?://[^\s]+", "", first_line).strip()
        clean_title = re.sub(r"[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s]", "", first_line)
        clean_title = re.sub(r"\s+", " ", clean_title).strip()[:40]
        if not clean_title:
            clean_title = "issue_task"
        return f"{date_part}{issue_no}_{clean_title}.md"
    
    if first_request_text:
        first_line = first_request_text.split("\n")[0]
        first_line = re.sub(r"[#*`~\[\]\(\)<>\-_]", " ", first_line).strip()
        clean_title = re.sub(r"[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s]", "", first_line)
        clean_title = re.sub(r"\s+", " ", clean_title).strip()[:40]
        if clean_title:
            return f"{date_part}_{clean_title}.md"
            
    return f"{date_part}_agent_session.md"

def normalize_agent_content(content: str) -> str:
    cleaned = re.sub(r"^\[tool-event\]\s*$", "", content, flags=re.MULTILINE)
    cleaned = re.sub(r"^\[(TRACE|DEBUG|INFO|WARN|ERROR)\]\s+[^\n]+\n", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()

def find_transcripts(directory: Path, filename: str) -> list[Path]:
    results = []
    if not directory.exists():
        return results
    for root, _, files in os.walk(directory):
        for f in files:
            if f == filename:
                results.append(Path(root) / f)
    return results

def find_joplin_files(directory: Path) -> list[Path]:
    results = []
    if not directory.exists():
        return results
    for root, _, files in os.walk(directory):
        for f in files:
            if f.endswith(".md") and not f.startswith("."):
                # .tmp_export 등의 임시 디렉토리는 제외
                if ".tmp_export" in root:
                    continue
                results.append(Path(root) / f)
    return results

def check_ollama_health(model: str) -> bool:
    print(f"🩺 Checking Ollama connection health (target model: {model})...")
    print(f"🔗 Ollama API Endpoint: {OLLAMA_ENDPOINT}")
    try:
        req = urllib.request.Request(OLLAMA_TAGS_ENDPOINT)
        with urllib.request.urlopen(req, timeout=3) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                models = [m["name"] for m in data.get("models", [])]
                if model not in models and not any(model in m for m in models):
                    print(f"   ⚠️ Warning: target model '{model}' not found in active Ollama models.")

        # ⚡ "hello" 더미 추론 테스트 (Pre-warming & 실제 추론 작동 여부 검증)
        print("⚡ Testing LLM inference with dummy request 'hello' (Pre-warming model)...")
        test_summary = OllamaClient.summarize("hello", model)
        if test_summary:
            print("   ✅ Ollama connection & inference health check passed.")
            return True
        else:
            print("   ❌ Ollama inference failed to return a response.")
            return False
    except Exception as e:
        print(f"   ❌ Ollama connection health check failed: {str(e)}")
        print("   Please make sure Ollama is running and accessible at the current host address.")
        return False
    return False

def main():
    print("🤖 Starting OpenKB Compiling Pipeline (Containerized Python Version)...")
    RAW_STORE.mkdir(parents=True, exist_ok=True)

    model = os.getenv("OLLAMA_MODEL") or OllamaClient.get_available_model()
    
    if not check_ollama_health(model):
        print("❌ Pipeline aborted due to Ollama connection failure.")
        exit(1)

    print(f"🧠 Using Ollama Model for semantic summarization: [{model}]")

    # RAW 환경변수를 통한 컴파일 대상 지정 (기본값은 둘 다 컴파일)
    raw_env = os.getenv("RAW", "data/agents,data/joplin")
    targets = [t.strip() for t in raw_env.split(",") if t.strip()]
    
    # 디렉토리 이름 매핑
    compile_agents = any("agents" in t for t in targets)
    compile_joplin = any("joplin" in t for t in targets)

    cache = OpenKbCache(CACHE_PATH)
    processed_count = 0
    skipped_count = 0

    if compile_agents:
        transcripts = find_transcripts(DUMP_DIR, "transcript.md")
        print(f"📁 Processing and splitting raw dump session transcripts (Found {len(transcripts)} files)...")
        for i, file_path in enumerate(transcripts):
            mtime = file_path.stat().st_mtime
            percent = int(((i + 1) / len(transcripts)) * 100)
    
            if cache.is_up_to_date(str(file_path), mtime):
                skipped_count += 1
                if (i + 1) % 10 == 0 or i == len(transcripts) - 1:
                    print(f"   [{i + 1}/{len(transcripts)}] ({percent}%) Skipping cached transcripts...")
                continue
    
            relative_path = file_path.relative_to(DUMP_DIR)
            print(f"   [{i + 1}/{len(transcripts)}] ({percent}%) Analyzing: {relative_path}")
    
            try:
                date_folder = file_path.parent.parent.name
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                content = normalize_agent_content(content)
                    
                title = extract_title(content, date_folder, model)
                dest_path = RAW_STORE / title
                with open(dest_path, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"      + Saved: {title}")
    
                cache.update(str(file_path), mtime)
                processed_count += 1
            except Exception as e:
                print(f"❌ 파일 처리 중 오류 발생 [{file_path}]: {str(e)}")
    else:
        print("⏭️ Skipping transcripts compiling (data/agents not in RAW).")

    # 📥 Joplin 데이터 연동 프로세스
    joplin_processed = 0
    joplin_skipped = 0

    if compile_joplin:
        joplin_files = find_joplin_files(JOPLIN_DIR)
        print(f"📁 Processing Joplin notes (Found {len(joplin_files)} files)...")
        
        for i, file_path in enumerate(joplin_files):
            mtime = file_path.stat().st_mtime
            percent = int(((i + 1) / len(joplin_files)) * 100)
    
            if cache.is_up_to_date(str(file_path), mtime):
                joplin_skipped += 1
                continue
    
            try:
                # 노트북 폴더명 추출
                notebook_name = file_path.parent.name
                filename = file_path.name
                
                # OpenKB 컴파일용으로 raw 스토어에 복사 및 Joplin 식별 태그 추가
                dest_filename = f"Joplin_{notebook_name}_{filename}"
                dest_path = RAW_STORE / dest_filename
                
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    
                # Frontmatter가 없는 경우 식별용 헤더 추가
                header = f"---\nsource: Joplin\nnotebook: {notebook_name}\n---\n\n"
                if not content.startswith("---"):
                    content = header + content
                    
                with open(dest_path, "w", encoding="utf-8") as f:
                    f.write(content)
                    
                print(f"      + Processed Joplin Note: {dest_filename}")
                cache.update(str(file_path), mtime)
                joplin_processed += 1
            except Exception as e:
                print(f"❌ Joplin 파일 처리 중 오류 발생 [{file_path}]: {str(e)}")
    else:
        print("⏭️ Skipping Joplin notes compiling (data/joplin not in RAW).")

    print(f"✨ Transcripts - Processed: {processed_count}, Skipped: {skipped_count}")
    print(f"✨ Joplin Notes - Processed: {joplin_processed}, Skipped: {joplin_skipped}")

    print("🧠 Compiling knowledge via OpenKB (PageIndex)...")
    raw_contents = os.listdir(RAW_STORE) if RAW_STORE.exists() else []
    if raw_contents:
        try:
            subprocess.run(["openkb", "add", str(RAW_STORE)], check=True)
            print("✅ OpenKB Compile execution complete.")
        except subprocess.CalledProcessError as e:
            print(f"❌ [OpenKB] 컴파일 명령어 실행 실패: {str(e)}")
            exit(1)
    else:
        print("   No raw logs found to compound.")

if __name__ == "__main__":
    main()
