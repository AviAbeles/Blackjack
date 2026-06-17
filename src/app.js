import { BlackjackGame, getHandTotals } from "./game.js";
import {
  CasinoWallet,
  COLOR_SPLITS,
  EUROPEAN_WHEEL,
  ROULETTE_PAYTABLE_ROWS,
  RouletteGame,
  SPECIAL_BETS,
  createBetSpec,
  createNeighbourComponents,
  createOutsideBet,
  getNumberColor,
} from "./roulette.js";
import { TableSound } from "./sound.js";
import { getBasicStrategyAction } from "./strategy.js";

const game = new BlackjackGame();
const roulette = new RouletteGame({
  storage: window.localStorage,
});
const wallet = new CasinoWallet();
const CARD_DELAY = 360;
const BLACKJACK_CHIP_VALUES = [
  0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 500, 1000, 5000, 10000,
];
const ROULETTE_CHIP_VALUES = [
  0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 500,
];
const storedMuted =
  window.localStorage.getItem("avis-casino-muted") === "true" ||
  window.localStorage.getItem("blackjack-muted") === "true";
const sound = new TableSound({ muted: storedMuted });
const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatMoney(value) {
  const amount = Number(value);
  if (amount !== 0 && Math.abs(amount) < 1) {
    const sign = amount < 0 ? "-" : "";
    return `${sign}${Math.round(Math.abs(amount) * 100)}p`;
  }

  return money.format(amount);
}

const elements = {
  shell: document.querySelector(".app-shell"),
  blackjackView: document.querySelector("#blackjack-view"),
  rouletteView: document.querySelector("#roulette-view"),
  gameSwitchButtons: [...document.querySelectorAll("[data-game-switch]")],
  balance: document.querySelector("#balance"),
  currentBet: document.querySelector("#current-bet"),
  betSpot: document.querySelector("#bet-spot"),
  betSpotValue: document.querySelector("#bet-spot-value"),
  dealerCards: document.querySelector("#dealer-cards"),
  dealerScore: document.querySelector("#dealer-score"),
  playerHands: document.querySelector("#player-hands"),
  playerScore: document.querySelector("#player-score"),
  playerTotalLabel: document.querySelector("#player-total-label"),
  statusPanel: document.querySelector(".status-panel"),
  statusKicker: document.querySelector("#status-kicker"),
  statusMessage: document.querySelector("#status-message"),
  deal: document.querySelector("#deal"),
  hit: document.querySelector("#hit"),
  stand: document.querySelector("#stand"),
  double: document.querySelector("#double"),
  split: document.querySelector("#split"),
  insurance: document.querySelector("#insurance"),
  declineInsurance: document.querySelector("#decline-insurance"),
  strategyHint: document.querySelector("#strategy-hint"),
  undoBet: document.querySelector("#undo-bet"),
  clearBet: document.querySelector("#clear-bet"),
  primaryChips: document.querySelector("#primary-chips"),
  extraChips: document.querySelector("#extra-chips"),
  extraChipsToggle: document.querySelector("#extra-chips-toggle"),
  soundToggle: document.querySelector("#sound-toggle"),
  wins: document.querySelector("#wins"),
  pushes: document.querySelector("#pushes"),
  losses: document.querySelector("#losses"),
  history: document.querySelector("#history-list"),
  viewButtons: [...document.querySelectorAll("[data-view]")],
  modeBadge: document.querySelector("#mode-badge"),
  sessionSettings: document.querySelector("#session-settings"),
  sessionDialog: document.querySelector("#session-dialog"),
  sessionForm: document.querySelector("#session-form"),
  sessionCancel: document.querySelector("#session-cancel"),
  sessionTitle: document.querySelector("#session-title"),
  sessionCopy: document.querySelector("#session-copy"),
  sessionStepGame: document.querySelector("#session-step-game"),
  sessionStepOptions: document.querySelector("#session-step-options"),
  sessionBack: document.querySelector("#session-back"),
  sessionForfeit: document.querySelector("#session-forfeit"),
  sessionNext: document.querySelector("#session-next"),
  sessionSubmit: document.querySelector("#session-submit"),
  blackjackModeSection: document.querySelector("#blackjack-mode-section"),
  startingBankroll: document.querySelector("#starting-bankroll"),
  bankrollPresets: [...document.querySelectorAll("[data-bankroll]")],
  sessionGames: [...document.querySelectorAll('[name="session-game"]')],
  walletModes: [...document.querySelectorAll('[name="wallet-mode"]')],
  gameModes: [...document.querySelectorAll('[name="game-mode"]')],
  sessionError: document.querySelector("#session-error"),
  forfeitDialog: document.querySelector("#forfeit-dialog"),
  rouletteResult: document.querySelector("#roulette-result"),
  rouletteNumberGrid: document.querySelector("#roulette-number-grid"),
  rouletteComboGrid: document.querySelector("#roulette-combo-grid"),
  rouletteOutsideGrid: document.querySelector("#roulette-outside-grid"),
  racetrackNumbers: document.querySelector("#racetrack-numbers"),
  rouletteSpecialGrid: document.querySelector("#roulette-special-grid"),
  roulettePrimaryChips: document.querySelector("#roulette-primary-chips"),
  rouletteExtraChips: document.querySelector("#roulette-extra-chips"),
  rouletteExtraChipsToggle: document.querySelector("#roulette-extra-chips-toggle"),
  rouletteUndoBet: document.querySelector("#roulette-undo-bet"),
  rouletteClearBets: document.querySelector("#roulette-clear-bets"),
  rouletteSaveBet: document.querySelector("#roulette-save-bet"),
  rouletteSpin: document.querySelector("#roulette-spin"),
  rouletteTotalStake: document.querySelector("#roulette-total-stake"),
  rouletteBetList: document.querySelector("#roulette-bet-list"),
  rouletteValidation: document.querySelector("#roulette-validation"),
  rouletteSavedBets: document.querySelector("#roulette-saved-bets"),
  rouletteInfoButtons: [...document.querySelectorAll("[data-roulette-info]")],
  roulettePaytablePanel: document.querySelector("#roulette-paytable-panel"),
  rouletteRulesPanel: document.querySelector("#roulette-rules-panel"),
};

