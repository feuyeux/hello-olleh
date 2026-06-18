#!/bin/sh
# 自动同步多个上游仓库的源码快照。
# - 如果仓库不存在就 clone，否则 fetch + reset --hard 到指定 tag/分支。
# - 优先使用 git；克隆完成后回到 base_dir，不污染后续 repo 的 cwd。
# - 所有源码快照统一放在 sources/ 下，与 README.md 中的目录结构一致。

# 仓库及对应版本（与 README 一致；空 tag 表示取远端默认分支）
repo_specs='
openai/codex.git rust-v0.141.0
anomalyco/opencode.git v1.4.14
google-gemini/gemini-cli.git v0.47.0
nousresearch/hermes-agent.git v2026.6.5
HKUDS/nanobot.git v0.2.1
'

# base_dir 解析为脚本所在目录下的 sources/，并按需创建
script_dir="$(cd "$(dirname "$0")" && pwd)"
base_dir="$script_dir/sources"
mkdir -p "$base_dir"

failed_count=0
failed_repos=""

while read -r repo_url tag; do
    [ -n "$repo_url" ] || continue
    remote_url="https://github.com/$repo_url"
    # 从 URL 提取仓库名作为目录名
    repo_name=$(basename "$repo_url" .git)
    repo_path="$base_dir/$repo_name"

    if [ -d "$repo_path/.git" ]; then
        echo ""
        echo "=== 更新 $repo_name ($tag) ==="
        git -C "$repo_path" fetch origin --quiet --tags
        if [ -n "$tag" ]; then
            git -C "$repo_path" checkout --force "$tag" 2>/dev/null
            git -C "$repo_path" reset --hard "$tag"
        else
            # 无指定 tag，取默认分支
            remote_default=$(git -C "$repo_path" remote show origin 2>/dev/null | grep "HEAD branch" | sed 's/.*: //')
            if [ -n "$remote_default" ]; then
                git -C "$repo_path" checkout --force "$remote_default" 2>/dev/null
                git -C "$repo_path" reset --hard "origin/$remote_default"
            fi
        fi
        git -C "$repo_path" clean -fdx -e "!.gitkeep" 2>/dev/null
    elif [ -d "$repo_path" ]; then
        # 目录存在但没有 .git（如只放了 .gitkeep 占位），先清空再 clone
        echo ""
        echo "=== 准备克隆 $repo_name：清理空目录 $repo_path ==="
        rm -rf "$repo_path"
        if ! git clone --quiet "$remote_url" "$repo_path" 2>&1; then
            echo "X 克隆失败: $repo_url"
            failed_count=$((failed_count + 1))
            failed_repos="${failed_repos}${repo_url}\n"
        else
            echo "OK 克隆成功: $repo_name"
            if [ -n "$tag" ]; then
                git -C "$repo_path" checkout --force "$tag" 2>/dev/null
                git -C "$repo_path" reset --hard "$tag"
            else
                remote_default=$(git -C "$repo_path" remote show origin 2>/dev/null | grep "HEAD branch" | sed 's/.*: //')
                if [ -n "$remote_default" ]; then
                    git -C "$repo_path" checkout --force "$remote_default" 2>/dev/null
                    git -C "$repo_path" reset --hard "origin/$remote_default"
                fi
            fi
        fi
    else
        echo ""
        echo "=== 克隆 $repo_name ($tag) ==="
        if ! git clone --quiet "$remote_url" "$repo_path" 2>&1; then
            echo "X 克隆失败: $repo_url"
            echo "  可能原因:"
            echo "    - 网络连接问题"
            echo "    - 仓库地址错误或仓库不存在"
            echo "    - 没有访问该仓库的权限"
            failed_count=$((failed_count + 1))
            failed_repos="${failed_repos}${repo_url}\n"
        else
            echo "OK 克隆成功: $repo_name"
            if [ -n "$tag" ]; then
                echo "=== 切换到 $tag ==="
                git -C "$repo_path" checkout --force "$tag" 2>/dev/null
                git -C "$repo_path" reset --hard "$tag"
            else
                remote_default=$(git -C "$repo_path" remote show origin 2>/dev/null | grep "HEAD branch" | sed 's/.*: //')
                if [ -n "$remote_default" ]; then
                    git -C "$repo_path" checkout --force "$remote_default" 2>/dev/null
                    git -C "$repo_path" reset --hard "origin/$remote_default"
                fi
            fi
        fi
    fi
done <<EOF
$repo_specs
EOF

echo ""
if [ "$failed_count" -eq 0 ]; then
    echo "OK 所有仓库同步完成!"
else
    echo "X 有 $failed_count 个仓库克隆失败:"
    printf "%b" "$failed_repos" | while IFS= read -r repo; do
        [ -n "$repo" ] && echo "  - $repo"
    done
fi
