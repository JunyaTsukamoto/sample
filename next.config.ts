import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ホームディレクトリ直下の無関係な package-lock.json をワークスペースルートと
  // 誤認識させないよう、このプロジェクトのディレクトリを明示的に指定する。
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
