# 防災訓練・課題クラスタリング

防災訓練の課題文を日本語対応の文埋め込みに変換し、階層クラスタリングを比較する探索支援ツールです。完全自動で分類を確定するのではなく、研究者が代表文・クラスタ規模・可視化を見ながら分類体系とラベルを設計することを目的にしています。

## 処理内容

1. Excelの「課題」列から空欄でない文章を読み込む
2. `sentence-transformers` で文章をベクトル化する
3. LOF（Local Outlier Factor）で外れ課題を検出し、通常のクラスタリング対象から分離する
4. 残った課題にcosine距離・average linkageの `AgglomerativeClustering` を実行する
5. クラスタ数 8, 10, 12, 15, 20 をsilhouette scoreとクラスタ規模で比較する
6. 最小クラスタ5件以上、最大クラスタ80%以下の候補だけを自動採用対象にする
7. UMAPで共通の2次元座標を作り、各クラスタ数の結果を並べて可視化する
8. 全候補の代表文を研究者が比較し、解釈可能性を記録できるExcelを出力する
9. 採用したクラスタ番号、外れ値フラグ、外れ値スコアを元Excelのコピーに追加する

クラスタ番号は計算上のIDにすぎず、大小に意味はありません。自動採用条件を満たす候補がない場合は、無理にクラスタ数を決めず「採用候補なし」と出力します。LOFの外れ値判定も最終判断ではありません。`outlier_issues.csv` を確認し、研究上重要な少数テーマが誤って除外されていないか確認してください。

## セットアップ

Python 3.10〜3.12を推奨します。Python 3.13以降では、環境によってUMAPが依存するNumbaの対応状況を確認してください。

```bash
cd /Users/tj/IdeaProjects/sample/disaster-drill-clustering
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

初回実行時はHugging Faceからモデルを取得するため、インターネット接続が必要です。既定モデルは日本語を含む多言語対応の `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` です。

## 実行

```bash
python cluster_issues.py \
  "/Users/tj/Downloads/防災訓練_課題一覧.xlsx" \
  --output-dir outputs
```

元データでは最初の「訓練の課題一覧」シートと「課題」列が自動選択されます。採用するクラスタ数を固定する場合は、次のように指定します。

```bash
python cluster_issues.py \
  "/Users/tj/Downloads/防災訓練_課題一覧.xlsx" \
  --output-dir outputs_k12 \
  --selected-k 12
```

主なオプション:

- `--cluster-counts 8 10 12 15 20`: 比較するクラスタ数
- `--selected-k auto`: 結果Excelに使うクラスタ数。`auto` はsilhouette score最大の候補
- `--min-cluster-size 5`: 自動採用候補に必要な最小クラスタ件数
- `--max-cluster-share 0.80`: 最大クラスタが全対象に占めてよい比率
- `--outlier-method lof|none`: 外れ値検出。既定は `lof`
- `--outlier-contamination 0.03`: LOFで外れ値とする比率。既定は3%
- `--outlier-neighbors 20`: LOFの近傍数
- `--sheet シート名`: 対象シート
- `--text-column 課題`: 課題文の列名
- `--model モデル名`: Sentence Transformersのモデル
- `--device cpu|cuda|mps`: 推論デバイス
- `--representatives 5`: クラスタごとの代表文数
- `--force-embedding`: 保存済み埋め込みを再利用せず再計算

## 出力

`--output-dir` 以下に次を作成します。

- `cluster_evaluation.csv`: silhouette score、クラスタ規模、最大クラスタ比率、自動候補の可否と除外理由
- `cluster_assignments_all.csv`: 各課題について外れ値情報、全候補のクラスタ番号、UMAP座標
- `outlier_issues.csv`: 外れ値らしさの高い順に並べた確認用一覧
- `umap_cluster_comparison.png`: 全候補を同じUMAP座標上で比較した図
- `cluster_review.xlsx`: 全候補の評価、代表文、解釈可能性スコア・研究者メモ・選択欄
- `cluster_summary.xlsx`: 採用結果の代表文。候補がなければ「採用候補なし」と除外理由
- `防災訓練_課題一覧_clustered_kN.xlsx`: 採用時のみ作成。`cluster`、`cluster_name`、`is_outlier`、`outlier_score` を追加
- `embeddings.npz`: 同じ文章・同じモデルで再実行するときの埋め込みキャッシュ
- `run_metadata.json`: モデル、距離、linkage、採用クラスタ数などの再現用情報

## 人間によるクラスタ名の付与

1. `cluster_review.xlsx` の `candidate_review` シートで候補の規模と除外理由を確認する
2. 各 `k_N` シートの代表文を読み、`interpretability_score_1_to_5`、メモ、選択欄を記入する
3. 採用したいクラスタ数を `--selected-k N` で再実行する。手動指定時は自動条件を満たさない候補でも出力できるが、警告が表示される
4. `cluster_summary.xlsx` の同じ `cluster` に同じ `cluster_name` を入力する（先頭行だけでも可）
5. 次のコマンドで結果Excelへ反映する

```bash
python apply_cluster_names.py \
  outputs/防災訓練_課題一覧_clustered_k12.xlsx \
  outputs/cluster_summary.xlsx \
  --output outputs/防災訓練_課題一覧_labeled.xlsx
