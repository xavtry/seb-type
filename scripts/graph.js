// SebType Graph Renderer
// Creates and animates a smooth WPM-over-time graph using Canvas
// Called by UI.showResults() to visualize test performance

const Graph = (() => {
    const canvas = document.getElementById("graph");
    const ctx = canvas?.getContext("2d");
    let wpmData = [];
    let animFrame = null;
    let width = 0, height = 0;

    const init = () => {
        if (!canvas) return;
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);
        console.log("%c[Graph] Ready", "color:#37e67d");
    };

    const resizeCanvas = () => {
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        drawGrid();
    };

    const drawGrid = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = "rgba(55,230,125,0.1)";
        ctx.lineWidth = 1;
        const stepY = height / 5;
        const stepX = width / 10;

        for (let y = 0; y <= height; y += stepY) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        for (let x = 0; x <= width; x += stepX) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    };

    const render = data => {
        if (!ctx || !data.length) return;
        wpmData = data;
        cancelAnimationFrame(animFrame);
        drawGrid();

        // Animate draw
        let progress = 0;
        const animate = () => {
            progress += 0.02;
            if (progress > 1) progress = 1;
            draw(progress);
            if (progress < 1) animFrame = requestAnimationFrame(animate);
        };
        animate();
    };

    const draw = progress => {
        drawGrid();
        const maxWPM = Math.max(...wpmData) || 100;
        const stepX = width / (wpmData.length - 1);
        const points = wpmData.map((val, i) => ({
            x: i * stepX,
            y: height - (val / maxWPM) * height
        }));

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        const visibleCount = Math.floor(points.length * progress);
        for (let i = 1; i < visibleCount; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.strokeStyle = "#37e67d";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Fill area under graph
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, "rgba(55,230,125,0.2)");
        grad.addColorStop(1, "rgba(55,230,125,0)");
        ctx.lineTo(points[visibleCount - 1].x, height);
        ctx.lineTo(points[0].x, height);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Draw dots
        ctx.fillStyle = "#37e67d";
        for (let i = 0; i < visibleCount; i++) {
            const p = points[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    const clear = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
        drawGrid();
    };

    return { init, render, clear };
})();

document.addEventListener("DOMContentLoaded", Graph.init);

