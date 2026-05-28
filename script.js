/* Общий скрипт сайта Мордовэнергосбыт.
   Вариант валюты — румынский лей (RON). Курс берётся с cbr-xml-daily.ru. */

// ---------- Меню (вариант 5) ----------
(function () {
  var toggle = document.getElementById('menu-toggle');
  var panel = document.getElementById('nav-panel');
  var overlay = document.getElementById('nav-overlay');
  if (!toggle || !panel) return;
  function setOpen(open) {
    toggle.classList.toggle('open', open);
    panel.classList.toggle('open', open);
    if (overlay) overlay.classList.toggle('open', open);
  }
  toggle.addEventListener('click', function () {
    setOpen(!panel.classList.contains('open'));
  });
  if (overlay) overlay.addEventListener('click', function () { setOpen(false); });
})();

// ---------- Кнопка «наверх» ----------
(function () {
  var btn = document.getElementById('to-top');
  if (!btn) return;
  window.addEventListener('scroll', function () {
    btn.classList.toggle('show', window.scrollY > 300);
  });
  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// ---------- Новости: раскрытие карточки ----------
(function () {
  var cards = document.querySelectorAll('.news-card');
  cards.forEach(function (card) {
    var btn = card.querySelector('.toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var open = card.classList.toggle('expanded');
      btn.textContent = open ? 'Скрыть' : 'Показать полностью';
    });
  });
})();

// ---------- Калькулятор валют + диаграмма (только на странице курса) ----------
(function () {
  var calc = document.getElementById('currency-calc');
  if (!calc) return;

  var CODE = 'RON';            // вариант 27 — румынский лей
  var rubInput = document.getElementById('rub');
  var curInput = document.getElementById('cur');
  var rateLine = document.getElementById('rate-line');
  var chartInfo = document.getElementById('chart-info');
  var rate = null;             // сколько рублей за 1 RON (с учётом номинала)

  // Текущий курс на сегодня
  fetch('https://www.cbr-xml-daily.ru/daily_json.js')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var v = data.Valute[CODE];
      rate = v.Value / v.Nominal;          // рублей за 1 RON
      var date = (data.Date || '').slice(0, 10).split('-').reverse().join('.');
      rateLine.textContent = 'Курс на ' + date + ': 1 ' + CODE +
        ' = ' + rate.toFixed(4) + ' ₽ (номинал ' + v.Nominal + ')';
      recalcFromRub();
    })
    .catch(function () {
      rateLine.textContent = 'Не удалось загрузить актуальный курс. Проверьте подключение к интернету.';
    });

  function recalcFromRub() {
    if (rate == null) return;
    var rub = parseFloat(rubInput.value) || 0;
    curInput.value = (rub / rate).toFixed(2);
  }
  function recalcFromCur() {
    if (rate == null) return;
    var cur = parseFloat(curInput.value) || 0;
    rubInput.value = (cur * rate).toFixed(2);
  }
  rubInput.addEventListener('input', recalcFromRub);
  curInput.addEventListener('input', recalcFromCur);

  // ----- История курса за ~месяц для диаграммы -----
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function archiveUrl(d) {
    return 'https://www.cbr-xml-daily.ru/archive/' +
      d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) +
      '/daily_json.js';
  }

  var today = new Date();
  var requests = [];
  for (var i = 32; i >= 0; i--) {
    var d = new Date(today.getTime() - i * 86400000);
    requests.push(
      fetch(archiveUrl(d))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.Valute || !j.Valute[CODE]) return null;
          var v = j.Valute[CODE];
          return { date: (j.Date || '').slice(0, 10), value: v.Value / v.Nominal };
        })
        .catch(function () { return null; })
    );
  }

  Promise.all(requests).then(function (rows) {
    var points = rows.filter(Boolean);
    // убрать дубли дат, отсортировать
    var seen = {};
    points = points.filter(function (p) {
      if (seen[p.date]) return false; seen[p.date] = 1; return true;
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });

    if (!points.length || typeof Chart === 'undefined') {
      if (chartInfo) chartInfo.textContent = 'Данные для построения диаграммы недоступны.';
      return;
    }

    var labels = points.map(function (p) { return p.date.slice(5).split('-').reverse().join('.'); });
    var values = points.map(function (p) { return +p.value.toFixed(4); });
    var baseColor = 'rgba(10,77,140,.75)';
    var hiColor = 'rgba(245,166,35,.95)';
    var colors = values.map(function () { return baseColor; });

    var ctx = document.getElementById('rate-chart').getContext('2d');
    var chart = new Chart(ctx, {
      type: 'bar',
      data: { labels: labels, datasets: [{ label: 'Курс RON, ₽', data: values, backgroundColor: colors, borderColor: 'rgba(6,51,95,1)', borderWidth: 1 }] },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.parsed.y.toFixed(4) + ' ₽'; } } } },
        scales: { y: { title: { display: true, text: 'рублей за 1 RON' } } },
        onClick: function (evt, els) {
          if (!els.length) return;
          var idx = els[0].index;
          colors = values.map(function (_, j) { return j === idx ? hiColor : baseColor; });
          chart.data.datasets[0].backgroundColor = colors;
          chart.update();
          if (chartInfo) {
            chartInfo.innerHTML = '<b>' + points[idx].date.split('-').reverse().join('.') +
              '</b>: 1 RON = <b>' + values[idx].toFixed(4) + ' ₽</b>';
          }
        }
      }
    });
    if (chartInfo) chartInfo.textContent = 'Щёлкните по столбцу, чтобы увидеть дату и курс.';
  });
})();
