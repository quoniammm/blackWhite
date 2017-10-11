import {ActivityIndicator, Composite, ScrollView, Tab, TextInput, ui } from 'tabris';
import BackgroundLayer from './backgroundLayer';
import CurrentWeatherView from './currentWeatherView';
import ForecastOverview from './forecastOverview';
import ForecastTabView from './forecastTabView';
import WeatherGraph from './weatherGraph';
import {pollWeatherData, WeatherData} from './weatherService';

ui.contentView.background = 'rgb(83,100,160)';
ui.contentView.on({
  resize: () => applyLayout()
});

let background = new BackgroundLayer({
  left: 0, right: 0, top: 0, height: ui.contentView.height
}).appendTo(ui.contentView);

let scrollView = new ScrollView({
  left: 0, right: 0, top: 0, bottom: 0
}).on({
  scrollY: ({offset}) => background.scroll(-offset)
}).appendTo(ui.contentView);

let input = new TextInput({
    top: 30, centerX: 0,
    id: 'citySelector',
    message: 'enter city',
    textColor: '#FFFFFF',
    background: 'rgba(255, 255, 255, 0)',
    font: 'normal thin 32px sans-serif'
  }).on({
    focus: () => input.text = '',
    blur: () => input.text = localStorage.getItem('city') || '',
    accept: () => loadCity(input.text)
  }).appendTo(scrollView);

if (localStorage.getItem('city')) {
  loadCity(localStorage.getItem('city'));
}

function loadCity(cityName: string) {
  let activityIndicator = new ActivityIndicator({centerX: 0, centerY: 0}).appendTo(ui.contentView);
  pollWeatherData(cityName)
    .then(data => {
      input.text = data.cityName + ', ' + data.countryName;
      localStorage.setItem('city', data.cityName);
      presentWeather(data);
    }).catch(error => {
      console.error(error);
      input.text = '';
      localStorage.setItem('city', '');
    }).then(() => activityIndicator.dispose());
}

function presentWeather(data: WeatherData) {
  ui.contentView.find('.weatherInfo').dispose();
  createWeatherInformation(data);
  applyLayout();
}

function createWeatherInformation(weatherData: WeatherData) {
  new Composite({class: 'weatherInfo', id: 'container'}).append(
    new CurrentWeatherView({weatherData, class: 'weatherInfo', id: 'current'}),
    new WeatherGraph({weatherData, class: 'weatherInfo', id: 'graph'}),
    new ForecastTabView({weatherData, class: 'weatherInfo', id: 'forecast'}).on({
      selectionChanged: ({target, value}) => changeGraphFocus(target as ForecastTabView, value, weatherData)
      }),
    new ForecastOverview({weatherData, class: 'weatherInfo', id: 'overview'}).on({
      daySelect: ({dayIndex}) => {
      let forecastTabView = ui.find('#forecast').first() as ForecastTabView;
      forecastTabView.selection = forecastTabView.getTab(dayIndex);
    }})
  ).on({
    resize: ({top, height}) => background.height = height + top
  }).appendTo(scrollView);
}

function applyLayout() {
  ui.contentView.apply({
    '#container': {top: 'prev()', left: 0, right: 0},
    '#current'  : {top: 0, left: 0, right: 0, height: 200},
    '#overview' : {top: '#current', left: 0, right: 0},
    '#graph'    : {top: '#overview', right: 0, left: 0, height: 200},
    '#forecast' : {top: ['#graph', 4], left: 0, right: 0, height: 410}
  });
}

function changeGraphFocus(forecastTabView: ForecastTabView, selection: Tab, data: WeatherData) {
  let day = forecastTabView.getTabIndex(selection);
  let graph = ui.contentView.find(WeatherGraph).first();
  if (day === 0) {
    animateGraphChange(graph, data.list[0].date.getTime(), data.list[data.list.length - 1].date.getTime());
  } else {
    let time = data.days[day][0].date.getTime();
    let newMin = new Date(time).setHours(0, 0, 0, 0);
    let newMax = new Date(time + 24 * 60 * 60 * 1000).setHours(0, 0, 0, 0);
    animateGraphChange(graph, newMin, newMax);
  }
}

function animateGraphChange(graph: WeatherGraph, min: number, max: number) {
  graph.animate({opacity: 0}, {duration: 180, easing: 'ease-in-out' })
    .then(() => {
      graph.setScale(min, max);
      graph.animate({opacity: 1}, {duration: 180, easing: 'ease-in-out'});
    });
}
