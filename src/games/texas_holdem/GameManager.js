const Deck = require("./Deck");
const { THGameState, Street, Position } = require("./THGameState");
const { Action, ActionType } = require("./Action");
const { evaluate } = require("./HandEvaluator");
const HandHistory = require("../../models/HandHistory");
const User = require("../../models/User");

const NUM_SEATS = 6;
const MIN_RAISE = 2;
const MAX_HAND_BET = 150;

const POSITIONS = [
  Position.BTN,
  Position.SB,
  Position.BB,
  Position.UTG,
  Position.MP,
  Position.CO,
];

class GameManager {
  constructor(botRegistry, smallBlind = 1, bigBlind = 2) {
    this.botRegistry = botRegistry;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
  }

  // ============================================================
  // Public: called by deal endpoint to start a fresh hand
  // ============================================================

  async startHand(gameState, user) {
    const activeSeats = this._getActiveSeats(gameState, user);
    if (activeSeats.length < 2) throw new Error("Not enough active players");

    // Advance dealer button
    gameState.dealerSeat = this._nextActiveAfter(
      gameState.dealerSeat,
      activeSeats,
    );
    const dealer = gameState.dealerSeat;
    const sbSeat = this._nextActiveAfter(dealer, activeSeats);
    const bbSeat = this._nextActiveAfter(sbSeat, activeSeats);

    // Build deck and deal hole cards
    const deck = new Deck();

    // // =====================================================================
    // // TESTING ONLY: force player Royal Flush. Remove before ship.
    // // Moves royal flush cards to the front of the deck BEFORE dealing so
    // // no bot can accidentally receive them. Player lands in seat 0 which
    // // is dealt last in activeSeats order; community cards follow.
    // // Deal order: each seat gets 2 cards sequentially, so seat 0 receives
    // // cards at index (activeSeats.indexOf(0) * 2) and +1. We pre-arrange
    // // the full deck so those slots are As/Ks and the next 5 are Qs Js Ts 2h 2d.
    // const _TEST_ROYAL = ["As", "Ks", "Qs", "Js", "Ts", "2h", "2d"];
    // const _otherCards = deck.cards.filter((c) => !_TEST_ROYAL.includes(c));
    // const _p0idx = activeSeats.indexOf(0);
    // const _before = _otherCards.splice(0, _p0idx * 2);
    // deck.cards = [
    //   ..._before, // other seats' hole cards before player
    //   "As",
    //   "Ks", // player hole cards
    //   ..._otherCards, // remaining bot hole cards
    //   "Qs",
    //   "Js",
    //   "Ts",
    //   "2h",
    //   "2d", // community cards (flop + turn + river)
    // ];
    // // =====================================================================

    const holeCards = {};
    const seatBets = {};
    const seatTotalBets = {};

    for (const seat of activeSeats) {
      holeCards[String(seat)] = deck.deal(2);
      seatBets[String(seat)] = 0;
      seatTotalBets[String(seat)] = 0;
    }

    // Post blinds
    const sbBlind = this._deductBlind(sbSeat, this.smallBlind, gameState, user);
    seatBets[String(sbSeat)] = sbBlind;
    seatTotalBets[String(sbSeat)] = sbBlind;

    const bbBlind = this._deductBlind(bbSeat, this.bigBlind, gameState, user);
    seatBets[String(bbSeat)] = bbBlind;
    seatTotalBets[String(bbSeat)] = bbBlind;

    const allInSeats = [];
    if (this._getChips(sbSeat, gameState, user) === 0) allInSeats.push(sbSeat);
    if (
      this._getChips(bbSeat, gameState, user) === 0 &&
      !allInSeats.includes(bbSeat)
    )
      allInSeats.push(bbSeat);

    const hand = {
      deck: deck.cards,
      holeCards,
      communityCards: [],
      phase: "preflop",
      pot: sbBlind + bbBlind,
      currentBet: bbBlind,
      lastRaiseAmount: this.bigBlind,
      activeSeat: bbSeat, // findNextToAct starts here. First actor is UTG
      activeSeats, // seats dealt into this hand
      seatBets,
      seatTotalBets,
      foldedSeats: [],
      allInSeats,
      actedThisRound: [],
      streetRaises: 0,
    };

    const actionLog = [
      { type: "blind", seat: sbSeat, action: "smallBlind", amount: sbBlind },
      { type: "blind", seat: bbSeat, action: "bigBlind", amount: bbBlind },
    ];

    gameState.currentHand = hand;
    gameState.markModified("currentHand");

    return this.runLoop(gameState, user, actionLog);
  }

