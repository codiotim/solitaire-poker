import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

const ROUND_CONFIG = [
    { round: 1, cardsPerHand: 2, minScore: 104, timeCeiling: 60 },
    { round: 2, cardsPerHand: 3, minScore: 156, timeCeiling: 120 },
    { round: 3, cardsPerHand: 4, minScore: 208, timeCeiling: 240 },
    { round: 4, cardsPerHand: 5, minScore: 260, timeCeiling: 480 }
];

let gameState = {
    deck: [],
    currentCardIndex: 0,
    currentRound: 0,
    hands: [[], [], [], [], []],
    score: 0,
    gameStarted: false,
    roundStartTime: null,
    timerInterval: null
};

let highScore = parseInt(localStorage.getItem('solitairePokerHighScore')) || 0;

function createDeck() {
    const deck = [];
    
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank, isJoker: false });
        }
    }
    
    deck.push({ suit: '🃏', rank: 'JOKER', isJoker: true });
    deck.push({ suit: '🃏', rank: 'JOKER', isJoker: true });
    
    return shuffleDeck(deck);
}

function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function startGame() {
    gameState = {
        deck: createDeck(),
        currentCardIndex: 0,
        currentRound: 0,
        hands: [[], [], [], [], []],
        score: 0,
        gameStarted: true,
        roundStartTime: Date.now(),
        timerInterval: null
    };
    
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('skip-btn').disabled = false;
    
    startTimer();
    renderHands();
    showNextCard();
    updateDisplay();
}

function showNextCard() {
    if (gameState.currentCardIndex >= gameState.deck.length) {
        endGame(false);
        return;
    }
    
    const card = gameState.deck[gameState.currentCardIndex];
    renderCurrentCard(card);
    updateDisplay();
}

function renderCurrentCard(card) {
    const cardDisplay = document.getElementById('current-card');
    const isRed = card.suit === '♥' || card.suit === '♦';
    
    if (card.isJoker) {
        cardDisplay.innerHTML = `
            <div class="card joker">
                <div class="card-content">
                    <div class="card-rank">${card.suit}</div>
                    <div class="card-suit-large">${card.rank}</div>
                </div>
            </div>
        `;
    } else {
        cardDisplay.innerHTML = `
            <div class="card ${isRed ? 'red' : 'black'}">
                <div class="card-content">
                    <div class="card-rank">${card.rank}</div>
                    <div class="card-suit">${card.suit}</div>
                    <div class="card-suit-large">${card.suit}</div>
                </div>
            </div>
        `;
    }
}

function renderHands() {
    const container = document.getElementById('hands-container');
    const config = ROUND_CONFIG[gameState.currentRound];
    container.innerHTML = '';
    
    for (let i = 0; i < 5; i++) {
        const handDiv = document.createElement('div');
        handDiv.className = 'hand';
        handDiv.innerHTML = `
            <div class="hand-header">
                <span class="hand-title">Hand ${i + 1}</span>
                <span class="hand-score" id="hand-score-${i}">-</span>
            </div>
            <div class="hand-cards" id="hand-${i}">
                ${renderHandSlots(i, config.cardsPerHand)}
            </div>
            <button class="btn btn-small place-btn" id="place-btn-${i}" 
                    onclick="placeCard(${i})" 
                    ${gameState.hands[i].length >= config.cardsPerHand ? 'disabled' : ''}>
                Place Here
            </button>
        `;
        container.appendChild(handDiv);
    }
}

function renderHandSlots(handIndex, maxCards) {
    const hand = gameState.hands[handIndex];
    let html = '';
    
    for (let i = 0; i < maxCards; i++) {
        if (i < hand.length) {
            const card = hand[i];
            const isRed = card.suit === '♥' || card.suit === '♦';
            if (card.isJoker) {
                html += `
                    <div class="card small joker">
                        <div class="card-content">
                            <div class="card-rank">${card.suit}</div>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="card small ${isRed ? 'red' : 'black'}">
                        <div class="card-content">
                            <div class="card-rank">${card.rank}</div>
                            <div class="card-suit">${card.suit}</div>
                        </div>
                    </div>
                `;
            }
        } else {
            html += '<div class="card-slot empty"></div>';
        }
    }
    
    return html;
}