const ui = {
  busy: false,
  stage: "",
  enteringHand: null,
  visiblePlayerCards: [],
  visibleDealerCards: 0,
  sessionRequired: true,
  sessionStep: 1,
  pendingSessionGame: "blackjack",
  extraChipsOpen: false,
  rouletteExtraChipsOpen: false,
  activeGame: "blackjack",
  walletMode: "universal",
  selectedRouletteChip: 0.01,
  rouletteInfoPanel: "paytable",
  gameMode: "normal",
  strategyFeedback: null,
  strategyHintAction: null,
};

const suitMarkup = {
  S: "&#9824;",
  H: "&#9829;",
  D: "&#9830;",
  C: "&#9827;",
};

function formatHandTotal(cards) {
  return cards.length ? getHandTotals(cards).join(" / ") : "--";
}

function cardMarkup(card, index, entering = false) {
  const isRed = ["H", "D"].includes(card.suit);
  const suit = suitMarkup[card.suit];
  return `
    <div
      class="card ${isRed ? "red" : ""} ${entering ? "entering" : ""}"
      style="--card-rotation: ${index % 2 ? 1 : -1}deg"
      aria-label="${card.rank} of ${card.suit}"
    >
      <span class="card-corner">${card.rank}<span class="suit">${suit}</span></span>
      <span class="card-center">${suit}</span>
      <span class="card-corner bottom">${card.rank}<span class="suit">${suit}</span></span>
    </div>
  `;
}

function renderHands() {
  const dealerCards = game.dealerHand.slice(0, ui.visibleDealerCards);

  elements.playerHands.innerHTML = game.playerHands
    .map((hand, handIndex) => {
      const visibleCount = ui.visiblePlayerCards[handIndex] || 0;
      const cards = hand.cards.slice(0, visibleCount);
      const active =
        game.phase === "player" && game.activeHandIndex === handIndex;
      const handTotal = formatHandTotal(cards);
      const resultLabel = hand.result
        ? hand.result === "blackjack"
          ? "Blackjack"
          : hand.result
        : "";
      const stateLabel = active
        ? "Play now"
        : hand.result
          ? ""
          : hand.bust
          ? "Bust"
          : hand.stood
            ? "Standing"
            : "";
      const cardsMarkup = cards
        .map((card, cardIndex) =>
          cardMarkup(
            card,
            cardIndex,
            ui.enteringHand?.owner === "player" &&
              ui.enteringHand?.index === handIndex &&
              cardIndex === cards.length - 1,
          ),
        )
        .join("");

      return `
        <section class="player-hand ${active ? "active" : ""} ${hand.result || ""}">
          <div class="player-hand-meta">
            <span>${game.playerHands.length > 1 ? `Hand ${handIndex + 1}` : "Main hand"}</span>
            <strong>Total ${handTotal}</strong>
            <span>${formatMoney(hand.wager)}</span>
            ${stateLabel ? `<em class="hand-state">${stateLabel}</em>` : ""}
            ${resultLabel ? `<em>${resultLabel}</em>` : ""}
          </div>
          <div class="cards">${cardsMarkup}</div>
        </section>
      `;
    })
    .join("");

  elements.dealerCards.innerHTML = dealerCards
    .map((card, index) =>
      cardMarkup(
        card,
        index,
        ui.enteringHand?.owner === "dealer" &&
          index === dealerCards.length - 1,
      ),
    )
    .join("");

  const visibleScores = game.playerHands.map((hand, index) => {
    const cards = hand.cards.slice(0, ui.visiblePlayerCards[index] || 0);
    return formatHandTotal(cards);
  });
  if (visibleScores.length > 1 && game.phase === "player") {
    elements.playerScore.textContent =
      visibleScores[game.activeHandIndex] || "--";
    elements.playerTotalLabel.textContent =
      `Hand ${game.activeHandIndex + 1} total`;
  } else {
    elements.playerScore.textContent =
      visibleScores.length > 1
        ? visibleScores.join(" | ")
        : visibleScores[0] || "--";
    elements.playerTotalLabel.textContent =
      visibleScores.length > 1 ? "Final totals" : "Your total";
  }
  elements.dealerScore.textContent = formatHandTotal(dealerCards);
}

function renderHistory() {
  if (!game.history.length) {
    elements.history.innerHTML =
      '<li class="empty-history">Your completed rounds will appear here.</li>';
    return;
  }

  elements.history.innerHTML = game.history
    .map((round) => {
      const sign = round.amount > 0 ? "+" : "";
      const amount =
        round.amount === 0 ? "Even" : `${sign}${formatMoney(round.amount)}`;
      return `
        <li class="history-item ${round.result}">
          <i class="history-mark"></i>
          <span>${round.label} &middot; ${round.playerValue} vs ${round.dealerValue}</span>
          <strong>${amount}</strong>
        </li>
      `;
    })
    .join("");
}

function formatChip(value) {
  if (value < 1) return `${Math.round(value * 100)}p`;
  return `£${value.toLocaleString("en-GB")}`;
}

function syncWalletFromActiveGame() {
  if (ui.activeGame === "roulette") {
    wallet.setBalance("roulette", roulette.balance);
  } else {
    wallet.setBalance("blackjack", game.balance);
  }
}

function syncEngineFromWallet(gameName) {
  const balance = wallet.getBalance(gameName);
  if (gameName === "roulette") {
    roulette.setBalance(balance);
    return;
  }

  if (["betting", "round-over"].includes(game.phase)) {
    game.balance = balance;
    if (game.pendingBet > game.balance) game.clearBet();
  }
}

function currentBalance() {
  return ui.activeGame === "roulette" ? roulette.balance : game.balance;
}

function currentDisplayedBet() {
  if (ui.activeGame === "roulette") return roulette.pendingTotal();

  if (game.phase === "player" || game.phase === "dealer") {
    return game.totalWager();
  }
  if (game.phase === "insurance") return game.initialBet + game.insuranceBet;
  return game.pendingBet;
}

function canSwitchGames() {
  return !ui.busy && ["betting", "round-over"].includes(game.phase);
}

function switchGame(nextGame) {
  if (nextGame === ui.activeGame || !canSwitchGames()) return;
  syncWalletFromActiveGame();
  ui.activeGame = nextGame;
  syncEngineFromWallet(nextGame);
  render();
}

