import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';

const randomIp = () =>
    `${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;

export const route: Route = {
    path: '/91porn/:category?',
    categories: ['multimedia'],
    example: '/my-custom/91porn',
    parameters: { category: 'Category, default is homepage' },
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
    name: '91Porn Video List',
    maintainers: ['luka1968'],
    handler,
    description: 'Homepage video list with iframe embed support',
};

async function handler(ctx) {
    const category = ctx.req.param('category');

    let targetUrl = 'https://www.91porn.com/index.php';
    if (category && category !== 'index') {
        targetUrl = `https://www.91porn.com/v.php?category=${category}&viewtype=basic`;
    }

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

    const list = $('.listchannel, .video-list-item, .col-xs-12.col-sm-4.col-md-3, .row .well').toArray();

    const items = list
        .map((item) => {
            const $item = $(item);
            const $a = $item.find('a[href*="view_video.php"]').first();
            const link = $a.attr('href');

            if (!link) {
                return null;
            }

            const fullLink = link.startsWith('http') ? link : `https://www.91porn.com/${link.replace(/^\//, '')}`;

            const viewkeyMatch = fullLink.match(/viewkey=([a-zA-Z0-9]+)/);
            const viewkey = viewkeyMatch ? viewkeyMatch[1] : '';
            const iframeUrl = viewkey ? `https://www.91porn.com/embed_iframe.php?viewkey=${viewkey}` : '';

            const title =
                $item.find('.video-title, span[id*="video-title"], .title').text().trim() ||
                $a.text().trim() ||
                'No Title';

            const $img = $item.find('img').first();
            let cover = $img.attr('data-original') || $img.attr('data-src') || $img.attr('src') || '';
            if (cover && !cover.startsWith('http')) {
                cover = `https://www.91porn.com/${cover.replace(/^\//, '')}`;
            }

            const text = $item.text();

            const authorMatch = text.match(/Author\s*:?\s*(\S+)/);
            const author = authorMatch ? authorMatch[1].trim() : 'Unknown';

            const timeMatch = text.match(/Added\s*:?\s*([^\n]+)/);
            const pubDateStr = timeMatch ? timeMatch[1].trim() : '';

            let pubDate;
            if (pubDateStr.includes('hour')) {
                const hours = Math.trunc(Number(pubDateStr.match(/\d+/)?.[0] || '0'));
                if (hours > 0) {
                    pubDate = new Date(Date.now() - hours * 3600 * 1000);
                }
            } else if (pubDateStr.includes('day')) {
                const days = Math.trunc(Number(pubDateStr.match(/\d+/)?.[0] || '0'));
                if (days > 0) {
                    pubDate = new Date(Date.now() - days * 24 * 3600 * 1000);
                }
            }

            const viewsMatch = text.match(/Views\s*:?\s*([\d,]+)/);
            const views = viewsMatch ? viewsMatch[1].replace(/,/g, '') : '0';

            const description = `<div style="font-family:sans-serif;"><img src="${cover}" referrerpolicy="no-referrer" style="width:100%;border-radius:6px;"/><p><b>Author:</b> ${author} | <b>Views:</b> ${views}</p><p><b>Added:</b> ${pubDateStr}</p>${iframeUrl ? `<iframe src="${iframeUrl}" width="100%" height="400" allowfullscreen referrerpolicy="no-referrer" style="border:none;border-radius:6px;"></iframe>` : ''}</div>`;

            return {
                title,
                link: fullLink,
                author,
                pubDate,
                description,
            };
        })
        .filter((i) => i !== null);

    return {
        title: '91Porn Video List',
        link: targetUrl,
        description: 'Video list with iframe embed support',
        item: items,
    };
}