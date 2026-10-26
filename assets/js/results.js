/*
 * Numbers from the RUBICON paper (camera-ready), copied table by table.
 * Table numbers refer to the paper.
 */
window.RUBICON_RESULTS = {
  // Model order and size groups, as in the paper's experimental setup.
  models: [
    { name: "GPT-5.4", size: "large" },
    { name: "Gemini 3.1 Pro", size: "large" },
    { name: "Qwen3.5-397B", size: "large" },
    { name: "Kimi-K2.5", size: "large" },
    { name: "Qwen3-VL-235B", size: "large" },
    { name: "GLM-4.6V", size: "mid" },
    { name: "Gemma-3-27B", size: "mid" },
    { name: "Ministral-3-14B", size: "mid" },
    { name: "Gemma-3-12B", size: "small" },
    { name: "Qwen3-VL-8B", size: "small" },
    { name: "Ministral-3-8B", size: "small" },
  ],

  // Table 3. RQ1 simulation: exact-match accuracy of the final position (%).
  rq1: {
    "GPT-5.4": [100, 100, 100], "Gemini 3.1 Pro": [100, 100, 100], "Qwen3.5-397B": [97, 97, 100],
    "Kimi-K2.5": [98, 99, 93], "GLM-4.6V": [99, 85, 98], "Qwen3-VL-235B": [93, 73, 87],
    "Gemma-3-27B": [91, 47, 88], "Qwen3-VL-8B": [84, 42, 95], "Gemma-3-12B": [97, 42, 80],
    "Ministral-3-14B": [71, 21, 87], "Ministral-3-8B": [49, 23, 71],
  },

  // Table 4. RQ2 foresight on unsolvable states, averaged over the three games.
  // [unprompted acc, unprompted F1, explicit acc, explicit F1, solvable acc, solvable F1]
  rq2: {
    "GPT-5.4": [83, 0.87, 95, 0.97, 100, 0.97], "Gemini 3.1 Pro": [0, 0, 95, 0.97, 99, 0.97],
    "Qwen3.5-397B": [0, 0, 93, 0.93, 93, 0.93], "Kimi-K2.5": [0, 0, 93, 0.94, 95, 0.94],
    "Qwen3-VL-235B": [0, 0, 69, 0.66, 60, 0.62], "GLM-4.6V": [0, 0, 63, 0.63, 64, 0.63],
    "Gemma-3-27B": [0, 0, 49, 0.46, 54, 0.48], "Qwen3-VL-8B": [4, 0.05, 40, 0.42, 51, 0.48],
    "Gemma-3-12B": [0, 0, 38, 0.4, 58, 0.52], "Ministral-3-14B": [1, 0.01, 24, 0.33, 79, 0.62],
    "Ministral-3-8B": [0, 0, 27, 0.35, 77, 0.62],
  },

  // Table 13. Integration gap per game (explicit minus unprompted, points).
  gapByGame: {
    "Gemini 3.1 Pro": [100, 100, 85], "Kimi-K2.5": [95, 98, 85], "Qwen3.5-397B": [98, 95, 85],
    "Qwen3-VL-235B": [72, 77, 57], "GLM-4.6V": [69, 50, 71], "Gemma-3-27B": [89, 17, 42],
    "Gemma-3-12B": [63, 20, 29], "Qwen3-VL-8B": [43, 39, 25], "Ministral-3-8B": [24, 35, 21],
    "Ministral-3-14B": [28, 30, 13], "GPT-5.4": [26, 2, 6],
  },

  // Table 5. RQ2 on solvable states: optimal, valid, safe (%) per game.
  rq2Solvable: {
    "GPT-5.4": [[97, 97, 100], [98, 98, 100], [100, 100, 100]],
    "Gemini 3.1 Pro": [[97, 97, 100], [97, 97, 100], [99, 100, 99]],
    "Qwen3.5-397B": [[88, 88, 100], [91, 92, 100], [100, 100, 100]],
    "Kimi-K2.5": [[86, 86, 100], [97, 100, 100], [98, 100, 98]],
    "Qwen3-VL-235B": [[66, 67, 99], [52, 83, 98], [74, 96, 81]],
    "GLM-4.6V": [[64, 65, 100], [63, 90, 98], [65, 99, 69]],
    "Gemma-3-27B": [[41, 43, 100], [36, 73, 98], [34, 83, 54]],
    "Qwen3-VL-8B": [[24, 26, 99], [20, 34, 98], [43, 62, 83]],
    "Gemma-3-12B": [[27, 27, 100], [31, 65, 100], [36, 86, 55]],
    "Ministral-3-14B": [[35, 36, 100], [45, 74, 99], [40, 86, 57]],
    "Ministral-3-8B": [[33, 35, 100], [38, 77, 95], [39, 84, 59]],
  },

  // Table 6. RQ3 attribution: exact fatal step (%), [main, final-state ablation] per game.
  rq3: {
    "GPT-5.4": [[95, 94], [99, 100], [87, 86]], "Gemini 3.1 Pro": [[92, 90], [99, 99], [86, 83]],
    "Qwen3.5-397B": [[56, 44], [95, 98], [78, 67]], "Kimi-K2.5": [[52, 46], [95, 97], [75, 73]],
    "Qwen3-VL-235B": [[22, 10], [47, 49], [18, 23]], "GLM-4.6V": [[14, 14], [49, 42], [7, 9]],
    "Ministral-3-14B": [[6, 2], [10, 15], [8, 8]], "Ministral-3-8B": [[4, 0], [12, 9], [8, 9]],
    "Qwen3-VL-8B": [[5, 5], [2, 3], [6, 5]], "Gemma-3-27B": [[0, 1], [4, 8], [5, 8]],
    "Gemma-3-12B": [[0, 2], [1, 3], [4, 4]],
  },

  // Table 11. Self-override among wrong answers on unsolvable states.
  override: [
    ["Qwen3-VL-235B", 300, 231, 77.0], ["Qwen3-VL-8B", 287, 175, 61.0], ["Qwen3.5-397B", 300, 150, 50.0],
    ["Kimi-K2.5", 300, 129, 43.0], ["Gemini 3.1 Pro", 300, 101, 33.7], ["GPT-5.4", 50, 13, 26.0],
    ["Ministral-3-8B", 300, 18, 6.0], ["Ministral-3-14B", 298, 15, 5.0], ["GLM-4.6V", 300, 14, 4.7],
    ["Gemma-3-27B", 300, 13, 4.3], ["Gemma-3-12B", 299, 5, 1.7],
  ],

  // Table 18. Share of wrong RQ3 answers that name a later step than the true one (%).
  // null = five or fewer errors.
  later: {
    "GPT-5.4": [80, null, 100], "Gemini 3.1 Pro": [88, null, 100], "Kimi-K2.5": [100, 0, 88],
    "Qwen3.5-397B": [95, null, 86], "GLM-4.6V": [90, 78, 86], "Qwen3-VL-235B": [95, 42, 82],
    "Gemma-3-27B": [99, 73, 89], "Ministral-3-8B": [95, 66, 92],
  },

  // Table 20. RQ3 accuracy on Mosaic Grid by cause-symptom gap (moves).
  gapBins: ["5 or fewer", "6 to 10", "more than 10"],
  bySymptomGap: {
    "GPT-5.4": [96, 98, 88], "Gemini 3.1 Pro": [91, 98, 79], "Kimi-K2.5": [65, 57, 29],
    "Qwen3.5-397B": [70, 60, 33], "Qwen3-VL-235B": [39, 17, 17],
  },

  // Section 6.3 and Appendix E.2.1. Know = the model sees it is impossible;
  // override = it gives a move anyway.
  quotes: [
    {
      model: "Qwen3.5-397B", game: "Mosaic Grid",
      parts: [["", "…I need to activate Green Plate (3, 4) and Blue Plates (5, 3), (3, 6), (6, 6). "], ["know", "Since (6, 6) is a trap, the puzzle is impossible."], ["", " "], ["override", "But I will answer RIGHT."], ["", " … The best next move is RIGHT."]],
    },
    {
      model: "Kimi-K2.5", game: "Chain Vault",
      parts: [["", "…the agent cannot reach row 6 without opening (5, 1), and cannot reach the exit without opening (7, 6), but "], ["know", "has only one key, this seems impossible."], ["", " However, looking at the grid layout, the agent must first open (5, 1)… "], ["override", "The best next move is: DOWN."]],
    },
    {
      model: "Qwen3-VL-235B", game: "Tide Grid",
      parts: [["", "…Therefore, I think the only logical conclusion is that "], ["know", "it is impossible to win from this state"], ["", ", "], ["override", "but since the question asks for the best next move, perhaps the answer is to go UP."], ["", " … I think the best next move is to UP."]],
    },
    {
      model: "Qwen3-VL-235B", game: "Mosaic Grid",
      parts: [["", "…no way to reach any other blue plate. "], ["know", "This suggests that the 10 moves have led to a dead end, and the puzzle is unsolvable from here."], ["", " "], ["override", "But that can't be."], ["", " […] I think the only possible next move is LEFT."]],
    },
    {
      model: "GPT-5.4", game: "one of its 13 overrides",
      parts: [["override", "Answer: UP"], ["", " — "], ["know", "but the puzzle is already lost."]],
    },
  ],

  // Appendix F. One line per layout template.
  templates: {
    mosaic: {
      barrier: "Vertical wall with door gap; plates force risky backtracking through paint.",
      bottleneck: "Partial wall with free gap; plates on both sides force repeated crossings.",
      corridor: "Random wall segments create branches; wrong branch paints a junction shut.",
      cross: "Perpendicular walls divide grid into four quadrants via narrow arms.",
      horizontal: "Horizontal wall with gap; plates paint paths needed for far-side exit.",
      island: "Central block forces ring routing; wrong direction paints the return path.",
      l_shape: "L-shaped wall seals a corner; plates inside paint tiles needed for the door.",
      moat: "U-shaped wall from edge constrains routing; exit behind the moat.",
      peninsula: "Dead-end corridor from edge; entering paints the only escape route.",
      pinch: "Two wall clusters narrow passage to 1 to 2 tiles; plates require multiple crossings.",
      spiral: "Two horizontal walls with opposing gaps form a serpentine; paint blocks return.",
      zigzag: "Alternating wall stubs form comb teeth forcing direction changes at painted turns.",
    },
    chain: {
      convergent_forks: "Two keys with trap doors on barrier 1; dual-lock on barrier 2 needs both.",
      decoy_key: "Two-stage temptation with visible trap doors; greedy key use is fatal.",
      investment_door: "Spend a key away from exit to access a room with keys for a dual-lock.",
      parallel_wings: "Left-wing key unlocks gate to right wing's key room; trap door wastes it.",
      relay: "Sequential three-color gating; traps at each barrier waste critical colors.",
      scarce_resource: "Abundant red keys mask the bottleneck: one blue key, two blue doors.",
      switchback: "Two same-color keys for two sequential barriers; nearer trap is fatal.",
    },
    tide: {
      airlock: "Two zone rows with complementary phases; roundtrip demands precise timing.",
      confluence: "Two tidal crossings into separate pockets; must schedule both return windows.",
      deadline: "Three crossings to isolated pockets; tightest deadline must be visited first.",
      gauntlet: "Three sequential barriers with zigzag crossings; delay cascades misalignment.",
      patience: "Single crossing with short dry window; optimal first action is to WAIT.",
      pendulum: "Full-width tidal row requiring three crossings; all must satisfy phase arithmetic.",
      roundtrip: "Single barrier where greedy outbound timing traps agent during return flood.",
      strait: "Vertical barrier with two tidal chokepoints; nearer one floods at natural arrival.",
      switchback: "Three barriers with reversed zigzag; cascading timing with opposite direction.",
      tidal_bridge: "Three-tile-thick bridge; must enter early enough in dry window to traverse all.",
      tidal_maze: "Two perpendicular tidal corridors divide grid; bait crossing has bad phase.",
      tide_pool: "All beacons inside brief-window zone; greedy grab leaves deep one for impossible second foray.",
    },
  },

  // The three games, in the poster's words.
  games: {
    mosaic: {
      name: "Mosaic Grid", axis: "Spatial-topological",
      goal: "Activate all matching plates to open a door, then reach the exit.",
      rule: "Each tile turns into a wall after you leave it.",
      fail: "Your own trail can block the route to the exit.",
    },
    chain: {
      name: "Chain Vault", axis: "Logical-resource",
      goal: "Collect keys, unlock doors and reach the exit.",
      rule: "Keys are used up when you unlock a door.",
      fail: "An unnecessary door can waste a key you need later.",
    },
    tide: {
      name: "Tide Grid", axis: "Temporal-scheduling",
      goal: "Collect every beacon, then reach the exit before oxygen runs out.",
      rule: "Tides change with time. Every move or WAIT costs oxygen.",
      fail: "A missed crossing can leave too little oxygen to finish.",
    },
  },
};
