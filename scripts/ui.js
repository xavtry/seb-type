
// SebType UI Management
// Handles all menu buttons, animations, panels, modals, etc.
// Works together with main.js and typing.js

const UI = (() => {
    const elements = {
        startButton: document.getElementById("start-btn"),
        resetButton: document.getElementById("reset-btn"),
        timerOptions: document.querySelectorAll(".timer-option"),
        modeOptions: document.querySelectorAll(".mode-option"),
        settingsBtn: document.getElementById("settings-btn"),
        settingsPanel: document.getElementById("settings-panel"),
        closeSettings: document.getElementById("close-settings"),
        overlay: document.getElementById("overlay"),
        graphCanvas: document.getElementById("graph"),
        resultPanel: document.getElementById("result-panel"),
        wordArea: document.getElementById("word-area"),
        inputBox: document.getElementById("input-box"),
        wpmStat: document.getElementById("wpm"),
        accStat: document.getElementById("accuracy"),
        timerDisplay: document.getElementById("timer-display"),
        themeToggle: document.getElementById("theme-toggle"),
        soundToggle: document.getElementById("sound-toggle"),
        langDisplay: document.getElementById("lang-display"),
        errorBox: document.getElementById("error-box")
    };

    let isSettingsOpen = false;

    const init = () => {
        attachListeners();
        loadPrefs();
        console.log("%c[UI] Ready", "color: #37e67d");
    };

    const attachListeners = () => {
        elements.startButton?.addEventListener("click", startTest);
        elements.resetButton?.addEventListener("click", resetTest);
        elements.settingsBtn?.addEventListener("click", toggleSettings);
        elements.closeSettings?.addEventListener("click", toggleSettings);
        elements.overlay?.addEventListener("click", () => {
            if (isSettingsOpen) toggleSettings();
        });

        elements.themeToggle?.addEventListener("change", toggleTheme);
        elements.soundToggle?.addEventListener("change", toggleSound);

        elements.timerOptions?.forEach(opt => {
            opt.addEventListener("click", e => {
                const time = parseInt(e.target.dataset.time);
                Timer.setDuration(time);
                elements.timerOptions.forEach(o => o.classList.remove("active"));
                e.target.classList.add("active");
            });
        });

        elements.modeOptions?.forEach(opt => {
            opt.addEventListener("click", e => {
                const mode = e.target.dataset.mode;
                Modes.setMode(mode);
                elements.modeOptions.forEach(o => o.classList.remove("active"));
                e.target.classList.add("active");
            });
        });
    };

    const startTest = () => {
        Typing.start();
        elements.wordArea.classList.add("active");
        elements.inputBox.disabled = false;
        elements.inputBox.focus();
        elements.startButton.classList.add("hidden");
        elements.resetButton.classList.remove("hidden");
    };

    const resetTest = () => {
        Typing.reset();
        Graph.clear();
        elements.inputBox.value = "";
        elements.wordArea.classList.remove("active");
        elements.resultPanel.classList.add("hidden");
        elements.startButton.classList.remove("hidden");
        elements.resetButton.classList.add("hidden");
    };

    const toggleSettings = () => {
        isSettingsOpen = !isSettingsOpen;
        elements.settingsPanel.classList.toggle("open", isSettingsOpen);
        elements.overlay.classList.toggle("visible", isSettingsOpen);
    };

    const toggleTheme = () => {
        const root = document.documentElement;
        const isDark = root.classList.toggle("dark-theme");
        localStorage.setItem("sebtype_theme", isDark ? "dark" : "light");
    };

    const toggleSound = () => {
        const enabled = elements.soundToggle.checked;
        localStorage.setItem("sebtype_sound", enabled);
    };

    const loadPrefs = () => {
        const theme = localStorage.getItem("sebtype_theme") || "dark";
        const sound = localStorage.getItem("sebtype_sound") === "true";

        if (theme === "dark") document.documentElement.classList.add("dark-theme");
        elements.soundToggle.checked = sound;
    };

    const showError = msg => {
        elements.errorBox.textContent = msg;
        elements.errorBox.classList.add("show");
        setTimeout(() => {
            elements.errorBox.classList.remove("show");
        }, 3000);
    };

    const showResults = stats => {
        elements.resultPanel.classList.remove("hidden");
        elements.wpmStat.textContent = stats.wpm;
        elements.accStat.textContent = `${stats.accuracy}%`;
        Graph.render(stats.history);
    };

    return {
        init,
        showResults,
        showError
    };
})();

document.addEventListener("DOMContentLoaded", UI.init);