function getPrimaryChipValues(balance) {
  if (balance <= 5) return [0.1, 0.25, 0.5, 1, 2];
  if (balance <= 25) return [0.25, 0.5, 1, 2, 5];
  if (balance <= 100) return [0.5, 1, 2, 5, 10];
  if (balance <= 500) return [1, 5, 10, 25, 50];
  if (balance <= 2000) return [5, 10, 25, 50, 100];
  if (balance <= 10000) return [10, 25, 50, 100, 500];
  return [25, 100, 500, 1000, 5000];
}

function chipMarkup(value, index, canBet) {
  const unavailable = !canBet || game.pendingBet + value > game.balance;
  return `
    <button
      class="chip chip-tone-${index % 8}"
      data-chip="${value}"
      type="button"
      aria-label="Bet ${formatChip(value)}"
      ${unavailable ? "disabled" : ""}
    >
      ${formatChip(value)}
    </button>
  `;
}

function renderChips(canBet) {
  const primaryValues = getPrimaryChipValues(game.balance);
  const extraValues = BLACKJACK_CHIP_VALUES.filter(
    (value) => !primaryValues.includes(value),
  );

  elements.primaryChips.innerHTML = primaryValues
    .map((value, index) => chipMarkup(value, index, canBet))
    .join("");
  elements.extraChips.innerHTML = extraValues
    .map((value, index) => chipMarkup(value, index + 3, canBet))
    .join("");
  elements.extraChips.hidden = !ui.extraChipsOpen;
  elements.extraChipsToggle.setAttribute(
    "aria-expanded",
    String(ui.extraChipsOpen),
  );
}

function getRoulettePrimaryChipValues(balance) {
  if (balance <= 1) return [0.01, 0.05, 0.1, 0.25, 0.5];
  if (balance <= 10) return [0.01, 0.1, 0.25, 0.5, 1];
  if (balance <= 100) return [0.01, 0.1, 1, 5, 10];
  if (balance <= 1000) return [0.01, 1, 5, 25, 50];
  return [0.01, 5, 25, 100, 500];
}

function rouletteChipMarkup(value, index) {
  const unavailable = ui.busy || roulette.pendingTotal() + value > roulette.balance;
  return `
    <button
      class="chip chip-tone-${index % 8} ${ui.selectedRouletteChip === value ? "selected-chip" : ""}"
      data-roulette-chip="${value}"
      type="button"
      aria-label="Select ${formatChip(value)} chip"
      aria-pressed="${ui.selectedRouletteChip === value}"
      ${unavailable ? "disabled" : ""}
    >
      ${formatChip(value)}
    </button>
  `;
}

function renderRouletteChips() {
  const primaryValues = getRoulettePrimaryChipValues(roulette.balance);
  const extraValues = ROULETTE_CHIP_VALUES.filter(
    (value) => !primaryValues.includes(value),
  );

  elements.roulettePrimaryChips.innerHTML = primaryValues
    .map((value, index) => rouletteChipMarkup(value, index))
    .join("");
  elements.rouletteExtraChips.innerHTML = extraValues
    .map((value, index) => rouletteChipMarkup(value, index + 4))
    .join("");
  elements.rouletteExtraChips.hidden = !ui.rouletteExtraChipsOpen;
  elements.rouletteExtraChipsToggle.setAttribute(
    "aria-expanded",
    String(ui.rouletteExtraChipsOpen),
  );
}

function numbersLabel(numbers) {
  return numbers.join("/");
}

function stakeForPosition(positionKey) {
  return (
    roulette.pendingBets.find((bet) => bet.positionKey === positionKey)?.stake ||
    0
  );
}

function stakeBadge(stake) {
  return stake > 0 ? `<small>${formatMoney(stake)}</small>` : "";
}

function rouletteButton({
  className = "",
  label,
  type,
  numbers,
  section,
  positionKey,
}) {
  const spec = createBetSpec({ type, label, numbers, section, positionKey });
  const stake = stakeForPosition(spec.positionKey);
  return `
    <button
      class="${className} ${stake > 0 ? "has-stake" : ""}"
      data-roulette-type="${spec.type}"
      data-roulette-label="${spec.label}"
      data-roulette-numbers="${spec.numbers.join(",")}"
      data-roulette-section="${spec.section}"
      data-roulette-position="${spec.positionKey}"
      type="button"
      ${ui.busy ? "disabled" : ""}
    >
      <span>${label}</span>${stakeBadge(stake)}
    </button>
  `;
}

function renderRouletteNumberGrid() {
  const zeroButton = rouletteButton({
    className: "roulette-number roulette-number-zero green-number",
    label: "0",
    type: "straight",
    numbers: [0],
  });
  const numberButtons = Array.from({ length: 36 }, (_, index) => index + 1)
    .map((number) =>
      rouletteButton({
        className: `roulette-number ${getNumberColor(number)}-number`,
        label: String(number),
        type: "straight",
        numbers: [number],
      }),
    )
    .join("");

  elements.rouletteNumberGrid.innerHTML = `
    ${zeroButton}
    <div class="roulette-main-numbers">${numberButtons}</div>
  `;
}

function rowStarts(limit = 34) {
  const starts = [];
  for (let start = 1; start <= limit; start += 3) starts.push(start);
  return starts;
}

function splitSpecs() {
  const specs = [
    [0, 1],
    [0, 2],
    [0, 3],
  ];
  for (const start of rowStarts()) {
    specs.push([start, start + 1], [start + 1, start + 2]);
  }
  for (let number = 1; number <= 33; number += 1) {
    specs.push([number, number + 3]);
  }
  return specs;
}

function renderRouletteComboGrid() {
  const streets = rowStarts()
    .map((start) =>
      rouletteButton({
        className: "roulette-combo-button",
        label: `${start}-${start + 2}`,
        type: "street",
        numbers: [start, start + 1, start + 2],
      }),
    )
    .join("");
  const lines = rowStarts(31)
    .map((start) =>
      rouletteButton({
        className: "roulette-combo-button",
        label: `${start}-${start + 5}`,
        type: "line",
        numbers: [start, start + 1, start + 2, start + 3, start + 4, start + 5],
      }),
    )
    .join("");
  const corners = rowStarts(31)
    .flatMap((start) => [
      [start, start + 1, start + 3, start + 4],
      [start + 1, start + 2, start + 4, start + 5],
    ])
    .map((numbers) =>
      rouletteButton({
        className: "roulette-combo-button",
        label: numbersLabel(numbers),
        type: "corner",
        numbers,
      }),
    )
    .join("");
  const splits = splitSpecs()
    .map((numbers) =>
      rouletteButton({
        className: "roulette-combo-button",
        label: numbersLabel(numbers),
        type: "split",
        numbers,
      }),
    )
    .join("");

  elements.rouletteComboGrid.innerHTML = `
    <details open>
      <summary>Street bets</summary>
      <div>${streets}</div>
    </details>
    <details>
      <summary>Line bets</summary>
      <div>${lines}</div>
    </details>
    <details>
      <summary>Corner bets</summary>
      <div>${corners}</div>
    </details>
    <details>
      <summary>Split bets</summary>
      <div>${splits}</div>
    </details>
  `;
}

