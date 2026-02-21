# ベースイメージとして、Python 3.11がプリインストールされたMicrosoftの公式Dev Containerイメージを使用します。
# このイメージにはgitやzshのほか、Node.jsのバージョン管理ツールであるnvmも含まれており、開発環境の基盤として適しています。
FROM mcr.microsoft.com/devcontainers/python:1-3.11-bullseye

# Node.jsのバージョンを環境変数として定義します。
# '--lts' を指定することで、長期サポート(LTS)版のNode.jsがインストールされるようになります。
ENV NODE_VERSION --lts

# nvm (Node Version Manager) を使ってNode.jsをインストールします。
# nvmはシェルの関数として読み込まれるため、`bash -c` を使ってコマンドを実行し、
# Node.jsのインストールと、デフォルトバージョンの設定を一つのレイヤーで行います。
# このコマンドはコンテナのビルド時に一度だけ実行されます。
RUN bash -c "source /usr/local/share/nvm/nvm.sh && nvm install ${NODE_VERSION} && nvm alias default ${NODE_VERSION}"

# 新しいターミナルセッションを開いた際にnvmとNode.jsが自動的に利用できるよう、
# シェルのプロファイル(.bashrc)にnvmの初期化スクリプトを追記します。
RUN echo -e '\n. /usr/local/share/nvm/nvm.sh' >> /home/vscode/.bashrc
