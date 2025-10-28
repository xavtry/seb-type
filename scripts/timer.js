// SebType Timer
// Controls the countdown and triggers typing end when finished
// Works with UI and Typing modules

const Timer = (() => {
    let duration = 60; // default 60 seconds
    let timeLeft = duration;
    let timerInterval = null;
    const display = document.getElementById("timer-display");

    const init = () => {
        updateDisplay();
        console.log("%c[Timer] Ready", "color:#37e67d");
    };

    const setDuration = secs => {
        duration = secs;
        timeLeft = secs;
        updateDisplay();
    };

    const start = onEnd => {
        stop(); // ensure no duplicate
        timeLeft = duration;
        updateDisplay();

        timerInterval = setInterval(() => {
            timeLeft--;
            updateDisplay();
            if (timeLeft <= 0) {
                stop();
                if (typeof onEnd === "function") onEnd();
            }
        }, 1000);
    };

    const stop = () => {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    };

    const updateDisplay = () => {
        if (!display) return;
        display.textContent = `${timeLeft}s`;
        display.style.color = timeLeft <= 5 ? "#e15858" : "#37e67d";
    };

    const flashWarning = () => {
        display.classList.add("flash");
        setTimeout(() => display.classList.remove("flash"), 400);
    };

    const getProgress = () => 1 - timeLeft / duration;

    const debug = () => {
        console.table({
            duration,
            timeLeft,
            running: !!timerInterval
        });
    };

    const testBlink = () => {
        let count = 0;
        const blinkInt = setInterval(() => {
            display.style.opacity = display.style.opacity === "0.3" ? "1" : "0.3";
            if (++count > 6) {
                clearInterval(blinkInt);
                display.style.opacity = "1";
            }
        }, 200);
    };

    return {
        init,
        start,
        stop,
        setDuration,
        getProgress,
        flashWarning,
        debug,
        testBlink
    };
})();

document.addEventListener("DOMContentLoaded", Timer.init);

