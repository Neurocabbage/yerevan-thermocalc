const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Климатические константы Еревана и Тарифы Армении
const CLIMATE = { tempInside: 22, tempOutside: -15, heatingDays: 136, tempAverage: 2.1 };
const TARIFS = { gas: 143.7, electricity: 48.48 };

// Базовые теплопроводности (Лямбда, Вт/м*°C). Меньше число — материал лучше держит тепло.
const LAMBDA = {
    panel_concrete: 0.47, // Советский керамзитобетон для панелей
    tuff: 0.65,           // Армянский вулканический туф
    concrete: 1.69,       // Сплошной тяжелый железобетон (перекрытия)
    brick: 0.70,          // Кирпич красный
    minvata: 0.045,       // Минеральная теплоизоляция
    penoplex: 0.035,      // Утеплитель ЭППС / Пенопласт
    plaster: 0.75         // Штукатурка, финишная стяжка
};

const WINDOWS_R = { single_old: 0.25, double_glazed: 0.42, energy_efficient: 0.75 };

// Строка выбора для инъекции слоев в UI смартфона
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
    const div = document.createElement('div');
    div.className = 'layer-row';
    div.innerHTML = MATERIAL_OPTIONS_HTML;
    layersContainer.appendChild(div);
}

function addStaticLayer(containerId) {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'layer-row';
    div.innerHTML = MATERIAL_OPTIONS_HTML;
    container.appendChild(div);
}

