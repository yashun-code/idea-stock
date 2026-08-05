# idea-stock を自分用にセットアップする手順

思いついたことをすぐ書き留めて、スマホとPCで同じメモを見られるようにするアプリです。
この手順どおりに進めると、**あなた専用の idea-stock** ができます。あなたのメモは、このアプリを作った人を含めて誰にも見えません。

- 費用: **無料**（AIの自動整理を使う場合のみ、後述のとおり数百円/月かかります）
- 所要時間: **40分〜1時間**
- 必要なもの: GitHubアカウント、メールアドレス、ブラウザ。**ターミナル（黒い画面）は使いません。**

---

## AIに任せる場合

Claude Code や ChatGPT などを使えるなら、このファイルのURLを渡して

> このファイルの手順どおりに、私の idea-stock をセットアップして。ブラウザ操作は代わりにやってほしい。

と頼めば、ほとんどの手順を代わりにやってもらえます。ただし**アカウント作成とパスワードの入力だけは、AIは代行できません**（安全のため制限されています）。そこだけは自分で入力してください。

以下は、自分の手で進める場合の手順です。

---

## 完成すると何ができるか

- スマホで書いたメモが、PCでもすぐ見られる（逆も同じ）
- 開いたらすぐ入力欄。分類は考えず、思いついたまま書ける
- 音声入力でしゃべって書ける
- メモを横にスワイプすると削除できる
- （任意）保存すると、AIが自動でタイトル・カテゴリ・タグを付けてくれる

---

## ステップ1：コードを自分のGitHubにコピーする

1. https://github.com/yashun-code/idea-stock を開く
2. 右上の **Fork** を押す
3. 「Create fork」を押す（設定はそのままでOK）

これで `https://github.com/あなたのユーザー名/idea-stock` ができます。以降、**自分のほう**を編集していきます。

## ステップ2：アプリを公開する（GitHub Pages）

1. 自分の idea-stock リポジトリで **Settings** タブを開く
2. 左メニューの **Pages** をクリック
3. 「Build and deployment」の Source が **Deploy from a branch** になっているのを確認
4. Branch を **main** / **/(root)** にして **Save**

1〜2分待つと、同じ Pages の画面の上のほうに公開URLが出ます。

```
https://あなたのユーザー名.github.io/idea-stock/
```

**このURLをメモしておいてください。** 以降ずっと使います。

今の時点で開くとログイン画面が出ますが、まだログインはできません。次で作ります。

## ステップ3：Supabase（データの保存先）を用意する

メモをクラウドに置くための無料サービスです。

1. https://supabase.com/dashboard/sign-in を開く
2. **Continue with GitHub** でログイン（メール＋パスワードで登録すると確認メールが必要になり、つまずきやすいです。GitHubログインが早くて確実）
3. **New project** を押す

入力する内容:

| 項目 | どうする |
|---|---|
| Organization | そのままでOK |
| Project name | `idea-stock` |
| Database password | 「Generate a password」で生成し、**必ずどこかに保存**（後から見返せません。今回は使いませんが、なくすと困ります） |
| Region | **Tokyo（Northeast Asia）** があれば選ぶ。なければそのまま |

**Security（安全）の3つのチェックは、必ずこうしてください:**

| 項目 | 状態 |
|---|---|
| Enable Data API（データAPIを有効にする） | ✅ **オンのまま** |
| Automatically expose new tables（新しいテーブルを自動的に公開する） | ✅ **オンのまま** |
| Enable automatic RLS（自動RLSを有効にする） | ⬜ → ✅ **オンにする** |

> 2番目には画面上に「無効にすることをお勧めします」と書かれていますが、**このアプリではオンのままが正解**です。オフにするとアプリからデータが見えなくなります。代わりに3番目の「自動RLS」をオンにして、**本人以外は1件も読めない状態**を作ります。この2つはセットです。片方だけにしないでください。

**Create new project** を押し、準備完了まで2〜3分待ちます。

## ステップ4：メモを入れる場所を作る（SQLを1回貼るだけ）

1. 左メニューの **SQL Editor** を開く
2. 下をまるごとコピーして貼り付ける
3. **Run** を押す

```sql
-- idea-stock: メモ保存用テーブル
create table public.memos (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  text        text,
  title       text,
  category    text,
  tags        jsonb,
  status      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 行レベルセキュリティを有効にする
alter table public.memos enable row level security;

-- 「ログイン本人の行しか触れない」ルールを4つ作る
create policy read_own_memos   on public.memos for select using (auth.uid() = user_id);
create policy insert_own_memos on public.memos for insert with check (auth.uid() = user_id);
create policy update_own_memos on public.memos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy delete_own_memos on public.memos for delete using (auth.uid() = user_id);

-- 一覧の表示を速くする
create index memos_user_created_idx on public.memos (user_id, created_at desc);
```

`Success. No rows returned` と出れば成功です。

## ステップ5：自分のログインアカウントを作る

1. 左メニューの **Authentication → Users**
2. 右上の **Add user → Create new user**
3. 入力する
   - Email address: 自分のメールアドレス
   - User Password: **自分で決めたパスワード**（Supabaseの管理画面ログインとは別のものにしてください）
   - **Auto Confirm User? のチェックを必ずオンに** ← 忘れると「未確認です」と出てログインできません
4. **Create user**

**ここで決めたメールとパスワードが、アプリのログインに使うものです。** ブラウザに保存させておくと確実です。

## ステップ6：他人がアカウントを作れないようにする

アプリは公開URLに置くので、これをやらないと**URLを見つけた誰でもアカウントを作れてしまいます。**

