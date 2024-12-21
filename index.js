import puppeteer from 'puppeteer';
import fs from 'fs';

const wait = (ms) => new Promise(res => setTimeout(res, ms));

async function scrapeDivData(page) {
    await page.waitForSelector('iframe.games-project-frame__item');

    const frame = page.frames().find(f => f.url().includes('/games-frame/games/371'));

    if (!frame) {
        return { totalPlayers: 'N/A', totalBets: 'N/A', totalWinnings: 'N/A' };
    }

    return await frame.evaluate(() => {
        function safeGetText(selector) {
            const element = document.querySelector(selector);
            return element ? element.innerText : 'N/A';
        }

        const totalPlayers = safeGetText('.crash-total__value--players');
        const totalBets = safeGetText('.crash-total__value--bets').replace(' EGP', '');;
        const totalWinnings = safeGetText('.crash-total__value--prize').replace(' EGP', '');;

        return {
            totalPlayers,
            totalBets,
            totalWinnings
        };
    });
}

(async () => {
    console.log('Starting script...');

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-client-side-phishing-detection',
            '--disable-setuid-sandbox',
            '--disable-component-update',
            '--disable-default-apps',
            '--disable-popup-blocking',
            '--disable-offer-store-unmasked-wallet-cards',
            '--disable-speech-api',
            '--hide-scrollbars',
            '--mute-audio',
            '--disable-extensions',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-default-browser-check',
            '--no-pings',
            '--password-store=basic',
            '--use-mock-keychain',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
        ]
    });

    const page = await browser.newPage();
    let status = await page.goto('https://gooobet.com/en/allgamesentrance/crash');
    status = status.status();
    console.log(`Probably HTTP response status code ${status}.`);

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

                let scrapedData;
                try {
                    scrapedData = await scrapeDivData(page);
                } catch (scrapeError) {
                    console.error('Error scraping data:', scrapeError);
                    scrapedData = { totalPlayers: 'N/A', totalBets: 'N/A', totalWinnings: 'N/A' };
                }

                const csvData = `${ts},${scrapedData.totalPlayers},${scrapedData.totalBets},${f},${scrapedData.totalWinnings},${l}\n`;

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
        await page.keyboard.press('Tab');
        await wait(1000);
        await page.keyboard.press('ArrowDown');
        await wait(1000);
    }
})();
