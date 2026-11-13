# astro-studio-as-portfolio

当前版本：**v0.2.0**。基于 Vite + React + TypeScript + three.js 的个人主页。

主页有两版，可以互相切换，默认是游戏版：

- **游戏版**：第一人称的空间站观测舱段。望远镜通向 Publications，电脑通向 Code，相框通向 About，主控开关切到普通版。
- **普通版**：一页普通的主页，三个链接通向同样的三个页面。

```bash
pnpm install
pnpm dev      # 本地预览
pnpm build    # 输出到 dist/
```

## 仓库与素材

网站直接使用 `public/` 中已经导出的模型和插画。安装、开发和构建不需要 Blender，也不依赖 `assets/`。

| 路径 | 用途与提交范围 |
| --- | --- |
| `src/`、`plugins/`、`content/`、`tests/` | 网站代码、内容、内容缓存和测试，提交到仓库 |
| `public/models/`、`public/about/`、`public/favicon.svg` | 运行必需的 GLB、WebP 和图标，提交到仓库 |
| `dev_docs/` | 本地开发文档、建模约定和素材制作记录，由 `.gitignore` 排除 |
| `assets/` | 本地素材工作目录；Blender 源文件、制作脚本、原始贴图、历史版本、预览图、出图记录和校验报告，由 `.gitignore` 排除 |
| `node_modules/`、`dist/`、`.claude/` | 依赖、构建输出和本机工具配置，由 `.gitignore` 排除 |

`assets/` 和 `dev_docs/` 的内容保留在本地，不随源码仓库发布。需要分发可编辑模型时，可单独打包发布。

## 更新内容

只需要改 `content/` 文件夹，不用碰代码：

```
content/
  site.toml              名字、标语、三个页面的标题、界面上的所有固定文字
  about.toml             照片、职位、单位、链接、教育经历、技能
  about.md               自由的自我介绍，Markdown
  photo.jpg              照片，竖版 4:5，宽至少 600 像素；换文件名的话在 about.toml 里改
  publications/
    2025-eelg-obscured-agn/  一篇论文一个文件夹，文件夹名就是它的网址
      index.md           开头两行 +++ 之间写 doi（或 arxiv）和 effect，其余自动获取
      meta.json          自动生成的论文信息缓存，不要手改
      figure1.png        图片数量不限，可选
  projects/
    nooboard/            一个项目一个文件夹
      index.md           开头写 repos 和 summary；正文是简短介绍
      meta.json          自动生成的仓库信息缓存，不要手改
      screenshot.png     可选
      icon.png           可选，项目自己的图标（见下）
```

**加一篇论文**：新建一个文件夹，放一个 `index.md`，只写这几行：

```toml
+++
doi = "10.3847/1538-4357/adaf1b"   # 或 arxiv = "2410.12198"，两个都写也行
effect = "blackhole"                # 这一页的粒子效果："blackhole" 或 "galaxy"
+++
```

下次 `pnpm dev` 或 `pnpm build` 时，标题、作者、期刊、年份、摘要会自动获取，存进同一个文件夹的 `meta.json`。
之后的构建只读这个文件，不再联网。Paper（DOI）和 arXiv 两个链接按钮也会自动生成。删一篇就是删掉文件夹。

- **数据来源**：DOI 查 Crossref，拿正式发表的版本；只给 DOI 时，arXiv 编号从 OpenAlex 查到；
  期刊没提供摘要时（比如 PRD），用 arXiv 的摘要。只给 arXiv 编号、后来正式发表了的，会自动用发表版本。都不需要 API key。
- **覆盖**：`index.md` 里写了的字段（`title`、`authors`、`venue`、`year`、`links`）优先于自动获取的；
  正文不空就用正文当摘要，可以用 `$...$` 写公式。
- **重新获取**：预印本正式发表了，或者想更新信息时运行 `pnpm refresh`（全部）或 `pnpm refresh <文件夹名>`。
- **不联网也能用**：`title`、`authors`、`venue`、`year` 和正文都手写的话，不会去获取。
- 还要手写的：`effect`，可选的 `selected`、`note`、额外的 `links` 和图片。

**你的名字加粗**：`site.toml` 里 `me` 列出你所有的署名写法，`orcid` 写你的 ORCID。论文数据里带 ORCID 时按 ORCID 认，
否则按名字认。如果某篇论文认错了人（比如有同名合作者），在那篇的 `index.md` 里写 `me = "那篇里你的写法"`。

**作者很多时**：超过 20 位作者的论文，页面上只显示前 4 位、你自己和 et al.，鼠标停在作者行上能看到总人数。