function placeCard(handIndex) {
    const config = ROUND_CONFIG[gameState.currentRound];
    
    if (gameState.hands[handIndex].length >= config.cardsPerHand) {
        return;
    }
    
    const card = gameState.deck[gameState.currentCardIndex];
    gameState.hands[handIndex].push(card);
    gameState.currentCardIndex++;
    
    if (gameState.hands[handIndex].length === config.cardsPerHand) {
        const handScore = evaluateHand(gameState.hands[handIndex]);
        document.getElementById(`hand-score-${handIndex}`).textContent = handScore.name;
        
        if (handScore.score < config.minScore) {
            endGame(false, `Hand ${handIndex + 1} scored ${handScore.score} but needed ${config.minScore}!`);
            return;
        }
    }
    
    if (isRoundComplete()) {
        completeRound();
    } else {
        renderHands();
        showNextCard();
    }
}

function skipCard() {
    gameState.currentCardIndex++;
    
    if (gameState.currentCardIndex >= gameState.deck.length) {
        endGame(false);
        return;
    }
    
    showNextCard();
}

function isRoundComplete() {
    const config = ROUND_CONFIG[gameState.currentRound];
    return gameState.hands.every(hand => hand.length === config.cardsPerHand);
}

function completeRound() {
    stopTimer();
    
    const roundTime = Math.floor((Date.now() - gameState.roundStartTime) / 1000);
    const config = ROUND_CONFIG[gameState.currentRound];
    const timeBonus = Math.max(0, (config.timeCeiling - roundTime) * 10);
    
    let roundScore = 0;
    const results = [];
    
    for (let i = 0; i < 5; i++) {
        const handEval = evaluateHand(gameState.hands[i]);
        roundScore += handEval.score;
        results.push({ handNum: i + 1, ...handEval });
    }
    
    gameState.score += roundScore + timeBonus;
    
    showRoundCompleteModal(results, roundScore, timeBonus, roundTime);
}

function showRoundCompleteModal(results, roundScore, timeBonus, roundTime) {
    const modal = document.getElementById('round-complete-modal');
    const resultsDiv = document.getElementById('round-results');
    const config = ROUND_CONFIG[gameState.currentRound];
    
    let html = `<div class="results-list">`;
    for (const result of results) {
        html += `
            <div class="result-item">
                <span>Hand ${result.handNum}:</span>
                <span class="hand-name">${result.name}</span>
                <span class="hand-points">+${result.score}</span>
            </div>
        `;
    }
    html += `</div>`;
    html += `<div class="time-info">Time: ${roundTime}s (Ceiling: ${config.timeCeiling}s)</div>`;
    if (timeBonus > 0) {
        html += `<div class="time-bonus">Time Bonus: <strong>+${timeBonus}</strong></div>`;
    }
    html += `<div class="round-score">Round Score: <strong>+${roundScore + timeBonus}</strong></div>`;
    
    resultsDiv.innerHTML = html;
    modal.classList.remove('hidden');
}

function nextRound() {
    document.getElementById('round-complete-modal').classList.add('hidden');
    
    gameState.currentRound++;
    
    if (gameState.currentRound >= ROUND_CONFIG.length) {
        endGame(true);
        return;
    }
    
    gameState.hands = [[], [], [], [], []];
    gameState.deck = createDeck();
    gameState.currentCardIndex = 0;
    gameState.roundStartTime = Date.now();
    
    startTimer();
    renderHands();
    showNextCard();
    updateDisplay();
}

