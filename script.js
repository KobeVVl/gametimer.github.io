const setupPanel = document.getElementById("setupPanel");
const timerPanel = document.getElementById("timerPanel");
const playersContainer = document.getElementById("playersContainer");
const playerCountInput = document.getElementById("playerCount");
const startingMinutesInput = document.getElementById("startingMinutes");
const startingSecondsInput = document.getElementById("startingSeconds");
const timeModeSelect = document.getElementById("timeMode");
const turnIncrementInput = document.getElementById("turnIncrement");
const autoStartToggle = document.getElementById("autoStartToggle");
const clickNameTurnToggle = document.getElementById("clickNameTurnToggle");
const lowTimeAlertToggle = document.getElementById("lowTimeAlertToggle");
const addColorsToggle = document.getElementById("addColorsToggle");
const multiplierToggle = document.getElementById("multiplierToggle");
const startGameButton = document.getElementById("startGame");
const nextPlayerButton = document.getElementById("nextPlayer");
const pauseToggleButton = document.getElementById("pauseToggle");
const resetGameButton = document.getElementById("resetGame");
const timerDisplay = document.getElementById("timerDisplay");
const currentPlayerName = document.getElementById("currentPlayerName");
const turnCounter = document.getElementById("turnCounter");
const statusText = document.getElementById("statusText");
const playerList = document.getElementById("playerList");

const DEFAULT_PLAYER_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"];

// Generate a beep sound using Web Audio API
function playBeep() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 1000; // 1000 Hz beep
        oscillator.type = "sine";

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
        // Fallback if Audio API unavailable
    }
}
const PRESET_STORAGE_KEY = "gameTimerPreset";
const PRESET_COLORS = [
    { label: "Marquise The Cat", value: "#f18025" },
    { label: "Eyrie Dynasties", value: "#375896" },
    { label: "Woodland Alliance", value: "#58c141" },
    { label: "Vagabond", value: "#636463" },
    { label: "Lizard Cult", value: "#f3f154" },
    { label: "Riverfolk Company", value: "#6fcac7" },
    { label: "Underground Duchy", value: "#dbb69b" },
    { label: "Corvid Conspiracy", value: "#9c7dae" },
    { label: "Lord of the Hundreds", value: "#bd3543" },
    { label: "Keepers in Iron", value: "#828382" },
    { label: "Honey Triarchy", value: "#ffd700" },
    { label: "Warlock", value: "#121212" },
];
const FACTION_SORT_ORDER = [...PRESET_COLORS.map((entry) => entry.label), "Custom"];

let state = {
    players: [],
    currentIndex: 0,
    timerId: null,
    isRunning: false,
    turn: 1,
    settings: {
        startingSeconds: 20 * 60,
        timeMode: "total",
        turnIncrement: 0,
        autoStart: true,
        clickNameTurn: false,
        lowTimeAlert: true,
        addColors: true,
        multipliersEnabled: true,
    },
};

const LOW_TIME_THRESHOLD = 15;

