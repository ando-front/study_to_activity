# Study to Activity (S2A)

「勉強のがんばりが、遊びの時間に変わる」── 小学生の学習進捗を管理し、達成度に応じてタブレットやNintendo Switchなどのアクティビティ時間を自動的に付与・制御する家庭内プロダクトです。

## ✨ 主な機能

- **学習計画の管理**: 親は週間・日々の学習計画（宿題、ドリルなど）を簡単に作成・管理できます。
- **進捗の可視化**: 子供は自分のタスクリストと進捗状況をダッシュボードで確認できます。
- **自動的な報酬付与**: 学習タスクが完了・承認されると、事前に設定したルールに基づき「アクティビティ時間」が自動で付与されます。
- **アクティビティウォレット**: 付与された時間がデジタルウォレットに貯まり、残高をいつでも確認できます。
- **柔軟なルール設定**: 「宿題を全部終えたら30分」「ドリルを1つ終えたら15分」など、各家庭の方針に合わせて報酬ルールを自由にカスタマイズできます。

## 🛠️ 技術スタック

- **バックエンド**:
    - **フレームワーク**: [Python](https://www.python.org/) / [FastAPI](https://fastapi.tiangolo.com/)
    - **データベース**: [SQLAlchemy](https://www.sqlalchemy.org/) + [SQLite](https://www.sqlite.org/index.html) (開発用)
    - **Webサーバー**: [Uvicorn](https://www.uvicorn.org/)
- **フロントエンド**: (計画中)
    - [Next.js](https://nextjs.org/) (React)

## 🚀 開発環境の起動

開発環境をセットアップするには、A) Dev Container（推奨）または B) ローカルマシン のいずれかの方法を選択してください。

### A) Dev Container (推奨)

Dev Containerを使用すると、Dockerコンテナ内に事前に構成された開発環境が起動し、お使いのマシンの環境に影響を与えることなく、すぐに開発を開始できます。

**前提条件:**
- [Visual Studio Code](https://code.visualstudio.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- VS Code拡張機能: [Remote - Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

**手順:**
1.  このプロジェクトをVS Codeで開きます。
2.  左下の緑色のリモートウィンドウアイコン `><` をクリックし、表示されるメニューから **「Reopen in Container」** を選択します。
3.  初回起動時はコンテナのビルドに数分かかります。
4.  ビルド完了後、VS Codeがコンテナに接続された状態で再起動します。依存関係（Python/Node.js）は `postCreateCommand` により自動でインストールされます。
5.  VS Code内のターミナルで、各サーバーを起動します。
    - **バックエンド:** `uvicorn backend.main:app --reload`
    - **フロントエンド:** `cd frontend && npm run dev`

### B) ローカルマシン

このプロジェクトはバックエンド（FastAPI）とフロントエンド（Next.js）で構成されています。
ローカルで開発を行うには、両方のサーバーを同時に起動する必要があります。

**1. 前提条件**

- Python (3.8 以降)
- Node.js (LTSバージョン) と npm

**2. バックエンドのセットアップ**

まず、バックエンドのAPIサーバーを起動します。

```bash
# 1. Pythonの仮想環境を作成・有効化
python -m venv venv
# Windowsの場合
.\venv\Scripts\activate
# macOS/Linuxの場合
# source venv/bin/activate

# 2. 依存関係をインストール
pip install -r backend/requirements.txt

# 3. バックエンドサーバーを起動
uvicorn backend.main:app --reload
```

サーバーは `http://127.0.0.1:8000` で起動します。

**3. フロントエンドのセットアップ**

次に、別のターミナルを開いてフロントエンドの開発サーバーを起動します。

```bash
# 1. フロントエンドディレクトリに移動
cd frontend

# 2. 依存関係をインストール
npm install

# 3. フロントエンド開発サーバーを起動
npm run dev
```

サーバーは `http://localhost:3000` で起動します。

**4. 動作確認**

- **Webアプリケーション**: ブラウザで `http://localhost:3000` にアクセスします。
- **APIドキュメント**: `http://127.0.0.1:8000/docs` にアクセスすると、バックエンドのAPI仕様を（Swagger UIで）確認・テストできます。



## 📁 プロジェクト構造

```
.
├── backend/            # バックエンドの全ソースコード
│   ├── main.py         # FastAPIアプリケーションのエントリポイント
│   ├── database.py     # DB接続とセッション管理
│   ├── models.py       # SQLAlchemyモデル
│   ├── schemas.py      # Pydanticスキーマ
│   ├── reward_engine.py# 報酬評価ロジック
│   └── routers/        # APIエンドポイントのルーティング
│       ├── auth.py
│       ├── plans.py
│       ├── tasks.py
│       ├── rules.py
│       └── wallet.py
├── docs/               # ドキュメンテーション
│   ├── prd.md          # プロダクト要求仕様書
│   └── technical_specification.md # 技術仕様書
├── GEMINI.md           # AIアシスタント向けのプロジェクトコンテキスト
└── README.md           # このファイル
```
