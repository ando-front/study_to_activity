# 公式デプロイガイド (Render)

> **バージョン**: v1.0
> **目的**: 「Study to Activity」アプリケーションをRenderにデプロイするための公式手順書

---

## 1. 方針概要

本プロジェクトのホスティング環境として、**Render** を公式に採用します。

### 1.1. なぜRenderか？

Renderは、本プロジェクトの規模と目的に対して、以下の点でAWSやAzureのような大規模クラウドサービスより優れた選択肢です。

- **圧倒的な使いやすさ (PaaS)**: RenderはPaaS (Platform as a Service) であり、開発者はサーバーやネットワークといったインフラを意識する必要がありません。アプリケーションのコードをGitHubにプッシュするだけで、ビルド、デプロイ、スケーリングが自動的に処理されます。
- **コスト効率と予測可能性**: FastAPIバックエンドとPostgreSQLデータベースを**完全に無料**で運用開始できます。有料プランもリソースベースで非常にわかりやすく、意図しない高額請求のリスクが極めて低いです。
- **開発スピードの向上**: インフラ構築に時間を費やすことなく、数クリックと簡単な設定でアプリケーションを公開できます。これにより、プロダクトの機能開発に集中できます。

### 1.2. デプロイ構成

- **バックエンド**: Render Web Service (Python 3)
- **データベース**: Render PostgreSQL (Managed Database)
- **デプロイ方法**: GitHubリポジトリ連携による自動デプロイ

---

## 2. デプロイ手順

### ステップ0: 事前準備

1.  **Renderアカウント作成**: [Render公式サイト](https://render.com/)でアカウントを作成します。GitHubアカウントでサインアップするのが最もスムーズです。
2.  **コードの確認**:
    - `backend/database.py` が環境変数 `DATABASE_URL` を読み込むように修正されていることを確認します（本手順で実施済み）。
    - `requirements.txt` に `gunicorn` と `psycopg2-binary` が含まれていることを確認します（本手順で実施済み）。

### ステップ1: PostgreSQLデータベースの作成

最初に、データを永続化するためのデータベースをRender上に作成します。

1.  Renderダッシュボードで **[New] > [PostgreSQL]** を選択します。
2.  以下の項目を設定します。
    - **Name**: データベースの識別名（例: `s2a-database`）
    - **Database**: データベース名（例: `s2a_db`）
    - **User**: ユーザー名（例: `s2a_user`）
    - **Region**: 最も近いリージョンを選択
    - **Freeプラン**: Freeプランが選択されていることを確認します。
3.  **[Create Database]** をクリックします。作成には数分かかります。
4.  作成後、データベースのダッシュボードが表示されます。**"Connections"** タブにある **`Internal Database URL`** をコピーしておきます。これは次のステップで使用します。

### ステップ2: バックエンド (Web Service) のデプロイ

次に、FastAPIアプリケーション本体をデプロイします。

1.  Renderダッシュボードで **[New] > [Web Service]** を選択します。
2.  **"Build and deploy from a Git repository"** を選択し、本プロジェクトのGitHubリポジトリを接続します。
3.  以下の項目を設定します。
    - **Name**: Webサービスの名前（例: `study-to-activity-api`）
    - **Region**: データベースと同じリージョンを選択します。
    - **Branch**: デプロイしたいブランチ（例: `main`）
    - **Root Directory**: `backend`
        - *重要: ソースコードが `backend` ディレクトリ内にあるため、これを指定することでビルドコマンド等の基準パスが `backend` になります。*
    - **Runtime**: `Python 3`
    - **Build Command**: `pip install -r requirements.txt`
    - **Start Command**: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app`
        - *Root Directoryを指定したため、パスは `backend.main:app` ではなく `main:app` になります。*
    - **Instance Type**: `Free`

4.  **[Create Web Service]** をクリックする前に、**"Advanced Settings"** を展開します。

### ステップ3: 環境変数の設定

Webサービスがデータベースに接続できるよう、環境変数を設定します。

1.  "Advanced Settings" の中で、**[Add Environment Variable]** をクリックします。
2.  以下の環境変数を設定します。
    - **Key**: `DATABASE_URL`
    - **Value**: ステップ1でコピーした **`Internal Database URL`** を貼り付けます。
3.  もう一つ、Pythonのバージョンを指定する環境変数を追加すると、より安定したビルドが期待できます。
    - **Key**: `PYTHON_VERSION`
    - **Value**: `3.11` (または使用したいPythonのバージョン)

### ステップ4: デプロイの実行と確認

1.  すべての設定が完了したら、ページ下部の **[Create Web Service]** をクリックします。
2.  最初のデプロイが自動的に開始されます。ログ画面でビルドとデプロイの進捗を確認できます。
3.  デプロイが成功すると、WebサービスのURL（例: `https://study-to-activity-api.onrender.com`）が発行され、"Live"と表示されます。
4.  発行されたURLの末尾に `/docs` をつけてブラウザでアクセスし、FastAPIのSwagger UIが表示されればデプロイ成功です。

---

## 3. 運用と管理

### ローカル開発

- ローカルで開発を続ける際は、`DATABASE_URL` 環境変数を設定せずに `uvicorn` コマンドで起動すれば、従来通り `s2a.db` というSQLiteファイルが使われます。
- 本番DBの情報をローカルで使いたい場合は、`.env` ファイルを作成し `DATABASE_URL=...` と記述して利用します（`.gitignore` により `.env` はコミットされません）。

### 自動デプロイ

- 上記設定後、GitHubリポジトリの指定ブランチ（例: `main`）に `git push` すると、Renderが自動的に変更を検知し、新しいバージョンのデプロイを開始します。
