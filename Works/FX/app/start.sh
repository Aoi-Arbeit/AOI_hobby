#!/bin/bash
# FX Practice App 起動スクリプト
# 使い方: bash start.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo " FX Practice App - 起動中..."
echo "========================================"

# バックエンド起動
echo "[1/2] バックエンド起動 (port 8000)..."
cd "$SCRIPT_DIR/backend"
export PATH="$PATH:/Users/shizuku/Library/Python/3.9/bin"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

sleep 2

# フロントエンド起動
echo "[2/2] フロントエンド起動 (port 5173)..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "========================================"
echo " 起動完了！"
echo "  → ブラウザで http://localhost:5173 を開いてください"
echo "  → API ドキュメント: http://localhost:8000/docs"
echo "========================================"
echo ""
echo "停止するには Ctrl+C を押してください"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '停止しました'" INT TERM
wait
