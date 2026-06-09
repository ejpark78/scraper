FROM ghcr.io/anomalyco/opencode

ARG BUILD_DATE
ARG VCS_REF
ARG USER_UID=1000
ARG USER_GID=1000
ARG DOCKER_GID=999

LABEL org.opencontainers.image.title="Opencode Coding Agent"
LABEL org.opencontainers.image.description="AI-powered coding assistant with Docker and git integration"
LABEL org.opencontainers.image.source="https://github.com/ejpark/linkedin"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"
LABEL org.opencontainers.image.licenses="MIT"

USER root

RUN apk add --no-cache \
    git \
    nodejs \
    npm \
    jq \
    yq \
    bash \
    curl \
    openssh-client \
    docker-cli

RUN addgroup -g ${USER_GID} opencode-group || true && \
    addgroup -g ${DOCKER_GID} docker-host || true && \
    adduser -u ${USER_UID} -G opencode-group -D -s /bin/bash opencode-user || true && \
    addgroup opencode-user docker-host || true

WORKDIR /workspace
RUN chmod 777 /workspace

ENTRYPOINT ["opencode"]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD pgrep -f opencode || exit 1
