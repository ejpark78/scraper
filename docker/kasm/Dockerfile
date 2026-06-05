FROM kasmweb/core-ubuntu-noble:1.18.0

USER root

# 한글 깨짐 방지용 폰트(나눔 폰트), make, Docker CLI, Zsh, fzf, eza 및 유틸리티 설치
RUN apt-get update && apt-get install -y \
    fonts-nanum \
    make \
    curl \
    git \
    sudo \
    zsh \
    fzf \
    eza \
    && curl -fsSL https://get.docker.com/ | sh \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Playwright 실행에 필요한 리눅스 시스템 의존성 패키지 설치
RUN npx playwright@1.60.0 install-deps chromium

# Kasm 기본 사용자의 기본 쉘을 Zsh로 변경
RUN usermod -s /bin/zsh kasm-user

# 호스트 사용자명(ejpark) 경로로 하드코딩된 설정들을 호환시키기 위해 심볼릭 링크 생성
RUN ln -s /home/kasm-user /home/ejpark

# npm 권한 오류 방지 및 홈 디렉토리 소유권 강제 변경
RUN chown -R 1000:1000 /home/kasm-user

# Kasm 기본 비루트 사용자(kasm-user: 1000) 권한으로 전환
USER 1000

# Oh My Zsh & 필수 플러그인 설치 (zsh-autosuggestions, zsh-syntax-highlighting, fzf-tab)
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended \
    && git clone https://github.com/zsh-users/zsh-autosuggestions /home/kasm-user/.oh-my-zsh/custom/plugins/zsh-autosuggestions \
    && git clone https://github.com/zsh-users/zsh-syntax-highlighting.git /home/kasm-user/.oh-my-zsh/custom/plugins/zsh-syntax-highlighting \
    && git clone https://github.com/Aloxaf/fzf-tab /home/kasm-user/.oh-my-zsh/custom/plugins/fzf-tab

# 호스트 개발자 편의 설정 파일 복사 (.zshrc)
COPY --chown=kasm-user:kasm-user .zshrc /home/kasm-user/.zshrc

# 작업 디렉토리 설정 (Kasm noble의 기본 사용자명은 kasm-user 입니다)
WORKDIR /home/kasm-user/linkedin

# 프로젝트에서 사용하는 것과 동일한 버전(1.60.0)의 Playwright Chromium 브라우저 바이너리 사전 설치
RUN npx playwright@1.60.0 install chromium
