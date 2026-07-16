import React, { useState } from 'react';
import { Settings, Preferences } from '@/lib/db';
import styles from './ConfigModal.module.css';

interface ConfigModalProps {
  initialSettings: Settings;
  preferences: Preferences;
  onSave: (settings: Settings) => Promise<void>;
  onResetPreferences: () => Promise<void>;
  onClose: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  initialSettings,
  preferences,
  onSave,
  onResetPreferences,
  onClose,
}) => {
  const [apiKey, setApiKey] = useState(initialSettings.geminiApiKey || '');
  const [mutationRate, setMutationRate] = useState(initialSettings.mutationRate ?? 0.08);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        geminiApiKey: apiKey.trim(),
        mutationRate: Number(mutationRate),
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('設定の保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('学習した好みスコアを初期状態（すべて 1.0）に戻しますか？')) {
      try {
        await onResetPreferences();
        alert('好みスコアをリセットしました。');
      } catch (err) {
        console.error(err);
        alert('リセットに失敗しました。');
      }
    }
  };

  // Maps score (range 0.05 to 5.0) to bar percentage width.
  // Standard weight is 1.0. Let's make 2.5 reflect 100% capacity width representation.
  const getBarWidth = (score: number) => {
    const maxVal = 2.5;
    const percentage = Math.min(100, (score / maxVal) * 100);
    return `${percentage}%`;
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>⚙️ アプリ設定</h2>
          <button onClick={onClose} className={styles.closeBtn} title="閉じる" aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.body}>
            {/* Gemini API Key */}
            <div className={styles.section}>
              <label className={styles.label} htmlFor="apiKey">
                Gemini API キー
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className={styles.input}
              />
              <p className={styles.helpText}>
                ※ 記事の自動要約やAIアシスタントとのチャットに使用します。APIキーを設定しない場合は、自動的にデモ用モック要約/モック応答が生成されます。
              </p>
            </div>

            {/* Mutation Rate */}
            <div className={styles.section}>
              <label className={styles.label}>
                突然変異率（多様性・セレンディピティ確保）
              </label>
              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  min="0"
                  max="0.30"
                  step="0.01"
                  value={mutationRate}
                  onChange={e => setMutationRate(parseFloat(e.target.value))}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>
                  {Math.round(mutationRate * 100)}%
                </span>
              </div>
              <p className={styles.helpText}>
                表示スコアの低いカテゴリの記事をあえて混ぜる確率です。数値を上げると、フィルターバブルを防ぎ、普段見ないジャンルの「意外な兆し」を発見しやすくなります（推奨: 5%〜10%）。
              </p>
            </div>

            {/* Preference Visualizer */}
            <div className={styles.section}>
              <label className={styles.label}>学習されたあなたの好み（カテゴリ）</label>
              <p className={styles.helpText}>
                👍/👎 ボタンの押下によって緩やかに指数移動平均 (EMA) で更新されます。スコアが高いカテゴリが優先表示されます。
              </p>
              <div className={styles.prefList}>
                {Object.entries(preferences.categories).map(([cat, score]) => (
                  <div key={cat} className={styles.prefItem}>
                    <span className={styles.prefName}>{cat}</span>
                    <div className={styles.prefBarContainer}>
                      <div
                        className={styles.prefBar}
                        style={{ width: getBarWidth(score) }}
                      ></div>
                    </div>
                    <span className={styles.prefValue}>{score.toFixed(2)}x</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleReset}
                className={styles.resetBtn}
              >
                好みの学習を初期化する
              </button>
            </div>
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              onClick={onClose}
              className={`${styles.btn} ${styles.btnCancel}`}
              disabled={saving}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnSave}`}
              disabled={saving}
            >
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default ConfigModal;