**加一个项目**：新建一个文件夹，放一个 `index.md`：

```toml
+++
repos = "YoRHazero/nooboard"        # 由几个仓库组成的项目写成列表
summary = "一句话，显示在列表里"      # 不写就用仓库的 description
tags = ["Tokio", "rustls"]          # 可选
order = 3
+++

正文是对项目的简短介绍，不放图片；想看详情的人会点进 GitHub。
```

- **自动获取**（GitHub）：名字（不写 `name` 时用仓库名）、语言、最后推送时间（列表里的 Modified 列）。
  只有一个仓库时，窗口上方会有 Repository、Website（仓库的 homepage）和 Download（最新 release）按钮；
  几个仓库时，介绍下面会列出每个仓库和它的 description。
- **缓存**：存在 `meta.json`。仓库信息会变，所以超过一天的缓存在下次构建时自动重新获取；获取失败就继续用旧的，只给提醒。
- **覆盖**：`name`、`summary`、`language` 写了就优先；`[[links]]` 里写一个同名或同地址的链接可以替换自动生成的那个。
- 不联网也能用：不写 `repos`，`name` 和 `summary` 手写即可。私有仓库需要设置环境变量 `GITHUB_TOKEN`。

**图片**：在 `index.md` 开头用 `[[figures]]` 逐张列出，可以写图注，顺序就是显示顺序。只显示列出的；
文件夹里没列出的图片不会显示，构建时会提醒。

**项目图标**：在项目的 `index.md` 开头写 `icon = "icon.png"`（文件放在同一个文件夹里，最好是正方形），
项目列表、Dock 和项目窗口的头图都会用它。不写的话，会根据项目名和语言自动画一张封面，配上首字母。

**论文页的粒子效果**：每篇论文的 `index.md` 开头必须写 `effect = "blackhole"` 或 `effect = "galaxy"`，决定这一页显示黑洞还是星系。

**顺序**：论文按年份从新到旧；项目按 `order` 从小到大，没写 `order` 的排在后面。

字段写错、漏写或多写时，`pnpm dev` 和 `pnpm build` 会报出是哪个文件的哪一项。

内容也可以放在项目之外的文件夹：

```bash
CONTENT_DIR=/path/to/content pnpm build
```

内容会反映到游戏里：相框里是你的照片，望远镜对准的天区里每篇论文是一个源。

## 页面层级

网站是三层的树，每一层都有自己的网址，Esc 或返回按钮回到上一层：

```
主页（游戏版或普通版）
├─ About
├─ Publications          望远镜的视场（可缩放、拖动）+ 论文目录
│   └─ 单篇论文           标题、全部作者、摘要、图片查看器，配一个粒子构成的黑洞或星系
└─ Code                  电脑桌面上的文件管理器，列出所有项目
    └─ 单个项目           一个单独的窗口：说明、截图、仓库链接
```

## 结构

- `plugins/content/`：读取并校验内容文件的构建插件。`schema.ts` 是字段定义，`papers.ts` 按 DOI/arXiv 获取论文信息，
  `abstract.ts` 把各种格式的摘要（出版商的 JATS/MathML、arXiv 的 LaTeX、手写的 Markdown）转成 HTML，公式在构建时转成 MathML。
- `src/pages/`：三个页面和它们的第三层，两版主页共用。
- `src/PlainHome.tsx`：普通版主页。
- `src/game/`：游戏版。`layout.ts` 是舱室里所有东西的位置。舱室本身是 `public/models/cabin.glb`，
  `Room.tsx` 加载它并负责窗外和灯光，`Objects.tsx` 按名字找到模型的部件，贴上屏幕、照片、铭牌、光谱，
  放主控开关指示灯和阅读灯，驱动开关拉杆。漂浮的笔和本子来自 `props.glb`，窗外地球来自 `earth.glb`。
- `src/LoadingScreen.tsx`、`src/loader-field.ts`：游戏下载时的加载页。望远镜对一个高红移 AGN 做曝光，光谱是 Hβ + [O III]，
  进度来自 `src/loading.ts` 记录的真实下载字节数；全部就绪后视场从中心张开，露出舱内。

## 素材署名

地球表面与云层使用 NASA / Goddard Space Flight Center 的 Blue Marble（2002）影像：
[地表、海洋颜色与海冰](https://visibleearth.nasa.gov/view.php?id=57730)、
[云层](https://visibleearth.nasa.gov/view.php?id=57747)。
Reto Stockli 负责陆地表面、浅水区和云层，Robert Simmon 负责海洋颜色和合成。

观测舱与漂浮物模型为项目制作；About 页的车站和电车插画通过图像生成工具创作。
