/* ART CONSTRUCT v5.1 (Grid Fix + Safe Events + Reroll) */

const PALETTES = {
    modern: {
        solids: ['#FF3B30', '#007AFF', '#34C759', '#FF9500', '#AF52DE', '#EEEEEE'],
        gradients: ['linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%)', 'linear-gradient(120deg, #a18cd1 0%, #fbc2eb 100%)', 'linear-gradient(to top, #fff1eb 0%, #ace0f9 100%)', 'linear-gradient(45deg, #85FFBD 0%, #FFFB7D 100%)']
    },
    vivid: {
        solids: ['#FF00FF', '#00FFFF', '#FFFF00', '#00FF00', '#FF0055', '#FFFFFF'],
        gradients: ['linear-gradient(45deg, #FF00FF, #00FFFF)', 'linear-gradient(90deg, #FFFF00, #FF0000)', 'linear-gradient(135deg, #00FF00, #0000FF)']
    },
    bauhaus: {
        solids: ['#D6241F', '#245BA8', '#F8CF38', '#222222', '#F0F0F0'],
        gradients: ['linear-gradient(to right, #D6241F 50%, #245BA8 50%)', 'linear-gradient(to bottom, #F8CF38 50%, #222222 50%)']
    },
    cubist: {
        solids: ['#A0522D', '#CD853F', '#8B4513', '#708090', '#2F4F4F', '#DCDCDC', '#C0C0C0'],
        gradients: ['linear-gradient(to right, #A0522D, #CD853F)', 'linear-gradient(135deg, #708090, #2F4F4F)', 'linear-gradient(to bottom, #DCDCDC, #8B4513)']
    }
};

const CONFIG = {
    GRID_LERP: 0.12, GRID_INTERVAL: 800, SHAPE_INTERVAL: 400, MOUSE_EXPANSION: 3.0,
    EMPTY_CHANCE: 0.50, PATTERN_CHANCE: 0.15 
};

const State = {
    ratioMode: 0, layoutMode: 0, paletteMode: 'modern',
    interactionMode: 'click', activeTool: 'chaos',
    isGridActive: false, isShapeActive: false,
    cols: 12, rows: 12,
    currentColSizes: [], targetColSizes: [], currentRowSizes: [], targetRowSizes: [],
    baseColSizes: [], baseRowSizes: [],
    hoverCol: -1, hoverRow: -1,
    cells: [] 
};

const grid = document.getElementById('grid');
let renderLoopId, gridIntervalId, shapeIntervalId;
const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