function createPlayerInputs(count) {
    playersContainer.innerHTML = "";
    const colorsEnabled = addColorsToggle.checked;
    for (let i = 0; i < count; i += 1) {
        const card = document.createElement("div");
        card.className = "player-card";
        const presetName = state.settings?.presetNames?.[i];
        const presetColor = state.settings?.presetColors?.[i];
        const presetMultiplier = state.settings?.presetMultipliers?.[i];
        const defaultColor = PRESET_COLORS[i % PRESET_COLORS.length].value;
        const resolvedColor = normalizeColor(presetColor || defaultColor);
        const resolvedMultiplier = clampNumber(presetMultiplier ?? 1, 0.25, 10);
        const matchedPreset = PRESET_COLORS.find((entry) => entry.value === resolvedColor);
        const selectValue = matchedPreset ? matchedPreset.value : "custom";
        const colorRow = colorsEnabled
            ? `
            <div class="color-row">
                <label>
                    <span class="muted">Faction color</span>
                    <select class="color-select" data-index="${i}">
                        ${buildColorOptions(selectValue)}
                    </select>
                </label>
                <label>
                    <span class="muted">Custom</span>
                    <input type="color" class="color-picker" data-index="${i}" value="${resolvedColor}" />
                </label>
            </div>
            `
            : "";
        const multiplierRow = state.settings.multipliersEnabled
            ? `
            <label>
                <span class="muted">Time multiplier</span>
                <input type="number" class="time-multiplier" min="0.25" max="10" step="0.25" value="${resolvedMultiplier}" />
            </label>
            `
            : "";
        card.innerHTML = `
            <div class="player-card-header">
                <strong class="player-card-title">Player ${i + 1}</strong>
                <div class="player-card-actions">
                    <button type="button" class="btn subtle card-move" data-move="up" aria-label="Move player up">↑</button>
                    <button type="button" class="btn subtle card-move" data-move="down" aria-label="Move player down">↓</button>
                </div>
            </div>
            <label>
                <span class="muted">Player name</span>
                <input type="text" value="${presetName || DEFAULT_PLAYER_NAMES[i] || `Player ${i + 1}`}" />
            </label>
            ${multiplierRow}
            ${colorRow}
    `;
        playersContainer.appendChild(card);
    }

    refreshSetupPlayerLabels();
}

function readPlayerInputs() {
    const cards = playersContainer.querySelectorAll(".player-card");
    return Array.from(cards).map((card, index) => {
        const nameInput = card.querySelector("input[type=\"text\"]");
        const colorSelect = card.querySelector(".color-select");
        const colorInput = card.querySelector(".color-picker");
        const multiplierInput = card.querySelector(".time-multiplier");
        const name = nameInput?.value.trim() || `Player ${index + 1}`;
        const timeMultiplier = state.settings.multipliersEnabled
            ? clampNumber(multiplierInput?.value ?? 1, 0.25, 10)
            : 1;
        const colorsEnabled = state.settings.addColors;
        const selectedColor = colorsEnabled
            ? normalizeColor(colorInput?.value || PRESET_COLORS[0].value)
            : PRESET_COLORS[index % PRESET_COLORS.length].value;
        const factionLabel = colorsEnabled
            ? PRESET_COLORS.find((entry) => entry.value === colorSelect?.value)?.label || "Custom"
            : PRESET_COLORS[index % PRESET_COLORS.length].label;
        return {
            id: index,
            name,
            remainingSeconds: Math.max(1, Math.round(state.settings.startingSeconds * timeMultiplier)),
            turnsTaken: 0,
            isPaused: false,
            color: selectedColor,
            factionLabel,
            timeMultiplier,
        };
    });
}

function getFactionSortIndex(factionLabel) {
    const index = FACTION_SORT_ORDER.indexOf(factionLabel);
    return index === -1 ? FACTION_SORT_ORDER.length : index;
}

function sortPlayersByFaction(players) {
    return [...players].sort((leftPlayer, rightPlayer) => {
        const factionDifference = getFactionSortIndex(leftPlayer.factionLabel) - getFactionSortIndex(rightPlayer.factionLabel);
        if (factionDifference !== 0) return factionDifference;
        return leftPlayer.id - rightPlayer.id;
    });
}

function getCardFactionLabel(card) {
    const colorSelect = card.querySelector(".color-select");
    if (!state.settings.addColors) {
        return "Custom";
    }

    const selectedValue = colorSelect?.value;
    return PRESET_COLORS.find((entry) => entry.value === selectedValue)?.label || "Custom";
}

function sortSetupPlayersByFaction() {
    const cards = Array.from(playersContainer.querySelectorAll(".player-card"));
    const sortedCards = [...cards].sort((leftCard, rightCard) => {
        const factionDifference = getFactionSortIndex(getCardFactionLabel(leftCard)) - getFactionSortIndex(getCardFactionLabel(rightCard));
        if (factionDifference !== 0) return factionDifference;
        return cards.indexOf(leftCard) - cards.indexOf(rightCard);
    });

    sortedCards.forEach((card) => playersContainer.appendChild(card));
    refreshSetupPlayerLabels();
}

