FROM ghcr.io/anomalyco/opencode

ARG USER_UID=1000
ARG USER_GID=1000
ARG DOCKER_GID=999

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
