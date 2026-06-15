const SUITS = ["S", "H", "D", "C"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function createShoe(deckCount = 6) {
  const cards = [];

  for (let deck = 0; deck < deckCount; deck += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ rank, suit });
      }
    }
  }

  return cards;
}

export function shuffle(cards, random = Math.random) {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function getHandDetails(cards) {
  let value = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === "A") {
      aces += 1;
      value += 11;
    } else if (["K", "Q", "J"].includes(card.rank)) {
      value += 10;
    } else {
      value += Number(card.rank);
    }
  }

  let softAces = aces;
  while (value > 21 && softAces > 0) {
    value -= 10;
    softAces -= 1;
  }

  return {
    value,
    soft: softAces > 0,
  };
}

export function getHandValue(cards) {
  return getHandDetails(cards).value;
}

export function isBlackjack(cards) {
  return cards.length === 2 && getHandValue(cards) === 21;
}

export function getCardValue(card) {
  if (card.rank === "A") return 11;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  return Number(card.rank);
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function createHand({
  cards,
  wager,
  compulsoryBet = 0,
  optionalBet = 0,
  fromSplit = false,
  splitAces = false,
}) {
  return {
    cards,
    wager,
    compulsoryBet,
    optionalBet,
    fromSplit,
    splitAces,
    doubled: false,
    stood: false,
    bust: false,
    result: null,
  };
}

export class BlackjackGame {
  constructor({
    startingBalance = 1000,
    hardMode = false,
    random = Math.random,
    shoeFactory,
  } = {}) {
    this.startingBalance = this.normalizeBalance(startingBalance);
    this.hardMode = Boolean(hardMode);
    this.challengeActive = this.hardMode;
    this.random = random;
    this.shoeFactory =
      shoeFactory || (() => shuffle(createShoe(6), this.random));
    this.resetSessionState();
  }

  resetSessionState() {
    this.balance = this.startingBalance;
    this.pendingBet = 0;
    this.pendingBetStack = [];
    this.initialBet = 0;
    this.currentBet = 0;
    this.playerHands = [];
    this.activeHandIndex = 0;
    this.dealerHand = [];
    this.insuranceBet = 0;
    this.insuranceDecision = null;
    this.hasSplit = false;
    this.phase = "betting";
    this.message = "Choose your chips, then deal the cards.";
    this.result = null;
    this.stats = { wins: 0, pushes: 0, losses: 0 };
    this.history = [];
    this.shoe = [];
    this.roundStartBalance = this.balance;
  }

  get playerHand() {
    return this.activeHand?.cards || this.playerHands[0]?.cards || [];
  }

  get activeHand() {
    return this.playerHands[this.activeHandIndex];
  }

  normalizeBalance(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0.1 || amount > 1000000) {
      throw new RangeError("Starting balance must be between 10p and £1,000,000.");
    }

    return roundMoney(amount);
  }

  configureSession({ startingBalance, hardMode = false }) {
    if (!this.canConfigureSession()) return false;

    this.startingBalance = this.normalizeBalance(startingBalance);
    this.hardMode = Boolean(hardMode);
    this.challengeActive = this.hardMode;
    this.resetSessionState();
    return true;
  }

  canConfigureSession() {
    return !this.hardMode || !this.challengeActive || this.isBankrupt();
  }

  forfeitChallenge() {
    if (!this.hardMode || !this.challengeActive || this.isBankrupt()) return false;
    this.challengeActive = false;
    return true;
  }

  isBankrupt() {
    return this.balance < 0.1;
  }

  addToBet(amount) {
    if (!["betting", "round-over"].includes(this.phase)) return false;
    const nextBet = roundMoney(this.pendingBet + Number(amount));
    if (nextBet > this.balance) return false;

    this.pendingBet = nextBet;
    this.pendingBetStack.push(roundMoney(Number(amount)));
    return true;
  }

  undoBet() {
    if (!["betting", "round-over"].includes(this.phase)) return false;
    const amount = this.pendingBetStack.pop();
    if (amount === undefined) return false;

    this.pendingBet = roundMoney(Math.max(0, this.pendingBet - amount));
    return true;
  }

  clearBet() {
    if (!["betting", "round-over"].includes(this.phase)) return false;
    if (this.pendingBet === 0) return false;
    this.pendingBet = 0;
    this.pendingBetStack = [];
    return true;
  }

  deal() {
    if (!["betting", "round-over"].includes(this.phase)) return false;
    if (this.pendingBet <= 0 || this.pendingBet > this.balance) return false;

    // The rules require a freshly shuffled six-deck shoe for every round.
    this.shoe = this.shoeFactory();
    if (!Array.isArray(this.shoe) || this.shoe.length < 4) {
      throw new Error("Malfunction: the shoe could not be prepared.");
    }

    this.roundStartBalance = this.balance;
    this.initialBet = this.pendingBet;
    this.currentBet = this.initialBet;
    this.balance = roundMoney(this.balance - this.initialBet);
    this.playerHands = [
      createHand({
        cards: [this.drawCard()],
        wager: this.initialBet,
        compulsoryBet: this.initialBet,
      }),
    ];
    this.dealerHand = [this.drawCard()];
    this.playerHands[0].cards.push(this.drawCard());
    this.activeHandIndex = 0;
    this.insuranceBet = 0;
    this.insuranceDecision = null;
    this.hasSplit = false;
    this.result = null;

    if (this.dealerHand[0].rank === "A") {
      this.phase = "insurance";
      this.message = "Dealer shows an ace. Take insurance?";
    } else {
      this.beginPlayerTurn();
    }

    return true;
  }

  beginPlayerTurn() {
    if (this.playerHands.length === 1 && isBlackjack(this.playerHands[0].cards)) {
      this.playDealer();
      return;
    }

    this.phase = "player";
    this.message = this.handPrompt();
  }

  canTakeInsurance() {
    return (
      this.phase === "insurance" &&
      this.balance >= roundMoney(this.initialBet / 2)
    );
  }

  takeInsurance() {
    if (!this.canTakeInsurance()) return false;

    this.insuranceBet = roundMoney(this.initialBet / 2);
    this.balance = roundMoney(this.balance - this.insuranceBet);
    this.insuranceDecision = "taken";
    this.finishInsuranceDecision();
    return true;
  }

  declineInsurance() {
    if (this.phase !== "insurance") return false;
    this.insuranceDecision = "declined";
    this.finishInsuranceDecision();
    return true;
  }

  finishInsuranceDecision() {
    if (isBlackjack(this.playerHands[0].cards)) {
      this.playDealer();
    } else {
      this.phase = "player";
      this.message = this.handPrompt();
    }
  }

  hit() {
    if (this.phase !== "player" || !this.activeHand || this.activeHand.splitAces) {
      return false;
    }

    this.activeHand.cards.push(this.drawCard());
    const value = getHandValue(this.activeHand.cards);

    if (value > 21) {
      this.activeHand.bust = true;
      this.activeHand.result = "loss";
      this.advanceHand();
    } else if (value === 21) {
      this.activeHand.stood = true;
      this.advanceHand();
    } else {
      this.message = this.handPrompt();
    }

    return true;
  }

  stand() {
    if (this.phase !== "player" || !this.activeHand) return false;

    this.activeHand.stood = true;
    this.advanceHand();
    return true;
  }

  canDouble() {
    return (
      this.phase === "player" &&
      this.activeHand?.cards.length === 2 &&
      !this.activeHand.splitAces &&
      this.balance >= this.activeHand.wager
    );
  }

  doubleDown() {
    if (!this.canDouble()) return false;

    const addedBet = this.activeHand.wager;
    this.balance = roundMoney(this.balance - addedBet);
    this.activeHand.optionalBet = roundMoney(
      this.activeHand.optionalBet + addedBet,
    );
    this.activeHand.wager = roundMoney(this.activeHand.wager + addedBet);
    this.activeHand.doubled = true;
    this.activeHand.cards.push(this.drawCard());

    if (getHandValue(this.activeHand.cards) > 21) {
      this.activeHand.bust = true;
      this.activeHand.result = "loss";
    } else {
      this.activeHand.stood = true;
    }

    this.advanceHand();
    return true;
  }

  canSplit() {
    if (
      this.phase !== "player" ||
      this.hasSplit ||
      this.playerHands.length !== 1 ||
      this.activeHand?.cards.length !== 2 ||
      this.balance < this.initialBet
    ) {
      return false;
    }

    const [first, second] = this.activeHand.cards;
    return getCardValue(first) === getCardValue(second);
  }

  split() {
    if (!this.canSplit()) return false;

    const [firstCard, secondCard] = this.activeHand.cards;
    const splittingAces = firstCard.rank === "A" && secondCard.rank === "A";
    this.balance = roundMoney(this.balance - this.initialBet);
    this.hasSplit = true;
    this.playerHands = [
      createHand({
        cards: [firstCard, this.drawCard()],
        wager: this.initialBet,
        compulsoryBet: this.initialBet,
        fromSplit: true,
        splitAces: splittingAces,
      }),
      createHand({
        cards: [secondCard, this.drawCard()],
        wager: this.initialBet,
        optionalBet: this.initialBet,
        fromSplit: true,
        splitAces: splittingAces,
      }),
    ];
    this.activeHandIndex = 0;

    if (splittingAces) {
      for (const hand of this.playerHands) {
        hand.stood = true;
      }
      this.playDealer();
    } else {
      this.phase = "player";
      this.message = this.handPrompt();
    }

    return true;
  }

  advanceHand() {
    const nextIndex = this.playerHands.findIndex(
      (hand, index) => index > this.activeHandIndex && !hand.stood && !hand.bust,
    );

    if (nextIndex !== -1) {
      this.activeHandIndex = nextIndex;
      this.phase = "player";
      this.message = this.handPrompt();
      return;
    }

    this.playDealer();
  }

  handPrompt() {
    const handNumber =
      this.playerHands.length > 1 ? `Hand ${this.activeHandIndex + 1}: ` : "";
    return `${handNumber}${getHandValue(this.activeHand.cards)}. Choose an action.`;
  }

  playDealer() {
    this.phase = "dealer";
    this.dealerHand.push(this.drawCard());

    if (!isBlackjack(this.dealerHand)) {
      let details = getHandDetails(this.dealerHand);
      while (details.value < 17 || (details.value === 17 && details.soft)) {
        this.dealerHand.push(this.drawCard());
        details = getHandDetails(this.dealerHand);
      }
    }

    this.settleRound();
  }

  settleRound() {
    const dealerBlackjack = isBlackjack(this.dealerHand);
    const dealerValue = getHandValue(this.dealerHand);

    if (this.insuranceBet > 0 && dealerBlackjack) {
      this.balance = roundMoney(this.balance + this.insuranceBet * 3);
    }

    for (const hand of this.playerHands) {
      if (dealerBlackjack) {
        this.settleAgainstDealerBlackjack(hand);
      } else {
        this.settleRegularHand(hand, dealerValue);
      }
    }

    const net = roundMoney(this.balance - this.roundStartBalance);
    this.result = net > 0 ? "win" : net < 0 ? "loss" : "push";
    this.phase = "round-over";
    this.message = this.roundMessage(dealerBlackjack, dealerValue, net);

    if (this.result === "win") this.stats.wins += 1;
    else if (this.result === "loss") this.stats.losses += 1;
    else this.stats.pushes += 1;

    this.history.unshift({
      result: this.result,
      label:
        this.playerHands.length > 1
          ? `${this.playerHands.length} hands`
          : this.playerHands[0].result === "blackjack"
            ? "Blackjack"
            : { win: "Won", loss: "Lost", push: "Push" }[this.result],
      amount: net,
      playerValue: this.playerHands
        .map((hand) => getHandValue(hand.cards))
        .join("/"),
      dealerValue,
    });
    this.history = this.history.slice(0, 8);

    this.pendingBet = Math.min(this.initialBet, this.balance);
    this.pendingBetStack =
      this.pendingBet > 0 ? [this.pendingBet] : [];
    this.currentBet = this.totalWager();
    if (this.isBankrupt()) {
      this.pendingBet = 0;
      this.message = `${this.message} Your bankroll is empty.`;
    }
  }

  settleAgainstDealerBlackjack(hand) {
    if (!hand.fromSplit && isBlackjack(hand.cards)) {
      this.balance = roundMoney(this.balance + hand.wager);
      hand.result = "push";
      return;
    }

    if (!hand.bust && hand.optionalBet > 0) {
      this.balance = roundMoney(this.balance + hand.optionalBet);
    }
    hand.result = hand.bust ? "loss" : hand.compulsoryBet > 0 ? "loss" : "push";
  }

  settleRegularHand(hand, dealerValue) {
    const playerValue = getHandValue(hand.cards);
    if (hand.bust) {
      hand.result = "loss";
      return;
    }

    if (!hand.fromSplit && isBlackjack(hand.cards)) {
      this.balance = roundMoney(this.balance + hand.wager * 2.5);
      hand.result = "blackjack";
    } else if (dealerValue > 21 || playerValue > dealerValue) {
      this.balance = roundMoney(this.balance + hand.wager * 2);
      hand.result = "win";
    } else if (playerValue === dealerValue) {
      this.balance = roundMoney(this.balance + hand.wager);
      hand.result = "push";
    } else {
      hand.result = "loss";
    }
  }

  roundMessage(dealerBlackjack, dealerValue, net) {
    const insuranceText =
      this.insuranceBet > 0 && dealerBlackjack ? " Insurance pays 2 to 1." : "";
    if (dealerBlackjack) {
      return `Dealer has Blackjack.${insuranceText} Optional live bets are returned.`;
    }
    if (dealerValue > 21) return `Dealer busts with ${dealerValue}.`;
    if (this.playerHands.length > 1) {
      return `Split hands settled against dealer ${dealerValue}.`;
    }
    if (this.playerHands[0].result === "blackjack") {
      return "Blackjack! Paid 3 to 2.";
    }
    if (net > 0) return `${getHandValue(this.playerHand)} beats ${dealerValue}.`;
    if (net === 0) return `Push against dealer ${dealerValue}.`;
    return `Dealer ${dealerValue} wins.`;
  }

  totalWager() {
    return roundMoney(
      this.playerHands.reduce((total, hand) => total + hand.wager, 0) +
        this.insuranceBet,
    );
  }

  voidRound() {
    if (!["betting", "round-over"].includes(this.phase)) {
      this.balance = this.roundStartBalance;
    }
    for (const hand of this.playerHands) {
      hand.result = "push";
    }
    this.phase = "round-over";
    this.result = "push";
    this.message = "Malfunction voids all plays and pays. All wagers returned.";
    this.pendingBet = Math.min(this.initialBet || this.pendingBet, this.balance);
    this.pendingBetStack =
      this.pendingBet > 0 ? [this.pendingBet] : [];
    this.currentBet = 0;
  }

  drawCard() {
    const card = this.shoe.pop();
    if (!card) {
      throw new Error("Malfunction: the shoe ran out of cards.");
    }
    return card;
  }
}
