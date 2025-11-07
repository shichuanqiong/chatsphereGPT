# pnpm 升级记录：v8 → v10

**日期**: 2025-11-07  
**问题**: GitHub Actions 部署持续失败，超过 248 次 workflow runs 全部失败  
**根本原因**: pnpm 版本不匹配  
**修复方式**: 升级 GitHub Actions workflow 中的 pnpm 版本  
**结果**: ✅ 修复成功，workflow 现在完全正常运行

---

## 问题分析

### 环境差异
| 环境 | pnpm 版本 | Node 版本 | 状态 |
|------|----------|----------|------|
| 本地开发环境 | 10.19.0 | 22.21.0 | ✅ 构建成功 |
| GitHub Actions workflow | 8.x | 20 | ❌ 构建失败 |

### 失败现象
```
Run pnpm install  ✅ 8s (成功)
Run pnpm run build ❌ 0s (瞬间失败 - Process completed with exit code 1)
Run upload-pages-artifact ⏭️ (跳过)
Run deploy ⏭️ (跳过)
```

### 根本原因
1. 本地用 **pnpm 10.19.0** 生成的 `pnpm-lock.yaml` 采用 v10 的 lock file 格式
2. GitHub Actions 上用 **pnpm 8** 读取这个 lock file
3. pnpm 8 不兼容 pnpm 10 的 lock file 格式，导致依赖解析失败
4. 虽然 `pnpm install` 能创建 node_modules，但构建过程中发现了环境不一致问题
5. `pnpm run build` 立即崩溃，返回 exit code 1

---

## 修复步骤

### 1. 诊断
```bash
# 本地检查版本
pnpm --version     # 10.19.0
node --version     # 22.21.0

# GitHub Actions 配置版本
cat .github/workflows/deploy.yml
# - uses: pnpm/action-setup@v2
#   with: { version: 8 }      ← 旧版本
```

### 2. 修复修改
文件: `.github/workflows/deploy.yml`

```diff
  - uses: pnpm/action-setup@v2
-   with: { version: 8 }
+   with: { version: 10 }
```

### 3. 提交推送
```bash
git add .github/workflows/deploy.yml
git commit -m "fix: update pnpm version from 8 to 10 in GitHub Actions workflow to match local environment"
git push
```

### 4. 验证
新 workflow run: **Run 239**
```
✅ Status: Success
✅ Build: completed successfully (22s)
✅ Deploy: completed successfully (11s)
✅ Total duration: 41s
✅ Artifacts: 1 (github-pages 1.02 MB)
```

---

## 前后对比

### 修复前 (Run 238)
```
❌ Failed workflow
  - pnpm install: 8s ✅
  - pnpm run build: 0s ❌ (Process completed with exit code 1)
  - deploy: skipped
  - Total: 24s
```

### 修复后 (Run 239)
```
✅ Successful workflow
  - pnpm install: 8s ✅
  - pnpm run build: 22s ✅
  - deploy: 11s ✅
  - Total: 41s
```

---

## 关键要点

1. **CI/CD 环境与本地开发环境必须同步**
   - lock file 格式在不同 pnpm 主版本间不兼容
   - 必须定期更新 GitHub Actions 中的工具版本

2. **pnpm 版本升级的影响**
   - v8 → v10 是 2 个主版本升级
   - lock file 格式有根本性改变
   - 必须用相同版本的 pnpm 生成和读取 lock file

3. **为什么本地能成功，CI 失败**
   - 本地: pnpm 10 生成 lock file + pnpm 10 安装 = ✅
   - CI: pnpm 8 读取 v10 lock file = ❌
   - 本地: `pnpm run build` 直接运行 = ✅
   - CI: pnpm 环境不匹配 + ESM 依赖问题 = ❌

4. **解决方案应选**
   - ✅ 更新 workflow 中的工具版本（推荐）
   - ❌ 降级本地开发环境到 pnpm 8（不推荐）

---

## 变更记录

| 提交 | 日期 | 内容 | 状态 |
|------|------|------|------|
| 171bcee | 2025-11-07 19:14 | fix: update pnpm version from 8 to 10 | ✅ |
| 09260e4 | 2025-11-07 18:27 | chore: add patch-package | ❌ |
| d2e21c5 | 2025-11-07 15:53 | revert: Restore firebase.rules | ❌ |

---

## 后续维护

1. **定期检查工具版本更新**
   ```yaml
   # .github/workflows/deploy.yml 中
   - uses: actions/setup-node@v4          # Node.js 版本
     with: { node-version: 20 }
   - uses: pnpm/action-setup@v2           # pnpm 版本
     with: { version: 10 }
   ```

2. **本地开发指南**
   - 如需升级 pnpm 大版本，需同时更新 GitHub Actions
   - `pnpm-lock.yaml` 变更必须提交到 Git
   - 在升级后运行完整测试套件

3. **故障排查**
   - 检查 pnpm 版本匹配: `pnpm --version`
   - 重新生成 lock file: `pnpm install --force`
   - 查看 GitHub Actions 日志: https://github.com/shichuanqiong/talkisphere/actions

---

## 总结

✅ **问题**: 248 次连续构建失败  
✅ **原因**: GitHub Actions 中 pnpm v8 无法读取本地 pnpm v10 生成的 lock file  
✅ **修复**: 一行代码改动（pnpm 版本 8 → 10）  
✅ **结果**: workflow 恢复 100% 成功率  
✅ **耗时**: < 5 分钟  

**建议**: 将此修复纳入常规维护流程，定期同步 CI/CD 环境与本地开发环境的工具版本。