function endGame(won, customMessage = null) {
    stopTimer();
    
    const modal = document.getElementById('game-over-modal');
    const title = document.getElementById('game-over-title');
    const message = document.getElementById('game-over-message');
    const finalScore = document.getElementById('final-score');
    const nameEntry = document.getElementById('name-entry');
    
    let isNewHighScore = false;
    if (gameState.score > highScore) {
        highScore = gameState.score;
        localStorage.setItem('solitairePokerHighScore', highScore);
        isNewHighScore = true;
    }
    
    if (won) {
        title.textContent = 'Congratulations! You Win!';
        message.textContent = 'You successfully completed all 4 rounds!';
    } else {
        title.textContent = 'Game Over';
        message.textContent = customMessage || 'You ran out of cards before completing all hands.';
    }
    
    if (gameState.score > 0) {
        nameEntry.classList.remove('hidden');
    } else {
        nameEntry.classList.add('hidden');
    }
    
    let scoreHTML = `<div class="final-score-display">Final Score: <strong>${gameState.score}</strong>`;
    if (isNewHighScore) {
        scoreHTML += `<div class="new-high-score">New High Score!</div>`;
    }
    scoreHTML += `</div>`;
    scoreHTML += `<div class="high-score-display">Personal Best: <strong>${highScore}</strong></div>`;
    
    finalScore.innerHTML = scoreHTML;
    modal.classList.remove('hidden');
}

async function submitScore() {
    const playerName = document.getElementById('player-name').value.trim();
    
    if (!playerName) {
        alert('Please enter your name!');
        return;
    }
    
    try {
        await addDoc(collection(db, 'leaderboard'), {
            name: playerName,
            score: gameState.score,
            timestamp: new Date().toISOString()
        });
        
        document.getElementById('name-entry').classList.add('hidden');
        alert('Score submitted to leaderboard!');
        showLeaderboard();
    } catch (error) {
        console.error('Error submitting score:', error);
        alert('Failed to submit score. Please try again.');
    }
}

async function showLeaderboard() {
    const modal = document.getElementById('leaderboard-modal');
    const listDiv = document.getElementById('leaderboard-list');
    
    try {
        const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);
        
        let html = '<div class="leaderboard-entries">';
        let rank = 1;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            html += `
                <div class="leaderboard-entry">
                    <span class="rank">#${rank}</span>
                    <span class="player-name">${escapeHtml(data.name)}</span>
                    <span class="player-score">${data.score}</span>
                </div>
            `;
            rank++;
        });
        
        if (rank === 1) {
            html += '<div class="no-scores">No scores yet. Be the first!</div>';
        }
        
        html += '</div>';
        listDiv.innerHTML = html;
        modal.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        listDiv.innerHTML = '<div class="error-message">Failed to load leaderboard.</div>';
        modal.classList.remove('hidden');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function restartGame() {
    stopTimer();
    document.getElementById('game-over-modal').classList.add('hidden');
    document.getElementById('start-btn').style.display = 'block';
    document.getElementById('skip-btn').disabled = true;
    
    gameState = {
        deck: [],
        currentCardIndex: 0,
        currentRound: 0,
        hands: [[], [], [], [], []],
        score: 0,
        gameStarted: false,
        roundStartTime: null,
        timerInterval: null
    };
    
    document.getElementById('current-card').innerHTML = '<div class="card-placeholder">Start Game</div>';
    document.getElementById('timer-display').textContent = '0s';
    document.getElementById('time-bonus-display').textContent = '+0';
    renderHands();
    updateDisplay();
}

function updateDisplay() {
    const config = ROUND_CONFIG[gameState.currentRound];
    document.getElementById('round-display').textContent = config.round;
    document.getElementById('cards-per-hand').textContent = config.cardsPerHand;
    document.getElementById('min-score').textContent = config.minScore;
    document.getElementById('time-ceiling').textContent = `${config.timeCeiling}s`;
    document.getElementById('score-display').textContent = gameState.score;
    document.getElementById('cards-left').textContent = gameState.deck.length - gameState.currentCardIndex;
}

function evaluateHand(hand) {
    if (hand.length === 0) return { name: 'Empty', score: 0 };
    
    const handSize = hand.length;
    
    if (handSize === 2) {
        return evaluateTwoCardHand(hand);
    } else if (handSize === 3) {
        return evaluateThreeCardHand(hand);
    } else if (handSize === 4) {
        return evaluateFourCardHand(hand);
    } else if (handSize === 5) {
        return evaluateFiveCardHand(hand);
    }
    
    return { name: 'Invalid', score: 0 };
}

