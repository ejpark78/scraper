import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

class WikiConfig:
    def __init__(self):
        if Path('/data').exists():
            self.project_root = Path('/data')
            self.openkb_dir = self.project_root / 'openkb'
            self.wiki_dir = self.project_root / 'gitea-wiki'
        else:
            self.project_root = Path('/Users/ejpark/workspace/scraper')
            self.openkb_dir = self.project_root / 'data/openkb'
            self.wiki_dir = self.project_root / 'data/gitea-wiki'

def copy_dir(src: Path, dest: Path):
    if not src.exists():
        return
    dest.mkdir(parents=True, exist_ok=True)
    for item in os.listdir(src):
        s = src / item
        d = dest / item
        if s.is_dir():
            copy_dir(s, d)
        else:
            shutil.copy2(s, d)

def run_cmd(cmd: str, cwd: Path):
    try:
        subprocess.run(cmd, shell=True, cwd=cwd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError as e:
        print(f"❌ [WikiSync] 명령어 실행 실패: {cmd}")
        print(str(e))
        exit(1)

def run_cmd_output(cmd: str, cwd: Path) -> str:
    try:
        res = subprocess.run(cmd, shell=True, cwd=cwd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return res.stdout.strip()
    except subprocess.CalledProcessError:
        return ""

def main():
    print('🤖 Synchronizing compiled concepts & summaries to Gitea Wiki...')
    config = WikiConfig()
    os.chdir(config.openkb_dir)
    config.wiki_dir.mkdir(parents=True, exist_ok=True)

    concepts_dir = config.openkb_dir / 'wiki/concepts'
    if concepts_dir.exists():
        copy_dir(concepts_dir, config.wiki_dir)

    summaries_dir = config.openkb_dir / 'wiki/summaries'
    if summaries_dir.exists():
        copy_dir(summaries_dir, config.wiki_dir / 'summaries')

    # git repository인지 안전성 검사 추가
    git_dir = config.wiki_dir / '.git'
    if not git_dir.exists():
        print('⚠️ [WikiSync] gitea-wiki 디렉토리에 .git 저장소 정보가 존재하지 않습니다. Git 동기화를 스킵합니다.')
        print('🎉 Wiki Deployment and Synchronization Pipeline finished (Skipped Git Push).')
        return

    print('📤 Pushing to Gitea Wiki remote...')
    run_cmd('git config http.sslVerify false', config.wiki_dir)
    run_cmd('git config user.name "WikiSync Agent"', config.wiki_dir)
    run_cmd('git config user.email "agent@openkb.local"', config.wiki_dir)
    
    status = run_cmd_output('git status --porcelain', config.wiki_dir)
    if status:
        run_cmd('git add .', config.wiki_dir)
        date_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        commit_cmd = (
            'GIT_AUTHOR_NAME="WikiSync Agent" '
            'GIT_AUTHOR_EMAIL="agent@openkb.local" '
            'GIT_COMMITTER_NAME="WikiSync Agent" '
            'GIT_COMMITTER_EMAIL="agent@openkb.local" '
            f'git commit -m "chore: auto-compound agent session logs {date_str}"'
        )
        run_cmd(commit_cmd, config.wiki_dir)
        run_cmd('git push origin main', config.wiki_dir)
        print('✅ Gitea Wiki Remote synchronisation complete.')
    else:
        print('   No changes detected in Wiki. Push skipped.')

    print('🎉 Wiki Deployment and Synchronization Pipeline finished.')

if __name__ == '__main__':
    main()