function refreshSetupPlayerLabels() {
    const cards = Array.from(playersContainer.querySelectorAll(".player-card"));
    cards.forEach((card, index) => {
        const title = card.querySelector(".player-card-title");
        if (title) {
            title.textContent = `Player ${index + 1}`;
        }
    });
}

function formatTime(totalSeconds) {
    const clamped = Math.max(0, totalSeconds);
    const minutes = Math.floor(clamped / 60);
    const seconds = clamped % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function normalizeColor(value) {
    if (!value || typeof value !== "string") return PRESET_COLORS[0].value;
    const trimmed = value.trim();
    if (trimmed.startsWith("#") && (trimmed.length === 7 || trimmed.length === 4)) {
        if (trimmed.length === 4) {
            const [r, g, b] = trimmed.slice(1).split("");
            return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
        }
        return trimmed.toLowerCase();
    }
    return PRESET_COLORS[0].value;
}

function buildColorOptions(selectedValue) {
    const options = PRESET_COLORS.map(
        (color) =>
            `<option value="${color.value}" ${color.value === selectedValue ? "selected" : ""}>${color.label}</option>`
    ).join("");
    const customSelected = selectedValue === "custom" ? "selected" : "";
    return `${options}<option value="custom" ${customSelected}>Custom</option>`;
}

function updateFactionBackground(color) {
    const fallback = "#1a1f2b";
    const base = normalizeColor(color || fallback);
    const glow = hexToRgba(base, 1);
    document.documentElement.style.setProperty("--faction-glow", glow);
}

function hexToRgba(hex, alpha) {
    const normalized = normalizeColor(hex).replace("#", "");
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clampNumber(value, min, max) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return min;
    return Math.min(max, Math.max(min, parsed));
}

function getToggleValue(toggle) {
    return toggle.checked ? "true" : "false";
}

function getStartingSeconds() {
    const minutes = clampNumber(startingMinutesInput.value, 0, 300);
    const seconds = clampNumber(startingSecondsInput.value, 0, 59);
    return minutes * 60 + seconds;
}

function savePreset() {
    const players = readPlayerInputs();
    const preset = {
        playerCount: clampNumber(playerCountInput.value, 1, 12),
        startingMinutes: clampNumber(startingMinutesInput.value, 0, 300),
        startingSeconds: clampNumber(startingSecondsInput.value, 0, 59),
        timeMode: timeModeSelect.value,
        turnIncrement: clampNumber(turnIncrementInput.value, 0, 300),
        autoStart: getToggleValue(autoStartToggle),
        clickNameTurn: getToggleValue(clickNameTurnToggle),
        lowTimeAlert: getToggleValue(lowTimeAlertToggle),
        addColorsSelect: getToggleValue(addColorsToggle),
        multipliersEnabled: getToggleValue(multiplierToggle),
        playerNames: players.map((player) => player.name),
        playerColors: players.map((player) => player.color),
        playerMultipliers: players.map((player) => player.timeMultiplier),
    };
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(preset));
}

