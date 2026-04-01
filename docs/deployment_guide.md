# S2A プロダクトデプロイメントガイド

本ドキュメントでは、Study to Activity (S2A) を本番環境へデプロイするための手順と、セキュアな運用設定について説明します。

## 1. システム構成（本番環境）

本番環境では、スケーラビリティと可用性を考慮し、以下の構成を推奨します。

- **Frontend**: Next.js (Vercel または任意の CDN 付きホスティング)
- **Backend**: FastAPI (Render, Railway, Heroku, または AWS/GCP のコンテナサービス)
- **Database**: Managed PostgreSQL (Render, AWS RDS 等)

## 2. Docker を使用したデプロイ

すでにリポジトリには `Dockerfile` と `docker-compose.yml` が含まれています。

### ローカルでの本番構成テスト
```bash
docker-compose up --build
```

## 3. 推奨デプロイプラットフォーム

### 3.1 Backend & Database (Render.com の例)
1. **PostgreSQL データベースを作成**:
   - `DATABASE_URL` を取得します。
2. **Web Service を作成**:
   - リポジトリを接続し、`Dockerfile Path` に `backend/Dockerfile` を指定します。
   - 以下の環境変数を設定します:
     - `DATABASE_URL`: (作成した PostgreSQL の URL)
     - `ENV`: `production`
     - `ALLOWED_ORIGINS`: `https://your-frontend-domain.com`

### 3.2 Frontend (Vercel の例)
1. **New Project を作成**:
   - リポジトリを選択し、`Root Directory` に `frontend` を指定。
2. **Build Settings**:
   - Framework Preset: `Next.js`
3. **Environment Variables**:
   - `NEXT_PUBLIC_API_URL`: `https://your-backend-api.render.com/api`
   - `BACKEND_URL`: `https://your-backend-api.render.com`（サーバーサイド用、NextAuth の signIn コールバックがバックエンドを呼び出す際に使用）
   - `AUTH_SECRET`: ランダムな文字列（`openssl rand -base64 32` で生成）※ **必須。未設定だと Google ログイン時にサーバーエラーが発生する**
   - `GOOGLE_CLIENT_ID`: Google Cloud Console で取得した OAuth 2.0 クライアント ID
   - `GOOGLE_CLIENT_SECRET`: Google Cloud Console で取得した OAuth 2.0 クライアント シークレット
   - `NEXTAUTH_URL`: `https://your-frontend.vercel.app`（本番フロントエンドの URL）

## 4. セキュリティ設定

デプロイ時には以下の項目を必ず確認してください。

- **CORS 設定**: `ALLOWED_ORIGINS` をフロントエンドのドメインのみに制限してください。
- **デバッグ用エンドポイント**: `ENV=production` に設定することで、テスト用のデータリセットエンドポイントが自動的に無効化されます。
- **HTTPS**: すべての通信は HTTPS 経由で行う必要があります（Vercel/Render では自動適用されます）。
- **データベースのパスワード**: `docker-compose.yml` に記載されているデフォルトパスワードは開発用です。本番環境では必ず強固なパスワードを生成し、環境変数として注入してください。
- **機密情報の管理**: Nintendo Account のセッショントークンなどは暗号化されたデータベースに保存され、API 経由で直接外部へ漏洩しないよう実装されています。

## 5. データベース移行 (SQLite -> PostgreSQL)

バックエンドは共通の SQLAlchemy インターフェースを使用しているため、`DATABASE_URL` を変更するだけで PostgreSQL に対応します。初回起動時に `Base.metadata.create_all` によってテーブルが自動生成されます。

---

> [!CAUTION]
> **重要**: 本番環境では、`.env` ファイルを絶対に Git リポジトリにコミットしないでください。ホスティングサービスのコントロールパネルから直接設定することを推奨します。
