import { getCardValue, getHandDetails } from "./game.js";

const ACTION_LABELS = {
  hit: "Hit",
  stand: "Stand",
  double: "Double",
  split: "Split",
  "decline-insurance": "Decline insurance",
};

function result(action, reason) {
  return { action, label: ACTION_LABELS[action], reason };
}

function doubleOr(canDouble, fallback, reason) {
  return canDouble
    ? result("double", reason)
    : result(fallback, `${reason} Double is unavailable, so ${ACTION_LABELS[fallback].toLowerCase()}.`);
}

function dealerValue(card) {
  return card ? getCardValue(card) : 0;
}

function pairShouldSplit(value, dealer) {
  if (value === 11 || value === 8) return true;
  if (value === 10 || value === 5) return false;
  if (value === 9) return [2, 3, 4, 5, 6, 8, 9].includes(dealer);
  if (value === 7) return dealer >= 2 && dealer <= 7;
  if (value === 6) return dealer >= 2 && dealer <= 6;
  if (value === 4) return dealer === 5 || dealer === 6;
  if (value === 2 || value === 3) return dealer >= 2 && dealer <= 7;
  return false;
}

function softAction(total, dealer, canDouble) {
  if (total >= 19) {
    if (total === 19 && dealer === 6) {
      return doubleOr(canDouble, "stand", "Double soft 19 against a dealer 6.");
    }
    return result("stand", `Stand on soft ${total}.`);
  }

  if (total === 18) {
    if (dealer >= 2 && dealer <= 6) {
      return doubleOr(canDouble, "stand", `Double soft 18 against dealer ${dealer}.`);
    }
    if (dealer === 7 || dealer === 8) {
      return result("stand", `Stand on soft 18 against dealer ${dealer}.`);
    }
    return result("hit", `Hit soft 18 against dealer ${dealer === 11 ? "A" : dealer}.`);
  }

  if (total === 17) {
    if (dealer >= 3 && dealer <= 6) {
      return doubleOr(canDouble, "hit", `Double soft 17 against dealer ${dealer}.`);
    }
    return result("hit", "Hit soft 17.");
  }

  if (total === 16 || total === 15) {
    if (dealer >= 4 && dealer <= 6) {
      return doubleOr(canDouble, "hit", `Double soft ${total} against dealer ${dealer}.`);
    }
    return result("hit", `Hit soft ${total}.`);
  }

  if (total === 14 || total === 13) {
    if (dealer === 5 || dealer === 6) {
      return doubleOr(canDouble, "hit", `Double soft ${total} against dealer ${dealer}.`);
    }
    return result("hit", `Hit soft ${total}.`);
  }

  return result("hit", `Hit soft ${total}.`);
}

function hardAction(total, dealer, canDouble) {
  if (total >= 17) return result("stand", `Stand on hard ${total}.`);
  if (total >= 13 && total <= 16) {
    return dealer >= 2 && dealer <= 6
      ? result("stand", `Stand on hard ${total} against dealer ${dealer}.`)
      : result("hit", `Hit hard ${total} against dealer ${dealer === 11 ? "A" : dealer}.`);
  }
  if (total === 12) {
    return dealer >= 4 && dealer <= 6
      ? result("stand", `Stand on hard 12 against dealer ${dealer}.`)
      : result("hit", `Hit hard 12 against dealer ${dealer === 11 ? "A" : dealer}.`);
  }
  if (total === 11) {
    return doubleOr(canDouble, "hit", "Double hard 11.");
  }
  if (total === 10) {
    return dealer >= 2 && dealer <= 9
      ? doubleOr(canDouble, "hit", `Double hard 10 against dealer ${dealer}.`)
      : result("hit", "Hit hard 10 against a dealer 10 or ace.");
  }
  if (total === 9) {
    return dealer >= 3 && dealer <= 6
      ? doubleOr(canDouble, "hit", `Double hard 9 against dealer ${dealer}.`)
      : result("hit", `Hit hard 9 against dealer ${dealer === 11 ? "A" : dealer}.`);
  }
  return result("hit", `Hit hard ${total}.`);
}

export function getBasicStrategyAction({
  playerCards,
  dealerCard,
  canDouble = false,
  canSplit = false,
  phase = "player",
}) {
  if (phase === "insurance") {
    return result(
      "decline-insurance",
      "Basic strategy does not take insurance.",
    );
  }

  if (phase !== "player" || !playerCards?.length || !dealerCard) return null;

  const dealer = dealerValue(dealerCard);
  if (
    canSplit &&
    playerCards.length === 2 &&
    getCardValue(playerCards[0]) === getCardValue(playerCards[1]) &&
    pairShouldSplit(getCardValue(playerCards[0]), dealer)
  ) {
    return result("split", "Split this pair.");
  }

  const details = getHandDetails(playerCards);
  return details.soft
    ? softAction(details.value, dealer, canDouble)
    : hardAction(details.value, dealer, canDouble);
}
