# 防災訓練・課題クラスタリング

防災訓練の課題文を日本語対応の文埋め込みに変換し、階層クラスタリングを比較する探索支援ツールです。完全自動で分類を確定するのではなく、研究者が代表文・クラスタ規模・可視化を見ながら分類体系とラベルを設計することを目的にしています。

## 処理内容

1. Excelの「課題」列から空欄でない文章を読み込む
2. `sentence-transformers` で文章をベクトル化する
3. cosine距離・average linkageの `AgglomerativeClustering` を実行する
4. クラスタ数 8, 10, 12, 15, 20 をsilhouette scoreとクラスタ規模で比較する
5. UMAPで共通の2次元座標を作り、各クラスタ数の結果を並べて可視化する
6. 各クラスタの重心に近い課題文を代表文として抽出する
7. 採用したクラスタ番号を元Excelのコピーに追加する

クラスタ番号は計算上のIDにすぎず、大小に意味はありません。また、silhouette scoreが最大の結果を既定で採用しますが、それが研究目的上の最適な分類体系とは限りません。代表文、クラスタ規模、UMAP上の重なりも合わせて判断してください。

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
- `--sheet シート名`: 対象シート
- `--text-column 課題`: 課題文の列名
- `--model モデル名`: Sentence Transformersのモデル
- `--device cpu|cuda|mps`: 推論デバイス
- `--representatives 5`: クラスタごとの代表文数
- `--force-embedding`: 保存済み埋め込みを再利用せず再計算

## 出力

`--output-dir` 以下に次を作成します。

- `cluster_evaluation.csv`: 候補ごとのcosine silhouette score、最小・最大クラスタ規模、規模の標準偏差
- `cluster_assignments_all.csv`: 各課題について全候補のクラスタ番号とUMAP座標
- `umap_cluster_comparison.png`: 全候補を同じUMAP座標上で比較した図
- `cluster_summary.xlsx`: 採用結果のクラスタ規模、代表文、研究者入力用 `cluster_name` 列
- `防災訓練_課題一覧_clustered_kN.xlsx`: 元Excelを複製し、採用結果の `cluster` と `cluster_name` を追加したファイル
- `embeddings.npz`: 同じ文章・同じモデルで再実行するときの埋め込みキャッシュ
- `run_metadata.json`: モデル、距離、linkage、採用クラスタ数などの再現用情報

## 人間によるクラスタ名の付与

1. `cluster_summary.xlsx` を開く
2. 代表文を確認し、同じ `cluster` の行すべてに同じ `cluster_name` を入力する（先頭行だけでも可）
3. 次のコマンドで結果Excelへ反映する

```bash
python apply_cluster_names.py \
  outputs/防災訓練_課題一覧_clustered_k12.xlsx \
  outputs/cluster_summary.xlsx \
  --output outputs/防災訓練_課題一覧_labeled.xlsx
```

同一クラスタに異なる名前が入力されている場合は、誤反映を防ぐためエラーになります。結果Excelの `cluster_name` 列へ直接入力しても構いません。

## 解釈上の注意

- 課題文の粒度や長さが大きく違う場合、前処理やモデル変更による感度分析を推奨します。
- UMAPは可視化用の非線形圧縮です。2次元上の距離だけでクラスタの妥当性を判断しないでください。
- silhouette scoreは候補間比較の補助指標です。小クラスタの意味、分類体系の説明可能性、研究目的との整合性を優先してください。
- 同じ設定を再現できるよう `run_metadata.json` を研究記録と一緒に保存してください。

## テスト

依存関係を導入した環境で実行します。

```bash
python -m unittest discover -s tests -v
```
