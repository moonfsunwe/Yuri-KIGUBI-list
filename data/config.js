/* 站点全局配置 —— 部署前请修改 feedback 相关字段（数据提交后端） */
(function () {
  "use strict";

  window.KIGUBI_CONFIG = {
    siteName: "KIGUBI LIST",
    siteSubtitle: "漫画亲吻 · ちくび信息索引",
    siteDescription:
      "按漫画、按章节收录亲吻场景与ちくび的信息。只提供角色与文字描述，不提供资源、链接或具体场景图片（漫画封面除外）。",

    adultNotice:
      "本站部分条目涉及成人向的ちくび信息记录，不展示任何对应图片。请在确认自己已成年、且所在地允许访问此类信息后继续浏览。",

    feedback: {
      /**
       * 数据提交后端三选一：
       *  - "githubIssue"：把表单整理为 GitHub Issue URL，访客确认后打开
       *    GitHub 新 Issue 页面提交（不暴露任何 Token，安全性最好）。
       *    需要先把仓库地址填到 githubIssueRepo，并在仓库中建好
       *    submission / pending / approved 三个标签。
       *  - "web3forms"：访问 https://web3forms.com 用邮箱领取 Access Key，
       *    适合邮箱接收投稿。
       *  - "formspree"：访问 https://formspree.io 创建表单，
       *    把返回的 https://formspree.io/f/xxxx 填入 formspreeEndpoint。
       */
      enabled: true,
      backend: "githubIssue",

      // GitHub Issue 提交（backend = "githubIssue" 时使用）
      // 格式：拥有者/仓库名，例如 "kigubi/list"
      githubIssueRepo: "moonfsunwe/Yuri-KIGUBI-list",
      // 新 Issue 自动预选标签（这些标签需要在你的 GitHub 仓库中已存在）
      githubIssueLabels: ["submission", "pending"],

      // 「前往百合会提交」按钮要打开的 Discuz! 发帖基础地址；
      // 点击按钮时会自动在 URL 后追加 subject/message 预填（action=reply 时只追加 message）。
      lilySubmitUrl: "https://bbs.yamibo.com/forum.php?mod=post&action=reply&fid=33&tid=567394"
    },

    // 你的仓库地址，用于页脚“审核流程”链接（可选）
    repoUrl: "",

    footerNote:
      "本站为爱好者整理的检索索引：只收录信息，不提供资源。数据以仓库文件为准，由维护者审核后上架。"
  };
})();