1. 左メニューの **Authentication → Sign In / Providers**
2. **Allow new users to sign up** を**オフ**にする
3. **Save changes**

`Successfully updated settings` と出れば完了です。

> 順番が大事です。**ステップ5（自分のアカウント作成）を先に**済ませてから閉めてください。

## ステップ7：接続先を自分のものに書き換える

ここが**一番重要**です。これをやらないと、アプリは他人のデータベースを見に行ったままになり、ログインできません。

**自分の接続情報を調べる:**

Supabaseの画面上部にある **Connect** ボタンを押すと、両方まとめて出ます。見つからなければ、
- Project URL → **Settings → Data API**
- キー → **Settings → API Keys** の「API Keys」タブにある **Publishable key**（`sb_publishable_` で始まるもの）

> 同じ画面にある **Secret key** と、Legacy タブの **service_role** は使いません。**絶対に他人に見せないでください。** これらはセキュリティ設定を全部素通りできる鍵です。
> 一方、**Publishable key は公開して問題ない鍵**です。コードに直接書き込みます。守りは鍵の秘匿ではなく、ステップ4で作ったRLSが担当します。

**書き換える:**

1. 自分のGitHubリポジトリで `app.js` を開く
2. 右上の鉛筆マーク（Edit this file）を押す
3. 上から4〜5行目にある次の2行を、**自分の値に**書き換える

```js
  const SUPABASE_URL = 'https://ここが自分のプロジェクトID.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_ここが自分のキー';
```

> Project URL は `https://xxxxx.supabase.co` までです。末尾に `/rest/v1/` が付いていたら、それは消してください。

4. **Commit changes** を押す

1〜2分でアプリに反映されます。

## ステップ8：動かしてみる

1. PCのブラウザで公開URL（`https://あなたのユーザー名.github.io/idea-stock/`）を開く
2. ステップ5で決めたメールとパスワードでログイン
3. 何か書いて「保存する」を押す
4. スマホでも同じURLを開いて同じアカウントでログインし、さっきのメモが出れば**完成**です

---

## AIの自動整理を使いたい場合（任意）

保存したメモにAIが自動でタイトル・カテゴリ・タグを付ける機能です。**使わなくてもメモアプリとしては普通に動きます**（その場合メモは「未整理」と表示されるだけです）。

使う場合は、Anthropic のAPIキーが必要です。

1. https://console.anthropic.com でアカウントを作る
2. 支払い情報を登録し、少額（5ドル程度）をチャージする
3. API Keys からキーを発行する（`sk-ant-` で始まる文字列）
4. アプリの**設定**タブを開き、そのキーを貼り付ける
5. 「接続テスト」を押して `✓ 接続OK` と出れば完了

料金は使った分だけで、メモ1件の整理で0.1円もかかりません。

> **キーは端末ごとの設定です。** スマホとPCの両方で使うなら、それぞれで1回ずつ貼ってください。クラウドには保存していません（漏洩経路を増やさないためです）。

---

## つまずきポイント（先に読んでおくと得します）

### iPhone：ホーム画面に追加したアプリは、Safariと別物

iPhoneでホーム画面に追加したアプリは、**Safariで同じURLを開いた場合とデータの置き場所が分かれます。** ホーム画面アプリで書いたメモは、Safariで開くと見えません（逆も同じ）。

普段使う入り口をどちらか一方に決めてください。おすすめは、**先にSafariでログインしてから**ホーム画面に追加することです。

> ⚠️ **ホーム画面のアイコンを削除すると、その中のデータごと消える可能性があります。** 消す前に、設定タブの「メモをファイルに書き出す（バックアップ）」でバックアップを取ってください。

### 画面を更新しても新しくならないとき

このアプリはオフラインでも開けるよう、画面をスマホの中に保存しています。そのため更新がすぐ反映されないことがあります。

1. アプリを開いて10秒ほど置く
2. **完全に終了**する（iPhoneなら画面下から上にスワイプ→アプリを上にスワイプ）
3. もう一度開く

反映まで2回繰り返すことがあります。

### Supabaseの管理画面が「ブラウザの拡張機能が原因でエラー」と出る

**Chromeの自動翻訳が原因**です。Supabaseの画面と相性が悪く、日本語に翻訳すると画面が壊れます。

アドレスバー右端の翻訳アイコン → 「⋮」→ **「このサイトは翻訳しない」** を選んでください。画面は英語に戻りますが、これで安定します。

### 1週間誰も使わないと止まる

Supabaseの無料プランは、**1週間まったくアクセスがないとプロジェクトが一時停止**されます。停止するとアプリからメモが読めなくなります。

**データは消えません。** Supabaseのダッシュボードを開いて「Restore」を押せば戻ります。「急にメモが出なくなった」ときは、まずこれを疑ってください。

### そのほか

| 症状 | 原因と対処 |
|---|---|
| ログインで「メールアドレスかパスワードが違います」 | ステップ5で決めたものか確認。管理画面のパスワードと混同しがちです |
| ログインしても真っ白／メモが出ない | ステップ7の書き換え漏れ。他人のデータベースを見に行っています |
| 「未確認です」と出る | ステップ5で Auto Confirm User のチェックを入れ忘れ。ユーザーを削除して作り直すのが早いです |
| 圏外で保存できない | 仕様です。このアプリはオフライン非対応です |

---

## 仕組みを詳しく知りたい場合

同じフォルダの `CLAUDE.md` に、技術スタック・データベースの構造・設計上の注意を書いてあります。改造したいときはそちらを見てください。

なお `CLAUDE.md` に書かれている Project URL とキーは**元の作者のもの**です。自分用にコピーしたら、そこも自分の値に書き換えておくと後で混乱しません。
