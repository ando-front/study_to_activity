# S2A デプロイメント詳細手順書 (Vercel & Render 版)

本ドキュメントは、Study to Activity (S2A) をインターネット上に公開するための、人間が行うべき具体的な操作手順をまとめたものです。

---

## 準備するもの
- GitHub アカウント（リポジトリがプッシュされていること）
- [Render](https://render.com/) アカウント（Backend & Database 用）
- [Vercel](https://vercel.com/) アカウント（Frontend 用）

---

## 手順 1: GitHub への最終プッシュ
まずは最新のセキュリティ強化コードとデプロイ設定を GitHub に反映させます。

1. ローカルのターミナルで以下を実行します。
   ```bash
   git add .
   git commit -m "Add production deployment and security hardening"
   git push origin main
   ```

---

## 手順 2: Render でのバックエンド構築
Render の **Blueprint** 機能を使用して、DB と API を一括構築します。

1. [Render Dashboard](https://dashboard.render.com/) にログイン。
2. **New +** > **Blueprint** を選択。
3. リポジトリ一覧から `study_to_activity` を選択して **Connect**。
4. **Service Group Name** に `s2a-stack` 等と入力。
5. **Apply** をクリック。
6. **構築完了を待つ**:
   - `s2a-db` (PostgreSQL) と `s2a-backend` (Web Service) が作成されます。
   - `s2a-backend` のダッシュボード上に表示される URL（例: `https://s2a-backend.onrender.com`）をコピーしてメモしておきます。**これが API のベース URL になります。**

---

## 手順 3: Vercel でのフロントエンド構築
次に、ユーザーがアクセスする画面を公開します。

1. [Vercel Dashboard](https://vercel.com/) にログイン。
2. **Add New...** > **Project** を選択。
3. GitHub リポジトリをインポート。
4. **Configure Project**:
   - **Root Directory**: `frontend` を選択。
   - **Framework Preset**: `Next.js` が選択されていることを確認。
5. **Environment Variables (環境変数)** を展開し、以下を追加：
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://(手順2でメモしたURL)/api` (最後に **/api** を忘れずに)
6. **Deploy** をクリック。
7. 完了後、発行されたプロジェクトの URL（例: `https://study-to-activity.vercel.app`）をコピーしてメモします。

---

## 手順 4: セキュリティの仕上げ (CORS 設定)
最後に、バックエンドに対して「自分のフロントエンドからのみアクセスを許可する」という鍵をかけます。

1. 再び **Render Dashboard** へ。
2. `s2a-backend` サービスを選択。
3. 左メニューの **Environment** をクリック。
4. `ALLOWED_ORIGINS` という項目を探し、**Edit**。
5. 値を **手順 3 でメモした Vercel の URL** に書き換えます。
   - 例: `https://study-to-activity.vercel.app`
6. **Save Changes** をクリック。バックエンドが自動で再起動します。

---

## デプロイ完了後の動作確認
1. Vercel の URL にアクセスします。
2. ログイン画面が表示されることを確認。
3. （ローカルのデータは引き継がれないため）再度「お父さん/お母さん」ユーザーを新規登録します。
4. ダッシュボードで **Nintendo Switch 連携** が表示されれば成功です！

> [!TIP]
> **トラブルシューティング**: 
> ログイン時にエラーが出る場合は、手順 3 の `NEXT_PUBLIC_API_URL` または 手順 4 の `ALLOWED_ORIGINS` の入力ミス（スペルや `https://` の有無など）が最も多い原因です。
