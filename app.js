// Проверка наличия Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
}

const CLIMATE = { tempInside: 22, tempOutside: -15, heatingDays: 136, tempAverage: 2.1 };
const TARIFS = { gas: 143.7, electricity: 48.48 };

const LAMBDA = {
    panel_concrete: 0.47,
    tuff: 0.65,
    concrete: 1.69,
    brick: 0.70,
    minvata: 0.045,
    penoplex: 0.035,
    plaster: 0.75
};

const WINDOWS_R = { single_old: 0.25, double_glazed: 0.42, energy_efficient: 0.75 };

// Чистый шаблон строк материалов БЕЗ вызова функций
const MATERIAL_OPTIONS_HTML = `
    <select class="mat-select">
        <option value="panel_concrete">Панель (Керамзитобетон СССР)</option>
        <option value="tuff">Армянский туф</option>
        <option value="concrete">Железобетон плиты</option>
        <option value="brick">Кирпич сплошной</option>
        <option value="minvata">Минеральная вата</option>
        <option value="penoplex">Пеноплекс / Пенопласт</option>
        <option value="plaster">Штукатурка</option>
    </select>
    <input type="number" class="mat-thick" value="5" placeholder="см">
`;

function addLayerToElement(button) {
    const layersContainer = button.previousElementSibling;
    if (!layersContainer) return;
    const div = document.createElement('div');
    div.className = 'layer-row';
    div.innerHTML = MATERIAL_OPTIONS_HTML;
    layersContainer.appendChild(div);
}

function addStaticLayer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'layer-row';
    div.innerHTML = MATERIAL_OPTIONS_HTML;
    container.appendChild(div);
}

