# GitHub Pages 作业版本

此版本从项目内容生成独立的静态站点，不改变 Cloudflare 的构建和部署。

1. 将本目录和 `.github/workflows/github-pages.yml` 提交并推送到 GitHub 仓库的 `main` 分支。
2. 打开 GitHub 仓库的 Settings → Pages，在 Build and deployment 的 Source 选择 **GitHub Actions**。
3. 在 Actions 页面运行或查看 `Deploy GitHub Pages` 工作流。发布成功后访问 `https://berhbro.github.io/PersonalWebsite/`。

之后推送到 `main` 时会重新构建。可在电脑上运行：

```bash
python -m pip install -r requirements.txt
python github-pages/build.py --base-path /PersonalWebsite
```

输出位于 `github-pages/dist/`。GitHub Pages 托管静态文件，不能运行 Flask 和 Cloudflare 的后台登录函数；发布内容请修改仓库里的文件并推送。大于 25 MiB 的静态文件沿用现有构建规则，会被跳过。