  // ============================================================
  // Public: main game loop
  // ============================================================

  async runLoop(gameState, user, actionLog) {
    const hand = gameState.currentHand;

    while (true) {
      const nonFolded = this._nonFoldedSeats(hand);

      if (nonFolded.length === 1) {
        return this._concludeHand(gameState, user, actionLog);
      }

      // Check if all remaining players are all-in (no more betting possible)
      const canBet = nonFolded.filter((s) => !hand.allInSeats.includes(s));
      if (canBet.length === 0) {
        while (hand.phase !== "river")
          this._advancePhase(hand, gameState, actionLog);
        return this._concludeHand(gameState, user, actionLog);
      }

      const nextSeat = this._findNextToAct(hand);

      if (nextSeat === null) {
        if (hand.phase === "river") {
          return this._concludeHand(gameState, user, actionLog);
        }
        this._advancePhase(hand, gameState, actionLog);
        continue;
      }

      hand.activeSeat = nextSeat;

      if (nextSeat === 0) {
        // Player's turn
        gameState.markModified("currentHand");
        await Promise.all([
          gameState.save(),
          User.findByIdAndUpdate(gameState.userId, { balance: user.balance }),
        ]);
        return {
          state: this.buildStateResponse(gameState, user),
          actionLog,
          handResult: null,
        };
      }

      // Bot's turn
      const aiSeat = gameState.aiSeats.find((a) => a.seat === nextSeat);
      const engineFactory = this.botRegistry[aiSeat.model];
      if (!engineFactory) throw new Error(`Unknown bot model: ${aiSeat.model}`);
      const engine = engineFactory();

      const thState = this._buildTHGameState(nextSeat, hand, gameState, user);
      const action = this._getValidBotAction(engine, thState);

      this.applyAction(hand, nextSeat, action, gameState, user);
      actionLog.push({
        type: "action",
        seat: nextSeat,
        action: action.type,
        amount: action.amount,
      });
    }
  }

  // ============================================================
  // Public: apply an action to the hand (used by controller for player + bots)
  // ============================================================

  applyAction(hand, seat, action, gameState, user) {
    const seatKey = String(seat);
    const chips = this._getChips(seat, gameState, user);
    const prevBet = hand.seatBets[seatKey] || 0;
    const toCall = Math.max(0, hand.currentBet - prevBet);

    switch (action.type) {
      case ActionType.FOLD:
      case "fold":
        hand.foldedSeats.push(seat);
        if (!hand.actedThisRound.includes(seat)) hand.actedThisRound.push(seat);
        break;

      case ActionType.CHECK:
      case "check":
        if (!hand.actedThisRound.includes(seat)) hand.actedThisRound.push(seat);
        break;

      case ActionType.CALL:
      case "call": {
        const callAmount = Math.min(toCall, chips);
        const newChips = chips - callAmount;
        this._setChips(seat, newChips, gameState, user);
        hand.seatBets[seatKey] = prevBet + callAmount;
        hand.seatTotalBets[seatKey] =
          (hand.seatTotalBets[seatKey] || 0) + callAmount;
        hand.pot += callAmount;
        if (!hand.actedThisRound.includes(seat)) hand.actedThisRound.push(seat);
        if (newChips === 0 && !hand.allInSeats.includes(seat))
          hand.allInSeats.push(seat);
        break;
      }

      case ActionType.RAISE:
      case "raise": {
        // action.amount = raise increment on top of currentBet, capped at MAX_HAND_BET per raise
        const oldBet = hand.currentBet;
        const raiseIncrement = Math.min(action.amount || 0, MAX_HAND_BET);
        const newBetLevel = oldBet + raiseIncrement;
        const additional = newBetLevel - prevBet;
        const cappedAdd = Math.min(additional, chips);
        const newChips = chips - cappedAdd;
        this._setChips(seat, newChips, gameState, user);
        hand.seatBets[seatKey] = prevBet + cappedAdd;
        hand.seatTotalBets[seatKey] =
          (hand.seatTotalBets[seatKey] || 0) + cappedAdd;
        hand.pot += cappedAdd;
        hand.lastRaiseAmount = hand.seatBets[seatKey] - oldBet;
        hand.currentBet = hand.seatBets[seatKey];
        hand.streetRaises += 1;
        hand.actedThisRound = [seat];
        if (newChips === 0 && !hand.allInSeats.includes(seat))
          hand.allInSeats.push(seat);
        break;
      }

      case ActionType.ALL_IN: {
        const allInAmount = chips;
        const newBet = prevBet + allInAmount;
        this._setChips(seat, 0, gameState, user);
        hand.seatBets[seatKey] = newBet;
        hand.seatTotalBets[seatKey] =
          (hand.seatTotalBets[seatKey] || 0) + allInAmount;
        hand.pot += allInAmount;
        if (!hand.allInSeats.includes(seat)) hand.allInSeats.push(seat);
        if (newBet > hand.currentBet) {
          hand.lastRaiseAmount = newBet - hand.currentBet;
          hand.currentBet = newBet;
          hand.streetRaises += 1;
          hand.actedThisRound = [seat];
        } else {
          if (!hand.actedThisRound.includes(seat))
            hand.actedThisRound.push(seat);
        }
        break;
      }
    }
  }

