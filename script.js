const setupPanel = document.getElementById("setupPanel");
const timerPanel = document.getElementById("timerPanel");
const playersContainer = document.getElementById("playersContainer");
const playerCountInput = document.getElementById("playerCount");
const startingMinutesInput = document.getElementById("startingMinutes");
const startingSecondsInput = document.getElementById("startingSeconds");
const timeModeSelect = document.getElementById("timeMode");
const turnIncrementInput = document.getElementById("turnIncrement");
const autoStartSelect = document.getElementById("autoStart");
const individualPauseSelect = document.getElementById("individualPause");
const lowTimeAlertSelect = document.getElementById("lowTimeAlert");
const startGameButton = document.getElementById("startGame");
const nextPlayerButton = document.getElementById("nextPlayer");
const pauseToggleButton = document.getElementById("pauseToggle");
const resetGameButton = document.getElementById("resetGame");
const timerDisplay = document.getElementById("timerDisplay");
const currentPlayerName = document.getElementById("currentPlayerName");
const turnCounter = document.getElementById("turnCounter");
const statusText = document.getElementById("statusText");
const playerList = document.getElementById("playerList");
const alertSound = document.getElementById("alertSound");

const DEFAULT_PLAYER_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"];
const PRESET_STORAGE_KEY = "gameTimerPreset";

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
        individualPause: false,
        lowTimeAlert: true,
    },
};

const LOW_TIME_THRESHOLD = 15;

function createPlayerInputs(count) {
    playersContainer.innerHTML = "";
    for (let i = 0; i < count; i += 1) {
        const card = document.createElement("div");
        card.className = "player-card";
        const presetName = state.settings?.presetNames?.[i];
        card.innerHTML = `
      <label>
        <span>Player ${i + 1}</span>
                <input type="text" value="${presetName || DEFAULT_PLAYER_NAMES[i] || `Player ${i + 1}`}" />
      </label>
    `;
        playersContainer.appendChild(card);
    }
}

function readPlayerInputs() {
    const inputs = playersContainer.querySelectorAll("input");
    return Array.from(inputs).map((input, index) => {
        const name = input.value.trim() || `Player ${index + 1}`;
        return {
            id: index,
            name,
            remainingSeconds: state.settings.startingSeconds,
            turnsTaken: 0,
            isPaused: false,
        };
    });
}

function formatTime(totalSeconds) {
    const clamped = Math.max(0, totalSeconds);
    const minutes = Math.floor(clamped / 60);
    const seconds = clamped % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function clampNumber(value, min, max) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return min;
    return Math.min(max, Math.max(min, parsed));
}

function getStartingSeconds() {
    const minutes = clampNumber(startingMinutesInput.value, 0, 300);
    const seconds = clampNumber(startingSecondsInput.value, 0, 59);
    return minutes * 60 + seconds;
}

function savePreset() {
    const preset = {
        playerCount: clampNumber(playerCountInput.value, 1, 12),
        startingMinutes: clampNumber(startingMinutesInput.value, 0, 300),
        startingSeconds: clampNumber(startingSecondsInput.value, 0, 59),
        timeMode: timeModeSelect.value,
        turnIncrement: clampNumber(turnIncrementInput.value, 0, 300),
        autoStart: autoStartSelect.value,
        individualPause: individualPauseSelect.value,
        lowTimeAlert: lowTimeAlertSelect.value,
        playerNames: readPlayerInputs().map((player) => player.name),
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
        autoStartSelect.value = preset.autoStart === "false" ? "false" : "true";
        individualPauseSelect.value = preset.individualPause === "true" ? "true" : "false";
        lowTimeAlertSelect.value = preset.lowTimeAlert === "false" ? "false" : "true";
        state.settings.presetNames = Array.isArray(preset.playerNames) ? preset.playerNames : [];
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

        const pauseButton = state.settings.individualPause && !isOut
            ? `<button class="btn ghost" data-pause="${player.id}">${player.isPaused ? "Resume" : "Pause"}</button>`
            : "";

        const removeButton = isOut
            ? `<button class="btn danger" data-remove="${player.id}">Remove Player</button>`
            : "";

        const actionButtons = [pauseButton, removeButton].filter(Boolean).join("");
        const actionsHtml = actionButtons ? `<div class="row-actions">${actionButtons}</div>` : "";

        row.innerHTML = `
      <div class="row-top">
        <div>
          <strong>${player.name}</strong>
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

function tick() {
    const player = state.players[state.currentIndex];
    if (!player || !state.isRunning) return;

    if (state.settings.individualPause && player.isPaused) return;

    player.remainingSeconds = Math.max(0, player.remainingSeconds - 1);

    if (state.settings.lowTimeAlert && player.remainingSeconds === LOW_TIME_THRESHOLD) {
        alertSound.play().catch(() => { });
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
        player.remainingSeconds += state.settings.turnIncrement;
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
        player.remainingSeconds = state.settings.startingSeconds;
    }
    applyTurnIncrement(player);
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
}

function onStartGame() {
    state.settings = {
        startingSeconds: Math.max(1, getStartingSeconds()),
        timeMode: timeModeSelect.value,
        turnIncrement: Math.max(0, Number(turnIncrementInput.value)),
        autoStart: autoStartSelect.value === "true",
        individualPause: individualPauseSelect.value === "true",
        lowTimeAlert: lowTimeAlertSelect.value === "true",
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
    const pauseId = e.target.dataset.pause;
    const removeId = e.target.dataset.remove;

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

loadPreset();
createPlayerInputs(Number(playerCountInput.value));
startTimer();
