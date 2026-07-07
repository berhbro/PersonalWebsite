# PersonalWebsite

一个使用 Python、Flask、纯 HTML、CSS 和少量 JavaScript 搭建的个人网站。

## 功能

- 个人简介名片
- Demo 作品集
- Blog 列表与详情页
- 相册轮播与相册详情页
- 酷狗音乐组件
- GitHub、Bilibili、QQ 邮箱链接

## 运行

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

启动后访问：

```text
http://127.0.0.1:5000
```

## Cloudflare Pages 自动部署

这个项目可以静态导出后部署到 Cloudflare Pages。推荐配置：

- Framework preset：`None`
- Build command：`python -m pip install -r requirements.txt && python build_static.py`
- Build output directory：`dist`
- Root directory：留空

本地测试静态构建：

```bash
python build_static.py
```

构建成功后会生成：

```text
dist/
```

Cloudflare 连接 GitHub 仓库后，每次 `git push` 都会自动运行构建并部署。

注意：Cloudflare Pages 不直接运行 Flask 后端，所以部署时使用 `build_static.py` 把 Flask 页面导出成静态 HTML。音乐歌单会导出为 `dist/api/music/playlist.json`，本地音乐文件会从 `static/music/` 一起复制。

## Cloudflare Worker 部署

也可以使用 Cloudflare Workers Static Assets 部署。这个方式仍然不是在 Worker 里直接运行 Flask，而是先用 `build_static.py` 导出静态站点，再由 Worker 托管 `dist/`。

本地部署命令：

```bash
python -m pip install -r requirements.txt
python build_static.py
npx wrangler deploy
```

如果在 Cloudflare 控制台连接 GitHub 仓库创建 Worker，推荐配置：

- Build command：`python -m pip install -r requirements.txt && python build_static.py`
- Deploy command：`npx wrangler deploy`
- Wrangler config：`wrangler.jsonc`

项目里的 `src/worker.js` 会优先读取静态资源，并为 `/demos`、`/gallery`、`/blog/文章slug` 这类无 `.html` 后缀的路径自动匹配对应的 `index.html`。

注意：如果 `static/music/` 里的本地音乐文件很大，可能会受到 Cloudflare 单文件大小或账号套餐限制影响；上线失败时可以把音乐文件改成外链 CDN，再在 `content/music_playlist.json` 中填写 `audio_url`。

## 更新个人信息

在 `app.py` 中修改 `profile`：

```python
profile = {
    "name": "done",
    "title": "Python / Flask 开发者",
    "summary": "你的个人简介",
    "skills": ["Python", "Flask", "HTML", "CSS"],
    "github": "https://github.com/你的账号",
    "bilibili": "https://space.bilibili.com/你的ID",
    "qq_email": "你的QQ邮箱",
}
```

## 更新 Demo 作品集

编辑：

```text
content/demos.json
```

示例：

```json
[
  {
    "slug": "personal-website",
    "name": "个人网站",
    "description": "基于 Flask 的个人主页",
    "tags": ["Flask", "HTML", "CSS"],
    "github": "https://github.com/berhbro/your-project",
    "video": {
      "type": "file",
      "url": "/static/videos/demo.mp4",
      "title": "项目演示视频"
    },
    "document": [
      "这里写项目背景。",
      "这里写功能介绍、运行方式或技术亮点。"
    ]
  }
]
```

字段说明：

- `slug`：作品锚点链接，例如 `/demos#personal-website`
- `github`：GitHub 仓库地址，留空则不显示 GitHub 按钮
- `video.type`：`file` 表示直接播放视频文件，`embed` 表示使用嵌入链接
- `video.url`：视频地址，留空则显示“暂无演示视频”
- `document`：项目文档段落列表，会展示在作品库页面

## 更新 Blog

在下面目录新增 Markdown 文件：

```text
content/blogs/
```

示例：

```markdown
---
title: 我的第一篇博客
date: 2026-07-07
slug: first-blog
excerpt: 这是一篇博客摘要。
---

这里写正文内容。

空一行会变成新的段落。
```

字段说明：

- `title`：文章标题
- `date`：发布日期，建议使用 `YYYY-MM-DD`
- `slug`：文章链接，例如 `/blog/first-blog`
- `excerpt`：首页展示的摘要

## 更新相册

把图片放进：

```text
static/images/album/
```

支持 `.jpg`、`.jpeg`、`.png`、`.webp`、`.gif`。刷新页面后会自动显示。

## 更新音乐歌单

编辑：

```text
content/music_playlist.json
```

推荐方式：把音乐文件放进 `static/music/`，然后在歌单里写本地路径：

```json
[
  {
    "title": "我的音乐",
    "artist": "歌手名",
    "audio_url": "/static/music/song.mp3",
    "cover": "/static/images/avatar.jpg"
  }
]
```

也可以使用酷狗 `hash`，程序会尝试解析播放链接：

```json
[
  {
    "title": "这世界那么多人",
    "artist": "赵海洋",
    "hash": "341af4ba2e76cd5286a584456e413919",
    "album_id": "",
    "cover": ""
  }
]
```

说明：

- `audio_url`：最稳定，推荐使用本地 `/static/music/xxx.mp3`
- `hash`：使用酷狗解析，可能受版权限制影响
- 播放器会按照歌单顺序循环播放