  // ============================================================
  // Public: build the state object returned to the client
  // ============================================================

  buildStateResponse(gameState, user) {
    const hand = gameState.currentHand;
    return {
      gameStateId: gameState._id,
      status: gameState.status,
      dealerSeat: gameState.dealerSeat,
      minHandBet: MIN_RAISE,
      maxHandBet: MAX_HAND_BET,
      handCount: gameState.handCount,
      playerChips: user.balance,
      aiSeats: gameState.aiSeats.map((a) => ({
        seat: a.seat,
        displayName: a.displayName,
        model: a.model,
        chips: a.chips,
        active: a.chips > 0,
      })),
      currentHand: hand
        ? {
            phase: hand.phase,
            communityCards: hand.communityCards,
            pot: hand.pot,
            currentBet: hand.currentBet,
            lastRaiseAmount: hand.lastRaiseAmount,
            activeSeat: hand.activeSeat,
            activeSeats: hand.activeSeats,
            playerCards: hand.holeCards["0"] || [],
            seatBets: hand.seatBets,
            seatTotalBets: hand.seatTotalBets,
            foldedSeats: hand.foldedSeats,
            allInSeats: hand.allInSeats,
          }
        : null,
    };
  }

  // ============================================================
  // Private: betting round helpers
  // ============================================================

  _findNextToAct(hand) {
    const seatsInPlay = hand.activeSeats;
    const startIdx = seatsInPlay.indexOf(hand.activeSeat);

    for (let i = 1; i <= seatsInPlay.length; i++) {
      const seat = seatsInPlay[(startIdx + i) % seatsInPlay.length];
      if (hand.foldedSeats.includes(seat)) continue;
      if (hand.allInSeats.includes(seat)) continue;
      const seatBet = hand.seatBets[String(seat)] || 0;
      if (!hand.actedThisRound.includes(seat) || seatBet < hand.currentBet) {
        return seat;
      }
    }
    return null;
  }

  _advancePhase(hand, gameState, actionLog) {
    const next = { preflop: "flop", flop: "turn", turn: "river" };
    const cardCount = { flop: 3, turn: 1, river: 1 };

    hand.phase = next[hand.phase];
    const cards = hand.deck.splice(0, cardCount[hand.phase]);
    hand.communityCards.push(...cards);

    // Reset betting for this street
    for (const seatKey of Object.keys(hand.seatBets))
      hand.seatBets[seatKey] = 0;
    hand.currentBet = 0;
    hand.lastRaiseAmount = 0;
    hand.streetRaises = 0;
    hand.actedThisRound = [];
    hand.activeSeat = gameState.dealerSeat; // findNextToAct starts after dealer

    actionLog.push({ type: "deal", phase: hand.phase, cards });
  }

  _nonFoldedSeats(hand) {
    return hand.activeSeats.filter((s) => !hand.foldedSeats.includes(s));
  }

  _getValidBotAction(engine, state) {
    for (let i = 0; i < 2; i++) {
      const action = engine.decide(state);
      if (this._isValidAction(action, state)) return action;
    }
    return new Action(ActionType.FOLD);
  }