function evaluateTwoCardHand(hand) {
    const [card1, card2] = hand;
    const cardStrength = getCardStrength(hand);
    const isFlush = checkFlush(hand);
    
    if (card1.isJoker || card2.isJoker) {
        return { name: 'Pair', score: 100 + cardStrength };
    }
    
    if (card1.rank === card2.rank) {
        return { name: 'Pair', score: 100 + cardStrength };
    }
    
    if (isFlush) {
        return { name: 'Flush', score: 50 + cardStrength };
    }
    
    return { name: 'High Card', score: 10 + cardStrength };
}

function evaluateThreeCardHand(hand) {
    const rankCounts = getRankCounts(hand);
    const counts = Object.values(rankCounts);
    const cardStrength = getCardStrength(hand);
    const isFlush = checkFlush(hand);
    const isStraight = checkStraight(hand);
    
    if (isStraight && isFlush) {
        return { name: 'Straight Flush', score: 1000 + cardStrength };
    }
    
    if (counts.includes(3)) {
        return { name: 'Three of a Kind', score: 500 + cardStrength };
    }
    
    if (isFlush) {
        return { name: 'Flush', score: 300 + cardStrength };
    }
    
    if (isStraight) {
        return { name: 'Straight', score: 250 + cardStrength };
    }
    
    if (counts.includes(2)) {
        return { name: 'Pair', score: 150 + cardStrength };
    }
    
    return { name: 'High Card', score: 20 + cardStrength };
}

function evaluateFourCardHand(hand) {
    const rankCounts = getRankCounts(hand);
    const counts = Object.values(rankCounts);
    const cardStrength = getCardStrength(hand);
    const isFlush = checkFlush(hand);
    const isStraight = checkStraight(hand);
    
    if (isStraight && isFlush) {
        return { name: 'Straight Flush', score: 5000 + cardStrength };
    }
    
    if (counts.includes(4)) {
        return { name: 'Four of a Kind', score: 2000 + cardStrength };
    }
    
    if (counts.includes(3)) {
        return { name: 'Three of a Kind', score: 600 + cardStrength };
    }
    
    if (isFlush) {
        return { name: 'Flush', score: 500 + cardStrength };
    }
    
    if (isStraight) {
        return { name: 'Straight', score: 450 + cardStrength };
    }
    
    const pairs = counts.filter(c => c === 2).length;
    if (pairs === 2) {
        return { name: 'Two Pair', score: 400 + cardStrength };
    }
    if (pairs === 1) {
        return { name: 'Pair', score: 200 + cardStrength };
    }
    
    return { name: 'High Card', score: 30 + cardStrength };
}

function evaluateFiveCardHand(hand) {
    const isFlush = checkFlush(hand);
    const straight = checkStraight(hand);
    const rankCounts = getRankCounts(hand);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    const cardStrength = getCardStrength(hand);
    
    if (straight && isFlush) {
        const ranks = hand.filter(c => !c.isJoker).map(c => RANK_VALUES[c.rank]);
        const hasAce = ranks.includes(14);
        const hasTen = ranks.includes(10);
        if (hasAce && hasTen && ranks.length >= 3) {
            return { name: 'Royal Flush', score: 100000 + cardStrength };
        }
        return { name: 'Straight Flush', score: 50000 + cardStrength };
    }
    
    if (counts[0] === 4) {
        return { name: 'Four of a Kind', score: 10000 + cardStrength };
    }
    
    if (counts[0] === 3 && counts[1] === 2) {
        return { name: 'Full House', score: 5000 + cardStrength };
    }
    
    if (isFlush) {
        return { name: 'Flush', score: 3000 + cardStrength };
    }
    
    if (straight) {
        return { name: 'Straight', score: 2000 + cardStrength };
    }
    
    if (counts[0] === 3) {
        return { name: 'Three of a Kind', score: 800 + cardStrength };
    }
    
    if (counts[0] === 2 && counts[1] === 2) {
        return { name: 'Two Pair', score: 500 + cardStrength };
    }
    
    if (counts[0] === 2) {
        return { name: 'Pair', score: 250 + cardStrength };
    }
    
    return { name: 'High Card', score: 50 + cardStrength };
}

