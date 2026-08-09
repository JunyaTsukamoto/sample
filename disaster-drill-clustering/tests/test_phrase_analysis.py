import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

from openpyxl import Workbook


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "analyze_issue_phrases", PROJECT_ROOT / "analyze_issue_phrases.py"
)
analysis = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = analysis
assert SPEC.loader is not None
SPEC.loader.exec_module(analysis)


class PhraseAnalysisTests(unittest.TestCase):
    def test_read_issues_uses_requested_columns(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.xlsx"
            workbook = Workbook()
            worksheet = workbook.active
            worksheet.title = "LLM分類結果"
            worksheet.append(["課題", "AI主分類名"])
            worksheet.append(["情報共有が不十分", "情報伝達・通信"])
            worksheet.append([None, "その他"])
            workbook.save(path)

            sheet, issues = analysis.read_issues(
                path, None, "課題", "AI主分類名"
            )

            self.assertEqual(sheet, "LLM分類結果")
            self.assertEqual(len(issues), 1)
            self.assertEqual(issues[0].excel_row, 2)
            self.assertEqual(issues[0].category, "情報伝達・通信")

    def test_pair_metrics_count_unique_documents(self):
        occurrences = [
            analysis.Occurrence(2, "情報伝達・通信", "a", "情報共有", "情報共有", "不十分", "不十分", "情報共有が不十分", 0, 9),
            analysis.Occurrence(2, "情報伝達・通信", "a", "情報共有", "情報共有", "不十分", "不十分", "情報共有が不十分", 0, 9),
            analysis.Occurrence(3, "情報伝達・通信", "b", "情報共有", "情報共有", "不足", "不足", "情報共有が不足", 0, 8),
            analysis.Occurrence(4, "情報伝達・通信", "c", "情報共有", "情報共有", "不十分", "不十分", "情報共有は不十分", 0, 9),
        ]

        rows = analysis.pair_rows(
            occurrences, {"情報伝達・通信": 4}, min_documents=2
        )

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["出現課題数"], 2)
        self.assertEqual(rows[0]["主分類内割合"], 0.5)
        self.assertEqual(rows[0]["Excel行"], "2;4")

    def test_kwic_keeps_original_context(self):
        occurrence = analysis.Occurrence(
            10,
            "組織体制・指揮命令",
            "本部内で役割分担が不明確なまま対応した",
            "役割分担",
            "役割分担",
            "不明確",
            "不明確",
            "役割分担が不明確",
            4,
            13,
        )

        rows = analysis.kwic_rows(
            [occurrence],
            {("組織体制・指揮命令", "役割分担", "不明確")},
            context_chars=10,
        )

        self.assertEqual(rows[0]["左文脈"], "本部内で")
        self.assertEqual(rows[0]["注目原文フレーズ"], "役割分担が不明確")
        self.assertIn("対応した", rows[0]["右文脈"])

    def test_phrase_rows_keep_singleton_surface_variants_of_repeated_pair(self):
        occurrences = [
            analysis.Occurrence(2, "情報伝達・通信", "a", "情報共有", "情報共有", "不足", "不足", "情報共有が不足", 0, 8),
            analysis.Occurrence(3, "情報伝達・通信", "b", "情報共有", "情報共有", "不足", "不足", "情報共有の不足", 0, 8),
        ]

        rows = analysis.phrase_rows(
            occurrences,
            {"情報伝達・通信": 2},
            {("情報伝達・通信", "情報共有", "不足"): 2},
        )

        self.assertEqual(len(rows), 2)
        self.assertEqual({row["原文フレーズ"] for row in rows}, {"情報共有が不足", "情報共有の不足"})
        self.assertTrue(all(row["対象―状態ペア出現課題数"] == 2 for row in rows))


if __name__ == "__main__":
    unittest.main()
