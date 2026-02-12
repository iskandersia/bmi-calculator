function calculateBMI() {
    // Получаем значения
    const weightInput = document.getElementById('weight').value;
    const heightInput = document.getElementById('height').value;
    
    // Валидация
    if (!weightInput || !heightInput) {
        alert('Пожалуйста, заполните оба поля');
        return;
    }

    const weight = parseFloat(weightInput);
    const heightCm = parseFloat(heightInput);
    
    // Проверка корректности значений
    if (weight <= 0 || heightCm <= 0) {
        alert('Пожалуйста, введите корректные значения');
        return;
    }

    // Конвертируем сантиметры в метры
    const heightM = heightCm / 100;

    // Рассчитываем ИМТ
    const bmi = weight / (heightM * heightM);

    // Определяем категорию
    let category = '';
    let description = '';
    let categoryClass = '';

    if (bmi < 18.5) {
        category = 'Недостаточный вес';
        description = 'Вам может быть полезно увеличить потребление калорий и проконсультироваться с врачом.';
        categoryClass = 'underweight';
    } else if (bmi >= 18.5 && bmi < 25) {
        category = 'Нормальный вес';
        description = 'Это идеальный диапазон для здоровья. Продолжайте поддерживать здоровый образ жизни!';
        categoryClass = 'normal';
    } else if (bmi >= 25 && bmi < 30) {
        category = 'Избыточная масса тела';
        description = 'Рекомендуется увеличить физическую активность и пересмотреть рацион питания.';
        categoryClass = 'overweight';
    } else if (bmi >= 30 && bmi < 35) {
        category = 'Ожирение I степени';
        description = 'Рекомендуется обратиться к врачу для разработки плана по снижению веса.';
        categoryClass = 'obesity1';
    } else if (bmi >= 35 && bmi < 40) {
        category = 'Ожирение II степени';
        description = 'Обратитесь к врачу или диетологу ��ля комплексной оценки вашего здоровья.';
        categoryClass = 'obesity2';
    } else {
        category = 'Ожирение III степени';
        description = 'Крайне важно получить профессиональную медицинскую помощь.';
        categoryClass = 'obesity3';
    }

    // Выводим результаты
    displayResult(bmi.toFixed(1), category, description, categoryClass);
}

function displayResult(bmi, category, description, categoryClass) {
    // Получаем контейнер результатов
    const resultContainer = document.getElementById('result-container');
    const bmiValue = document.getElementById('bmi-value');
    const bmiCategory = document.getElementById('bmi-category');
    const bmiDescription = document.getElementById('bmi-description');

    // Обновляем содержимое
    bmiValue.textContent = bmi;
    bmiCategory.textContent = category;
    bmiDescription.textContent = description;

    // Обновляем стили
    bmiCategory.className = 'bmi-category ' + categoryClass;

    // Показываем контейнер результатов
    resultContainer.classList.remove('hidden');

    // Скролим к результатам
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Позволяем рассчитывать ИМТ по нажатию Enter
document.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        calculateBMI();
    }
});

// Очищаем результаты при изменении значений
document.getElementById('weight').addEventListener('input', function() {
    document.getElementById('result-container').classList.add('hidden');
});

document.getElementById('height').addEventListener('input', function() {
    document.getElementById('result-container').classList.add('hidden');
});
