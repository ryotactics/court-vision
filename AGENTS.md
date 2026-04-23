# Court Vision — AGENTS.md

AI エージェント（Codex・Claude Code 等）がこのリポジトリで作業するための指示書。

---

## プロジェクト概要

**バスケットボール戦術分析専用の動画編集アプリ**。
コーチ・アナリストが試合映像を読み込み、プレイをクリップ・マーキング・アノテーションして戦術分析を行う。

詳細は `CLAUDE.md` を参照。

---

## 作業前に必ず確認すること

1. `CLAUDE.md` — アプリ目的・UX 原則・実装ルール
2. `src/types/index.ts` — 全ドメイン型定義の唯一の真実
3. `src/store/projectStore.ts` — 状態管理の中心
4. 関連コンポーネントのソースを読んでから変更する

---

## ファイル構成

```
src/
  types/index.ts                  # 型定義（変更時は影響範囲を確認）
  db/
    schema.ts                     # IndexedDB スキーマ（idb）
    projectRepository.ts          # CRUD
  store/
    projectStore.ts               # Zustand ストア
  hooks/
    useAutoSave.ts                # デバウンス自動保存
    useVideoFile.ts               # File → ObjectURL ライフサイクル
    useFileSystemAccess.ts        # File System Access API
  components/
    FileImporter/FileImporter.tsx
    VideoPlayer/VideoPlayer.tsx
    Timeline/Timeline.tsx
    AnnotationCanvas/AnnotationCanvas.tsx
    SaveIndicator/SaveIndicator.tsx
  App.tsx                         # レイアウト統合
  App.css                         # 全スタイル（CSS変数ベース）
  index.css                       # リセット + 変数定義
```

---

## 絶対に守るルール

### メモリ安全（3GB 動画対応）

```
✅ URL.createObjectURL(file)   — ファイル参照のみ、メモリコピーなし
✅ <video preload="metadata">  — メタデータのみ先読み

❌ file.arrayBuffer()          — 全データをメモリ展開（禁止）
❌ FileReader.readAsDataURL()  — base64 で約 4GB になる（禁止）
❌ new Blob([file])            — コピー生成（禁止）
❌ <video preload="auto">      — 大量先読みが走る（禁止）
```

### 状態管理

```
✅ FileSystemFileHandle は useRef で管理（Zustand ストアに入れない）
✅ useAutoSave の useEffect cleanup で clearTimeout を必ず呼ぶ
✅ アノテーション座標は正規化（0〜1）で保存
```

### スタイル

```
✅ CSS 変数（var(--accent) 等）を使う — index.css で定義済み
✅ App.css に既存クラスがないか確認してから追加
❌ インラインスタイルで色を直書きしない
❌ Tailwind・CSS Modules は使わない（素の CSS）
```

---

## CSS 変数リファレンス

```css
--bg:            #08080f   /* アプリ背景 */
--panel:         #0f0f18   /* パネル背景 */
--panel-header:  #1a1a28   /* パネルヘッダー */
--border:        #1e1e30   /* 薄いボーダー */
--border-mid:    #28283c   /* 中程度ボーダー */
--border-strong: #36364e   /* 強いボーダー */
--text:          #b8b8d0   /* 本文 */
--text-h:        #e8e8ff   /* 見出し・強調 */
--muted:         #5a5a78   /* 補助テキスト */
--accent:        #7c3aed   /* 紫アクセント（ボタン・ハイライト） */
--accent-hover:  #8b5cf6
--accent-light:  #a78bfa   /* 薄い紫（アイコン・ラベル） */
--accent-soft:   #1a0f35   /* 紫の背景トーン */
--green:         #10b981   /* 保存済み・成功 */
--amber:         #f59e0b   /* 保存中・警告 */
--red:           #ef4444   /* エラー・削除 */
```

---

## 作業後に必ず実行すること

```bash
npm run build   # TypeScript 型チェック + Vite ビルド
```

エラーが 0 件であることを確認してから完了とする。

---

## バスケ文脈でのデザイン指針

- **暗い環境**（ロッカールーム・会議室）での使用を想定 → コントラスト重視
- フォントサイズ最小 11px、ラベルは読みやすく
- マーカー色はプレイ種別を示す（緑=得点、赤=ターンオーバー、青=ディフェンス）
- パネル幅 190px を維持してビューアーを最大化
- 「クリップ一覧で素早くシーク → 映像確認 → アノテーション」のフローを最短に

---

## 今後の実装予定（優先度順）

1. バスケ専用マーカーラベルプリセット（3PT / Fast Break / Turnover / Defense 等）
2. タイムライン上のクリップをドラッグで範囲調整
3. コート図オーバーレイ（ハーフコートの背景レイヤー）
4. プレイヤーナンバータグ（アノテーションの拡張）
5. クリップエクスポート（ffmpeg.wasm）
