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

DUMP_DIR = (PROJECT_ROOT / "agents/agy").resolve()
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
                    preferred = ['gemma4:e4b', 'qwen2.5-coder:14b', 'rafw007/gemma4-e2b-claude-coder:latest', 'deepseek-r1:14b', 'gemma4:26b']
                    for model in preferred:
                        if model in models:
                            return model
                    if models:
                        return models[0]
        except Exception:
            pass
        return "qwen2.5-coder:14b"

    @staticmethod
    def summarize(content: str, model: str) -> str:
        try:
            prompt = f"Below is a segment of an agent's workspace conversation. Generate a very brief Korean summary (under 20 characters, using letters, numbers, and underscores, no spaces) representing the core topic of this conversation. Output ONLY the summary text, with no extra explanation, quotes, or markdown.\n\nConversation Segment:\n{content[:1500]}"
            
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
            with urllib.request.urlopen(req, timeout=45) as response:
                if response.status == 200:
                    res_data = json.loads(response.read().decode("utf-8"))
                    raw_summary = res_data.get("response", "").strip()
                    clean = re.sub(r"[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s_]", "", raw_summary)
                    clean = re.sub(r"\s+", "_", clean)[:30]
                    return clean
        except Exception as e:
            print(f"⚠️ Ollama 요약 생성 실패: {str(e)}")
        return ""

def segment_file(file_path: Path, date_folder: str, model: str):
    date_part = date_folder.split("T")[0]
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    request_matches = list(re.finditer(r"<USER_REQUEST>([\s\S]*?)</USER_REQUEST>", content))
    
    if not request_matches:
        summary = OllamaClient.summarize(content, model) or "agent_session"
        return [{
            "conversation": content,
            "title": f"{date_part}_{summary}.md"
        }]

    segments = []
    for i, match in enumerate(request_matches):
        request_text = match.group(1).strip()
        start_idx = match.start()
        end_idx = request_matches[i+1].start() if i + 1 < len(request_matches) else len(content)
        conversation = content[start_idx:end_idx].strip()

        issue_no = ""
        issue_match = re.search(r"(?:#|이슈\s*|버그\s*|feature/)([0-9]{3})", request_text, re.IGNORECASE)
        if issue_match:
            issue_no = f"_#{issue_match.group(1)}"

        if issue_no:
            first_line = request_text.split("\n")[0]
            first_line = re.sub(r"[#*`~\[\]\(\)<>\-_]", " ", first_line)
            first_line = re.sub(r"https?://[^\s]+", "", first_line).strip()
            clean_title = re.sub(r"[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s]", "", first_line)
            clean_title = re.sub(r"\s+", "_", clean_title)[:40]
            if not clean_title:
                clean_title = "issue_task"
            title = f"{date_part}{issue_no}_{clean_title}.md"
        else:
            summary = OllamaClient.summarize(conversation, model)
            if summary:
                title = f"{date_part}_{summary}.md"
            else:
                first_line = request_text.split("\n")[0]
                first_line = re.sub(r"[#*`~\[\]\(\)<>\-_]", " ", first_line).strip()
                clean_title = re.sub(r"[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s]", "", first_line)
                clean_title = re.sub(r"\s+", "_", clean_title)[:40]
                if not clean_title:
                    clean_title = "agent_session"
                title = f"{date_part}_{clean_title}.md"

        segments.append({
            "conversation": conversation,
            "title": title
        })

    return segments

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
    try:
        req = urllib.request.Request(OLLAMA_TAGS_ENDPOINT)
        with urllib.request.urlopen(req, timeout=3) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                models = [m["name"] for m in data.get("models", [])]
                if model in models or any(model in m for m in models):
                    print("   ✅ Ollama connection health check passed.")
                    return True
                else:
                    print(f"   ⚠️ Warning: target model '{model}' not found in active Ollama models.")
                    return True
    except Exception as e:
        print(f"   ❌ Ollama connection health check failed: {str(e)}")
        print("   Please make sure Ollama is running and accessible at the current host address.")
        return False
    return False

def main():
    print("🤖 Starting OpenKB Compiling Pipeline (Containerized Python Version)...")
    RAW_STORE.mkdir(parents=True, exist_ok=True)

    model = OllamaClient.get_available_model()
    
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
            segments = segment_file(file_path, date_folder, model)
            
            for seg in segments:
                dest_path = RAW_STORE / seg["title"]
                with open(dest_path, "w", encoding="utf-8") as f:
                    f.write(seg["conversation"])
                print(f"      + Saved: {seg['title']}")

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
