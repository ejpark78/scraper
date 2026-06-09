FROM ghcr.io/anomalyco/opencode

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

WORKDIR /workspace
RUN chmod 777 /workspace

ENTRYPOINT ["opencode"]