function renderRouletteOutsideGrid() {
  const outsideBets = [
    ["red", "Red"],
    ["black", "Black"],
    ["odd", "Odd"],
    ["even", "Even"],
    ["low", "1-18"],
    ["high", "19-36"],
    ["dozen-1", "1st 12"],
    ["dozen-2", "2nd 12"],
    ["dozen-3", "3rd 12"],
    ["column-1", "Column 1"],
    ["column-2", "Column 2"],
    ["column-3", "Column 3"],
  ];

  elements.rouletteOutsideGrid.innerHTML = outsideBets
    .map(([kind, label]) => {
      const spec = createOutsideBet(kind, label);
      const stake = stakeForPosition(spec.positionKey);
      return `
        <button
          class="roulette-outside-button ${kind} ${stake > 0 ? "has-stake" : ""}"
          data-roulette-type="${spec.type}"
          data-roulette-label="${spec.label}"
          data-roulette-numbers="${spec.numbers.join(",")}"
          data-roulette-section="${spec.section}"
          data-roulette-position="${spec.positionKey}"
          type="button"
          ${ui.busy ? "disabled" : ""}
        >
          <span>${label}</span>${stakeBadge(stake)}
        </button>
      `;
    })
    .join("");
}

function renderRacetrack() {
  elements.racetrackNumbers.innerHTML = EUROPEAN_WHEEL.map((number) => `
    <button
      class="racetrack-number ${getNumberColor(number)}-number"
      data-racetrack-number="${number}"
      type="button"
      ${ui.busy ? "disabled" : ""}
    >
      ${number}
    </button>
  `).join("");

  const specialButtons = Object.entries(SPECIAL_BETS)
    .map(([key, bet]) => `
      <button data-special-bet="${key}" type="button" ${ui.busy ? "disabled" : ""}>
        ${bet.label}
      </button>
    `)
    .join("");
  const colorSplitButtons = Object.keys(COLOR_SPLITS)
    .map((color) => `
      <button data-color-splits="${color}" type="button" ${ui.busy ? "disabled" : ""}>
        ${color === "red" ? "Red splits" : "Black splits"}
      </button>
    `)
    .join("");

  elements.rouletteSpecialGrid.innerHTML = specialButtons + colorSplitButtons;
}

function renderRouletteBetList() {
  if (!roulette.pendingBets.length) {
    elements.rouletteBetList.innerHTML =
      '<li class="empty-history">No bets placed yet.</li>';
    return;
  }

  elements.rouletteBetList.innerHTML = roulette.pendingBets
    .map((bet) => `
      <li class="history-item">
        <i class="history-mark"></i>
        <span>${bet.label} · ${bet.numbers.length} number${bet.numbers.length === 1 ? "" : "s"}</span>
        <strong>${formatMoney(bet.stake)}</strong>
      </li>
    `)
    .join("");
}

function renderRouletteSavedBets() {
  const savedBets = roulette.getSavedBets();
  if (!savedBets.length) {
    elements.rouletteSavedBets.innerHTML =
      '<p class="empty-history">Saved bets will appear here.</p>';
    return;
  }

  elements.rouletteSavedBets.innerHTML = savedBets
    .map((savedBet) => `
      <div class="saved-bet">
        <span>${savedBet.name}</span>
        <strong>${formatMoney(savedBet.bets.reduce((total, bet) => total + bet.stake, 0))}</strong>
        <button data-replay-saved-bet="${savedBet.id}" type="button">Play</button>
        <button data-delete-saved-bet="${savedBet.id}" type="button">Delete</button>
      </div>
    `)
    .join("");
}

