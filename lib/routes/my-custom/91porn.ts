import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';

// 随机 IP (用于 X-Forwarded-For 伪造防�?
const randomIp = () =>
    `${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;

export const route: Route = {
    path: '/91porn/:category?',
    categories: ['multimedia'],
    example: '/my-custom/91porn',
    parameters: { category: '分类，默认为空，抓取首页' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.91porn.com/index.php'],
            target: '/91porn',
        },
    ],
    name: '91Porn 卡片�?(极速版)',
    maintainers: ['your_name'],
    handler,
    description: '仅解析首页列表以保证极速响应并防止 IP 限制。包�?iframe 嵌入地址，前端可直接在卡片弹窗中播放视频�?,
};

async function handler(ctx) {
    const category = ctx.req.param('category');

    // 1. 目标网址
    let targetUrl = 'https://www.91porn.com/index.php';
    if (category && category !== 'index') {
        targetUrl = `https://www.91porn.com/v.php?category=${category}&viewtype=basic`;
    }

    // 请求头伪�?
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'X-Forwarded-For': randomIp(),
        'Client-IP': randomIp(),
        Cookie: 'language=cn_CN; age_confirmed=1;',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Referer: 'https://www.91porn.com/',
    };

    const response = await ofetch(targetUrl, { headers });
    const $ = load(response);

    // 2. 数据解析 - 兼容多种 DOM 结构
    const list = $('.listchannel, .video-list-item, .col-xs-12.col-sm-4.col-md-3, .row .well').toArray();

    const items = list
        .map((item) => {
            const $item = $(item);
            const $a = $item.find('a[href*="view_video.php"]').first();
            const link = $a.attr('href');

            if (!link) {
                return null;
            }

            // 补全为绝对路�?
            const fullLink = link.startsWith('http') ? link : `https://www.91porn.com/${link.replace(/^\//, '')}`;

            // 提取 viewkey 用于 iframe 嵌入播放
            const viewkeyMatch = fullLink.match(/viewkey=([a-zA-Z0-9]+)/);
            const viewkey = viewkeyMatch ? viewkeyMatch[1] : '';
            const iframeUrl = viewkey ? `https://www.91porn.com/embed_iframe.php?viewkey=${viewkey}` : '';

            // 提取标题
            const title =
                $item.find('.video-title, span[id*="video-title"], .title').text().trim() ||
                $a.text().trim() ||
                '无标�?;

            // 提取封面�?
            const $img = $item.find('img').first();
            let cover = $img.attr('data-original') || $img.attr('data-src') || $img.attr('src') || '';
            if (cover && !cover.startsWith('http')) {
                cover = `https://www.91porn.com/${cover.replace(/^\//, '')}`;
            }

            // 提取卡片内文本以获取元数�?
            const text = $item.text();

            const authorMatch = text.match(/(?:作者|Author)\s*[:：]?\s*(\S+)/);
            const author = authorMatch ? authorMatch[1].trim() : '未知';

            const timeMatch = text.match(/(?:添加时间|Added|添加時間)\s*[:：]?\s*([^\n]+)/);
            const pubDateStr = timeMatch ? timeMatch[1].trim() : '';

            // 解析相对时间
            let pubDate: Date | undefined;
            if (pubDateStr.includes('小时') || pubDateStr.includes('hours')) {
                const hours = Math.trunc(Number(pubDateStr.match(/\d+/)?.[0] || '0'));
                pubDate = new Date(Date.now() - hours * 3600 * 1000);
            } else if (pubDateStr.includes('�?) || pubDateStr.includes('days')) {
                const days = Math.trunc(Number(pubDateStr.match(/\d+/)?.[0] || '0'));
                pubDate = new Date(Date.now() - days * 24 * 3600 * 1000);
            }

            const viewsMatch = text.match(/(?:查看|Views|热度|熱度)\s*[:：]?\s*([\d,]+)/);
            const views = viewsMatch ? viewsMatch[1].replace(/,/g, '') : '0';

            const favMatch = text.match(/(?:收藏|Favorites)\s*[:：]?\s*([\d,]+)/);
            const favorites = favMatch ? favMatch[1].replace(/,/g, '') : '0';

            const commentMatch = text.match(/(?:留言|Comments)\s*[:：]?\s*([\d,]+)/);
            const comments = commentMatch ? commentMatch[1].replace(/,/g, '') : '0';

            // 构建带防盗链�?HTML description (用于 RSS 阅读器展�?
            const description = `
<div style="font-family:sans-serif;">
  <img src="${cover}" referrerpolicy="no-referrer" style="width:100%;border-radius:6px;"/>
  <p><b>作�?</b> ${author} | <b>热度:</b> ${views}</p>
  <p><b>添加时间:</b> ${pubDateStr} | <b>收藏:</b> ${favorites} | <b>留言:</b> ${comments}</p>
  ${iframeUrl ? `<iframe src="${iframeUrl}" width="100%" height="400" allowfullscreen referrerpolicy="no-referrer" style="border:none;border-radius:6px;"></iframe>` : ''}
</div>`;

            return {
                title,
                link: fullLink,
                author,
                pubDate,
                description,
                // JSON Feed 标准字段
                image: cover,
                banner: cover,
                // 扩展字段打包�?_extra，确保在 JSON Feed 中输�?
                _extra: {
                    iframe_url: iframeUrl,
                    views,
                    favorites,
                    comments,
                    cover,
                    pub_date_str: pubDateStr,
                },
            };
        })
        .filter((i) => i !== null);

    return {
        title: '91Porn 卡片墙更�?,
        link: targetUrl,
        description: '仅列表极速模式，包含 iframe 嵌入地址用于前端网格布局在线播放',
        item: items,
    };
}
