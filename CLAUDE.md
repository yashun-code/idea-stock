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
- データ保存: Supabase（Postgres）。スマホ・PCなどログインした全端末で同じメモを共有する
- ログイン: Supabase Auth（メール＋パスワード）。アプリ内に新規登録画面はなく、サーバー側でsign upを無効化済み。ユーザー追加はSupabaseダッシュボードから行う
- AI整理: Claude API（ブラウザから直接呼び出し、モデル claude-haiku-4-5、APIキーは設定画面でlocalStorageに保存）
- 音声入力: Web Speech API（非対応端末はキーボードのマイク案内）
- オフライン非対応（圏外では保存できない。上部にオレンジの帯を出す）

## Supabase

- Project URL: `https://awqjhdihhwfijceurwya.supabase.co`
- Publishable key: `sb_publishable_atCYSxQQ39TktHIuvAHPBg_YPKK5FcV`
- この2つは公開前提の値なので `app.js` に直接埋め込んでいる。守りは鍵の秘匿ではなくRLSが担当する
- `public.memos` テーブル: `id`(uuid,PK) / `user_id`(uuid, default `auth.uid()`) / `text` / `title` / `category` / `tags`(jsonb) / `status` / `created_at` / `updated_at`
- RLS有効。select/insert/update/delete の4ポリシーがすべて `auth.uid() = user_id` の行だけを許可
- **`service_role` キーとSecret keyはこのアプリでは一切使わない。コードにもドキュメントにも書かないこと**

### localStorage に残るもの
- `ideastock_apikey` — Claude APIキー（端末ごと。クラウドには置かない）
- `ideastock_memos` — クラウド移行前の旧メモ。**移行後もバックアップとして残してある。消さないこと**
- `ideastock_migrated` — 移行済みフラグ

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
- `mockups/` — 画面モックアップ（HTML、実装の元）。`sync-mockup.html` はログイン・移行ダイアログ・設定画面の見た目の正本

## iPhoneでの注意（実機で確認済み）

- **ホーム画面に追加したアプリと、Safariでこの公開URLを開いた場合とで、localStorageが別物になる。** 旧バージョンのメモはホーム画面アプリ側にしかないので、クラウド移行のダイアログはホーム画面アプリで開かないと出てこない。
- **ホーム画面のアイコンを消すと、その中のlocalStorageごと消える可能性がある。** 移行前に消さないこと。
- 更新を反映させる手順: ホーム画面アプリを開く→10秒待つ→アプリスイッチャーから完全終了→もう一度開く。反映まで2回かかることがある。`sw.js` の `CACHE_NAME` を上げていないと永遠に反映されない。
- レイアウトは `main` だけが内部スクロールする構造にしてある（`body`と`.phone`は`overflow: hidden`＋`100dvh`）。**ナビゲーションを `position: fixed` に戻すと、iOSで本文と一緒にスクロールして崩れる。**

## 残課題
なし
