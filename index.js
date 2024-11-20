import puppeteer from 'puppeteer';
import fs from 'fs';
import { format, subHours } from 'date-fns';

const wait = (ms) => new Promise(res => setTimeout(res, ms));

async function scrapeDivData(page) {
    await page.waitForSelector('iframe.games-project-frame__item');

    const frame = page.frames().find(f => f.url().includes('/games-frame/games/371'));

    if (!frame) {
        return { totalPlayers: 'N/A', totalBets: 'N/A', totalPrize: 'N/A' };
    }

    await frame.waitForSelector('.crash-total__value--players', { timeout: 10000 });

    const data = await frame.evaluate(() => {
        function safeGetText(selector) {
            const element = document.querySelector(selector);
            return element ? element.innerText : 'N/A';
        }

        const totalPlayers = safeGetText('.crash-total__value--players');
        const totalBets = safeGetText('.crash-total__value--bets').replace(' EGP', '');;
        const totalPrize = safeGetText('.crash-total__value--prize').replace(' EGP', '');;

        return {
            totalPlayers,
            totalBets,
            totalPrize
        };
    });

    return data;
}

(async () => {
    console.log('Starting script...');

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://1xbet.com/en/allgamesentrance/crash', { waitUntil: 'networkidle0' });
    await page.waitForSelector('iframe.games-project-frame__item');
    const client = await page.createCDPSession();

    await client.send('Network.enable');

    client.on('Network.webSocketFrameReceived', async ({ requestId, timestamp, response }) => {
        let payloadString = response.payloadData.toString('utf8');

        try {
            payloadString = payloadString.replace(/[^\x20-\x7E]/g, '');
            const payload = JSON.parse(payloadString);

            if (payload.type === 1 && payload.target === 'OnCrash') {
                const { l, f, ts } = payload.arguments[0];

                const date = new Date(ts);
                const dateMinusOneHour = subHours(date, 1);
                const formattedTime = format(dateMinusOneHour, 'HH:mm');

                // Scrape the div data
                let scrapedData;
                try {
                    scrapedData = await scrapeDivData(page);
                } catch (scrapeError) {
                    console.error('Error scraping data:', scrapeError);
                    scrapedData = { totalPlayers: 'N/A', totalBets: 'N/A', totalPrize: 'N/A' };
                }

                const csvData = `${formattedTime},${scrapedData.totalPlayers},${scrapedData.totalBets},${f},${scrapedData.totalPrize},${l}\n`;

                fs.appendFile('data.csv', csvData, (err) => {
                    if (err) throw err;
                    console.log('Data appended to CSV file');
                });
            }
        } catch (error) {
            console.error('Error processing WebSocket frame:', error);
        }
    });

    console.log('Starting main loop...');

    while (true) {
        await wait(1000);
    }
})();