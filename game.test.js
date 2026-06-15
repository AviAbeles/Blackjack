import test from "node:test";
import assert from "node:assert/strict";
import {
  BlackjackGame,
  createShoe,
  getHandDetails,
  getHandValue,
  isBlackjack,
} from "../src/game.js";

function card(rank, suit = "S") {
  return { rank, suit };
}

function shoeFactory(drawOrder, onCreate = () => {}) {
  return () => {
    onCreate();
    const shoe = createShoe(6);
    shoe.splice(
      shoe.length - drawOrder.length,
      drawOrder.length,
      ...[...drawOrder].reverse(),
    );
    return shoe;
  };
}

function createRiggedGame(drawOrder, options = {}) {
  return new BlackjackGame({
    ...options,
    shoeFactory: shoeFactory(drawOrder),
  });
}

function betAndDeal(game, amount = 100) {
  assert.equal(game.addToBet(amount), true);
  assert.equal(game.deal(), true);
}

test("the table uses six 52-card decks", () => {
  assert.equal(createShoe(6).length, 312);
});

test("aces are valued as 1 or 11 and soft hands are identified", () => {
  assert.deepEqual(getHandDetails([card("A"), card("6")]), {
    value: 17,
    soft: true,
  });
  assert.deepEqual(getHandDetails([card("A"), card("6"), card("10")]), {
    value: 17,
    soft: false,
  });
  assert.equal(getHandValue([card("A"), card("A"), card("9")]), 21);
});

test("blackjack requires exactly two cards", () => {
  assert.equal(isBlackjack([card("A"), card("K")]), true);
  assert.equal(isBlackjack([card("A"), card("5"), card("5")]), false);
});

test("a fresh shuffled shoe is prepared before every hand", () => {
  let shoesCreated = 0;
  const game = new BlackjackGame({
    shoeFactory: shoeFactory(
      [card("10"), card("9"), card("7"), card("8")],
      () => {
        shoesCreated += 1;
      },
    ),
  });

  betAndDeal(game, 10);
  assert.equal(shoesCreated, 1);

  game.phase = "round-over";
  game.balance = 100;
  game.pendingBet = 10;
  game.deal();
  assert.equal(shoesCreated, 2);
});

test("pending chips can be withdrawn one at a time before dealing", () => {
  const game = new BlackjackGame();

  game.addToBet(5);
  game.addToBet(25);
  game.addToBet(10);
  assert.equal(game.pendingBet, 40);

  assert.equal(game.undoBet(), true);
  assert.equal(game.pendingBet, 30);
  assert.equal(game.undoBet(), true);
  assert.equal(game.pendingBet, 5);
  assert.equal(game.undoBet(), true);
  assert.equal(game.pendingBet, 0);
  assert.equal(game.undoBet(), false);
});

test("clear removes the entire pending wager", () => {
  const game = new BlackjackGame();

  game.addToBet(5);
  game.addToBet(25);
  assert.equal(game.clearBet(), true);
  assert.equal(game.pendingBet, 0);
  assert.deepEqual(game.pendingBetStack, []);
});

test("the dealer receives no hole card during the player turn", () => {
  const game = createRiggedGame([
    card("10"),
    card("9"),
    card("7"),
    card("8"),
  ]);

  betAndDeal(game);

  assert.equal(game.playerHand.length, 2);
  assert.equal(game.dealerHand.length, 1);
  assert.equal(game.phase, "player");
});

test("the dealer hits soft 17", () => {
  const game = createRiggedGame([
    card("10"),
    card("A"),
    card("7"),
    card("6"),
    card("4"),
  ]);

  betAndDeal(game);
  game.declineInsurance();
  game.stand();

  assert.equal(game.dealerHand.length, 3);
  assert.equal(getHandValue(game.dealerHand), 21);
  assert.equal(game.result, "loss");
});

test("blackjack pays three to two", () => {
  const game = createRiggedGame([
    card("A"),
    card("9"),
    card("K"),
    card("7"),
    card("2"),
  ]);

  betAndDeal(game);

  assert.equal(game.balance, 1150);
  assert.equal(game.playerHands[0].result, "blackjack");
  assert.equal(game.history[0].amount, 150);
});

test("a regular win pays one to one", () => {
  const game = createRiggedGame([
    card("10"),
    card("8"),
    card("9"),
    card("10"),
  ]);

  betAndDeal(game);
  game.stand();

  assert.equal(game.balance, 1100);
  assert.equal(game.playerHands[0].result, "win");
  assert.equal(game.history[0].amount, 100);
});

test("equal-value cards can split once, including unlike face cards", () => {
  const game = createRiggedGame([
    card("K"),
    card("6"),
    card("Q"),
    card("9"),
    card("8"),
    card("10"),
    card("2"),
  ]);

  betAndDeal(game);
  assert.equal(game.canSplit(), true);
  assert.equal(game.split(), true);
  assert.equal(game.canSplit(), false);
  assert.equal(game.playerHands.length, 2);

  game.stand();
  game.stand();

  assert.equal(game.playerHands[0].result, "win");
  assert.equal(game.playerHands[1].result, "push");
  assert.equal(game.balance, 1100);
});

