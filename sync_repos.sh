#!/bin/bash
# 自动同步多个仓库的Bash脚本
# 如果仓库不存在就clone，否则pull
# 优先使用gh命令，没有则使用git

failed_clones=()

# 仓库及对应版本（与 README 一致）
declare -A repo_tags=(
    ["openai/codex.git"]="rust-v0.118.0"
    ["anomalyco/opencode.git"]="v1.3.2"
    ["google-gemini/gemini-cli.git"]="v0.36.0"
    # ["openclaw/openclaw.git"]=""  # 不在分析范围内
    # ["anthropics/claude-code.git"]=""  # claude-code 为本地已有目录，非远程仓库
    # ["zeroclaw-labs/zeroclaw.git"]=""  # 不在分析范围内
)

base_dir="$(pwd)"

for repo_url in "${!repo_tags[@]}"; do
    tag="${repo_tags[$repo_url]}"
    # 从URL提取仓库名作为目录名
    repo_name=$(basename "$repo_url" .git)
    repo_path="$base_dir/$repo_name"

    if [ -d "$repo_path" ]; then
        echo ""
        echo "=== 更新 $repo_name ($tag) ==="
        cd "$repo_path"
        git fetch origin --quiet
        if [ -n "$tag" ]; then
            git checkout --force "$tag" 2>/dev/null
            git reset --hard "$tag"
        else
            # 无指定 tag，取默认分支
            remote_default=$(git remote show origin 2>/dev/null | grep "HEAD branch" | sed 's/.*: //')
            if [ -n "$remote_default" ]; then
                git checkout --force "$remote_default" 2>/dev/null
                git reset --hard "origin/$remote_default"
            fi
        fi
        git clean -fdx -e "!/.gitkeep" 2>/dev/null
    else
        echo ""
        echo "=== 克隆 $repo_name ($tag) ==="
        if ! git clone "$repo_url" "$repo_path" 2>&1; then
            echo "✗ 克隆失败: $repo_url"
            echo "  可能原因:"
            echo "    - 网络连接问题"
            echo "    - 仓库地址错误或仓库不存在"
            echo "    - 没有访问该仓库的权限"
            failed_clones+=("$repo_url")
        else
            echo "✓ 克隆成功: $repo_name"
            cd "$repo_path"
            if [ -n "$tag" ]; then
                echo "=== 切换到 $tag ==="
                git checkout --force "$tag" 2>/dev/null
                git reset --hard "$tag"
            fi
        fi
    fi
done

echo ""
if [ ${#failed_clones[@]} -eq 0 ]; then
    echo "✓ 所有仓库同步完成!"
else
    echo "✗ 有 ${#failed_clones[@]} 个仓库克隆失败:"
    for repo in "${failed_clones[@]}"; do
        echo "  - $repo"
    done
fi
