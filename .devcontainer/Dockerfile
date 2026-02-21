# ベースイメージとして、Python 3.11がプリインストールされたMicrosoftの公式Dev Containerイメージを使用します。
FROM mcr.microsoft.com/devcontainers/python:1-3.11-bullseye

# Node.js LTSをインストールします。
# nvmではなく、NodeSourceリポジトリを追加してapt経由でインストールすることで、
# システム全体でNode.jsが利用可能になり、非インタラクティブシェルでもパスの問題が発生しにくくなります。
RUN apt-get update && \
    apt-get install -y ca-certificates curl gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    NODE_MAJOR=20 && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install nodejs -y

# [Optional] ビルドキャッシュをクリーンアップしてイメージサイズを削減
RUN apt-get clean && rm -rf /var/lib/apt/lists/*
