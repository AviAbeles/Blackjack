import { BlackjackGame, getHandValue } from "./game.js";
import { TableSound } from "./sound.js";

const game = new BlackjackGame();
const CARD_DELAY = 360;
const CHIP_VALUES = [
  0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 500, 1000, 5000, 10000,
];
const storedMuted = window.localStorage.getItem("blackjack-muted") === "true";
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
  balance: document.querySelector("#balance"),
  currentBet: document.querySelector("#current-bet"),
  betSpot: document.querySelector("#bet-spot"),
  betSpotValue: document.querySelector("#bet-spot-value"),
  dealerCards: document.querySelector("#dealer-cards"),
  dealerScore: document.querySelector("#dealer-score"),
  playerHands: document.querySelector("#player-hands"),
  playerScore: document.querySelector("#player-score"),
  statusKicker: document.querySelector("#status-kicker"),
  statusMessage: document.querySelector("#status-message"),
  deal: document.querySelector("#deal"),
  hit: document.querySelector("#hit"),
  stand: document.querySelector("#stand"),
  double: document.querySelector("#double"),
  split: document.querySelector("#split"),
  insurance: document.querySelector("#insurance"),
  declineInsurance: document.querySelector("#decline-insurance"),
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
  startingBankroll: document.querySelector("#starting-bankroll"),
  bankrollPresets: [...document.querySelectorAll("[data-bankroll]")],
  hardMode: document.querySelector("#hard-mode"),
  sessionError: document.querySelector("#session-error"),
  forfeitDialog: document.querySelector("#forfeit-dialog"),
};

const ui = {
  busy: false,
  stage: "",
  enteringHand: null,
  visiblePlayerCards: [],
  visibleDealerCards: 0,
  sessionRequired: true,
  extraChipsOpen: false,
};