function renderRoulettePaytable() {
  elements.roulettePaytablePanel.hidden = ui.rouletteInfoPanel !== "paytable";
  elements.rouletteRulesPanel.hidden = ui.rouletteInfoPanel !== "rules";
  for (const button of elements.rouletteInfoButtons) {
    button.classList.toggle(
      "active",
      button.dataset.rouletteInfo === ui.rouletteInfoPanel,
    );
  }

  elements.roulettePaytablePanel.innerHTML = `
    <table class="roulette-paytable">
      <thead>
        <tr><th>Bet name</th><th>Min</th><th>Max</th><th>Odds</th></tr>
      </thead>
      <tbody>
        ${ROULETTE_PAYTABLE_ROWS.map((row) => `
          <tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderRoulette() {
  renderRouletteNumberGrid();
  renderRouletteComboGrid();
  renderRouletteOutsideGrid();
  renderRacetrack();
  renderRouletteChips();
  renderRouletteBetList();
  renderRouletteSavedBets();
  renderRoulettePaytable();

  const errors = roulette.validationErrors();
  elements.rouletteValidation.textContent = errors[0] || roulette.message;
  elements.rouletteTotalStake.textContent = formatMoney(roulette.pendingTotal());
  elements.rouletteUndoBet.disabled = ui.busy || roulette.betStack.length === 0;
  elements.rouletteClearBets.disabled = ui.busy || roulette.pendingBets.length === 0;
  elements.rouletteSaveBet.disabled = ui.busy || roulette.pendingBets.length === 0;
  elements.rouletteSpin.disabled = ui.busy || !roulette.canSpin();
  elements.rouletteExtraChipsToggle.disabled = ui.busy;

  const resultStrong = elements.rouletteResult.querySelector("strong");
  const resultSmall = elements.rouletteResult.querySelector("small");
  elements.rouletteResult.classList.remove("red-number", "black-number", "green-number");
  if (ui.busy && ui.activeGame === "roulette") {
    resultStrong.textContent = "SPIN";
    resultSmall.textContent = "Wheel in motion";
  } else if (roulette.lastSpin) {
    resultStrong.textContent = roulette.lastSpin.number;
    resultSmall.textContent =
      `${roulette.lastSpin.color} · ${roulette.lastSpin.amount >= 0 ? "+" : ""}${formatMoney(roulette.lastSpin.amount)}`;
    elements.rouletteResult.classList.add(`${roulette.lastSpin.color}-number`);
  } else {
    resultStrong.textContent = "--";
    resultSmall.textContent = "Place bets to start";
  }
}

function renderStatus() {
  elements.statusPanel.classList.remove(
    "strategy-correct",
    "strategy-wrong",
    "strategy-hint",
  );

  if (ui.busy) {
    const busyStatus = {
      dealer: ["DEALER PLAYING", "Dealer draws to at least 17."],
      split: ["SPLITTING HANDS", "One new card is dealt to each hand."],
      "split-aces": ["SPLIT ACES", "Each ace receives one card, then stands."],
      deal: ["DEALING", "Please wait."],
    };
    const [kicker, message] = busyStatus[ui.stage] || busyStatus.deal;
    elements.statusKicker.textContent = kicker;
    elements.statusMessage.textContent = message;
    return;
  }

  if (ui.gameMode === "perfect" && ui.strategyFeedback) {
    const feedback = ui.strategyFeedback;
    elements.statusPanel.classList.add(`strategy-${feedback.tone}`);
    elements.statusKicker.textContent = feedback.kicker;
    elements.statusMessage.textContent = feedback.message;
    return;
  }

  const status = {
    betting: ["BETTING", "Choose chips, then press Deal."],
    insurance: ["INSURANCE", "Choose Insurance or No thanks."],
    player: [
      game.playerHands.length > 1
        ? `PLAY HAND ${game.activeHandIndex + 1}`
        : "YOUR TURN",
      "Choose Hit, Stand, Double, or Split.",
    ],
    dealer: ["DEALER'S TURN", "Dealer draws to at least 17."],
    "round-over": [
      game.result === "loss"
        ? "ROUND LOST"
        : game.result === "push"
          ? "PUSH"
          : "ROUND WON",
      game.message,
    ],
  };

  const [kicker, message] = status[game.phase];
  elements.statusKicker.textContent = kicker;
  elements.statusMessage.textContent = message;
}

function renderControls() {
  const canBet = ["betting", "round-over"].includes(game.phase);
  const insurancePhase = !ui.busy && game.phase === "insurance";
  const canDeal =
    !ui.busy &&
    canBet &&
    game.pendingBet > 0 &&
    game.pendingBet <= game.balance;
  const playerTurn = !ui.busy && game.phase === "player";

  elements.deal.disabled = !canDeal;
  elements.deal.textContent = game.phase === "round-over" ? "Deal again" : "Deal cards";
  elements.deal.hidden =
    insurancePhase || (ui.gameMode === "perfect" && playerTurn);
  elements.hit.disabled = !playerTurn;
  elements.stand.disabled = !playerTurn;
  elements.double.disabled = ui.busy || !game.canDouble();
  elements.split.disabled = ui.busy || !game.canSplit();
  elements.hit.hidden = insurancePhase;
  elements.stand.hidden = insurancePhase;
  elements.double.hidden = insurancePhase;
  elements.split.hidden = insurancePhase;
  elements.insurance.hidden = !insurancePhase;
  elements.declineInsurance.hidden = !insurancePhase;
  elements.strategyHint.hidden =
    ui.gameMode !== "perfect" || (!playerTurn && !insurancePhase);
  elements.strategyHint.disabled =
    ui.busy || (!playerTurn && !insurancePhase);
  elements.insurance.disabled = !game.canTakeInsurance();
  elements.insurance.textContent = `Insurance ${formatMoney(game.initialBet / 2)}`;
  elements.undoBet.disabled =
    ui.busy || !canBet || game.pendingBetStack.length === 0;
  elements.clearBet.disabled = ui.busy || !canBet || game.pendingBet === 0;
  elements.extraChipsToggle.disabled = ui.busy || !canBet;

  const strategyButtons = {
    hit: elements.hit,
    stand: elements.stand,
    double: elements.double,
    split: elements.split,
    insurance: elements.insurance,
    "decline-insurance": elements.declineInsurance,
  };
  for (const button of Object.values(strategyButtons)) {
    button.classList.remove("strategy-suggested");
  }
  if (ui.strategyHintAction && strategyButtons[ui.strategyHintAction]) {
    strategyButtons[ui.strategyHintAction].classList.add("strategy-suggested");
  }

  renderChips(canBet && !ui.busy);
}

function render() {
  syncWalletFromActiveGame();
  elements.blackjackView.hidden = ui.activeGame !== "blackjack";
  elements.rouletteView.hidden = ui.activeGame !== "roulette";
  for (const button of elements.gameSwitchButtons) {
    button.classList.toggle("active", button.dataset.gameSwitch === ui.activeGame);
    button.disabled = button.dataset.gameSwitch !== ui.activeGame && !canSwitchGames();
  }

  elements.balance.textContent = formatMoney(currentBalance());
  const displayedBet = currentDisplayedBet();
  elements.currentBet.textContent = formatMoney(displayedBet);
  elements.betSpotValue.textContent = formatMoney(displayedBet);
  elements.betSpot.classList.toggle(
    "visible",
    ui.activeGame === "blackjack" && displayedBet > 0,
  );
  elements.wins.textContent = game.stats.wins;
  elements.pushes.textContent = game.stats.pushes;
  elements.losses.textContent = game.stats.losses;
  elements.modeBadge.hidden =
    ui.activeGame === "blackjack" && ui.gameMode === "normal";
  elements.modeBadge.textContent =
    ui.activeGame === "roulette"
      ? "European Roulette"
      : ui.gameMode === "perfect"
        ? "Perfect strategy"
        : "Hard mode";
  elements.modeBadge.classList.toggle(
    "strategy-mode-badge",
    ui.gameMode === "perfect" || ui.activeGame === "roulette",
  );
  elements.shell.classList.toggle("strategy-mode", ui.gameMode === "perfect");
  elements.shell.classList.toggle("roulette-mode", ui.activeGame === "roulette");
  elements.sessionSettings.textContent =
    game.hardMode && game.challengeActive && !game.isBankrupt()
      ? "Forfeit"
      : "New session";
  elements.sessionSettings.disabled = ui.busy;
  elements.soundToggle.textContent = sound.muted ? "Sound off" : "Sound on";
  elements.soundToggle.setAttribute("aria-pressed", String(sound.muted));
  elements.soundToggle.setAttribute(
    "aria-label",
    sound.muted ? "Enable sound effects" : "Mute sound effects",
  );

  renderHands();
  renderHistory();
  renderStatus();
  renderControls();
  renderRoulette();
}

function wait(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

async function revealNextCard(hand) {
  await wait(CARD_DELAY);
  if (hand.owner === "player") {
    ui.visiblePlayerCards[hand.index] =
      (ui.visiblePlayerCards[hand.index] || 0) + 1;
  } else {
    ui.visibleDealerCards += 1;
  }
  ui.enteringHand = hand;
  render();
  sound.card();
  ui.enteringHand = null;
}

async function revealRemainingPlayerCards() {
  for (let index = 0; index < game.playerHands.length; index += 1) {
    while (
      (ui.visiblePlayerCards[index] || 0) <
      game.playerHands[index].cards.length
    ) {
      await revealNextCard({ owner: "player", index });
    }
  }
}

async function revealRemainingDealerCards() {
  while (ui.visibleDealerCards < game.dealerHand.length) {
    await revealNextCard({ owner: "dealer", index: 0 });
  }
}

async function finishAnimation(playResultSound = false) {
  await wait(120);
  ui.busy = false;
  ui.stage = "";
  ui.enteringHand = null;
  ui.visiblePlayerCards = game.playerHands.map((hand) => hand.cards.length);
  ui.visibleDealerCards = game.dealerHand.length;
  render();

  if (playResultSound && game.phase === "round-over") {
    if (game.playerHands.some((hand) => hand.result === "blackjack")) {
      sound.win(true);
    }
    else if (game.result === "win") sound.win();
    else if (game.result === "loss") sound.loss();
    else sound.push();
  }
}

async function dealRound() {
  if (ui.busy) return;

  ui.strategyFeedback = null;
  ui.strategyHintAction = null;

  try {
    if (!game.deal()) return;
  } catch {
    game.voidRound();
    ui.busy = false;
    render();
    return;
  }

  ui.busy = true;
  ui.stage = "deal";
  ui.visiblePlayerCards = [0];
  ui.visibleDealerCards = 0;
  render();

  await revealNextCard({ owner: "player", index: 0 });
  await revealNextCard({ owner: "dealer", index: 0 });
  await revealNextCard({ owner: "player", index: 0 });

  if (game.dealerHand.length > 1) {
    ui.stage = "dealer";
    render();
    await revealRemainingDealerCards();
  }

  await finishAnimation(game.phase === "round-over");
}

async function playAction(action, type = "action") {
  if (ui.busy) return;

  const previousPlayerCards = game.playerHands.map((hand) => hand.cards.length);
  const previousDealerCards = game.dealerHand.length;
  try {
    if (!action()) return;
  } catch {
    game.voidRound();
    ui.busy = false;
    ui.visiblePlayerCards = game.playerHands.map((hand) => hand.cards.length);
    ui.visibleDealerCards = game.dealerHand.length;
    render();
    return;
  }

  ui.busy = true;
  ui.visiblePlayerCards =
    type === "split"
      ? [1, 1]
      : game.playerHands.map((hand, index) =>
          Math.min(previousPlayerCards[index] || 0, hand.cards.length),
        );
  ui.visibleDealerCards = previousDealerCards;
  const hasPlayerCardsToReveal = game.playerHands.some(
    (hand, index) => hand.cards.length > (ui.visiblePlayerCards[index] || 0),
  );
  const splitAces =
    type === "split" && game.playerHands.every((hand) => hand.splitAces);
  ui.stage = hasPlayerCardsToReveal
    ? type === "split"
      ? splitAces
        ? "split-aces"
        : "split"
      : "deal"
    : "dealer";
  render();

  await revealRemainingPlayerCards();
  if (game.dealerHand.length > previousDealerCards) {
    ui.stage = "dealer";
    render();
    await revealRemainingDealerCards();
  }

  await finishAnimation(game.phase === "round-over");
}

function handleChipClick(event) {
  const chip = event.target.closest("[data-chip]");
  if (!chip || chip.disabled) return;

  if (game.addToBet(Number(chip.dataset.chip))) {
    sound.chip();
    render();
  }
}

function rouletteSpecFromDataset(dataset) {
  return {
    type: dataset.rouletteType,
    label: dataset.rouletteLabel,
    numbers: dataset.rouletteNumbers.split(",").map(Number),
    section: dataset.rouletteSection,
    positionKey: dataset.roulettePosition,
  };
}

function placeRouletteBet(spec) {
  if (roulette.placeBet(spec, ui.selectedRouletteChip)) {
    sound.chip();
    render();
  }
}

function placeRouletteComponents(placed) {
  if (placed) {
    sound.chip();
    render();
  }
}

async function spinRoulette() {
  if (ui.busy || !roulette.canSpin()) return;

  ui.busy = true;
  render();
  sound.spin();
  await wait(900);

  try {
    roulette.spin();
  } catch {
    roulette.voidSpin();
  }

  syncWalletFromActiveGame();
  sound.settle();
  if (roulette.result === "win") sound.win();
  else if (roulette.result === "loss") sound.loss();
  ui.busy = false;
  render();
}

function currentStrategyRecommendation() {
  return getBasicStrategyAction({
    playerCards: game.activeHand?.cards || [],
    dealerCard: game.dealerHand[0],
    canDouble: game.canDouble(),
    canSplit: game.canSplit(),
    phase: game.phase,
  });
}

function evaluateStrategyChoice(action) {
  if (ui.gameMode !== "perfect") return;

  const recommendation = currentStrategyRecommendation();
  if (!recommendation) return;

  const correct = recommendation.action === action;
  ui.strategyHintAction = null;
  ui.strategyFeedback = {
    tone: correct ? "correct" : "wrong",
    kicker: correct
      ? `CORRECT: ${recommendation.label.toUpperCase()}`
      : `BEST MOVE: ${recommendation.label.toUpperCase()}`,
    message: correct
      ? recommendation.reason
      : `${recommendation.reason} You chose ${action === "decline-insurance" ? "No insurance" : action}.`,
  };
}

async function playTrainedAction(actionName, action, type = "action") {
  evaluateStrategyChoice(actionName);
  const feedback = ui.strategyFeedback;
  await playAction(action, type);

  if (ui.gameMode === "perfect" && feedback) {
    await wait(1100);
    if (ui.strategyFeedback === feedback) {
      ui.strategyFeedback = null;
      render();
    }
  }
}

elements.primaryChips.addEventListener("click", handleChipClick);
elements.extraChips.addEventListener("click", handleChipClick);

for (const button of elements.gameSwitchButtons) {
  button.addEventListener("click", () => switchGame(button.dataset.gameSwitch));
}

elements.roulettePrimaryChips.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-roulette-chip]");
  if (!chip || chip.disabled) return;
  ui.selectedRouletteChip = Number(chip.dataset.rouletteChip);
  sound.chip();
  render();
});