function addNewWall() {
    const container = document.getElementById('wallsContainer');
    const div = document.createElement('div');
    div.className = 'sub-block wall-item';
    div.innerHTML = `
        <div class="form-group">
            <label>Название/Имя этой стены:</label>
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
    const rows = layersDiv.getElementsByClassName('layer-row');
    let totalR = 0.158; // постоянное внутреннее и наружное теплосопротивление воздуха
    for (let row of rows) {
        const material = row.querySelector('.mat-select').value;
        const thicknessCm = parseFloat(row.querySelector('.mat-thick').value) || 0;
        if (thicknessCm > 0) {
            totalR += ((thicknessCm / 100) / LAMBDA[material]);
        }
    }
    return totalR;
}

function runCalculation() {
    const deltaTPeak = CLIMATE.tempInside - CLIMATE.tempOutside;
    const deltaTAverage = CLIMATE.tempInside - CLIMATE.tempAverage;

    let peakLossNoVent = 0;
    let avgLoss = 0;
    
    let htmlDetails = "<h4>Промежуточные пиковые потери (при -15°C):</h4>";

    // 1. Расчет всех созданных стен
    const wallItems = document.getElementsByClassName('wall-item');
    for (let item of wallItems) {
        const name = item.querySelector('.wall-name').value || "Стена";
        const area = parseFloat(item.querySelector('.wall-area').value) || 0;
        const corr = parseFloat(item.querySelector('.wall-env').value);
        const layersDiv = item.querySelector('.wall-layers');
        const R_wall = calculateRFromLayersContainer(layersDiv);

        if (area > 0) {
            const wallPeak = (area * deltaTPeak * corr) / R_wall;
            peakLossNoVent += wallPeak;
            avgLoss += (area * deltaTAverage * corr) / R_wall;
            htmlDetails += `🧱 ${name}: <b>${Math.round(wallPeak)} Вт</b> (R=${R_wall.toFixed(2)})<br>`;
        }
    }

    // 2. Окна
    const windowsArea = parseFloat(document.getElementById('windowsArea').value) || 0;
    const R_window = WINDOWS_R[document.getElementById('windowsType').value];
    if (windowsArea > 0) {
        const windowPeak = (windowsArea * deltaTPeak * 1.0) / R_window;
        peakLossNoVent += windowPeak;
        avgLoss += (windowsArea * deltaTAverage * 1.0) / R_window;
        htmlDetails += `🪟 Окна: <b>${Math.round(windowPeak)} Вт</b> (R=${R_window.toFixed(2)})<br>`;
    }

    // 3. Расчет всех созданных дверей
    const doorItems = document.getElementsByClassName('door-item');
    for (let item of doorItems) {
        const name = item.querySelector('.door-name').value || "Дверь";
        const area = parseFloat(item.querySelector('.door-area').value) || 0;
        const corr = parseFloat(item.querySelector('.door-env').value);
        const R_door = parseFloat(item.querySelector('.door-type').value);

        if (area > 0) {
            const doorPeak = (area * deltaTPeak * corr) / R_door;
            peakLossNoVent += doorPeak;
            avgLoss += (area * deltaTAverage * corr) / R_door;
            htmlDetails += `🚪 ${name}: <b>${Math.round(doorPeak)} Вт</b> (R=${R_door.toFixed(2)})<br>`;
        }
    }

    // 4. Потолок сверху
    const ceilingArea = parseFloat(document.getElementById('ceilingArea').value) || 0;
    const ceilingCorr = parseFloat(document.getElementById('ceilingEnvironment').value);
    const R_ceiling = calculateRFromLayersContainer(document.getElementById('ceilingLayers'));
    if (ceilingArea > 0 && ceilingCorr > 0) {
        const ceilingPeak = (ceilingArea * deltaTPeak * ceilingCorr) / R_ceiling;
        peakLossNoVent += ceilingPeak;
        avgLoss += (ceilingArea * deltaTAverage * ceilingCorr) / R_ceiling;
        htmlDetails += `🔼 Потолок: <b>${Math.round(ceilingPeak)} Вт</b> (R=${R_ceiling.toFixed(2)})<br>`;
    } else {
        htmlDetails += `🔼 Потолок: <b>0 Вт</b> (Сверху отапливаемые соседи)<br>`;
    }

    // 5. Пол снизу
    const floorArea = parseFloat(document.getElementById('floorArea').value) || 0;
    const floorCorr = parseFloat(document.getElementById('floorEnvironment').value);
    const R_floor = calculateRFromLayersContainer(document.getElementById('floorLayers'));
    if (floorArea > 0 && floorCorr > 0) {
        const floorPeak = (floorArea * deltaTPeak * floorCorr) / R_floor;
        peakLossNoVent += floorPeak;
        avgLoss += (floorArea * deltaTAverage * floorCorr) / R_floor;
        htmlDetails += `🔽 Пол: <b>${Math.round(floorPeak)} Вт</b> (R=${R_floor.toFixed(2)})<br>`;
    } else {
        htmlDetails += `🔽 Пол: <b>0 Вт</b> (Снизу отапливаемые соседи)<br>`;
    }

    // Добавляем инфильтрацию воздуха (+20%)
    const ventLoss = peakLossNoVent * 0.2;
    const finalPeakLoss = peakLossNoVent + ventLoss;
    avgLoss *= 1.2;

    htmlDetails += `💨 Вентиляция/Инфильтрация (+20%): <b>${Math.round(ventLoss)} Вт</b><br>`;

    // Сезонный расход энергии за зиму в кВт*ч
    const totalKWh = (avgLoss / 1000) * 24 * CLIMATE.heatingDays;

    // Расчет финансовой составляющей в драмах Армении
    const gasCost = (totalKWh / (9.3 * 0.92)) * TARIFS.gas;
    const electCost = (totalKWh / 1.0) * TARIFS.electricity;
    const кондиционерCost = (totalKWh / 2.8) * TARIFS.electricity;

    const out = document.getElementById('output');
    out.style.display = 'block';
    out.innerHTML = `
        <h3>📊 Детализация теплопотерь:</h3>
        <div class="calc-details">${htmlDetails}</div>

        <h3>🔍 Итоговые результаты:</h3>
    `;
    container.appendChild(div);
}

// Вычисление общего R для многослойной конструкции
function calculateStructureR(containerId) {
    const container = document.getElementById(containerId);
    const rows = container.getElementsByClassName('layer-row');
    
    // Внутреннее и внешнее сопротивление воздуха по СНиП (константа ~0.16)
    let totalR = 0.158; 

    for (let row of rows) {
        const material = row.querySelector('.mat-select').value;
        const thicknessCm = parseFloat(row.querySelector('.mat-thick').value) || 0;
        
        if (thicknessCm > 0) {
            const thicknessMeters = thicknessCm / 100; // Переводим см в метры
            totalR += (thicknessMeters / LAMBDA[material]); // R = толщина / лямбда
        }
    }
    return totalR;
}

function runCalculation() {
    const deltaTPeak = CLIMATE.tempInside - CLIMATE.tempOutside;
    const deltaTAverage = CLIMATE.tempInside - CLIMATE.tempAverage;

    // Считаем итоговые R для каждой конструкции на основе слоев
    const R_wall = calculateStructureR('wallLayers');
    const R_ceiling = calculateStructureR('ceilingLayers');
    const R_floor = calculateStructureR('floorLayers');
    const R_window = WINDOWS_R[document.getElementById('windowsType').value];

    // Геометрия и коэффициенты окружения (из выпадающих списков)
    const wallArea = parseFloat(document.getElementById('wallArea').value) || 0;
    const wallCorr = parseFloat(document.getElementById('wallEnvironment').value);

    const ceilingArea = parseFloat(document.getElementById('ceilingArea').value) || 0;
    const ceilingCorr = parseFloat(document.getElementById('ceilingEnvironment').value);

    const floorArea = parseFloat(document.getElementById('floorArea').value) || 0;
    const floorCorr = parseFloat(document.getElementById('floorEnvironment').value);

    const windowsArea = parseFloat(document.getElementById('windowsArea').value) || 0;

    // Расчет теплопотерь в Ваттах
    let peakLoss = 0;
    let avgLoss = 0;

    // Стены
    if (wallArea > 0) {
        peakLoss += (wallArea * deltaTPeak * wallCorr) / R_wall;
        avgLoss += (wallArea * deltaTAverage * wallCorr) / R_wall;
    }
    // Потолок
    if (ceilingArea > 0 && ceilingCorr > 0) {
        peakLoss += (ceilingArea * deltaTPeak * ceilingCorr) / R_ceiling;
        avgLoss += (ceilingArea * deltaTAverage * ceilingCorr) / R_ceiling;
    }
    // Пол
    if (floorArea > 0 && floorCorr > 0) {
        peakLoss += (floorArea * deltaTPeak * floorCorr) / R_floor;
        avgLoss += (floorArea * deltaTAverage * floorCorr) / R_floor;
    }
    // Окна (всегда на улицу, коэф. 1.0)
    if (windowsArea > 0) {
        peakLoss += (windowsArea * deltaTPeak * 1.0) / R_window;
        avgLoss += (windowsArea * deltaTAverage * 1.0) / R_window;
    }

    // Добавляем 20% запаса на инфильтрацию воздуха через вентиляцию
    peakLoss *= 1.2;
    avgLoss *= 1.2;

    // Суммарная энергия тепла за отопительный сезон (кВт*ч)
    const totalKWh = (avgLoss / 1000) * 24 * CLIMATE.heatingDays;

    // Расчет расходов по системам отопления
    const gasCost = (totalKWh / (9.3 * 0.92)) * TARIFS.gas; // КПД 92%
    const electCost = (totalKWh / 1.0) * TARIFS.electricity; // Электрокотел КПД 99%
    const кондиционерCost = (totalKWh / 2.8) * TARIFS.electricity; // Кондиционер зимой (COP=2.8)

    // Отображаем результаты
    const out = document.getElementById('output');
    out.style.display = 'block';
    out.innerHTML = `
        <h3>Результаты расчетов:</h3>
        🔹 <b>Пиковые теплопотери квартиры:</b> ${(peakLoss/1000).toFixed(2)} кВт<br>
        <i>(Это минимальная мощность отопительной системы, которая вам нужна в мороз -15°C)</i><br><br>
        🔹 <b>Необходимая энергия за зиму:</b> ${Math.round(totalKWh).toLocaleString('ru-RU')} кВт*ч<br>
        
        <h3>💰 Стоимость за сезон (136 дней):</h3>
        <div class="sys-card">
            🔥 <b>Газовый котел (Baxi и аналоги):</b><br>
            Расход газа: ${Math.round(totalKWh / (9.3 * 0.92))} м³<br>
            Итого: <b>${Math.round(gasCost).toLocaleString('ru-RU')} AMD</b>
        </div>
        <div class="sys-card">
            ⚡ <b>Электрический котел / Теплый пол:</b><br>
            Расход: ${Math.round(totalKWh)} кВт*ч<br>
            Итого: <b>${Math.round(electCost).toLocaleString('ru-RU')} AMD</b>
        </div>
        <div class="sys-card">
            ❄️ <b>Инверторный кондиционер (Тепловой насос):</b><br>
            Расход: ${Math.round(totalKWh / 2.8)} кВт*ч<br>
            Итого: <b>${Math.round(кондиционерCost).toLocaleString('ru-RU')} AMD</b>
        </div>
    `;
}
