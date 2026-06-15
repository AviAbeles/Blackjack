import test from "node:test";
import assert from "node:assert/strict";
import { getBasicStrategyAction } from "../src/strategy.js";

function card(rank, suit = "S") {
  return { rank, suit };
}

function recommend(playerRanks, dealerRank, options = {}) {
  return getBasicStrategyAction({
    playerCards: playerRanks.map((rank) => card(rank)),
    dealerCard: card(dealerRank),
    canDouble: options.canDouble ?? true,
    canSplit: options.canSplit ?? false,
  }).action;
}

test("pair strategy follows the supplied DAS chart", () => {
  assert.equal(recommend(["A", "A"], "10", { canSplit: true }), "split");
  assert.equal(recommend(["8", "8"], "A", { canSplit: true }), "split");
  assert.equal(recommend(["9", "9"], "7", { canSplit: true }), "stand");
  assert.equal(recommend(["9", "9"], "9", { canSplit: true }), "split");
  assert.equal(recommend(["4", "4"], "5", { canSplit: true }), "split");
  assert.equal(recommend(["K", "Q"], "6", { canSplit: true }), "stand");
});

test("soft-total strategy uses double fallbacks from the chart", () => {
  assert.equal(recommend(["A", "7"], "6"), "double");
  assert.equal(recommend(["A", "7"], "6", { canDouble: false }), "stand");
  assert.equal(recommend(["A", "7"], "9"), "hit");
  assert.equal(recommend(["A", "6"], "4"), "double");
  assert.equal(recommend(["A", "2"], "5"), "double");
});

test("hard-total strategy follows the supplied chart without surrender", () => {
  assert.equal(recommend(["10", "6"], "6"), "stand");
  assert.equal(recommend(["10", "6"], "10"), "hit");
  assert.equal(recommend(["10", "2"], "4"), "stand");
  assert.equal(recommend(["10", "2"], "3"), "hit");
  assert.equal(recommend(["6", "5"], "A"), "double");
  assert.equal(recommend(["6", "5"], "A", { canDouble: false }), "hit");
  assert.equal(recommend(["5", "5"], "9", { canSplit: true }), "double");
});

test("insurance is always declined", () => {
  assert.equal(
    getBasicStrategyAction({
      playerCards: [card("10"), card("6")],
      dealerCard: card("A"),
      phase: "insurance",
    }).action,
    "decline-insurance",
  );
});
