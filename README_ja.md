# Decision-Flow PM

Decision-Flow PM は、先が完全には読めない案件のための**意思決定中心ワークスペース**です。
研究開発、探索型開発、ステージゲート審査、部門横断の企画検討などを対象にしています。

一般的なタスク一覧ではなく、Decision-Flow PM は **判断点（Decision Point）** を主単位として扱います。

- **Decision Card**: 何を判断するのか、誰が責任を持つのか、何が分かっていて何が不足しているのか、次に何をするのかを記録します。
- **Review Mode**: 会議中に、判断可能なカードを順番に確認し、その場で判断結果を記録できます。
- **Project / Gate Context**: カードを Project / Gate に紐づけて、案件全体やレビュー構造の文脈の中で扱えます。
- **Timeline View**: Excel ガントチャートの代替として、**何をするか** だけでなく **いつ次に決めるか** を時間軸で俯瞰できます。

---

## できること

### Board
- 3 列のボードでカードを管理
  - `DECIDABLE`
  - `NOT_DECIDABLE`
  - `DECIDED`
- 表示中カード一覧から件数・期限超過数を再計算
- 各カードの **詳細** ボタンから Card Detail を開ける
- 以下を作成可能
  - Decision Card
  - Project
  - Gate

### Card Detail
- カード本体項目の編集
- Evidence（判断材料）の追加
- 判断結果の記録 / 再オープン
- 任意で Context を編集
  - Project
  - Gate
  - 親カード
  - レビュー会ラベル
  - 判断基準

### Review Mode
- `DECIDABLE` のカードだけをレビュー対象として表示
- Project / Gate API が利用可能ならフィルタ可能
- Project / Gate API が落ちても全体レビューへフォールバックして継続可能
- 判断後に**任意で**次カードを作成可能
- 可能な場合は、新しく作成した次カードを元カードの文脈へ自動接続

### Timeline
- Project / Gate / Decision Card を時間軸上で俯瞰
- タスクバーではなく、判断点と Gate マーカーを表示
- ガント的な俯瞰は欲しいが、単なるタスク管理には戻したくない場合に利用可能

---

## このツールが向いているケース

Decision-Flow PM は、次のようなケースで有効です。

- 次の行動が、証拠・審査・GO / NO-GO 判断に依存する
- 判断チェックポイントが繰り返し発生する
- ブロッカーや不足材料を明示したい
- 会議の中でその場で判断記録を残したい
- 通常のガントチャートだと、探索業務にはタスク中心すぎると感じる

---

## Docker Compose での始め方

### 前提
- Docker がインストール済みであること
- このリポジトリに `docker-compose.yml` のような Compose 用 YAML ファイルが含まれていること

### 1. アプリを起動する
リポジトリのルートで次を実行してください。

```bash
docker compose -f docker-compose.yml up --build
```

バックグラウンドで起動する場合:

```bash
docker compose -f docker-compose.yml up -d --build
```

> もし Compose ファイル名が `compose.yml` や `docker-compose.prod.yml` など別名であれば、`docker-compose.yml` の部分を実際のファイル名に置き換えてください。

### 2. アプリを開く
起動後、Compose 設定で公開しているフロントエンド URL を開いてください。
一般的な構成では、例えば次のようになります。

- Frontend: `http://localhost:3000`
- Backend API Docs: `http://localhost:8000/docs`

実際のポート番号は Compose YAML の設定に従ってください。

### 3. アプリを停止する

```bash
docker compose -f docker-compose.yml down
```

### 4. 変更後に再ビルドする

```bash
docker compose -f docker-compose.yml up --build
```

バックグラウンド運用中に再ビルドする場合:

```bash
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml up -d --build
```

---

## 基本的な使い方

1. Project / Gate 構造で管理したい場合は、まず **Project** を作成
2. 審査やレビューの節目がある場合は **Gate** を作成
3. 判断すべき内容ごとに **Decision Card** を作成
4. ボード上で以下を使い分ける
   - `NOT_DECIDABLE`
   - `DECIDABLE`
   - `DECIDED`
5. **詳細** から判断材料、文脈、判断理由を更新
6. 会議では **Review Mode** を使って判断可能カードを順に処理
7. 時間軸で俯瞰したい場合は **Timeline** を利用

---

## 典型的なリポジトリ構成

```text
frontend/
  app/
    page.tsx
    globals.css
    review/page.tsx
    cards/[id]/page.tsx
    timeline/page.tsx
backend/
  app/
    main.py
    models.py
    schemas.py
    crud.py
    db.py
    config.py
README.md
README_ja.md
licenses.txt
privacy_scan_report.txt
```

---

## 公開前の注意（プライバシー / セキュリティ）

GitHub に公開する前に、以下が含まれていないことを確認してください。

- API キー / Bearer トークン
- ローカル PC 固有の絶対パス
- 個人ユーザー名を含む設定値
- 社内専用 URL
- ローカル DB / dump / log ファイル

`privacy_scan_report.txt` がある場合は、公開前に必ず確認してください。

---

## サードパーティライセンス

主要な利用モジュールとライセンスは `licenses.txt` を参照してください。
最終的には、実際のプロジェクトファイルを基に確認してください。

- `package.json`
- lockfile
- `requirements.txt`
- `pyproject.toml`

---

## 現在のステータス

このプロジェクトは現在も **プロトタイピング / UI 反復中** です。
実際に触ったうえで直しやすいよう、GUI は最初から完全固定ではなく、改善しやすい構成を優先しています。

---

## 言語版

- `README_en.md` : 英語版
- `README_ja.md` : 日本語版
