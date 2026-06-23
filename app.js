const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Климат Еревана
const CLIMATE = { tempInside: 22, tempOutside: -15, heatingDays: 136, tempAverage: 2.1 };
const TARIFS = { gas: 143.7, electricity: 48.48 };

// Коэффициенты теплопроводности материалов (лямбда, Вт/м*°C). Чем МЕНЬШЕ число, тем теплее материал!
const LAMBDA = {
    tuff: 0.65,       // Фельзитовый/вулканический туф
    concrete: 1.69,   // Тяжелый железобетон плиты перекрытия
    brick: 0.70,      // Глиняный кирпич
    minvata: 0.045,   // Каменная / минеральная вата
    penoplex: 0.035,  // Экструдированный пенополистирол
    plaster: 0.75     // Штукатурка / стяжка
};

// Фиксированные сопротивления окон (R)
const WINDOWS_R = { single_old: 0.25, double_glazed: 0.42, energy_efficient: 0.75 };

// Шаблон добавления нового слоя в интерфейс смартфона
function addLayer(containerId) {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'layer-row';
    div.innerHTML = `
        <select class="mat-select">
            <option value="tuff">Армянский туф (0.65)</option>
            <option value="concrete">Железобетон (1.69)</option>
            <option value="brick">Кирпич сплошной (0.70)</option>
            <option value="minvata">Минеральная вата (0.045)</option>
            <option value="penoplex">Пеноплекс (0.035)</option>
            <option value="plaster">Штукатурка / стяжка (0.75)</option>
        </select>
        <input type="number" class="mat-thick" value="5" placeholder="см">
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
