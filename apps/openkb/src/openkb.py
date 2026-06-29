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
    PROJECT_ROOT = Path("/Users/ejpark/workspace/scraper")
    OLLAMA_HOST = "127.0.0.1"

DUMP_DIR = (PROJECT_ROOT / "agents").resolve()
OPENKB_DIR = (PROJECT_ROOT / "openkb").resolve()
RAW_STORE = OPENKB_DIR / "raw"
CACHE_PATH = OPENKB_DIR / ".openkb_cache.json"

OLLAMA_ENDPOINT = f"http://{OLLAMA_HOST}:11434/api/generate"
OLLAMA_TAGS_ENDPOINT = f"http://{OLLAMA_HOST}:11434/api/tags"

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
    def summarize(user_req: str, agent_res: str, model: str) -> str:
        try:
            prompt = (
                "Below is the user's request and the agent's response in an agent workspace session.\n"
                "Please generate a very brief Korean summary (under 40 characters, using Korean, English, numbers, and underscores, no spaces)\n"
                "representing what was requested and how it was resolved (e.g. '이슈번호_작업요약' or '작업내용_조치결과').\n"
                "Output ONLY the summary text, with no extra explanation, quotes, or markdown.\n\n"
                f"User Request:\n{user_req[:800]}\n\n"
                f"Agent Response:\n{agent_res[:1000]}"
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
                    clean = re.sub(r"[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s_]", "", raw_summary)
                    clean = re.sub(r"\s+", "_", clean)[:50]
                    return clean
        except Exception as e:
            print(f"⚠️ Ollama 요약 생성 실패: {str(e)}")
        return ""

def extract_title(content: str, date_folder: str, model: str) -> str:
    date_part = date_folder.split("T")[0]
    
    # 세션 전체에서 이슈 번호 감지 시도 (가장 먼저 나오는 것을 대표로 설정)
    issue_match = re.search(r"(?:#|이슈\s*|버그\s*|feature/)([0-9]{3})", content, re.IGNORECASE)
    
    # 모든 USER_REQUEST 구역 추출 및 클렌징 (코드 블록, 연속된 영문 로그 라인 제거)
    user_requests = re.findall(r"<USER_REQUEST>([\s\S]*?)</USER_REQUEST>", content)
    cleaned_user_texts = []
    for req in user_requests:
        # 1. 백틱 코드 블록 제거
        req_clean = re.sub(r"```[\s\S]*?```", "", req)
        # 2. 영문 대문자/소문자, 숫자, 일부 특수문자만 포함된 긴 로그성 라인 제거 (공백 제외 한 줄이 주로 영문/숫자/기호인 경우)
        lines = req_clean.split("\n")
        filtered_lines = []
        for line in lines:
            trimmed = line.strip()
            # 만약 한 줄의 대다수(70% 이상)가 영문/숫자/특수기호이면서 30자 이상 길면 로그로 필터링
            if len(trimmed) > 30:
                english_char_count = len(re.findall(r"[a-zA-Z0-9_\-\.\/\\:\(\)\{\}\[\]\=\+\&\?\;\,\<\>\'\"]", trimmed))
                if (english_char_count / len(trimmed)) > 0.7:
                    continue
            filtered_lines.append(line)
        cleaned_user_texts.append("\n".join(filtered_lines).strip())
    
    user_request_combined = "\n".join([t for t in cleaned_user_texts if t]).strip()
    
    # 모든 에이전트 단계의 설명 문장(자연어 보고내용) 추출 및 노이즈 제거
    agent_blocks = re.findall(r"### \[Step \d+\] 🤖 Agent([\s\S]*?)(?=### \[Step \d+\]|$)", content)
    agent_summaries = []
    for block in agent_blocks:
        # Tool Call, Result 등의 아티팩트 구역 제거
        cleaned = re.sub(r">\s*\*\*🛠️ Tool Call\*\*[\s\S]*?(?=> \*\*Result\*\*|$)", "", block)
        cleaned = re.sub(r">\s*\*\*Result\*\*[\s\S]*?(?=\n\n|$)", "", cleaned)
        cleaned = cleaned.strip()
        if cleaned:
            # 줄바꿈 정리 및 너무 긴 영어 출력 등 필터링하여 자연어 텍스트만 취합
            lines = [l.strip() for l in cleaned.split("\n") if l.strip() and not l.strip().startswith(">")]
            agent_summaries.append(" ".join(lines))
            
    agent_response_combined = "\n".join(agent_summaries).strip()
    
    # 요약용 입력을 위해 빈 텍스트 대체
    if not user_request_combined:
        user_request_combined = content[:500]
    if not agent_response_combined:
        agent_response_combined = content[-500:]

    # Ollama 요약 활용
    summary = OllamaClient.summarize(user_request_combined, agent_response_combined, model)
    if summary:
        if issue_match:
            issue_no = f"#{issue_match.group(1)}"
            if issue_no not in summary:
                return f"{date_part}_{issue_no}_{summary}.md"
        return f"{date_part}_{summary}.md"
    
    # Ollama 요약 실패 시 Fallback 로직
    if issue_match:
        issue_no = f"_#{issue_match.group(1)}"
        first_line = user_request_combined.split("\n")[0] if user_request_combined else "issue_task"
        first_line = re.sub(r"[#*`~\[\]\(\)<>\-_]", " ", first_line)
        first_line = re.sub(r"https?://[^\s]+", "", first_line).strip()
        clean_title = re.sub(r"[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s]", "", first_line)
        clean_title = re.sub(r"\s+", "_", clean_title)[:40]
        if not clean_title:
            clean_title = "issue_task"
        return f"{date_part}{issue_no}_{clean_title}.md"
    
    if user_request_combined:
        first_line = user_request_combined.split("\n")[0]
        first_line = re.sub(r"[#*`~\[\]\(\)<>\-_]", " ", first_line).strip()
        clean_title = re.sub(r"[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s]", "", first_line)
        clean_title = re.sub(r"\s+", "_", clean_title)[:40]
        if clean_title:
            return f"{date_part}_{clean_title}.md"
            
    return f"{date_part}_agent_session.md"

def find_transcripts(directory: Path, filename: str) -> list[Path]:
    results = []
    if not directory.exists():
        return results
    for root, _, files in os.walk(directory):
        for f in files:
            if f == filename:
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

    transcripts = find_transcripts(DUMP_DIR, "transcript.md")
    print(f"📁 Processing and splitting raw dump session transcripts (Found {len(transcripts)} files)...")

    cache = OpenKbCache(CACHE_PATH)
    processed_count = 0
    skipped_count = 0

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
                
            title = extract_title(content, date_folder, model)
            dest_path = RAW_STORE / title
            with open(dest_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"      + Saved: {title}")

            cache.update(str(file_path), mtime)
            processed_count += 1
        except Exception as e:
            print(f"❌ 파일 처리 중 오류 발생 [{file_path}]: {str(e)}")

    print(f"✨ Processed: {processed_count} files, Skipped: {skipped_count} files.")

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
