FROM rust:1.88-slim AS agent-tools

ARG LITEBRITE_REV=294171da1490e5f071a9fd5f31c25a9c34f9010e
ARG TRAPPERKEEPER_REV=bd5ca628ab75f4c902945d0dc2768c66052624f8
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
  && cargo install --locked --git https://github.com/coobeeyon/litebrite.git \
    --rev "${LITEBRITE_REV}" \
  && cargo install --locked --git https://github.com/coobeeyon/trapperkeeper.git \
    --rev "${TRAPPERKEEPER_REV}" \
  && rm -rf /var/lib/apt/lists/* /usr/local/cargo/registry /usr/local/cargo/git

FROM node:22-slim

# Layer 1: System deps (changes ~never)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git make curl unzip ca-certificates openssh-client sudo \
  && rm -rf /var/lib/apt/lists/*

# Layer 2: GitHub SSH known host (changes ~never)
RUN mkdir -p /root/.ssh && \
    ssh-keyscan github.com >> /root/.ssh/known_hosts

# Layer 3: Dev tools (changes rarely, pinned versions)
ARG BUN_VERSION=1.3.5
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
ENV PATH="/root/.bun/bin:${PATH}"

# Layer 3b: Project task tracker and wiki, pinned to reviewed revisions
COPY --from=agent-tools /usr/local/cargo/bin/lb /usr/local/bin/lb
COPY --from=agent-tools /usr/local/cargo/bin/trk /usr/local/bin/trk

# Layer 4: Agent CLIs (changes occasionally, pinned for reproducible runs)
ARG CLAUDE_CODE_VERSION=2.1.220
ARG CODEX_VERSION=0.153.4
RUN npm install -g \
    "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
    "@openai/codex@${CODEX_VERSION}"

# Layer 5: Non-root user matching host UID (for SSH agent socket access)
ARG HOST_UID=1000
ARG HOST_GID=1000
RUN userdel -r node 2>/dev/null || true && \
    groupadd -g ${HOST_GID} runner 2>/dev/null || true && \
    useradd -m -s /bin/bash -u ${HOST_UID} -g ${HOST_GID} runner && \
    echo "runner ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/runner && \
    mkdir -p /workspace && chown runner:runner /workspace && \
    cp -r /root/.ssh /home/runner/.ssh && \
    chown -R runner:runner /home/runner/.ssh && \
    cp -r /root/.bun /home/runner/.bun && \
    chown -R runner:runner /home/runner/.bun
USER runner
ENV HOME=/home/runner
ENV PATH="/home/runner/.bun/bin:${PATH}"
RUN git config --global user.name "epic-runner" && \
    git config --global user.email "epic-runner@local"

# Layer 6: Pre-install JS dependencies (cache key = lockfiles)
COPY --chown=runner:runner package.json bun.lock* bun.lockb* /deps/physarum/
RUN cd /deps/physarum && bun install --frozen-lockfile || true

# run-epic.sh is mounted at runtime — no COPY needed
ENTRYPOINT ["bash"]
