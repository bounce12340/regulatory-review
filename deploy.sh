#!/bin/bash
# Deploy Regulatory Review Tool to Render

echo "🚀 開始部署 Regulatory Review Tool..."

# 檢查必要檔案
echo "📋 檢查必要檔案..."
if [ ! -f "requirements.txt" ]; then
    echo "❌ 錯誤: requirements.txt 不存在"
    exit 1
fi

if [ ! -f "render.yaml" ]; then
    echo "❌ 錯誤: render.yaml 不存在"
    exit 1
fi

echo "✅ 檔案檢查通過"

# 檢查 Git 狀態
echo "📦 檢查 Git 狀態..."
if [ -d ".git" ]; then
    git add -A
    git commit -m "Prepare for cloud deployment - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "✅ Git commit 完成"
else
    echo "⚠️  未初始化 Git，跳過 commit"
fi

# 部署指示
echo ""
echo "=================================="
echo "🎉 部署檔案準備完成！"
echo "=================================="
echo ""
echo "下一步："
echo "1. 前往 https://dashboard.render.com/"
echo "2. 點擊 'New +' → 'Blueprint'"
echo "3. 連結 GitHub Repository"
echo "4. 選擇 'regulatory-review' repository"
echo "5. Render 會自動讀取 render.yaml 並部署"
echo ""
echo "或者使用 Render CLI:"
echo "   render blueprint apply"
echo ""
echo "📚 文件: https://render.com/docs/blueprint-spec"
echo ""