test("split aces receive one card each and automatically stand", () => {
  const game = createRiggedGame([
    card("A"),
    card("6"),
    card("A"),
    card("9"),
    card("10"),
    card("10"),
    card("2"),
  ]);

  betAndDeal(game);
  game.split();

  assert.equal(game.playerHands.length, 2);
  assert.equal(game.playerHands[0].cards.length, 2);
  assert.equal(game.playerHands[1].cards.length, 2);
  assert.equal(game.playerHands[0].stood, true);
  assert.equal(game.playerHands[1].stood, true);
  assert.equal(game.phase, "round-over");
  assert.equal(game.balance, 1200);
});

test("doubling is allowed on any two-card non-ace-split hand and draws once", () => {
  const game = createRiggedGame([
    card("5"),
    card("6"),
    card("6"),
    card("10"),
    card("10"),
    card("5"),
  ]);

  betAndDeal(game);
  assert.equal(game.canDouble(), true);
  game.doubleDown();

  assert.equal(game.playerHands[0].cards.length, 3);
  assert.equal(game.playerHands[0].doubled, true);
  assert.equal(game.playerHands[0].stood, true);
  assert.equal(game.balance, 1000);
});

test("insurance costs half the initial bet and pays two to one", () => {
  const game = createRiggedGame([
    card("10"),
    card("A"),
    card("9"),
    card("K"),
  ]);

  betAndDeal(game);
  assert.equal(game.phase, "insurance");
  game.takeInsurance();
  game.stand();

  assert.equal(game.insuranceBet, 50);
  assert.equal(game.balance, 1000);
  assert.equal(game.result, "push");
});

test("insurance is lost when the dealer does not have blackjack", () => {
  const game = createRiggedGame([
    card("10"),
    card("A"),
    card("9"),
    card("6"),
    card("10"),
  ]);

  betAndDeal(game);
  game.takeInsurance();
  game.stand();

  assert.equal(game.balance, 1050);
  assert.equal(game.result, "win");
});

test("dealer blackjack only takes the compulsory bet and busted optional bets", () => {
  const game = createRiggedGame([
    card("10"),
    card("A"),
    card("10"),
    card("5"),
    card("6"),
    card("5"),
    card("K"),
  ]);

  betAndDeal(game);
  game.declineInsurance();
  game.split();
  game.doubleDown();
  game.stand();

  assert.equal(game.dealerHand.length, 2);
  assert.equal(isBlackjack(game.dealerHand), true);
  assert.equal(game.playerHands[0].result, "loss");
  assert.equal(game.playerHands[1].result, "push");
  assert.equal(game.balance, 900);
  assert.equal(game.history[0].amount, -100);
});

test("a busted double is not returned against dealer blackjack", () => {
  const game = createRiggedGame([
    card("10"),
    card("A"),
    card("10"),
    card("5"),
    card("6"),
    card("10"),
    card("K"),
  ]);

  betAndDeal(game);
  game.declineInsurance();
  game.split();
  game.doubleDown();
  game.stand();

  assert.equal(game.playerHands[0].bust, true);
  assert.equal(game.balance, 800);
});

test("surrender is not available", () => {
  const game = new BlackjackGame();
  assert.equal(game.surrender, undefined);
});

test("a malfunction voids the round and restores all wagers", () => {
  const game = createRiggedGame([
    card("10"),
    card("9"),
    card("7"),
    card("8"),
  ]);

  betAndDeal(game);
  assert.equal(game.balance, 900);
  game.voidRound();

  assert.equal(game.balance, 1000);
  assert.equal(game.result, "push");
  assert.match(game.message, /Malfunction voids all plays and pays/);
  assert.deepEqual(game.stats, { wins: 0, pushes: 0, losses: 0 });
});

test("hard mode locks bankroll configuration until forfeited or bankrupt", () => {
  const game = new BlackjackGame({ startingBalance: 500, hardMode: true });

  assert.equal(
    game.configureSession({ startingBalance: 2000, hardMode: true }),
    false,
  );
  assert.equal(game.forfeitChallenge(), true);
  assert.equal(
    game.configureSession({ startingBalance: 2000, hardMode: true }),
    true,
  );

  game.balance = 0.09;
  assert.equal(
    game.configureSession({ startingBalance: 750, hardMode: false }),
    true,
  );
});

test("10p blackjack payouts stay penny accurate", () => {
  const game = createRiggedGame(
    [card("A"), card("9"), card("K"), card("7"), card("2")],
    { startingBalance: 1 },
  );

  betAndDeal(game, 0.1);

  assert.equal(game.balance, 1.15);
  assert.equal(game.history[0].amount, 0.15);
});
