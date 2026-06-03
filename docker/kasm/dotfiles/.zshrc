export IN_CONTAINER=true
export ZSH="$HOME/.oh-my-zsh"

ZSH_THEME="robbyrussell"

plugins=(
  git
  z
  sudo
  docker
  web-search
  zsh-autosuggestions
  zsh-syntax-highlighting
  fzf-tab
)

source $ZSH/oh-my-zsh.sh

# 컨테이너 전용 프롬프트 식별자 추가 (robbyrussell 테마 기반 커스텀)
if [ "$IN_CONTAINER" = "true" ]; then
  PROMPT="%(?:%{$fg_bold[blue]%}🐳 kasm %{$fg_bold[green]%}➜ :%{$fg_bold[blue]%}🐳 kasm %{$fg_bold[red]%}➜ ) %{$fg[cyan]%}%c%{$reset_color%} \$(git_prompt_info)"
fi

[ -f "$HOME/.local/bin/env" ] && . "$HOME/.local/bin/env"

alias ls='eza --icons --group-directories-first'
alias ll='eza -alh --icons --group-directories-first'

[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh
export PATH=$PATH:/usr/local/bin

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

alias dc='docker compose'

# Fcitx5 한글 입력 설정
export GTK_IM_MODULE=fcitx
export QT_IM_MODULE=fcitx
export XMODIFIERS=@im=fcitx
export DefaultIMModule=fcitx

export UV_LINK_MODE=copy

export LANG=ko_KR.UTF-8
export LANGUAGE=ko_KR.UTF-8
export LC_ALL=ko_KR.UTF-8

# Kasm 컨테이너 내부임을 명시하여 Makefile이 직접 명령을 수행하도록 설정