// --- DOM SHAPES ---
function getShapeContent(type, color) {
    if (type === 'dots') return `<svg width="100%" height="100%"><defs><pattern id="p_${color.replace(/[^a-z0-9]/gi, '')}" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="3.5" fill="${color}"/></pattern></defs><rect width="100%" height="100%" fill="url(#p_${color.replace(/[^a-z0-9]/gi, '')})" /></svg>`;
    if (type === 'grid') return `<svg width="100%" height="100%"><defs><pattern id="g_${color.replace(/[^a-z0-9]/gi, '')}" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="${color}" stroke-width="4"/></pattern></defs><rect width="100%" height="100%" fill="url(#g_${color.replace(/[^a-z0-9]/gi, '')})" /></svg>`;
    if (type === 'rect') return ''; 
    let inner = '';
    if (type === 'circle') inner = `<circle cx='50' cy='50' r='48' fill='${color}'/>`;
    else if (type === 'triangle') inner = `<polygon points='50,10 90,90 10,90' fill='${color}'/>`;
    else if (type === 'rhombus') inner = `<polygon points='50,10 90,50 50,90 10,50' fill='${color}'/>`;
    else if (type === 'outline-circles') inner = `<circle cx='50' cy='50' r='45' fill='none' stroke='${color}' stroke-width='6'/><circle cx='50' cy='50' r='30' fill='none' stroke='${color}' stroke-width='6'/><circle cx='50' cy='50' r='15' fill='none' stroke='${color}' stroke-width='6'/>`;
    else if (type === 'triple-triangle') inner = `<polygon points='50,5 95,85 5,85' fill='${color}' opacity='0.5'/><polygon points='50,15 85,75 15,75' fill='${color}' opacity='0.7'/><polygon points='50,25 75,65 25,65' fill='${color}' opacity='0.9'/>`;
    return `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

// --- GRID LOOP (FIXED) ---
function initGridState() {
    if (!State.currentColSizes || State.currentColSizes.length !== State.cols) {
        State.currentColSizes = new Array(State.cols).fill(1); State.currentRowSizes = new Array(State.rows).fill(1);
        State.baseColSizes = [...State.currentColSizes]; State.baseRowSizes = [...State.currentRowSizes];
        State.targetColSizes = [...State.currentColSizes]; State.targetRowSizes = [...State.currentRowSizes];
    }
    // CRITICAL: Set initial grid immediately to avoid "collapsed" state
    grid.style.gridTemplateColumns = State.currentColSizes.map(v => v + 'fr').join(' ');
    grid.style.gridTemplateRows = State.currentRowSizes.map(v => v + 'fr').join(' ');
    
    if (!renderLoopId) renderLoop();
}

function updateTargets() {
    if (State.isGridActive) return;
    for(let i=0; i<State.cols; i++) { State.targetColSizes[i] = State.baseColSizes[i]; }
    for(let i=0; i<State.rows; i++) { State.targetRowSizes[i] = State.baseRowSizes[i]; }
    if (State.hoverCol !== -1 && State.hoverCol < State.cols) State.targetColSizes[State.hoverCol] = Math.max(State.baseColSizes[State.hoverCol], CONFIG.MOUSE_EXPANSION);
    if (State.hoverRow !== -1 && State.hoverRow < State.rows) State.targetRowSizes[State.hoverRow] = Math.max(State.baseRowSizes[State.hoverRow], CONFIG.MOUSE_EXPANSION);
}

function renderLoop() {
    // CRITICAL FIX: If state is invalid, skip rendering this frame
    if (!State.currentColSizes || State.currentColSizes.length === 0) {
        renderLoopId = requestAnimationFrame(renderLoop);
        return;
    }

    updateTargets();
    let changed = false;
    for(let i=0; i<State.cols; i++) {
        const newVal = lerp(State.currentColSizes[i], State.targetColSizes[i], CONFIG.GRID_LERP);
        if (Math.abs(newVal - State.currentColSizes[i]) > 0.001) { State.currentColSizes[i] = newVal; changed = true; }
    }
    for(let i=0; i<State.rows; i++) {
        const newVal = lerp(State.currentRowSizes[i], State.targetRowSizes[i], CONFIG.GRID_LERP);
        if (Math.abs(newVal - State.currentRowSizes[i]) > 0.001) { State.currentRowSizes[i] = newVal; changed = true; }
    }
    if (changed || State.isGridActive) {
        grid.style.gridTemplateColumns = State.currentColSizes.map(v => v.toFixed(3) + 'fr').join(' ');
        grid.style.gridTemplateRows = State.currentRowSizes.map(v => v.toFixed(3) + 'fr').join(' ');
    }
    renderLoopId = requestAnimationFrame(renderLoop);
}

// --- CELL LOGIC ---
function setVisual(cell, style) {
    cell._style = style;
    cell.style.background = '';
    cell.classList.remove('painted');
    cell.innerHTML = ''; 

    if (style.type === 'empty') return;
    cell.classList.add('painted');
    
    if (style.shape === 'rect' || style.val.includes('gradient')) {
        cell.style.background = style.val;
    }
    
    if (style.shape === 'ascii') {
        const div = document.createElement('div');
        div.className = 'ascii-art';
        div.style.color = style.val; 
        div.innerText = style.textVal;
        cell.appendChild(div);
    } 
    else if (style.shape !== 'rect' && !style.val.includes('gradient')) {
        const div = document.createElement('div');
        div.className = 'inner-visual';
        div.innerHTML = getShapeContent(style.shape, style.val);
        cell.appendChild(div);
    }
}

function randomizeCell(cell, r, c, resizeGrid = true) {
    let newStyle = { ...cell._style, type: 'filled' };
    const tool = State.activeTool;
    const currentPal = PALETTES[State.paletteMode];
    const allColors = [...currentPal.solids, ...currentPal.gradients];
    const shapes = ['circle', 'triangle', 'rhombus', 'outline-circles', 'triple-triangle'];
    const patterns = ['dots', 'grid'];
    const asciiBig = ["A", "B", "X", "8", "@", "&", "?", "!", "%", "§", "M", "W", "Q", "#"];

    newStyle.val = allColors[Math.floor(Math.random() * allColors.length)];
    
    if (tool === 'solid') { newStyle.val = currentPal.solids[Math.floor(Math.random()*currentPal.solids.length)]; newStyle.shape = 'rect'; } 
    else if (tool === 'gradient') { newStyle.val = currentPal.gradients[Math.floor(Math.random()*currentPal.gradients.length)]; newStyle.shape = 'rect'; }
    else if (tool === 'shape') { newStyle.shape = shapes[Math.floor(Math.random()*shapes.length)]; }
    else if (tool === 'pattern') { newStyle.val = currentPal.solids[Math.floor(Math.random()*currentPal.solids.length)]; newStyle.shape = patterns[Math.floor(Math.random()*patterns.length)]; }
    else if (tool === 'ascii') {
        newStyle.shape = 'ascii';
        newStyle.val = currentPal.solids[Math.floor(Math.random()*currentPal.solids.length)]; 
        newStyle.textVal = asciiBig[Math.floor(Math.random() * asciiBig.length)];
    }
    else { // Chaos
        const rnd = Math.random();
        if (rnd < 0.18) { 
            newStyle.shape = 'ascii'; 
            newStyle.val = currentPal.solids[Math.floor(Math.random()*currentPal.solids.length)]; 
            newStyle.textVal = asciiBig[Math.floor(Math.random() * asciiBig.length)];
        }
        else if (rnd < 0.35) { newStyle.shape = patterns[Math.floor(Math.random()*patterns.length)]; }
        else if (rnd < 0.65) { newStyle.shape = 'rect'; }
        else { newStyle.shape = shapes[Math.floor(Math.random()*shapes.length)]; }
    }

    setVisual(cell, newStyle);

    if (resizeGrid && State.activeTool !== 'ascii') {
        const rndGrid = Math.random();
        State.baseColSizes[c] = rndGrid > 0.5 ? (Math.random() * 5 + 2) : (Math.random() * 0.3 + 0.2);
        State.baseRowSizes[r] = Math.random() > 0.5 ? (Math.random() * 5 + 2) : (Math.random() * 0.3 + 0.2);
    }
}

function createCell(r, c, spanR, spanC) {
    const cell = document.createElement('div');
    cell.className = 'cell'; cell.style.gridColumn = `span ${spanC}`; cell.style.gridRow = `span ${spanR}`;
    setVisual(cell, { type: 'empty', shape: 'rect', val: '' });
    cell.addEventListener('mouseenter', () => { State.hoverCol = c; State.hoverRow = r; if (State.interactionMode === 'hover') randomizeCell(cell, r, c, true); });
    cell.addEventListener('mouseleave', () => { State.hoverCol = -1; State.hoverRow = -1; });
    cell.addEventListener('click', (e) => randomizeCell(cell, r, c, true));
    cell.addEventListener('contextmenu', (e) => { e.preventDefault(); return false; });
    return cell;
}

// --- GENERATORS ---
function resetGrid(styling = true) {
    State.isGridActive = false; State.isShapeActive = false;
    clearInterval(gridIntervalId); clearInterval(shapeIntervalId);
    document.getElementById('btnAnimGrid').classList.remove('active');
    document.getElementById('btnAnimShape').classList.remove('active');
    
    // CRITICAL: Do NOT empty arrays immediately if using in loop, wait for init
    grid.innerHTML = ''; State.cells = [];
    
    if(styling) {
        // RESET GRID STYLE TO DEFAULT
        grid.style.backgroundColor = 'var(--line)'; 
        grid.style.border = '1px solid var(--line)'; 
        grid.style.gap = '1px';
    }
}

function generateCurrentLayout() {
    if(State.layoutMode === 0) generateChaos();
    else if(State.layoutMode === 1) generateChess();
    else if(State.layoutMode === 2) generateMondrian();
    else if(State.layoutMode === 3) generateCubism();
    else if(State.layoutMode === 4) generateConcentric();
    else generateAscii();
}

function generateChaos() {
    resetGrid(true); State.cols = 12; State.rows = 12; initGridState();
    for(let i=0; i<State.cols; i++) State.baseColSizes[i] = Math.random()*2+0.5; for(let i=0; i<State.rows; i++) State.baseRowSizes[i] = Math.random()*2+0.5;
    const occupied = Array(State.rows).fill().map(() => Array(State.cols).fill(false));
    for (let r = 0; r < State.rows; r++) {
        for (let c = 0; c < State.cols; c++) {
            if (occupied[r][c]) continue;
            let spanC = 1, spanR = 1;
            const rand = Math.random();
            if (rand > 0.92 && c < State.cols-3) spanC = 4; else if (rand > 0.85 && c < State.cols-2) spanC = 3; else if (rand > 0.75 && c < State.cols-1) spanC = 2;
            if (Math.random() > 0.88 && r < State.rows-2) spanR = 3; else if (Math.random() > 0.78 && r < State.rows-1) spanR = 2;
            let fit = true; for(let i=0; i<spanR; i++) for(let j=0; j<spanC; j++) { if(r+i >= State.rows || c+j >= State.cols || occupied[r+i][c+j]) fit = false; }
            if(!fit) { spanC = 1; spanR = 1; } for(let i=0; i<spanR; i++) for(let j=0; j<spanC; j++) occupied[r+i][c+j] = true;

            const cell = createCell(r,c,spanR,spanC);
            if(Math.random() > CONFIG.EMPTY_CHANCE) randomizeCell(cell,r,c,false);
            grid.appendChild(cell); State.cells.push(cell);
        }
    }
}

// ... Other generators ...
function generateChess() {
    resetGrid(true); State.cols = 12; State.rows = 12; initGridState();
    for(let i=0; i<State.cols; i++) {State.baseColSizes[i]=1; State.baseRowSizes[i]=1;}
    for(let r=0; r<State.rows; r++) for(let c=0; c<State.cols; c++) {
        const cell = createCell(r,c,1,1);
        if((r+c)%2===0) { const pal=PALETTES[State.paletteMode]; setVisual(cell,{type:'filled',shape:'rect',val:pal.solids[(r*c)%pal.solids.length]}); }
        grid.appendChild(cell); State.cells.push(cell);
    }
}

function generateMondrian() {
    resetGrid(false); 
    grid.style.backgroundColor='#000'; grid.style.gap='4px'; grid.style.border='4px solid #000';
    State.cols = 12; State.rows = 12; initGridState();
    State.baseColSizes = [2,4,1,3,2,2,1,4,2,1,3,2]; State.baseRowSizes = [3,1,2,4,1,3,2,2,4,1,2,3];
    const occupied = Array(State.rows).fill().map(() => Array(State.cols).fill(false));
    const mColors = ['#E30022', '#0000B8', '#FFD700', '#F0F0F0', '#F0F0F0'];
    for(let r=0; r<State.rows; r++) for(let c=0; c<State.cols; c++) {
        if(occupied[r][c]) continue;
        let spanC = (c%4===0 && c<State.cols-3) ? 3 : 1; let spanR = (r%4===0 && r<State.rows-3) ? 3 : 1;
        for(let i=0; i<spanR; i++) for(let j=0; j<spanC; j++) occupied[r+i][c+j] = true;
        const cell = createCell(r,c,spanR,spanC);
        let color = '#F0F0F0';
        if(Math.random()>0.6) {
            if(State.paletteMode==='modern') color=mColors[Math.floor(Math.random()*mColors.length)];
            else color=PALETTES[State.paletteMode].solids[Math.floor(Math.random()*PALETTES[State.paletteMode].solids.length)];
        }
        setVisual(cell,{type:'filled',shape:'rect',val:color});
        grid.appendChild(cell); State.cells.push(cell);
    }
}

function generateCubism() {
    resetGrid(false); grid.style.backgroundColor='#333'; grid.style.gap='2px'; grid.style.border='2px solid #333';
    State.cols = 14; State.rows = 14; initGridState();
    for(let i=0; i<State.cols; i++) State.baseColSizes[i] = Math.random()*2+0.5; for(let i=0; i<State.rows; i++) State.baseRowSizes[i] = Math.random()*2+0.5;
    const occupied = Array(State.rows).fill().map(() => Array(State.cols).fill(false));
    const colors = PALETTES.cubist.solids;
    for(let r=0; r<State.rows; r++) for(let c=0; c<State.cols; c++) {
        if(occupied[r][c]) continue;
        let spanC = 1; let spanR = 1;
        if(Math.random()>0.7 && c<State.cols-1) spanC=2; if(Math.random()>0.7 && r<State.rows-1) spanR=2;
        if(c+spanC>State.cols || r+spanR>State.rows || occupied[r][c] || (spanC>1&&occupied[r][c+1]) || (spanR>1&&occupied[r+1][c])) { spanC=1; spanR=1; }
        for(let i=0; i<spanR; i++) for(let j=0; j<spanC; j++) occupied[r+i][c+j] = true;
        const cell = createCell(r,c,spanR,spanC);
        let s = { type:'filled', shape:'rect', val: colors[Math.floor(Math.random()*colors.length)] };
        if(Math.random()>0.7) s.shape = ['triangle','rhombus'][Math.floor(Math.random()*2)];
        setVisual(cell, s);
        grid.appendChild(cell); State.cells.push(cell);
    }
}

function generateConcentric() { generateChaos(); }

function generateAscii() {
    resetGrid(true); State.cols = 12; State.rows = 12; initGridState();
    const asciiBig = ["A", "B", "X", "8", "@", "&", "?", "!", "%", "§"];
    for(let r=0; r<State.rows; r++) for(let c=0; c<State.cols; c++) {
        const cell = createCell(r,c,1,1);
        if(Math.random() > CONFIG.EMPTY_CHANCE) {
            const currentPal = PALETTES[State.paletteMode];
            let s = {
                type:'filled', shape:'ascii',
                val: currentPal.solids[Math.floor(Math.random()*currentPal.solids.length)],
                textVal: asciiBig[Math.floor(Math.random() * asciiBig.length)]
            };
            setVisual(cell, s);
        }
        grid.appendChild(cell); State.cells.push(cell);
    }
}

// UI BINDINGS
document.getElementById('btnLayout').onclick = (e) => {
    State.layoutMode = (State.layoutMode+1)%6; const m = ['Chaos','Chess','Mondrian','Cubism','Concentric','ASCII']; e.currentTarget.innerHTML = `<span class="material-symbols-rounded">style</span> Mode: ${m[State.layoutMode]}`; generateCurrentLayout();
};
document.getElementById('btnReroll').onclick = () => generateCurrentLayout();

// FIXED EVENT HANDLING (NO NULL ERRORS)
window.setTool = (t) => { 
    State.activeTool = t; 
    document.getElementById('toolLabel').innerText = `Current: ${t}`; 
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); 
    // Find button by ID matching pattern "tool-{name}"
    const btn = document.getElementById(`tool-${t}`);
    if(btn) btn.classList.add('active');
};

window.setPalette = (p) => { 
    State.paletteMode = p; 
    document.querySelectorAll('.pal-btn').forEach(b => b.classList.remove('active')); 
    const btn = document.getElementById(`pal-${p}`);
    if(btn) btn.classList.add('active');
    generateCurrentLayout(); 
};

document.getElementById('btnModeClick').onclick = () => { State.interactionMode='click'; document.getElementById('btnModeClick').classList.add('active'); document.getElementById('btnModeHover').classList.remove('active'); };
document.getElementById('btnModeHover').onclick = () => { State.interactionMode='hover'; document.getElementById('btnModeHover').classList.add('active'); document.getElementById('btnModeClick').classList.remove('active'); };
document.getElementById('btnAnimGrid').onclick = (e) => { State.isGridActive=!State.isGridActive; e.currentTarget.classList.toggle('active'); if(State.isGridActive) gridIntervalId=setInterval(autoGridStep, CONFIG.GRID_INTERVAL); else clearInterval(gridIntervalId); };
document.getElementById('btnAnimShape').onclick = (e) => { State.isShapeActive=!State.isShapeActive; e.currentTarget.classList.toggle('active'); if(State.isShapeActive) shapeIntervalId=setInterval(()=>{for(let i=0;i<3;i++)if(State.cells.length>0)randomizeCell(State.cells[Math.floor(Math.random()*State.cells.length)],0,0,false)}, CONFIG.SHAPE_INTERVAL); else clearInterval(shapeIntervalId); };
function autoGridStep() { for(let i=0; i<State.cols; i++) State.targetColSizes[i] = Math.random()*5; for(let i=0; i<State.rows; i++) State.targetRowSizes[i] = Math.random()*5; }
document.getElementById('btnTheme').onclick = () => document.body.classList.toggle('dark');

// FIXED CLEAR FUNCTION
document.getElementById('btnClear').onclick = () => { 
    resetGrid(true); // Force Grid Style Reset
    State.cols = 12; State.rows = 12; initGridState();
    for(let r=0;r<State.rows;r++) for(let c=0;c<State.cols;c++) { const cell=createCell(r,c,1,1); grid.appendChild(cell); State.cells.push(cell); } 
};

document.getElementById('btnRatio').onclick = (e) => { 
    State.ratioMode=(State.ratioMode+1)%3; 
    const labels = ['1:1', '16:9', '4:5'];
    e.currentTarget.innerHTML = `<span class="material-symbols-rounded">aspect_ratio</span> Ratio: ${labels[State.ratioMode]}`;
    if(State.ratioMode===0) { grid.style.setProperty('--grid-w','80vmin'); grid.style.setProperty('--grid-h','80vmin'); }
    else if(State.ratioMode===1) { grid.style.setProperty('--grid-w','min(90vw, 150vh)'); grid.style.setProperty('--grid-h','min(50.625vw, 85vh)'); }
    else { grid.style.setProperty('--grid-w','64vh'); grid.style.setProperty('--grid-h','80vh'); }
};

// EXPORT
document.getElementById('btnPng').onclick = () => {
    const t = grid.style.transition; grid.style.transition = 'none';
    html2canvas(grid, { scale: 4, backgroundColor: null }).then(c => {
        const a = document.createElement('a'); a.download = 'art.png'; a.href = c.toDataURL('image/png'); a.click();
        grid.style.transition = t;
    });
};
document.getElementById('btnSvg').onclick = () => {
    let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${grid.offsetWidth}" height="${grid.offsetHeight}">\n<rect width="100%" height="100%" fill="${getComputedStyle(grid).backgroundColor}"/>`;
    State.cells.forEach(cell => {
        if(cell._style.type === 'empty') return;
        const rect = { x: cell.offsetLeft, y: cell.offsetTop, w: cell.offsetWidth, h: cell.offsetHeight };
        if (cell._style.shape === 'ascii') {
             const char = (cell._style.textVal || "#").replace(/&/g,'&amp;').replace(/</g,'&lt;'); 
             svg += `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="none"/><text x="${rect.x+rect.w/2}" y="${rect.y+rect.h/2}" font-family="monospace" font-weight="900" font-size="${rect.h*0.6}" fill="${cell._style.val}" text-anchor="middle" dominant-baseline="middle">${char}</text>`;
        } else { svg += `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="${cell._style.val}"/>`; }
    });
    svg += `</svg>`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml'})); a.download = 'art.svg'; a.click();
};

generateChaos();