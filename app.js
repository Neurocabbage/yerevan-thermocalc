// Настройки WebApp
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
}

// Данные для Еревана (-15°C в пике)
const CLIMATE = { 
    tempInside: 22, 
    tempOutside: -15, 
    heatingDays: 136, 
    tempAverage: 2.1 
};

// Действующие тарифы в Армении
const TARIFS = { 
    gas: 143.7, 
    electricity: 48.48 
};

// Коэффициенты теплопроводности материалов
// Расширенная база теплопроводности (лямбда)
const LAMBDA = {
    panel_concrete: 0.47, // Советский керамзитобетон для панелей
    tuff: 0.65,           // Армянский вулканический туф
    concrete: 1.69,       // Сплошной тяжелый железобетон (перекрытия)
    brick: 0.70,          // Кирпич красный
    minvata: 0.045,       // Минеральная теплоизоляция
    penoplex: 0.035,      // Утеплитель ЭППС / Пенопласт
    plaster: 0.75,         // Штукатурка, финишная стяжка
    block_hollow: 0.45    // НОВОЕ: Бетонный блок с полостями (20х20х40)
};

// Фиксированные R для светопрозрачных конструкций и полов по грунту
const WINDOWS_R = { 
    single_old: 0.25, 
    double_glazed: 0.42, 
    energy_efficient: 0.75,
    pvc_door_glass: 0.45   // НОВОЕ: Пластиковая дверь со стеклом и сэндвичем
};