  _isValidAction(action, state) {
    if (!action || !action.type) return false;
    const t = action.type;
    if (t === ActionType.FOLD || t === "fold") return true;
    if (t === ActionType.CHECK || t === "check") return state.chipsToCall === 0;
    if (t === ActionType.CALL || t === "call")
      return state.chipsToCall > 0 && state.chipsToCall < state.stack;
    if (t === ActionType.RAISE || t === "raise") {
      return (
        typeof action.amount === "number" &&
        action.amount >= state.minRaise &&
        state.chipsToCall + action.amount <= state.stack
      );
    }
    if (t === ActionType.ALL_IN) return state.stack > 0;
    return false;
  }

  // ============================================================
  // Private: conclude hand, award pots, save history
  // ============================================================

  async _concludeHand(gameState, user, actionLog) {
    const hand = gameState.currentHand;
    const nonFolded = this._nonFoldedSeats(hand);
    let winners, revealedHands, sidePots;

    if (nonFolded.length === 1) {
      const winner = nonFolded[0];
      this._addChips(winner, hand.pot, gameState, user);
      winners = [{ seat: winner, amount: hand.pot, handName: null }];
      revealedHands = {};
      sidePots = [];
    } else {
      const handStrengths = {};
      revealedHands = {};

      for (const seat of nonFolded) {
        const seatKey = String(seat);
        const ev = evaluate(hand.holeCards[seatKey], hand.communityCards);
        handStrengths[seatKey] = ev.value;
        revealedHands[seatKey] = {
          cards: hand.holeCards[seatKey],
          handName: ev.handName,
        };
      }

      const awards = this._awardPots(
        hand.seatTotalBets,
        hand.foldedSeats,
        handStrengths,
      );
      winners = [];
      for (const [seatKey, amount] of Object.entries(awards)) {
        if (amount > 0) {
          this._addChips(Number(seatKey), amount, gameState, user);
          winners.push({
            seat: Number(seatKey),
            amount,
            handName: revealedHands[seatKey]?.handName || null,
          });
        }
      }
      sidePots = this._calculateSidePots(hand.seatTotalBets, hand.foldedSeats);
    }

    // Record hand history
    const amountBet = hand.seatTotalBets["0"] || 0;
    const winnerEntry = winners.find((w) => w.seat === 0);
    const amountWon = winnerEntry ? winnerEntry.amount : 0;
    const isFolded = hand.foldedSeats.includes(0);
    const netChange = amountWon - amountBet;

    let result;
    if (isFolded) result = "fold";
    else if (netChange > 0) result = "win";
    else if (netChange < 0) result = "loss";
    else result = "split";

    const roundEliminated = isFolded ? hand.phase : null;

    try {
      const lastHand = await HandHistory.findOne({
        userId: gameState.userId,
      }).sort({ handNumber: -1 });
      await HandHistory.create({
        userId: gameState.userId,
        gameId: gameState.gameId,
        gameStateId: gameState._id,
        handNumber: (lastHand?.handNumber || 0) + 1,
        result,
        amountBet,
        amountWon,
        balanceAfter: user.balance,
        playerHand: hand.holeCards["0"] || [],
        communityCards: hand.communityCards,
        winningHandType: winners[0]?.handName || null,
        roundEliminated,
      });
    } catch (err) {
      console.error("HandHistory save failed:", err);
    }

    // Mark busted AIs inactive
    for (const ai of gameState.aiSeats) {
      if (ai.chips === 0) ai.active = false;
    }

    gameState.handCount += 1;
    gameState.currentHand = null;
    gameState.markModified("currentHand");
    gameState.updatedAt = new Date();

    const playerEliminated = user.balance === 0;
    const activeCount = this._getActiveSeats(gameState, user).length;
    const gameOver = activeCount < 2;

    if (gameOver || playerEliminated) {
      gameState.status = "completed";
    }

    await Promise.all([
      gameState.save(),
      User.findByIdAndUpdate(gameState.userId, { balance: user.balance }),
    ]);

    return {
      state: this.buildStateResponse(gameState, user),
      actionLog,
      handResult: {
        winners,
        sidePots,
        revealedHands,
        playerEliminated,
        gameOver,
      },
    };
  }

  // ============================================================
  // Private: pot award algorithm
  // ============================================================