function loadPreset() {
    const stored = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!stored) return;
    try {
        const preset = JSON.parse(stored);
        playerCountInput.value = clampNumber(preset.playerCount ?? 4, 1, 12);
        startingMinutesInput.value = clampNumber(preset.startingMinutes ?? 20, 0, 300);
        startingSecondsInput.value = clampNumber(preset.startingSeconds ?? 0, 0, 59);
        timeModeSelect.value = preset.timeMode === "perTurn" ? "perTurn" : "total";
        turnIncrementInput.value = clampNumber(preset.turnIncrement ?? 0, 0, 300);
        autoStartToggle.checked = preset.autoStart !== "false";
        clickNameTurnToggle.checked = preset.clickNameTurn === "true";
        lowTimeAlertToggle.checked = preset.lowTimeAlert !== "false";
        addColorsToggle.checked = preset.addColorsSelect !== "false";
        multiplierToggle.checked = preset.multipliersEnabled !== "false";
        state.settings.multipliersEnabled = multiplierToggle.checked;
        state.settings.presetNames = Array.isArray(preset.playerNames) ? preset.playerNames : [];
        state.settings.presetColors = Array.isArray(preset.playerColors) ? preset.playerColors : [];
        state.settings.presetMultipliers = Array.isArray(preset.playerMultipliers) ? preset.playerMultipliers : [];
    } catch (error) {
        localStorage.removeItem(PRESET_STORAGE_KEY);
    }
}

function updateStatus(text) {
    statusText.textContent = text;
}

function updateTimerDisplay() {
    const player = state.players[state.currentIndex];
    if (!player) return;

    timerDisplay.textContent = formatTime(player.remainingSeconds);
    currentPlayerName.textContent = player.name;
    turnCounter.textContent = `Turn ${state.turn}`;
    if (state.settings.addColors) {
        updateFactionBackground(player.color);
    } else {
        updateFactionBackground();
    }

    if (state.settings.lowTimeAlert && player.remainingSeconds <= LOW_TIME_THRESHOLD) {
        timerDisplay.classList.add("time-warning");
    } else {
        timerDisplay.classList.remove("time-warning");
    }
}

function updatePlayerList() {
    playerList.innerHTML = "";
    state.players.forEach((player, index) => {
        const row = document.createElement("div");
        row.className = "player-row";
        if (index === state.currentIndex) {
            row.classList.add("active");
        }

        const isOut = player.remainingSeconds === 0;
        if (isOut) {
            row.classList.add("out");
        }

        const removeButton = isOut
            ? `<button class="btn danger" data-remove="${player.id}">Remove Player</button>`
            : "";

        const actionButtons = [removeButton].filter(Boolean).join("");
        const actionsHtml = actionButtons ? `<div class="row-actions">${actionButtons}</div>` : "";

        const colorDot = state.settings.addColors
            ? `<span class="color-dot" style="background: ${player.color};"></span>`
            : "";
        const nameMarkup = state.settings.clickNameTurn
            ? `<button type="button" class="player-name-button" data-select-turn="${player.id}">${player.name}</button>`
            : `<strong>${player.name}</strong>`;
        row.innerHTML = `
      <div class="row-top">
                <div class="name-block">
                                        ${colorDot}
                                        ${nameMarkup}
          <div class="muted">${formatTime(player.remainingSeconds)}</div>
        </div>
        <div>
          <div class="muted">Turns: ${player.turnsTaken}</div>
          ${isOut ? "<div class=\"out-label\">Out of time</div>" : ""}
        </div>
      </div>
      ${actionsHtml}
    `;

        playerList.appendChild(row);
    });
}

function removePlayerById(playerId) {
    const index = state.players.findIndex((player) => player.id === playerId);
    if (index === -1) return;

    const removingCurrent = index === state.currentIndex;
    state.players.splice(index, 1);

    if (state.players.length === 0) {
        resetGame();
        return;
    }

    if (index < state.currentIndex) {
        state.currentIndex -= 1;
    }

    if (removingCurrent) {
        if (state.currentIndex >= state.players.length) {
            state.currentIndex = 0;
        }
        handleTurnStart(state.players[state.currentIndex]);
        state.isRunning = state.settings.autoStart;
        pauseToggleButton.textContent = state.isRunning ? "Pause" : "Resume";
        updateStatus(`It's ${state.players[state.currentIndex].name}'s turn.`);
    }

    updateTimerDisplay();
    updatePlayerList();
}