```

同一クラスタに異なる名前が入力されている場合は、誤反映を防ぐためエラーになります。結果Excelの `cluster_name` 列へ直接入力しても構いません。

自動条件を満たす候補がない場合でも、全候補の `cluster_review.xlsx` と外れ値一覧は出力されます。代表文から研究目的に合う候補を選べた場合だけ、例えば次のように明示指定してください。

```bash
python cluster_issues.py \
  "/Users/tj/Downloads/防災訓練_課題一覧.xlsx" \
  --output-dir outputs \
  --cluster-counts 4 6 8 10 12 \
  --selected-k 8
```

## 解釈上の注意

- 課題文の粒度や長さが大きく違う場合、前処理やモデル変更による感度分析を推奨します。
- UMAPは可視化用の非線形圧縮です。2次元上の距離だけでクラスタの妥当性を判断しないでください。
- silhouette scoreは候補間比較の補助指標です。小クラスタの意味、分類体系の説明可能性、研究目的との整合性を優先してください。
- `cluster=-1` はLOFで外れ値候補とされた課題です。削除対象ではなく、別テーマまたは重要な少数事例として人間が再確認してください。
- 同じ設定を再現できるよう `run_metadata.json` を研究記録と一緒に保存してください。

## テスト

依存関係を導入した環境で実行します。

```bash
python -m unittest discover -s tests -v
```

## Gemma 4による探索的分類

階層クラスタリングとは別に、ローカルのOllamaで `gemma4:latest` を使い、固定した暫定分類体系へ分類できます。分類体系は `taxonomy.json` にあり、13の主分類、小分類、最大2件の副分類を定義しています。これは正解ラベルの自動確定ではなく、研究者が分類体系を修正するための一次コーディングです。

Ollamaを導入後、モデルを取得します（約9.6GB）。

```bash
ollama pull gemma4
```

分類を実行します。

```bash
.venv/bin/python llm_classify.py \
  "/Users/tj/Downloads/防災訓練_課題一覧_v2.xlsx" \
  --output outputs_llm/gemma4_classifications.jsonl \
  --batch-size 12
```

出力は1課題1行のJSON Lines形式です。各行に以下を記録します。

- Excel行番号と元の課題文
- 主分類コード・名称・小分類
- 最大2件の副分類コード・名称
- 信頼度、要確認フラグ、判断根拠
- 医療語や無線などに対する簡易監査警告

途中で停止しても、同じコマンドを再実行すると保存済み行を読み飛ばして再開します。初めからやり直す場合だけ `--overwrite` を付けてください。`--limit 20` や `--rows 20 55 408` で少数件の試行もできます。

### 解釈と品質管理

- `confidence` はモデルの自己評価であり、正解確率ではありません。
- `review_required=true`、監査警告あり、希少カテゴリ、複数テーマの文を優先して人手確認してください。既定では信頼度0.90未満、C13、副分類2件、監査警告を要確認にします。
- `taxonomy.json` を研究目的に合わせて改訂した場合、分類体系の版と出力を一緒に保存してください。
- 再現性のため温度0、seed 42を指定していますが、ローカル推論環境の違いで出力が完全一致しない場合があります。

## 主分類別の課題内容分析

`analyze_issue_phrases.py` は、「課題」と「AI主分類名」を使って、単語頻度では失われる「何がどう問題なのか」を原文へ戻れる形で集計します。

1. 原文フレーズ頻度: 反復する対象―状態ペアについて、文章中に実在する表現の全バリエーションを出現課題数と主分類内割合で集計
2. 対象―状態ペア: GiNZAの係り受け解析で対象と状態・述語を抽出し、最小限の表記正規化後に集計
3. KWIC: 集計された対象―状態ペアについて、前後文脈、注目原文フレーズ、課題全文、元Excel行を一覧化

セットアップ後に次のように実行します。

```bash
.venv/bin/python analyze_issue_phrases.py \
  "/Users/tj/Downloads/災害訓練ScR/課題分析/防災訓練_課題一覧_v4_gemma4分類.xlsx" \
  --output-dir outputs_phrase_analysis
```

出力:

- `00_category_counts.csv`: 主分類ごとの分析対象件数
- `01_original_phrases.csv`: 原文フレーズの頻度・割合・該当Excel行
- `02_target_state_pairs.csv`: 対象―状態ペアの頻度、割合、PMI、nPMI、Dice係数、代表原文
- `03_kwic.csv`: 全該当箇所の左文脈、注目原文、右文脈、課題全文
- `analysis_metadata.json`: 入力、件数、モデル、閾値、正規化方針

主結果は `出現課題数` と `主分類内割合` です。PMI・nPMI・Dice係数は結び付きの強さを示す補助指標であり、低頻度ペアを過大評価しないよう既定では2課題以上のペアだけを出力します。原文フレーズとKWICは正規化せず、元の文章を保持します。

主なオプション:

- `--sheet LLM分類結果`: 入力シートを明示
- `--min-documents 2`: 対象―状態ペアの最小出現課題数。原文フレーズ表には採用ペアの全表現を残す
- `--context-chars 35`: KWICの左右に残す文字数
- `--text-column 課題`: 分析する文章列
- `--category-column AI主分類名`: 比較単位の列