const suitMarkup = {
  S: "&#9824;",
  H: "&#9829;",
  D: "&#9830;",
  C: "&#9827;",
};

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
      const resultLabel = hand.result
        ? hand.result === "blackjack"
          ? "Blackjack"
          : hand.result
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
            <strong>${formatMoney(hand.wager)}</strong>
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
    return cards.length ? getHandValue(cards) : "--";
  });
  elements.playerScore.textContent =
    visibleScores.length > 1
      ? visibleScores.join(" / ")
      : visibleScores[0] || "--";
  elements.dealerScore.textContent = dealerCards.length
    ? getHandValue(dealerCards)
    : "--";
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
  const extraValues = CHIP_VALUES.filter(
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

function renderStatus() {
  if (ui.busy) {
    elements.statusKicker.textContent =
      ui.stage === "dealer" ? "DEALER DRAWING" : "DEALING";
    elements.statusMessage.textContent =
      ui.stage === "dealer"
        ? "The house completes its hand."
        : "Cards are coming to the table.";
    return;
  }

  const status = {
    betting: "PLACE YOUR BET",
    insurance: "INSURANCE",
    player: "YOUR MOVE",
    dealer: "DEALER'S TURN",
    "round-over":
      game.result === "loss"
        ? "HOUSE WINS"
        : game.result === "push"
          ? "PUSH"
          : "YOU WIN",
  };

  elements.statusKicker.textContent = status[game.phase];
  elements.statusMessage.textContent = game.message;
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
  elements.deal.hidden = insurancePhase;
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
  elements.insurance.disabled = !game.canTakeInsurance();
  elements.insurance.textContent = `Insurance ${formatMoney(game.initialBet / 2)}`;
  elements.undoBet.disabled =
    ui.busy || !canBet || game.pendingBetStack.length === 0;
  elements.clearBet.disabled = ui.busy || !canBet || game.pendingBet === 0;
  elements.extraChipsToggle.disabled = ui.busy || !canBet;
  renderChips(canBet && !ui.busy);
}

function render() {
  elements.balance.textContent = formatMoney(game.balance);
  const displayedBet =
    game.phase === "player" || game.phase === "dealer"
      ? game.totalWager()
      : game.phase === "insurance"
        ? game.initialBet + game.insuranceBet
      : game.pendingBet;
  elements.currentBet.textContent = formatMoney(displayedBet);
  elements.betSpotValue.textContent = formatMoney(displayedBet);
  elements.betSpot.classList.toggle("visible", displayedBet > 0);
  elements.wins.textContent = game.stats.wins;
  elements.pushes.textContent = game.stats.pushes;
  elements.losses.textContent = game.stats.losses;
  elements.modeBadge.hidden = !game.hardMode;
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
  ui.stage =
    game.playerHands.some(
      (hand, index) => hand.cards.length > (ui.visiblePlayerCards[index] || 0),
    )
      ? "deal"
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

elements.primaryChips.addEventListener("click", handleChipClick);
elements.extraChips.addEventListener("click", handleChipClick);

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

elements.hit.addEventListener("click", () => playAction(() => game.hit()));

elements.stand.addEventListener("click", () => playAction(() => game.stand()));

elements.double.addEventListener("click", () =>
  playAction(() => game.doubleDown(), "double"),
);

elements.split.addEventListener("click", () =>
  playAction(() => game.split(), "split"),
);

elements.insurance.addEventListener("click", () =>
  playAction(() => game.takeInsurance(), "insurance"),
);

elements.declineInsurance.addEventListener("click", () =>
  playAction(() => game.declineInsurance(), "insurance"),
);

elements.soundToggle.addEventListener("click", () => {
  sound.setMuted(!sound.muted);
  window.localStorage.setItem("blackjack-muted", String(sound.muted));
  if (!sound.muted) sound.chip();
  render();
});

function setView(view) {
  const mobile = view === "mobile";
  elements.shell.classList.toggle("mobile-preview", mobile);
  document.body.classList.toggle("show-mobile-preview", mobile);
  for (const button of elements.viewButtons) {
    button.classList.toggle("active", button.dataset.view === view);
  }
  window.localStorage.setItem("blackjack-view", view);
}

for (const button of elements.viewButtons) {
  button.addEventListener("click", () => setView(button.dataset.view));
}

function openSessionDialog(required = false) {
  ui.sessionRequired = required;
  elements.sessionCancel.hidden = required;
  elements.startingBankroll.value = String(game.startingBalance);
  elements.hardMode.checked = game.hardMode;
  elements.sessionError.textContent = "";
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

elements.sessionDialog.addEventListener("cancel", (event) => {
  if (ui.sessionRequired) event.preventDefault();
});

elements.sessionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const startingBalance = Number(elements.startingBankroll.value);

  try {
    const configured = game.configureSession({
      startingBalance,
      hardMode: elements.hardMode.checked,
    });
    if (!configured) {
      elements.sessionError.textContent =
        "Forfeit the active hard-mode challenge before changing the bankroll.";
      return;
    }

    ui.visiblePlayerCards = [];
    ui.visibleDealerCards = 0;
    ui.extraChipsOpen = false;
    elements.sessionDialog.close();
    sound.chip();
    render();
  } catch (error) {
    elements.sessionError.textContent = error.message;
  }
});

elements.sessionSettings.addEventListener("click", () => {
  if (ui.busy) return;

  if (game.hardMode && game.challengeActive && !game.isBankrupt()) {
    elements.forfeitDialog.showModal();
  } else {
    openSessionDialog(false);
  }
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
  if (key === "h" && !elements.hit.disabled) elements.hit.click();
  if (key === "s" && !elements.stand.disabled) elements.stand.click();
  if (key === "d" && !elements.double.disabled) elements.double.click();
  if (key === "p" && !elements.split.disabled) elements.split.click();
  if (event.key === "Enter" && !elements.deal.disabled) elements.deal.click();
});

setView(window.localStorage.getItem("blackjack-view") || "desktop");
render();
window.setTimeout(() => openSessionDialog(true), 0);