elements.rouletteExtraChips.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-roulette-chip]");
  if (!chip || chip.disabled) return;
  ui.selectedRouletteChip = Number(chip.dataset.rouletteChip);
  sound.chip();
  render();
});

elements.rouletteNumberGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-roulette-type]");
  if (!button || button.disabled) return;
  placeRouletteBet(rouletteSpecFromDataset(button.dataset));
});

elements.rouletteComboGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-roulette-type]");
  if (!button || button.disabled) return;
  placeRouletteBet(rouletteSpecFromDataset(button.dataset));
});

elements.rouletteOutsideGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-roulette-type]");
  if (!button || button.disabled) return;
  placeRouletteBet(rouletteSpecFromDataset(button.dataset));
});

elements.racetrackNumbers.addEventListener("click", (event) => {
  const button = event.target.closest("[data-racetrack-number]");
  if (!button || button.disabled) return;
  placeRouletteComponents(
    roulette.placeComponents(
      createNeighbourComponents(Number(button.dataset.racetrackNumber)),
      ui.selectedRouletteChip,
    ),
  );
});

elements.rouletteSpecialGrid.addEventListener("click", (event) => {
  const special = event.target.closest("[data-special-bet]");
  const colorSplits = event.target.closest("[data-color-splits]");
  if (special && !special.disabled) {
    placeRouletteComponents(
      roulette.placeSpecialBet(special.dataset.specialBet, ui.selectedRouletteChip),
    );
  }
  if (colorSplits && !colorSplits.disabled) {
    placeRouletteComponents(
      roulette.placeColorSplits(
        colorSplits.dataset.colorSplits,
        ui.selectedRouletteChip,
      ),
    );
  }
});