function addNewWall() {
    const container = document.getElementById('wallsContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'sub-block wall-item';
    div.innerHTML = `
        <div class="form-group">
            <label>Название этой стены:</label>
            <input type="text" class="wall-name" value="Дополнительная стена">
        </div>
        <div class="form-group">
            <label>Площадь стены без учета окон (м²):</label>
            <input type="number" class="wall-area" value="15">
        </div>
        <div class="form-group">
            <label>Куда выходит стена?</label>
            <select class="wall-env">
                <option value="1.0">Прямо на улицу (коэф. 1.0)</option>
                <option value="0.6">В холодный подъезд / на балкон (коэф. 0.6)</option>
            </select>
        </div>
        <label>Слои этой стены:</label>
        <div class="wall-layers">
            <div class="layer-row">
                ${MATERIAL_OPTIONS_HTML}
            </div>
        </div>
        <button type="button" class="btn-secondary" onclick="addLayerToElement(this)">+ Добавить слой</button>
        <br><button type="button" class="btn-danger" onclick="this.parentElement.remove()">❌ Удалить эту стену</button>
    `;
    container.appendChild(div);
}

function addNewDoor() {
    const container = document.getElementById('doorsContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'sub-block door-item';
    div.innerHTML = `
        <div class="form-group">
            <label>Название двери:</label>
            <input type="text" class="door-name" value="Дополнительная дверь">
        </div>
        <div class="form-group">
            <label>Площадь двери (м²):</label>
            <input type="number" class="door-area" value="2">
        </div>
        <div class="form-group">
            <label>Куда ведет дверь?</label>
            <select class="door-env">
                <option value="0.6">В подъезд (коэф. 0.6)</option>
                <option value="1.0">На улицу (коэф. 1.0)</option>
            </select>
        </div>
        <div class="form-group">
            <label>Тип двери и утепление:</label>
            <select class="door-type">
                <option value="0.45">Металлическая стандарт (R=0.45)</option>
                <option value="0.30">Деревянная обычная (R=0.30)</option>
                <option value="0.80">С терморазрывом утепленная (R=0.80)</option>
            </select>
        </div>
        <button type="button" class="btn-danger" onclick="this.parentElement.remove()">❌ Удалить эту дверь</button>
    `;
    container.appendChild(div);
}

function calculateRFromLayersContainer(layersDiv) {
    if (!layersDiv) return 0.158;
    const rows = layersDiv.getElementsByClassName('layer-row');
    let totalR = 0.158; 
    for (let row of rows) {
        const matSelect = row.querySelector('.mat-select');
        const matThick = row.querySelector('.mat-thick');
        if (matSelect && matThick) {
            const material = matSelect.value;
            const thicknessCm = parseFloat(matThick.value) || 0;
            if (thicknessCm > 0 && LAMBDA[material]) {
                totalR += ((thicknessCm / 100) / LAMBDA[material]);
            }
        }
    }
    return totalR;
}

function runCalculation() {
    try {
        const deltaTPeak = CLIMATE.tempInside - CLIMATE.tempOutside;
        const deltaTAverage = CLIMATE.tempInside - CLIMATE.tempAverage;

        let peakLossNoVent = 0;
        let avgLoss = 0;
        
        let htmlDetails = "<h4>Промежуточные пиковые потери (при -15°C):</h4>";

        // 1. Стены
        const wallItems = document.getElementsByClassName('wall-item');
        for (let item of wallItems) {
            const nameEl = item.querySelector('.wall-name');
            const areaEl = item.querySelector('.wall-area');
            const envEl = item.querySelector('.wall-env');
            const layersDiv = item.querySelector('.wall-layers');

            const name = nameEl ? nameEl.value : "Стена";
            const area = areaEl ? parseFloat(areaEl.value) : 0;
            const corr = envEl ? parseFloat(envEl.value) : 1.0;
            const R_wall = calculateRFromLayersContainer(layersDiv);

            if (area > 0 && R_wall > 0) {
                const wallPeak = (area * deltaTPeak * corr) / R_wall;
                peakLossNoVent += wallPeak;
                avgLoss += (area * deltaTAverage * corr) / R_wall;
                htmlDetails += `🧱 ${name}: <b>${Math.round(wallPeak)} Вт</b> (R=${R_wall.toFixed(2)})<br>`;
            }
        }

        // 2. Окна
        const winAreaEl = document.getElementById('windowsArea');
        const winTypeEl = document.getElementById('windowsType');
        const windowsArea = winAreaEl ? parseFloat(winAreaEl.value) : 0;
        const R_window = winTypeEl ? WINDOWS_R[winTypeEl.value] : 0.42;
        
        if (windowsArea > 0) {
            const windowPeak = (windowsArea * deltaTPeak * 1.0) / R_window;
            peakLossNoVent += windowPeak;
            avgLoss += (windowsArea * deltaTAverage * 1.0) / R_window;
            htmlDetails += `🪟 Окна: <b>${Math.round(windowPeak)} Вт</b> (R=${R_window.toFixed(2)})<br>`;
        }

        // 3. Двери
        const doorItems = document.getElementsByClassName('door-item');
        for (let item of doorItems) {
            const nameEl = item.querySelector('.door-name');
            const areaEl = item.querySelector('.door-area');
            const envEl = item.querySelector('.door-env');
            const typeEl = item.querySelector('.door-type');

            const name = nameEl ? nameEl.value : "Дверь";
            const area = areaEl ? parseFloat(areaEl.value) : 0;
            const corr = envEl ? parseFloat(envEl.value) : 1.0;
            const R_door = typeEl ? parseFloat(typeEl.value) : 0.45;

            if (area > 0) {
                const doorPeak = (area * deltaTPeak * corr) / R_door;
                peakLossNoVent += doorPeak;
                avgLoss += (area * deltaTAverage * corr) / R_door;
                htmlDetails += `🚪 ${name}: <b>${Math.round(doorPeak)} Вт</b> (R=${R_door.toFixed(2)})<br>`;
            }
        }

        // 4. Потолок
        const ceilAreaEl = document.getElementById('ceilingArea');
        const ceilEnvEl = document.getElementById('ceilingEnvironment');
        const ceilLayersEl = document.getElementById('ceilingLayers');
        
        const ceilingArea = ceilAreaEl ? parseFloat(ceilAreaEl.value) : 0;
        const ceilingCorr = ceilEnvEl ? parseFloat(ceilEnvEl.value) : 0;
        const R_ceiling = calculateRFromLayersContainer(ceilLayersEl);
        
        if (ceilingArea > 0 && ceilingCorr > 0) {
            const ceilingPeak = (ceilingArea * deltaTPeak * ceilingCorr) / R_ceiling;
            peakLossNoVent += ceilingPeak;
            avgLoss += (ceilingArea * deltaTAverage * ceilingCorr) / R_ceiling;
            htmlDetails += `🔼 Потолок: <b>${Math.round(ceilingPeak)} Вт</b> (R=${R_ceiling.toFixed(2)})<br>`;
        } else {
            htmlDetails += `🔼 Потолок: <b>0 Вт</b> (Сверху отапливаемые соседи)<br>`;
        }

        // 5. Пол
        const floorAreaEl = document.getElementById('floorArea');
        const floorEnvEl = document.getElementById('floorEnvironment');
        const floorLayersEl = document.getElementById('floorLayers');
        
        const floorArea = floorAreaEl ? parseFloat(floorAreaEl.value) : 0;
        const floorCorr = floorEnvEl ? parseFloat(floorEnvEl.value) : 0;
        const R_floor = calculateRFromLayersContainer(floorLayersEl);
        
        if (floorArea > 0 && floorCorr > 0) {
            const floorPeak = (floorArea * deltaTPeak * floorCorr) / R_floor;
            peakLossNoVent += floorPeak;
            avgLoss += (floorArea * deltaTAverage * floorCorr) / R_floor;
            htmlDetails += `🔽 Пол: <b>${Math.round(floorPeak)} Вт</b> (R=${R_floor.toFixed(2)})<br>`;
        } else {
