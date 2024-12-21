import 'ws';
import fs from 'fs';

let totalBets = 0;
let totalWinnings = 0;
let playerCount = 0;
let losingPlayers = 0;
let multiplier = 0;
let crashTimestamp;
let gameId = 1;
let cumulativeCasinoEarnings = 0;

let socket;

function connectToCrashGame() {
    try {
        console.log('Connecting to Crash Game WebSocket server...');
        socket = new WebSocket(
            'wss://gooobet.com/games-frame/sockets/crash?whence=55&fcountry=66&ref=253&gr=887&appGuid=games-web-master&lng=en'
        );

        socket.addEventListener('open', () => {
            console.log('Connected to Crash Game WebSocket server');

            socket.send(`{"protocol":"json","version":1}\u001e`);

            setTimeout(() => {
                socket.send(`{"arguments":[{"activity":30,"currency":119}],"invocationId":"1","target":"Guest","type":1}\u001e`);
            }, 150);
        });

        setInterval(() => {
            socket.send(`{"type":6}\u001e`);
        }, 15000); // Send ping every 15 seconds

        socket.addEventListener('close', () => {
            console.log('The WebSocket is closing...');
        });

        socket.addEventListener('message', (event) => {
            const cleanedMessage = event.data.replace(/[\x00-\x1F\x7F]/g, '');

            let messageObject;
            try {
                messageObject = JSON.parse(cleanedMessage);
            } catch (error) {
                console.error('Error parsing JSON:', error);
                return;
            }

            switch (messageObject.target) {
                case 'OnStage':
                    resetGameData(messageObject);
                    break;
                case 'OnBets':
                    handleBets(messageObject);
                    break;
                case 'OnCrash':
                    handleCrash(messageObject);
                    break;
                case 'OnCashouts':
                    handleCashouts(messageObject);
                    break;
            }
        });

        socket.addEventListener('error', (event) => {
            console.error('WebSocket error:', event);
        });

        socket.addEventListener('close', () => {
            console.log('Connection to WebSocket server closed');
        });
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

function resetGameData() {
    displayGameResults();
    cumulativeCasinoEarnings += totalBets - totalWinnings;
    gameId += 1;
    totalBets = 0;
    totalWinnings = 0;
    multiplier = 0;
    playerCount = 0;
    losingPlayers = 0;
}

function handleCrash(messageObject) {
    multiplier = messageObject.arguments[0].f;
    crashTimestamp = messageObject.arguments[0].ts;
}

function handleBets(messageObject) {
    totalBets = messageObject.arguments[0].bid;
}

function handleCashouts(messageObject) {
    const { l, won, d, n, q } = messageObject.arguments[0];

    totalWinnings = won;
    playerCount = n;
    losingPlayers = d;
}

function displayGameResults() {
    const gameData = {
        'ID': gameId,
        'Total Bets': totalBets.toFixed(2),
        'Total Winnings': totalWinnings.toFixed(2),
        'Player Count': playerCount,
        'Losing Players': losingPlayers,
        'Multiplier': multiplier,
        'Casino Earnings': (totalBets - totalWinnings).toFixed(2),
        'Cumulative Casino Earnings': cumulativeCasinoEarnings.toFixed(2),
        'Timestamp': crashTimestamp,
    };

    const csvData = Object.values(gameData).join(',');

    fs.appendFile('data.csv', `${csvData}\n`, (err) => {
        if (err) throw err;
        console.log('Data appended to CSV file');
    });

    console.table(gameData);
}

connectToCrashGame();

// setInterval(connectToCrashGame, 1200000); // Reconnect every 20 minutes