elements.rouletteExtraChipsToggle.addEventListener("click", () => {
  ui.rouletteExtraChipsOpen = !ui.rouletteExtraChipsOpen;
  render();
});

elements.rouletteUndoBet.addEventListener("click", () => {
  if (roulette.undoBet()) {
    sound.clearChips();
    render();
  }
});

elements.rouletteClearBets.addEventListener("click", () => {
  if (roulette.clearBets()) {
    sound.clearChips();
    render();
  }
});

elements.rouletteSaveBet.addEventListener("click", () => {
  const saved = roulette.saveCurrentBet(
    `Bet ${roulette.getSavedBets().length + 1}`,
  );
  if (saved) {
    sound.chip();
    render();
  }
});

elements.rouletteSavedBets.addEventListener("click", (event) => {
  const replay = event.target.closest("[data-replay-saved-bet]");
  const remove = event.target.closest("[data-delete-saved-bet]");
  if (replay) {
    placeRouletteComponents(roulette.replaySavedBet(replay.dataset.replaySavedBet));
  }
  if (remove && roulette.deleteSavedBet(remove.dataset.deleteSavedBet)) {
    sound.clearChips();
    render();
  }
});

for (const button of elements.rouletteInfoButtons) {
  button.addEventListener("click", () => {
    ui.rouletteInfoPanel = button.dataset.rouletteInfo;
    renderRoulettePaytable();
  });
}

elements.rouletteSpin.addEventListener("click", spinRoulette);

elements.extraChipsToggle.addEventListener("click", () => {
  ui.extraChipsOpen = !ui.extraChipsOpen;
  renderControls();
});

elements.clearBet.addEventListener("click", () => {
  if (game.clearBet()) {
    sound.clearChips();
    render();
  }
});

elements.undoBet.addEventListener("click", () => {
  if (game.undoBet()) {
    sound.clearChips();
    render();
  }
});

elements.deal.addEventListener("click", dealRound);

elements.hit.addEventListener("click", () =>
  playTrainedAction("hit", () => game.hit()),
);

elements.stand.addEventListener("click", () =>
  playTrainedAction("stand", () => game.stand()),
);

elements.double.addEventListener("click", () =>
  playTrainedAction("double", () => game.doubleDown(), "double"),
);

elements.split.addEventListener("click", () =>
  playTrainedAction("split", () => game.split(), "split"),
);

elements.insurance.addEventListener("click", () =>
  playTrainedAction("insurance", () => game.takeInsurance(), "insurance"),
);

elements.declineInsurance.addEventListener("click", () =>
  playTrainedAction(
    "decline-insurance",
    () => game.declineInsurance(),
    "insurance",
  ),
);

elements.strategyHint.addEventListener("click", () => {
  const recommendation = currentStrategyRecommendation();
  if (!recommendation) return;

  ui.strategyHintAction = recommendation.action;
  ui.strategyFeedback = {
    tone: "hint",
    kicker: `HINT: ${recommendation.label.toUpperCase()}`,
    message: recommendation.reason,
  };
  render();
});

elements.soundToggle.addEventListener("click", () => {
  sound.setMuted(!sound.muted);
  window.localStorage.setItem("avis-casino-muted", String(sound.muted));
  if (!sound.muted) sound.chip();
  render();
});

function setView(view, { persist = true } = {}) {
  const mobile = view === "mobile";
  elements.shell.classList.toggle("mobile-preview", mobile);
  document.body.classList.toggle("show-mobile-preview", mobile);
  for (const button of elements.viewButtons) {
    button.classList.toggle("active", button.dataset.view === view);
    button.setAttribute("aria-pressed", String(button.dataset.view === view));
  }
  if (persist) window.localStorage.setItem("avis-casino-view", view);
}

for (const button of elements.viewButtons) {
  button.addEventListener("click", () => setView(button.dataset.view));
}

function selectedSessionGame() {
  return (
    elements.sessionGames.find((sessionGame) => sessionGame.checked)?.value ||
    ui.pendingSessionGame ||
    "blackjack"
  );
}

