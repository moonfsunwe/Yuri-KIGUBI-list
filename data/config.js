/* 站点全局配置 —— 部署前请修改 feedback 相关字段（数据提交后端） */
(function () {
  "use strict";

  window.KIGUBI_CONFIG = {
    siteName: "KIGUBI LIST",
    siteSubtitle: "漫画亲吻 · ちくび信息索引",

    feedback: {
      enabled: true,
      backend: "githubIssue",

      // GitHub Issue 提交（backend = "githubIssue" 时使用）
      // 格式：拥有者/仓库名，例如 "kigubi/list"
      githubIssueRepo: "moonfsunwe/Yuri-KIGUBI-list",

      // 「前往百合会提交」按钮要打开的 Discuz! 发帖基础地址；
      // 点击按钮时会自动在 URL 后追加 subject/message 预填（action=reply 时只追加 message）。
      lilySubmitUrl: "https://bbs.yamibo.com/forum.php?mod=post&action=reply&fid=5&tid=575418&fromuid=705003"
    },

    footerNote:
      "本站为爱好者整理的检索索引：只收录信息，不提供资源。数据以仓库文件为准，由维护者审核后上架。"
  };
})();