function getCardStrength(hand) {
    let strength = 0;
    for (const card of hand) {
        if (card.isJoker) {
            strength += 0;
        } else {
            strength += RANK_VALUES[card.rank];
        }
    }
    return strength;
}

function startTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    
    gameState.timerInterval = setInterval(() => {
        updateTimerDisplay();
    }, 100);
}

function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

function updateTimerDisplay() {
    const elapsed = Math.floor((Date.now() - gameState.roundStartTime) / 1000);
    const config = ROUND_CONFIG[gameState.currentRound];
    const timeLeft = Math.max(0, config.timeCeiling - elapsed);
    
    document.getElementById('timer-display').textContent = `${elapsed}s`;
    document.getElementById('time-ceiling').textContent = `${config.timeCeiling}s`;
    
    if (timeLeft > 0) {
        const bonus = timeLeft * 10;
        document.getElementById('time-bonus-display').textContent = `+${bonus}`;
    } else {
        document.getElementById('time-bonus-display').textContent = '+0';
    }
}

function getRankCounts(hand) {
    const counts = {};
    const jokerCount = hand.filter(c => c.isJoker).length;
    
    for (const card of hand) {
        if (!card.isJoker) {
            counts[card.rank] = (counts[card.rank] || 0) + 1;
        }
    }
    
    if (jokerCount > 0 && Object.keys(counts).length > 0) {
        const maxRank = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        counts[maxRank] += jokerCount;
    } else if (jokerCount > 0) {
        counts['A'] = jokerCount;
    }
    
    return counts;
}

function checkFlush(hand) {
    const nonJokers = hand.filter(c => !c.isJoker);
    if (nonJokers.length === 0) return true;
    
    const firstSuit = nonJokers[0].suit;
    return nonJokers.every(c => c.suit === firstSuit);
}

function checkStraight(hand) {
    const jokerCount = hand.filter(c => c.isJoker).length;
    const nonJokerRanks = hand.filter(c => !c.isJoker).map(c => RANK_VALUES[c.rank]).sort((a, b) => a - b);
    
    if (nonJokerRanks.length === 0) return true;
    
    const uniqueRanks = [...new Set(nonJokerRanks)];
    
    if (uniqueRanks.length + jokerCount < hand.length) {
        return false;
    }
    
    const minRank = uniqueRanks[0];
    const maxRank = uniqueRanks[uniqueRanks.length - 1];
    
    if (maxRank - minRank < hand.length) {
        let jokersNeeded = 0;
        for (let i = 0; i < uniqueRanks.length - 1; i++) {
            jokersNeeded += uniqueRanks[i + 1] - uniqueRanks[i] - 1;
        }
        if (jokersNeeded <= jokerCount) {
            return true;
        }
    }
    
    if (uniqueRanks.includes(14)) {
        const withAceLow = uniqueRanks.filter(r => r !== 14).concat([1]).sort((a, b) => a - b);
        const minRankLow = withAceLow[0];
        const maxRankLow = withAceLow[withAceLow.length - 1];
        
        if (maxRankLow - minRankLow < hand.length) {
            let jokersNeeded = 0;
            for (let i = 0; i < withAceLow.length - 1; i++) {
                jokersNeeded += withAceLow[i + 1] - withAceLow[i] - 1;
            }
            if (jokersNeeded <= jokerCount) {
                return true;
            }
        }
    }
    
    return false;
}

window.placeCard = placeCard;

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('skip-btn').addEventListener('click', skipCard);
document.getElementById('next-round-btn').addEventListener('click', nextRound);
document.getElementById('restart-btn').addEventListener('click', restartGame);
document.getElementById('submit-score-btn').addEventListener('click', submitScore);
document.getElementById('show-leaderboard-btn').addEventListener('click', showLeaderboard);
document.getElementById('close-leaderboard-btn').addEventListener('click', () => {
    document.getElementById('leaderboard-modal').classList.add('hidden');
});

renderHands();
updateDisplay();