function renderSessionDialogStep() {
  const gameName = selectedSessionGame();
  const gameLabel = gameName === "roulette" ? "Roulette" : "Blackjack";
  const onGameStep = ui.sessionStep === 1;

  elements.sessionStepGame.hidden = !onGameStep;
  elements.sessionStepOptions.hidden = onGameStep;
  elements.sessionBack.hidden = onGameStep;
  elements.sessionForfeit.hidden = true;
  elements.sessionNext.hidden = !onGameStep;
  elements.sessionSubmit.hidden = onGameStep;
  elements.blackjackModeSection.hidden = gameName !== "blackjack";
  elements.sessionTitle.textContent = onGameStep
    ? "Pick a game"
    : `Set up ${gameLabel}`;
  elements.sessionCopy.textContent = onGameStep
    ? "Choose the table you want to open first."
    : gameName === "blackjack"
      ? "Choose a wallet style, starting money, and Blackjack mode."
      : "Choose a wallet style and starting money for European Roulette.";
}

function goToSessionOptions() {
  ui.pendingSessionGame = selectedSessionGame();
  ui.sessionStep = 2;
  elements.sessionError.textContent = "";
  renderSessionDialogStep();
}

function openSessionDialog(required = false) {
  ui.sessionRequired = required;
  ui.sessionStep = 1;
  ui.pendingSessionGame = ui.activeGame;
  elements.sessionCancel.hidden = required;
  elements.startingBankroll.value = String(game.startingBalance);
  for (const sessionGame of elements.sessionGames) {
    sessionGame.checked = sessionGame.value === ui.activeGame;
  }
  for (const walletMode of elements.walletModes) {
    walletMode.checked = walletMode.value === ui.walletMode;
  }
  for (const mode of elements.gameModes) {
    mode.checked = mode.value === ui.gameMode;
  }
  elements.sessionError.textContent = "";
  renderSessionDialogStep();
  elements.sessionDialog.showModal();
}

for (const preset of elements.bankrollPresets) {
  preset.addEventListener("click", () => {
    elements.startingBankroll.value = preset.dataset.bankroll;
  });
}

elements.sessionCancel.addEventListener("click", () => {
  if (!ui.sessionRequired) elements.sessionDialog.close();
});

elements.sessionNext.addEventListener("click", goToSessionOptions);

elements.sessionBack.addEventListener("click", () => {
  ui.sessionStep = 1;
  elements.sessionError.textContent = "";
  elements.sessionForfeit.hidden = true;
  renderSessionDialogStep();
});

elements.sessionForfeit.addEventListener("click", () => {
  if (!game.forfeitChallenge()) return;
  elements.sessionError.textContent =
    "Challenge forfeited. You can now start a new Blackjack session.";
  elements.sessionForfeit.hidden = true;
});

for (const sessionGame of elements.sessionGames) {
  sessionGame.addEventListener("change", () => {
    ui.pendingSessionGame = selectedSessionGame();
    renderSessionDialogStep();
  });
}

elements.sessionDialog.addEventListener("cancel", (event) => {
  if (ui.sessionRequired) event.preventDefault();
});

elements.sessionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (ui.sessionStep === 1) {
    goToSessionOptions();
    return;
  }

  const startingBalance = Number(elements.startingBankroll.value);
  const selectedGame = ui.pendingSessionGame || selectedSessionGame();
  const selectedWalletMode =
    elements.walletModes.find((walletMode) => walletMode.checked)?.value ||
    "universal";
  const selectedMode =
    elements.gameModes.find((mode) => mode.checked)?.value || "normal";

  try {
    if (selectedGame === "blackjack") {
      const configured = game.configureSession({
        startingBalance,
        hardMode: selectedMode === "hard",
      });
      if (!configured) {
        elements.sessionError.textContent =
          "Forfeit the active hard-mode challenge before changing Blackjack settings.";
        elements.sessionForfeit.hidden = false;
        return;
      }
      ui.gameMode = selectedMode;
    } else if (game.canConfigureSession()) {
      game.configureSession({
        startingBalance,
        hardMode: false,
      });
    }

    wallet.configure({
      mode: selectedWalletMode,
      startingBalance,
    });
    roulette.configureSession({ startingBalance });
    ui.walletMode = selectedWalletMode;
    ui.activeGame = selectedGame;
    if (selectedGame === "blackjack" || game.canConfigureSession()) {
      syncEngineFromWallet("blackjack");
    }
    syncEngineFromWallet("roulette");
    ui.visiblePlayerCards = [];
    ui.visibleDealerCards = 0;
    ui.extraChipsOpen = false;
    ui.rouletteExtraChipsOpen = false;
    ui.selectedRouletteChip = 0.01;
    ui.strategyFeedback = null;
    ui.strategyHintAction = null;
    elements.sessionDialog.close();
    sound.chip();
    render();
  } catch (error) {
    elements.sessionError.textContent = error.message;
  }
});

elements.sessionSettings.addEventListener("click", () => {
  if (ui.busy) return;
  openSessionDialog(false);
});

elements.forfeitDialog.addEventListener("close", () => {
  if (elements.forfeitDialog.returnValue === "confirm") {
    game.forfeitChallenge();
    openSessionDialog(true);
  }
});

document.addEventListener("keydown", (event) => {
  if (
    event.target.matches("button, input") ||
    elements.sessionDialog.open ||
    elements.forfeitDialog.open
  ) {
    return;
  }

  const key = event.key.toLowerCase();
  if (ui.activeGame === "roulette") {
    if (event.key === "Enter" && !elements.rouletteSpin.disabled) {
      elements.rouletteSpin.click();
    }
    return;
  }

  if (key === "h" && !elements.hit.disabled) elements.hit.click();
  if (key === "s" && !elements.stand.disabled) elements.stand.click();
  if (key === "d" && !elements.double.disabled) elements.double.click();
  if (key === "p" && !elements.split.disabled) elements.split.click();
  if (event.key === "Enter" && !elements.deal.disabled) elements.deal.click();
});

const phoneViewport = window.matchMedia("(max-width: 700px)");
setView(
  phoneViewport.matches
    ? "mobile"
    : window.localStorage.getItem("avis-casino-view") ||
        window.localStorage.getItem("blackjack-view") ||
        "desktop",
  { persist: false },
);

phoneViewport.addEventListener("change", (event) => {
  if (event.matches) setView("mobile", { persist: false });
});

render();
window.setTimeout(() => openSessionDialog(true), 0);
