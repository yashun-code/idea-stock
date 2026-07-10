# idea-stock — アイデアメモアプリ

思いついたアイデア・考えたことをすぐ書き留めて、AIが自動でタグ付け・分類してくれる個人用メモアプリ。

## 想定ユーザー
本人（1人）のみ。スマホから使う。

## コンセプト
- **書くのは一瞬**: 開いたらすぐ入力欄。書いて保存するだけ。分類はしない。
- **整理はAI任せ**: 保存時にClaude APIがタイトル・カテゴリ・タグを自動付与。
- **後から見返す**: カテゴリ・タグで絞り込んで一覧できる。

## 技術スタック
- HTML/JS のPWA（単一ページ、ビルド不要）
- データ保存: ブラウザのlocalStorage（キー: `ideastock_memos`, `ideastock_apikey`）
- AI整理: Claude API（ブラウザから直接呼び出し、モデル claude-haiku-4-5、APIキーは設定画面でlocalStorageに保存）
- 音声入力: Web Speech API（非対応端末はキーボードのマイク案内）

## 状態
実装済み・公開中。

- 公開URL（スマホはこれを開く）: https://yashun-code.github.io/idea-stock/
- リポジトリ: https://github.com/yashun-code/idea-stock

## 起動方法（ローカル確認）
```
python3 -m http.server 8642 --directory .
```
→ http://localhost:8642/ を開く

## フォルダ
- `index.html` / `app.js` / `styles.css` / `manifest.json` / `sw.js` / `icon.svg` — アプリ本体
- `memo-ai-icon-1024.png` — アプリアイコンの元画像（ユーザー作成、1024×1024）
- `icon-180.png` / `icon-192.png` / `icon-512.png` — 元画像から縮小したアイコン（180=apple-touch-icon、192/512=manifest）
- `mockups/` — 画面モックアップ（HTML、実装の元）

## 残課題
なし（apple-touch-iconのPNG化は対応済み）
