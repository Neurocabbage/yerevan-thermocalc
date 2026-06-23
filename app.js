// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand(); // Развернуть на весь экран смартфона

const CLIMATE = { tempInside: 22, tempOutside: -15, heatingDays: 136, tempAverage: 2.1 };
const TARIFS = { gas: 143.7, electricity: 48.48 };
const MATERIALS_R = {
    walls: { tuff_40cm: 0.65, panel_concrete: 0.40, insulated_modern: 2.80 },
    windows: { single_old: 0.25, double_glazed: 0.42, energy_efficient: 0.70 }
};

function runCalculation() {
    // Собираем данные из полей смартфона
    const wallOuterArea = parseFloat(document.getElementById('wallOuter').value) || 0;
    const wallMaterial = document.getElementById('wallMaterial').value;
    const windowsArea = parseFloat(document.getElementById('windowsArea').value) || 0;
    const windowsType = document.getElementById('windowsType').value;

    const deltaTPeak = CLIMATE.tempInside - CLIMATE.tempOutside;
    const deltaTAverage = CLIMATE.tempInside - CLIMATE.tempAverage;

    // Считаем потери (базовый вариант без дверей и полов для простоты)
    let peakLoss = ((wallOuterArea * deltaTPeak) / MATERIALS_R.walls[wallMaterial]) + ((windowsArea * deltaTPeak) / MATERIALS_R.windows[windowsType]);
    let avgLoss = ((wallOuterArea * deltaTAverage) / MATERIALS_R.walls[wallMaterial]) + ((windowsArea * deltaTAverage) / MATERIALS_R.windows[windowsType]);
    
    peakLoss *= 1.2; // Вентиляция
    avgLoss *= 1.2;

    const totalKWh = (avgLoss / 1000) * 24 * CLIMATE.heatingDays;

    // Считаем деньги за сезон
    const gasCost = (totalKWh / (9.3 * 0.92)) * TARIFS.gas;
    const electCost = (totalKWh / 1.0) * TARIFS.electricity;

    // Выводим результат на экран телефона
    const out = document.getElementById('output');
    out.style.display = 'block';
    out.innerHTML = `
        <strong>Пиковая мощность:</strong> ${(peakLoss/1000).toFixed(2)} кВт<br>
        <strong>Энергия за зиму:</strong> ${Math.round(totalKWh)} кВт*ч<br><br>
        <strong>Расходы за сезон (драмы):</strong><br>
        🔥 Газ (Baxi): ${Math.round(gasCost).toLocaleString('ru-RU')} AMD<br>
        ⚡ Электричество: ${Math.round(electCost).toLocaleString('ru-RU')} AMD
    `;
}