// HTML шаблон списка материалов
const MATERIAL_OPTIONS_HTML = `
    <select class="mat-select">
        <option value="panel_concrete">Панель (Керамзитобетон СССР)</option>
        <option value="tuff">Армянский туф</option>
        <option value="block_hollow">Бетонный блок с полостями (20x20x40)</option>
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
                <option value="0.5">ПОДЗЕМНАЯ часть стены полуподвала (коэф. 0.5)</option>
                <option value="0.4">К НЕОТАПЛИВАЕМЫМ соседям за стеной (коэф. 0.4)</option>
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
            const name = item.querySelector('.wall-name')?.value || "Стена";
            const area = parseFloat(item.querySelector('.wall-area')?.value) || 0;
            const corr = parseFloat(item.querySelector('.wall-env')?.value) || 1.0;
            const R_wall = calculateRFromLayersContainer(item.querySelector('.wall-layers'));
            if (area > 0 && R_wall > 0) {
                const p = (area * deltaTPeak * corr) / R_wall;
                peakLossNoVent += p;
                avgLoss += (area * deltaTAverage * corr) / R_wall;
                htmlDetails += `🧱 ${name}: <b>${Math.round(p)} Вт</b> (R=${R_wall.toFixed(2)})<br>`;
            }
        }

        // 2. Окна
        const windowsArea = parseFloat(document.getElementById('windowsArea')?.value) || 0;
        const R_window = WINDOWWS_R = WINDOWS_R[document.getElementById('windowsType')?.value || 'double_glazed'];
        if (windowsArea > 0) {
            const p = (windowsArea * deltaTPeak * 1.0) / R_window;
            peakLossNoVent += p;
            avgLoss += (windowsArea * deltaTAverage * 1.0) / R_window;
            htmlDetails += `🪟 Окна: <b>${Math.round(p)} Вт</b> (R=${R_window.toFixed(2)})<br>`;
        }

        // 3. Двери
        const doorItems = document.getElementsByClassName('door-item');
        for (let item of doorItems) {
            const name = item.querySelector('.door-name')?.value || "Дверь";
            const area = parseFloat(item.querySelector('.door-area')?.value) || 0;
            const corr = parseFloat(item.querySelector('.door-env')?.value) || 1.0;
            const R_door = parseFloat(item.querySelector('.door-type')?.value) || 0.45;
            if (area > 0) {
                const p = (area * deltaTPeak * corr) / R_door;
                peakLossNoVent += p;
                avgLoss += (area * deltaTAverage * corr) / R_door;
                htmlDetails += `🚪 ${name}: <b>${Math.round(p)} Вт</b> (R=${R_door.toFixed(2)})<br>`;
            }
        }

        // 4. Потолок
        const ceilingArea = parseFloat(document.getElementById('ceilingArea')?.value) || 0;
        const ceilingCorr = parseFloat(document.getElementById('ceilingEnvironment')?.value) || 0;
        const R_ceiling = calculateRFromLayersContainer(document.getElementById('ceilingLayers'));
        if (ceilingArea > 0 && ceilingCorr > 0) {
            const p = (ceilingArea * deltaTPeak * ceilingCorr) / R_ceiling;
            peakLossNoVent += p;
            avgLoss += (ceilingArea * deltaTAverage * ceilingCorr) / R_ceiling;
            htmlDetails += `🔼 Потолок: <b>${Math.round(p)} Вт</b> (R=${R_ceiling.toFixed(2)})<br>`;
        } else {
            htmlDetails += `🔼 Потолок: <b>0 Вт</b> (Сверху тепло)<br>`;
        }

        // 5. Пол
        const floorArea = parseFloat(document.getElementById('floorArea')?.value) || 0;
        const floorCorr = parseFloat(document.getElementById('floorEnvironment')?.value) || 0;
        const R_floor = calculateRFromLayersContainer(document.getElementById('floorLayers'));
        if (floorArea > 0 && floorCorr > 0) {
            const p = (floorArea * deltaTPeak * floorCorr) / R_floor;
            peakLossNoVent += p;
            avgLoss += (floorArea * deltaTAverage * floorCorr) / R_floor;
            htmlDetails += `🔽 Пол: <b>${Math.round(p)} Вт</b> (R=${R_floor.toFixed(2)})<br>`;
        } else {
            htmlDetails += `🔽 Пол: <b>0 Вт</b> (Снизу тепло)<br>`;
        }

        // Вентиляция (+20%)
        const ventLoss = peakLossNoVent * 0.2;
        const finalPeakLoss = peakLossNoVent + ventLoss;
        avgLoss *= 1.2;
        htmlDetails += `💨 Вентиляция (+20%): <b>${Math.round(ventLoss)} Вт</b><br>`;

        const totalKWh = (avgLoss / 1000) * 24 * CLIMATE.heatingDays;
        const gasCost = (totalKWh / (9.3 * 0.92)) * TARIFS.gas;
        const electCost = (totalKWh / 1.0) * TARIFS.electricity;
        const кондиционерCost = (totalKWh / 2.8) * TARIFS.electricity;

        const out = document.getElementById('output');
        if (out) {
            out.style.display = 'block';
            document.getElementById('btnSaveFile').style.display = 'block';
            out.innerHTML = `
                <h3>📊 Детализация теплопотерь:</h3>
                <div class="calc-details">${htmlDetails}</div>
                <h3>🔍 Итоговые результаты:</h3>
                🔹 <b>Пиковые теплопотери:</b> ${(finalPeakLoss/1000).toFixed(2)} кВт<br>
                🔹 <b>Энергия за зиму:</b> ${Math.round(totalKWh).toLocaleString('ru-RU')} кВт*ч<br>
                <h3>💰 Стоимость за сезон:</h3>
                <div class="sys-card">🔥 <b>Газ (Baxi):</b> ${Math.round(gasCost).toLocaleString('ru-RU')} AMD</div>
                <div class="sys-card">⚡ <b>Электрокотел:</b> ${Math.round(electCost).toLocaleString('ru-RU')} AMD</div>
                <div class="sys-card">❄️ <b>Кондиционер (COP 2.8):</b> ${Math.round(кондиционерCost).toLocaleString('ru-RU')} AMD</div>
            `;
            out.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (err) {
        alert("Ошибка расчетов: " + err.message);
    }
}

 function saveResultsToFile() {
    try {
        // Сбор текстовых данных со страницы смартфона
        const detailsContainer = document.querySelector('.calc-details');
        const outputContainer = document.getElementById('output');
        
        if (!outputContainer || outputContainer.style.display === 'none') {
            alert('Сначала выполните расчет!');
            return;
        }

        // Формируем красивый текстовый файл
        let textContent = `=========================================\r\n`;
        textContent += `ОТЧЕТ ПО ТЕПЛОПОТЕРЯМ КВАРТИРЫ (ЕРЕВАН)\r\n`;
        textContent += `=========================================\r\n\r\n`;
        
        // Извлекаем детализацию в Ваттах (убираем HTML теги)
        if (detailsContainer) {
            let detailsText = detailsContainer.innerHTML
                .replace(/<br>/g, '\r\n')
                .replace(/<\/?[^>]+(>|$)/g, ""); // Очистка от тегов 🧱, 🪟, <b>
            textContent += `ДЕТАЛИЗАЦИЯ ПОТЕРЬ ПРИ -15°C:\r\n${detailsText}\r\n`;
        }

        textContent += `-----------------------------------------\r\n`;
        
        // Извлекаем итоговые результаты и стоимость отопления
        let resultsText = outputContainer.innerHTML
            .split('<h3>💰 Стоимость за сезон')[0] // берем первую часть до стоимости
            .replace(/<br>/g, '\r\n')
            .replace(/<\/?[^>]+(>|$)/g, "")
            .replace(/📊 Детализация теплопотерь:[\s\S]*?🔍 Итоговые результаты:/, "ИТОГОВЫЕ РЕЗУЛЬТАТЫ:");
            
        textContent += resultsText + `\r\n`;
        textContent += `-----------------------------------------\r\n`;
        textContent += `ОРИЕНТИРОВОЧНАЯ СТОИМОСТЬ ЗА ЗИМУ (136 дней):\r\n`;

        // Собираем данные по Baxi, электрокотлу и кондиционеру
        const cards = outputContainer.getElementsByClassName('sys-card');
        for (let card of cards) {
            textContent += `> ${card.innerText}\r\n`;
        }
        
        textContent += `\r\n\r\nДата расчета: ${new Date().toLocaleDateString('ru-RU')}\r\n`;
        textContent += `Создано в Telegram Mini App Калькулятор Тепла.`;

        // Создаем Blob (двоичный объект) с текстом в кодировке UTF-8
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        
        // Формируем имя файла, например: "teplo_report_24_06_2026.txt"
        const dateStr = new Date().toLocaleDateString('ru-RU').replace(/\./g, '_');
        link.download = `teplo_report_${dateStr}.txt`;
        
        // Запуск скачивания на мобильном устройстве
        link.href = window.URL.createObjectURL(blob);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (err) {
        alert("Не удалось сохранить файл: " + err.message);
    }
}
   
    
                                                 