function switchToPlayer(playerId) {
    const nextIndex = state.players.findIndex((player) => player.id === playerId);
    if (nextIndex === -1 || nextIndex === state.currentIndex) return;

    const currentPlayer = state.players[state.currentIndex];
    if (currentPlayer) {
        handleTurnEnd(currentPlayer);
    }

    state.currentIndex = nextIndex;
    state.turn += 1;

    const nextPlayer = state.players[state.currentIndex];
    if (nextPlayer) {
        handleTurnStart(nextPlayer);
    }

    updateTimerDisplay();
    updatePlayerList();
    updateStatus(`It's ${state.players[state.currentIndex].name}'s turn.`);

    if (state.settings.autoStart) {
        setRunning(true);
    } else {
        setRunning(false);
    }
}

function tick() {
    const player = state.players[state.currentIndex];
    if (!player || !state.isRunning) return;

    player.remainingSeconds = Math.max(0, player.remainingSeconds - 1);

    if (state.settings.lowTimeAlert && player.remainingSeconds <= LOW_TIME_THRESHOLD && player.remainingSeconds > 0) {
        playBeep();
    }

    updateTimerDisplay();
    updatePlayerList();

    if (player.remainingSeconds === 0) {
        state.isRunning = false;
        updateStatus(`${player.name} is out of time.`);
        pauseToggleButton.textContent = "Resume";
    }
}

function startTimer() {
    if (state.timerId) {
        clearInterval(state.timerId);
    }
    state.timerId = setInterval(tick, 1000);
}

function setRunning(isRunning) {
    state.isRunning = isRunning;
    pauseToggleButton.textContent = isRunning ? "Pause" : "Resume";
    updateStatus(isRunning ? "Timer running" : "Paused");
}

function applyTurnIncrement(player) {
    if (state.settings.turnIncrement > 0) {
        const multiplier = player.timeMultiplier || 1;
        player.remainingSeconds += Math.max(1, Math.round(state.settings.turnIncrement * multiplier));
    }
}

function handleTurnEnd(player) {
    player.turnsTaken += 1;
    if (state.settings.timeMode === "total") {
        applyTurnIncrement(player);
    }
}

function handleTurnStart(player) {
    if (state.settings.timeMode === "perTurn") {
        const multiplier = player.timeMultiplier || 1;
        player.remainingSeconds = Math.max(1, Math.round(state.settings.startingSeconds * multiplier));
    }
}

function moveToNextPlayer() {
    const currentPlayer = state.players[state.currentIndex];
    if (currentPlayer) {
        handleTurnEnd(currentPlayer);
    }

    state.currentIndex = (state.currentIndex + 1) % state.players.length;
    state.turn += 1;

    const nextPlayer = state.players[state.currentIndex];
    if (nextPlayer) {
        handleTurnStart(nextPlayer);
    }

    updateTimerDisplay();
    updatePlayerList();
    updateStatus(`It's ${state.players[state.currentIndex].name}'s turn.`);

    if (state.settings.autoStart) {
        setRunning(true);
    } else {
        setRunning(false);
    }
}

function adjustTime(seconds) {
    const player = state.players[state.currentIndex];
    if (!player) return;
    player.remainingSeconds = Math.max(0, player.remainingSeconds + seconds);
    updateTimerDisplay();
    updatePlayerList();
}

function resetGame() {
    state.players = [];
    state.currentIndex = 0;
    state.turn = 1;
    state.isRunning = false;
    clearInterval(state.timerId);
    state.timerId = null;

    setupPanel.classList.remove("hidden");
    timerPanel.classList.add("hidden");
    updateStatus("Not started");
    updateFactionBackground();
}

