'use strict';

const RATES = ['1/2.5', '1/2.25', '1/2' ,'1/1.75', '1/1.5', '1/1.25', '1', '1.25', '1.5', '1.75', '2', '2.25', '2.5'];

function popupateCell(cell, voice, text, normalDuration) {
  if (voice.voiceURI.startsWith('Google') && parseFloat(cell.dataset.rate) > 2) {
    return Promise.resolve(normalDuration);
  }

  if (cell.dataset.duration) {
    return Promise.resolve(parseFloat(cell.dataset.duration));
  }

  return new Promise(resolve => {
    let u = new SpeechSynthesisUtterance(text);
    let now = 0;
    u.rate = eval(cell.dataset.rate);
    u.voice = voice;
    u.onstart = e => {
      now = Date.now();
      cell.classList.add('warning');
    };

    u.onerror = console.log.bind(console);

    u.onend = e => {
      cell.classList.remove('warning');
      let duration = Date.now() - now;
      cell.dataset.duration = duration;
      cell.dataset.value = normalDuration ? normalDuration / duration : 1;
      cell.textContent = parseFloat(cell.dataset.value).toPrecision(3);
      resolve(duration);
    };

    speechSynthesis.speak(u);
  });
}

function createRow() {
  let results = document.querySelector('#results tbody');
  let row = document.createElement('tr');
  results.appendChild(row);

  return row;
}

function doVoice(voice, text) {
  let selector = `#results tr[data-voice="${voice.voiceURI}"] td.ratecell`
  let normalRateCell = document.querySelector(selector + '[data-rate="1"]');
  let ratecells = document.querySelectorAll(selector + ':not([data-rate="1"])');
  return popupateCell(normalRateCell, voice, text).then(normalDuration => {
    return Promise.all(
      Array.from(ratecells).map(cell => popupateCell(cell, voice, text, normalDuration)));
  });
}

function buildColumnHeaders() {
  let row = createRow();

  let th = document.createElement('th');
  th.textContent = 'Voice';
  row.appendChild(th);

  for (let rateString of RATES) {
    th = document.createElement('th');
    th.textContent = rateString;
    th.className = 'ratecell';
    row.appendChild(th);
  }
}

function buildVoiceRow(voice, values) {
  let row = createRow();
  row.className = 'result';
  row.dataset.voice = voice.voiceURI;
  let td = document.createElement('td');
  td.textContent = voice.name;
  row.appendChild(td);

  for (let i in RATES) {
    let rateString = RATES[i];
    td = document.createElement('td');
    td.className = 'ratecell';
    td.dataset.rate = rateString;
    if (values && values[i]) {
      td.dataset.value = values[i];
      td.textContent = parseFloat(values[i]).toPrecision(3);
    }
    row.appendChild(td);
  }
}

function updatePlayState(playing) {
  let button = document.getElementById("startstop");
  button.classList.toggle('btn-success', !playing);
  button.classList.toggle('btn-danger', playing);
  button.classList.toggle('playing', playing);
  button.textContent = playing ? 'Stop' : 'Start';
}

function stop() {
  speechSynthesis.cancel();
  updatePlayState(false);
}

function start() {
  updatePlayState(true);
  let text = document.getElementById('texttospeak').value;
  let selectedOptions = document.getElementById('voices').selectedOptions;
  let selectedVoices = new Set(Array.from(selectedOptions).map(o => o.value));
  let voices = speechSynthesis.getVoices().filter(v => selectedVoices.has(v.voiceURI));
  let p = Promise.resolve();
  for (let voice of voices) {
    let v = voice;
    if (!document.querySelector(`#results tr[data-voice="${voice.voiceURI}"]`)) {
      buildVoiceRow(voice);
    }

    p = p.then(() => {
      return doVoice(v, text);
    });
  }

  p.then(() => {
    updatePlayState(false);
    plot();
    updatePermalink();
  });
}

function parseQueryString() {
  let query = location.search.substring(1);
  if (query) {
    let rows = query.split('&').map(e => JSON.parse(decodeURIComponent(e)));
    for (let values of rows) {
      let voice = { voiceURI: values.shift(), name: values.shift() };
      buildVoiceRow(voice, values);
    }
  }

  plot();
}

function encodeArray(array) {
  return '?' + array.map(value => encodeURIComponent(JSON.stringify(value))).join('&');
}

function updatePermalink() {
  let rows = Array.from(document.querySelectorAll('#results tr.result'));
  if (!rows.length)
    return;

  let data = [];
  for (let row of rows) {
    let v = Array.from(row.querySelectorAll('td')).map(cell => cell.dataset.value || cell.textContent);
    v.unshift(row.dataset.voice);
    data.push(v);
  }

  let permalink = document.getElementById('permalink');
  permalink.href = location;
  permalink.search = encodeArray(data);
}

function plot() {
  let series = [RATES.map(s => Math.log10(eval(s)))];
  let rows = Array.from(document.querySelectorAll('#results tr.result'));
  for (let row of rows) {
    series.push(Array.from(row.querySelectorAll('td.ratecell')).map(
      cell => Math.log10(parseFloat(cell.dataset.value))));
  }
  var data = {
  labels: RATES,
  // Our series array that contains series objects or in this case series data arrays
  series: series
};
  new Chartist.Line('.ct-chart', data, {
    axisY: { showLabel: false, offset: 0 },
    chartPadding: { top: 15, right: 15, bottom: 5, left: 10 }
  });
};

function initVoices() {
  let voices = speechSynthesis.getVoices();
  startButton.disabled = false;
  var selectElm = document.querySelector('#voices');
  selectElm.innerHTML = '';
  voices.sort((a, b) => a.name.localeCompare(b.name));
  for (var i=0;i < voices.length;i++) {
    var option = document.createElement('option');
    option.innerHTML = voices[i].name + ' (' + voices[i].lang + ')';
    option.setAttribute('value', voices[i].voiceURI);
    option.voice = voices[i];
    if (voices[i].isDefault) {
      option.selected = true;
    }
    selectElm.appendChild(option);
  }

}

let startButton = document.getElementById("startstop");
startButton.addEventListener("click", e => {
  if (e.target.classList.contains('playing')) {
    stop(e.target);
  } else {
    start(e.target);
  }
});

buildColumnHeaders();
parseQueryString();
updatePermalink();

if (speechSynthesis.getVoices().length === 0) {
  speechSynthesis.addEventListener('voiceschanged', initVoices);
} else {
  initVoices();
}

