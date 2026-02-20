FROM node:22-slim

# Layer 1: System deps (changes ~never)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git make curl unzip ca-certificates openssh-client \
  && rm -rf /var/lib/apt/lists/*

# Layer 2: GitHub SSH known host (changes ~never)
RUN mkdir -p /root/.ssh && \
    ssh-keyscan github.com >> /root/.ssh/known_hosts

# Layer 3: Dev tools installed from internet (changes rarely, pinned versions)
ARG BUN_VERSION=1.3.9
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
ENV PATH="/root/.bun/bin:${PATH}"
RUN curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash

# Layer 4: Claude Code (changes occasionally)
RUN npm install -g @anthropic-ai/claude-code

# Layer 5: Non-root user matching host UID (for SSH agent socket access)
ARG HOST_UID=1000
ARG HOST_GID=1000
RUN userdel -r node 2>/dev/null || true && \
    groupadd -g ${HOST_GID} runner 2>/dev/null || true && \
    useradd -m -s /bin/bash -u ${HOST_UID} -g ${HOST_GID} runner && \
    mkdir -p /workspace && chown runner:runner /workspace && \
    cp -r /root/.ssh /home/runner/.ssh && \
    chown -R runner:runner /home/runner/.ssh && \
    cp -r /root/.bun /home/runner/.bun && \
    chown -R runner:runner /home/runner/.bun && \
    cp -r /root/.local /home/runner/.local && \
    chown -R runner:runner /home/runner/.local
USER runner
ENV HOME=/home/runner
ENV PATH="/home/runner/.bun/bin:/home/runner/.local/bin:${PATH}"
RUN git config --global user.name "epic-runner" && \
    git config --global user.email "epic-runner@local"

# Layer 6: Pre-install JS dependencies (cache key = lockfiles)
COPY --chown=runner:runner package.json bun.lock* bun.lockb* /deps/physarum/
RUN cd /deps/physarum && bun install --frozen-lockfile || true

# run-epic.sh is mounted at runtime — no COPY needed
ENTRYPOINT ["bash"]