function onStartGame() {
    state.settings = {
        startingSeconds: Math.max(1, getStartingSeconds()),
        timeMode: timeModeSelect.value,
        turnIncrement: Math.max(0, Number(turnIncrementInput.value)),
        autoStart: autoStartToggle.checked,
        clickNameTurn: clickNameTurnToggle.checked,
        lowTimeAlert: lowTimeAlertToggle.checked,
        addColors: addColorsToggle.checked,
        multipliersEnabled: multiplierToggle.checked,
    };

    savePreset();

    state.players = readPlayerInputs();
    state.currentIndex = 0;
    state.turn = 1;
    state.isRunning = state.settings.autoStart;

    setupPanel.classList.add("hidden");
    timerPanel.classList.remove("hidden");

    handleTurnStart(state.players[0]);

    updateTimerDisplay();
    updatePlayerList();
    updateStatus(`It's ${state.players[0].name}'s turn.`);
    pauseToggleButton.textContent = state.isRunning ? "Pause" : "Resume";

    startTimer();
}

function onPauseToggle() {
    setRunning(!state.isRunning);
}

function onManualPause(e) {
    const selectTurnId = e.target.dataset.selectTurn;
    const pauseId = e.target.dataset.pause;
    const removeId = e.target.dataset.remove;

    if (selectTurnId !== undefined) {
        if (!state.settings.clickNameTurn) return;
        switchToPlayer(Number(selectTurnId));
        return;
    }

    if (removeId !== undefined) {
        removePlayerById(Number(removeId));
        return;
    }

    if (pauseId === undefined) return;

    const player = state.players.find((entry) => entry.id === Number(pauseId));
    if (!player) return;

    player.isPaused = !player.isPaused;
    updatePlayerList();
}

function onColorChange(event) {
    const target = event.target;
    if (!target.closest(".player-card")) return;

    if (!state.settings.addColors) return;

    let shouldResort = false;

    if (target.classList.contains("color-select")) {
        const card = target.closest(".player-card");
        const picker = card.querySelector(".color-picker");
        if (target.value !== "custom") {
            picker.value = target.value;
        }
        shouldResort = true;
    }

    if (target.classList.contains("color-picker")) {
        const card = target.closest(".player-card");
        const select = card.querySelector(".color-select");
        const normalized = normalizeColor(target.value);
        const matched = PRESET_COLORS.find((entry) => entry.value === normalized);
        select.value = matched ? matched.value : "custom";
        shouldResort = true;
    }

    if (shouldResort) {
        sortSetupPlayersByFaction();
    }
}

function onPlayerCardMove(event) {
    const button = event.target.closest("[data-move]");
    if (!button) return;

    const card = button.closest(".player-card");
    if (!card) return;

    const direction = button.dataset.move;
    if (direction === "up" && card.previousElementSibling) {
        playersContainer.insertBefore(card, card.previousElementSibling);
    } else if (direction === "down" && card.nextElementSibling) {
        playersContainer.insertBefore(card.nextElementSibling, card);
    }

    refreshSetupPlayerLabels();
}

function onAdjustClick(event) {
    const value = Number(event.target.dataset.adjust);
    if (Number.isNaN(value)) return;
    adjustTime(value);
}

playerCountInput.addEventListener("change", (event) => {
    const count = Math.max(1, Math.min(12, Number(event.target.value)));
    createPlayerInputs(count);
});

startGameButton.addEventListener("click", onStartGame);
nextPlayerButton.addEventListener("click", moveToNextPlayer);
pauseToggleButton.addEventListener("click", onPauseToggle);
resetGameButton.addEventListener("click", resetGame);
playerList.addEventListener("click", onManualPause);
document.querySelectorAll("[data-adjust]").forEach((button) => {
    button.addEventListener("click", onAdjustClick);
});
playersContainer.addEventListener("change", onColorChange);
playersContainer.addEventListener("click", onPlayerCardMove);
addColorsToggle.addEventListener("change", () => {
    createPlayerInputs(Number(playerCountInput.value));
    updateFactionBackground();
});
multiplierToggle.addEventListener("change", () => {
    state.settings.multipliersEnabled = multiplierToggle.checked;
    createPlayerInputs(Number(playerCountInput.value));
});

loadPreset();
createPlayerInputs(Number(playerCountInput.value));
startTimer();
updateFactionBackground();
