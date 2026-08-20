# KIGUBI LIST

漫画亲吻/露点场景**信息索引**，目标部署到 **GitHub Pages**。

- 按漫画 → 按章节，分别列出亲吻场景与露点场景
- 只有信息：角色 / 文字描述
- 不提供资源、下载链接与具体场景图片（漫画允许展示封面图）
- 支持漫画搜索（标题、作者、章节、角色、场景描述）
- 首页条件筛选：连载中 / 已完结 / 有亲吻 / 有露点（连载中与已完结互斥）
- 章节记录支持折叠模式（默认，只显示话数色块）与详细模式（完整文字记录）；支持 5.5 这样的特典章节（order 写 5.5）
- 支持用户提交数据：分「新增漫画」和「修改已有漫画」两类；新增漫画填写标题/日文原名/别名/连载状况/作者/几章并编辑章节色块，可在相邻整数章节间插入 .5 特典章节，且不允许整部漫画全部为未知；修改已有漫画可逐章修改色块、插入 .5 特典章节并注明原因，Issue/邮件中会带原样和改后对照；佐证图片选填，每张必须备注对应章节
- 详情页提供「修改这部漫画的场景记录」入口，并带剧透警告提示

## 文件结构

```
index.html          列表页（搜索 / 条件筛选 / 排序）
manga.html          详情页（?id=slug，章节折叠/详细模式）
feedback.html       数据提交页（文字 + 图片佐证）
admin.html          审核与上架流程（纯文本，非网页）
404.html
data/
  config.js         站点配置 + 数据提交后端配置（首次部署必须改）
  manga-data.js     全部漫画/章节/场景数据（日常维护只改这里）
assets/
  css/style.css
  js/app.js         公共工具与渲染
  js/index.js       列表页逻辑
  js/manga.js       详情页逻辑
  js/feedback.js    数据提交逻辑
  covers/           漫画封面（可继续添加 jpg/png/webp）
```

## 首次部署

1. 把仓库推到 GitHub，在 Settings → Pages 中开启 GitHub Pages（Source 选 `main` 分支根目录 `/`）。
2. 配置数据提交通道：打开 `data/config.js`：
   - **GitHub Issue（默认，无 Token 暴露风险）**：在仓库中先创建 `submission`、`pending`、`approved` 三个标签；设置 `backend: "githubIssue"`，把仓库路径填入 `feedback.githubIssueRepo`（如 `owner/repo`）。访客提交时前端只生成 GitHub Issue URL，确认后跳到 GitHub 提交。
   - 或 **Web3Forms**（免费额度带附件）：去 <https://web3forms.com> 用邮箱领取 Access Key，设置 `backend: "web3forms"` 并填入 `feedback.web3formsAccessKey`。
   - 或 **Formspree**：创建表单后，设置 `backend: "formspree"` 并填入 `feedback.formspreeEndpoint`。
3. 把 `data/manga-data.js` 里的 3 条示例数据替换成你整理的真实条目（或在上面继续增删改）。
4. 提交推送。数据提交页的提交按钮会在配置完成后自动启用。

## 数据维护

每个漫画的结构：

```js
{
  slug: "manga-slug",            // 唯一，出现在 URL 里
  title: "作品名",
  altTitles: ["别名"],
  author: "作者",
  status: "连载中",              // “连载中”会命中首页的“连载中”筛选
  cover: "assets/covers/xxx.jpg", // 封面允许放图；无封面可留空
  description: "一句话介绍",
  demo: true,                    // 首页会显示“示例”角标
  updatedAt: "2025-08-15",
  chapters: [
    {
      id: "ch1",
      title: "第1话 …",
      order: 1,
      note: "可选：章节备注（折叠模式会显示提示，并在悬停框中展示）",
      kissUnknown: true,             // 可选：true 表示亲吻情况未知（折叠模式显示问号）
      nudityUnknown: false,          // 可选：true 表示露点情况未知
      kiss: [
        { characters: "A × B", note: "情境与镜头描述" }
      ],
      nudity: [
        { characters: "A", note: "情境与镜头描述，禁止放图" }
      ]
    }
  ]
}
```

字段说明：

- `note`：只写文字描述。**不要**在 `note` 或任何字段里放图片外链、图床地址、资源链接。
- `cover`：唯一允许的场景外图片。建议把封面放在 `assets/covers/`。
- 场景条目不再记录页码 / 时间点；如果需要定位，可把位置信息写在 `chapter.title` 或 `note` 的自然语言里。

## 审核用户提交的数据

1. 用户通过 `feedback.html` 提交：
   - **GitHub Issue 模式**：前端把表单整理成 Issue 标题/正文并生成 URL；用户在确认框点击后进入 GitHub Issue 页面，手动拖入佐证图片并 <code>Submit new issue</code>。Issue 会自动带上 `submission`、`pending` 标签。
   - **邮箱模式**：表单服务把内容和图片发到你的邮箱。
2. 管理员在 GitHub / 邮箱中审核：把 Issue 的 `pending` 标签改为 `approved` 并关闭；核对漫画、章节、图片。
3. 把通过的文字信息写入 `data/manga-data.js` 对应条目。
4. 推送部署后全站自动更新。佐证图片不进入仓库、不展示。

详细的配置与审核说明见 `admin.html`。

## 本地预览

纯静态站点，直接双击 `index.html` 即可打开（数据以 JS 文件加载，无构建步骤）。

也可以跑本地服务器：

```bash
python -m http.server 8080
# 打开 http://localhost:8080
```

## 内容边界

- ✅ 允许：封面图、章节号、角色名、文字描述
- ❌ 不允许：具体场景图片、露点截图、漫画资源/下载链接、图床外链

本站只做检索信息，不做资源分发。