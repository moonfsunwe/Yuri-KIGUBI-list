/* 漫画场景数据 —— 维护者按此结构增删改。
 *
 * 结构说明：
 * - slug：URL 标识，建议用英文短横线，全站唯一
 * - cover：漫画封面（允许展示），用 assets/covers/ 下的文件或外链
 * - chapters[].kiss[]：亲吻场景记录
 * - chapters[].nudity[]：露点场景记录（只记录信息，不放图）
 * - chapters[].kissUnknown / nudityUnknown：可选，true 或 1 表示该章对应情况未知，
 *   折叠模式的色块会显示未知色与问号，详细模式会显示“情况未知”
 * - chapters[].note：可选，章节备注；折叠模式会为该章显示提示标记，
 *   鼠标指向章节色块时会显示章节名与备注
 * - 场景 note：文字描述，只描述发生情境与镜头信息；不要出现页码、图片外链或资源链接
 *
 * 当前内容为演示用示例数据。正式上线前请替换为你实际整理的作品。
 */
(function () {
  "use strict";

  window.KIGUBI_DATA = [
    {
      slug: "hoshikuzu-symphonia",
      title: "星屑シンフォニア",
      altTitles: ["Stardust Symphonia", "星尘交响曲"],
      author: "朝霧みお（示例数据）",
      status: "连载中",
      cover: "assets/covers/hoshikuzu-symphonia.svg",
      description:
        "内向的图书委员小夜，在放学后的音乐教室遇见了从海外转学来的小提琴手ひなた。两人因合奏逐渐靠近，也在选拔与误解中确认彼此的心意。（示例占位数据）",
      demo: true,
      updatedAt: "2025-08-15",
      chapters: [
        {
          id: "ch1",
          title: "第1话 放学后的音乐教室",
          order: 1,
          kiss: [
            {
              characters: "小夜 × ひなた",
              note: "黄昏的音乐教室里，ひなた在合奏结束后轻轻吻了小夜的嘴唇。"
            }
          ],
          nudity: [
            {
              characters: "小夜",
              note: "夜晚独自淋浴的镜头，露出肩线与胸部侧面，有乳头轮廓的描写。"
            }
          ]
        },
        {
          id: "ch2",
          title: "第2话 雨天的合宿",
          order: 2,
          kiss: [
            {
              characters: "小夜 × ひなた",
              note: "合宿屋檐下避雨时，ひなた用轻吻安慰不安的小夜。"
            },
            {
              characters: "小夜 × ひなた",
              note: "就寝前在合宿房间里的长吻，小夜反手抱住对方。"
            }
          ],
          nudity: [
            {
              characters: "ひなた",
              note: "合宿温泉入浴场景，全裸入浴，镜头从背后与侧胸角度给出露点。"
            }
          ]
        },
        {
          id: "ch3",
          title: "第3话 第一次登台",
          order: 3,
          note: "本章已核对亲吻部分；露点部分尚未复核完整。",
          kissUnknown: 1,
          nudityUnknown: 1,
          kiss: [
            {
              characters: "小夜 × ひなた",
              note: "演奏会结束后的后台，两人额头相抵后接吻。"
            }
          ],
          nudity: []
        }
      ]
    },
    {
      slug: "yuunagi-satellite",
      title: "夕凪サテライト",
      altTitles: ["Evening Calm Satellite", "夕凪卫星"],
      author: "凪野アオ（示例数据）",
      status: "连载中",
      cover: "assets/covers/yuunagi-satellite.svg",
      description:
        "在小型设计事务所工作的社会人澪，某天在深夜便利店遇见了自由摄影师柚季。工作与生活逐渐交叠，两人在都市夜晚里互相靠近。（示例占位数据）",
      demo: true,
      updatedAt: "2025-08-02",
      chapters: [
        {
          id: "ch1",
          title: "第1话 深夜便利店",
          order: 1,
          kiss: [
            {
              characters: "澪 × 柚季",
              note: "公寓门口道别时，柚季忽然凑近轻吻了澪的嘴角。"
            }
          ],
          nudity: []
        },
        {
          id: "ch2",
          title: "第2话 阳台与啤酒",
          order: 2,
          kiss: [
            {
              characters: "澪 × 柚季",
              note: "澪家阳台上并排喝酒时，两人在夜风里接吻。"
            }
          ],
          nudity: [
            {
              characters: "澪",
              note: "隔日清晨澪在卧室换衣服时，镜中映出上半身露点镜头。"
            }
          ]
        }
      ]
    },
    {
      slug: "amagasa-refrain",
      title: "雨音リフレイン",
      altTitles: ["Rain Refrain", "雨音叠句"],
      author: "雨宮なぎ（示例数据）",
      status: "已完结",
      cover: "assets/covers/amagasa-refrain.svg",
      description:
        "青梅竹马的二人从小学、初中到高中一直同班，却始终不敢向前一步。毕业前最后一个梅雨季，停滞的关系开始改变。（示例占位数据）",
      demo: true,
      updatedAt: "2025-07-20",
      chapters: [
        {
          id: "ch1",
          title: "第1话 放学路上的伞",
          order: 1,
          kiss: [
            {
              characters: "湊 × つむぎ",
              note: "共撑一把伞回家时，湊在雨中吻了つむぎ。"
            }
          ],
          nudity: []
        },
        {
          id: "ch2",
          title: "第2话 修学旅行的温泉夜",
          order: 2,
          kiss: [
            {
              characters: "湊 × つむぎ",
              note: "旅馆走廊拐角，つむぎ踮脚主动亲了湊。"
            }
          ],
          nudity: [
            {
              characters: "つむぎ",
              note: "女汤入浴画面，正在洗发时露出的胸部正面露点。"
            }
          ]
        }
      ]
    }
  ];
})();