# Market Dashboard

マクロ指標の横断監視・学習用ダッシュボード。

## セットアップ

```bash
cd market-dashboard
npm install
```

## データ取得

```bash
# 依存ライブラリをインストール
pip install -r scripts/requirements.txt

# FRED APIキーを設定（金利データに必要 / 無料）
# 取得先: https://fred.stlouisfed.org/docs/api/api_key.html
cp .env.example .env
# .env を編集して FRED_API_KEY= を設定

# データ取得実行
python scripts/fetch_market_data.py
```

スクリプトを実行すると `public/data/market_latest.json` と `public/data/history/{id}.json` が更新される。

## 開発サーバー起動

```bash
npm run dev
# → http://localhost:5173
```

## データ更新の運用

毎日 `python scripts/fetch_market_data.py` を実行する。  
GitHub Actions を使う場合は `.github/workflows/fetch.yml` を追加する（別途作成）。

## 学習メモの保存

1. ダッシュボード下部のメモ欄に記入
2. 「JSON コピー」ボタンでクリップボードにコピー
3. `public/data/comments/YYYY-MM-DD.json` として保存

## ディレクトリ構成

```
market-dashboard/
├── src/
│   ├── components/   # MarketCard, CategorySection, SparklineChart, MemoEditor, CorrelationPanel
│   ├── pages/        # Home, IndicatorDetail
│   ├── types/        # TypeScript型定義
│   └── utils/        # format, ma（移動平均）
├── public/data/
│   ├── market_latest.json   # 全指標の最新値 + 30日スパークライン
│   ├── history/{id}.json    # 指標ごとの3年分履歴（詳細ページ用）
│   └── comments/YYYY-MM-DD.json
├── scripts/
│   ├── fetch_market_data.py
│   └── requirements.txt
└── .env.example
```

## 表示カテゴリ

| カテゴリ | 指標 |
|---|---|
| Equity | S&P500, NASDAQ100, ACWI, TOPIX, 日経平均 |
| Rates | 米10Y, 米2Y, 日10Y, 10Y-2Yスプレッド |
| FX | USD/JPY, EUR/USD |
| Commodity | 金, プラチナ, WTI, ブレント, 天然ガス |
| Risk | VIX |
| Energy | 天然ガス（Henry Hub）|