  _awardPots(seatTotalBets, foldedSeats, handStrengths) {
    const remaining = {};
    const awards = {};
    for (const [k, v] of Object.entries(seatTotalBets)) {
      remaining[k] = v;
      awards[k] = 0;
    }

    while (Object.values(remaining).some((v) => v > 0)) {
      const minBet = Math.min(...Object.values(remaining).filter((v) => v > 0));
      const contributors = Object.keys(remaining).filter(
        (k) => remaining[k] > 0,
      );
      const potAmount = contributors.length * minBet;
      const eligible = contributors.filter(
        (k) => !foldedSeats.includes(Number(k)),
      );

      if (eligible.length > 0) {
        const bestValue = Math.max(
          ...eligible.map((k) => handStrengths[k] || 0),
        );
        const potWinners = eligible
          .filter((k) => (handStrengths[k] || 0) === bestValue)
          .sort((a, b) => Number(a) - Number(b));
        const share = Math.floor(potAmount / potWinners.length);
        const remainder = potAmount - share * potWinners.length;
        potWinners.forEach((k, i) => {
          awards[k] += share + (i === 0 ? remainder : 0);
        });
      }

      for (const k of contributors) remaining[k] -= minBet;
    }

    return awards;
  }

  _calculateSidePots(seatTotalBets, foldedSeats) {
    const remaining = {};
    for (const [k, v] of Object.entries(seatTotalBets)) remaining[k] = v;
    const pots = [];

    while (Object.values(remaining).some((v) => v > 0)) {
      const minBet = Math.min(...Object.values(remaining).filter((v) => v > 0));
      const contributors = Object.keys(remaining).filter(
        (k) => remaining[k] > 0,
      );
      const potAmount = contributors.length * minBet;
      const eligible = contributors.filter(
        (k) => !foldedSeats.includes(Number(k)),
      );
      if (potAmount > 0)
        pots.push({ amount: potAmount, eligibleSeats: eligible.map(Number) });
      for (const k of contributors) remaining[k] -= minBet;
    }

    return pots;
  }

  // ============================================================
  // Private: chip helpers
  // ============================================================

  _getChips(seat, gameState, user) {
    if (seat === 0) return user.balance;
    return gameState.aiSeats.find((a) => a.seat === seat)?.chips || 0;
  }

  _setChips(seat, amount, gameState, user) {
    if (seat === 0) {
      user.balance = amount;
      return;
    }
    const ai = gameState.aiSeats.find((a) => a.seat === seat);
    if (ai) ai.chips = amount;
  }

  _addChips(seat, delta, gameState, user) {
    this._setChips(
      seat,
      this._getChips(seat, gameState, user) + delta,
      gameState,
      user,
    );
  }

  _deductBlind(seat, amount, gameState, user) {
    const chips = this._getChips(seat, gameState, user);
    const actual = Math.min(amount, chips);
    this._setChips(seat, chips - actual, gameState, user);
    return actual;
  }

  _getActiveSeats(gameState, user) {
    const seats = [];
    if (user.balance > 0) seats.push(0);
    for (const ai of gameState.aiSeats) {
      if (ai.chips > 0) seats.push(ai.seat);
    }
    return seats.sort((a, b) => a - b);
  }

  _nextActiveAfter(fromSeat, activeSeats) {
    const idx = activeSeats.indexOf(fromSeat);
    if (idx === -1) return activeSeats[0];
    return activeSeats[(idx + 1) % activeSeats.length];
  }

  // ============================================================
  // Private: build THGameState for bot decision
  // ============================================================

  _buildTHGameState(seat, hand, gameState, user) {
    const seatKey = String(seat);
    const stack = this._getChips(seat, gameState, user);
    const myBet = hand.seatBets[seatKey] || 0;
    const chipsToCall = Math.max(0, hand.currentBet - myBet);
    const activeSeats = hand.activeSeats;
    const dealerIdx = activeSeats.indexOf(gameState.dealerSeat);
    const seatIdx = activeSeats.indexOf(seat);
    const offset =
      dealerIdx === -1 || seatIdx === -1
        ? 0
        : (seatIdx - dealerIdx + activeSeats.length) % activeSeats.length;
    const position = POSITIONS[offset] || Position.UTG;

    return new THGameState({
      holeCards: hand.holeCards[seatKey] || [],
      communityCards: [...hand.communityCards],
      stack,
      chipsToCall,
      minRaise: hand.lastRaiseAmount || this.bigBlind,
      maxBet: stack,
      pot: hand.pot,
      position,
      street: hand.phase,
      activePlayers: this._nonFoldedSeats(hand).length,
      bigBlind: this.bigBlind,
      streetRaises: hand.streetRaises,
      actionHistory: [],
    });
  }
}

module.exports = GameManager;
module.exports.MIN_RAISE = MIN_RAISE;
module.exports.MAX_HAND_BET = MAX_HAND_BET;
