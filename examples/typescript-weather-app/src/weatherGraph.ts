import {Canvas, CanvasContext, CompositeProperties, device} from 'tabris';
import {omit} from './util';
import {WeatherData, WeatherDatum} from './weatherService';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const UI_FONT = '16px sans-serif';
const UI_LINE_COLOR = 'rgba(255,255,255,0.3)';
const UI_TEXT_COLOR = 'rgba(0,0,0,0.4)';
const GRAPH_LINE_COLOR = 'rgba(255,255,255,0.55)';
const UI_LINE_WIDTH = 1.5;
const GRAPH_LINE_WIDTH = 1;
const MIN_HORIZONTAL_DISTANCE = 33;
const MIN_VERTICAL_DISTANCE = 25;
const HOURS_LENGTH = 60 * 60 * 1000;
const DAY_LENGTH = 24 * 60 * 60 * 1000;
const NIGHT_COLOR = 'rgba(103,113,145,0.392)';
const DAY_COLOR = 'rgba(131,156,188,0.286)';
const margins = { top: 20, left: 30, bottom: 13, right: 10 };

interface WeatherGraphProperties extends CompositeProperties {
  weatherData: WeatherData;
}


export default class WeatherGraph extends Canvas {
  private canvas: Canvas;
  private dataPoints: WeatherDatum[];
  private weatherData: WeatherData;
  private scale: { minX: number, maxX: number, minY: number, maxY: number };

  constructor(properties: WeatherGraphProperties) {
    super(omit(properties, 'data'));
    this.weatherData = properties.weatherData;
    this.scale = {
      minX: this.weatherData.list[0].date.getTime(),
      maxX: this.weatherData.list[this.weatherData.list.length - 1].date.getTime(),
      minY: 0,
      maxY: 0
    };
    this.initDataPoints();
    this.initScale();
    this.canvas = new Canvas({ top: 0, left: 0, right: 0, bottom: 0 });
    this.on({
      resize: () => this.draw()
    });
  }

  public setScale(newMin: number, newMax: number) {
    this.scale.minX = newMin;
    this.scale.maxX = newMax;
    this.initDataPoints();
    this.initScale();
    this.draw();
  }

  public draw() {
    let width = this.bounds.width * device.scaleFactor;
    let height = this.bounds.height * device.scaleFactor;
    let ctx = this.getContext('2d', width, height);
    this.drawBackground(ctx);
    this.drawTemperatureScale(ctx);
    this.drawTimeScale(ctx);
    this.drawTemperatureCurve(ctx);
  }

  private initDataPoints() {
    this.dataPoints = this.weatherData.list.filter((datum) =>
      (datum.date.getTime() > this.scale.minX && datum.date.getTime() < this.scale.maxX)
    );
    let firstIndex = this.weatherData.list.indexOf(this.dataPoints[0]);
    let lastIndex = this.weatherData.list.indexOf(this.dataPoints[this.dataPoints.length - 1]);
    if (firstIndex > 0) {
      this.dataPoints.unshift(this.weatherData.getWeatherAtDate(new Date(this.scale.minX)));
    }
    if (lastIndex < this.weatherData.list.length - 1) {
      this.dataPoints.push(this.weatherData.getWeatherAtDate(new Date(this.scale.maxX)));
    }
  }

  private initScale() {
    let temperatures = this.dataPoints.map((forcast) => forcast.temperature);
    let [minTemp, maxTemp] = [Math.min(...temperatures), Math.max(...temperatures)];
    let meanTemp = (maxTemp + minTemp) / 2;
    let tempScaleFactor = 1.2;
    this.scale.minY = meanTemp + tempScaleFactor * (minTemp - meanTemp);
    this.scale.maxY = meanTemp + tempScaleFactor * (maxTemp - meanTemp);
  }

  private drawBackground(ctx: CanvasContext) {
    let now = this.scale.minX;
    let dayOffset = new Date(now).getDate() - this.weatherData.list[0].date.getDate();
    let sunriseTime = this.weatherData.sunriseTime.getTime() + dayOffset * DAY_LENGTH;
    let sunsetTime = this.weatherData.sunsetTime.getTime() + dayOffset * DAY_LENGTH;
    let isDay = (sunriseTime < now && now < sunsetTime);
    sunriseTime += (now > sunriseTime) ? DAY_LENGTH : 0;
    sunsetTime += (now > sunsetTime) ? DAY_LENGTH : 0;
    let startTime = Math.min(sunriseTime, sunsetTime);
    let endTime = Math.max(sunriseTime, sunsetTime);

    this.drawArea(ctx, now, startTime, isDay ? DAY_COLOR : NIGHT_COLOR);
    isDay = !isDay;
    while (endTime < this.scale.maxX) {
      this.drawArea(ctx, startTime, endTime, isDay ? DAY_COLOR : NIGHT_COLOR);
      isDay = !isDay;
      [startTime, endTime] = [endTime, startTime + DAY_LENGTH];
    }
    this.drawArea(ctx, startTime, this.scale.maxX, isDay ? DAY_COLOR : NIGHT_COLOR);
  }

  private drawArea(ctx: CanvasContext, startTime: number, endTime: number, color: string) {
    ctx.fillStyle = color;
    let graphHeight = this.bounds.height - margins.top - margins.bottom;
    ctx.fillRect(this.getX(startTime),
      this.getY(this.scale.maxY),
      this.getX(endTime) - this.getX(startTime),
      graphHeight
    );
  }

  private drawTemperatureScale(ctx: CanvasContext) {
    let degreeHeight = this.getY(this.scale.minY) - this.getY(this.scale.minY + 1);
    let degreeStep = (degreeHeight > MIN_VERTICAL_DISTANCE) ? 1 : (2 * degreeHeight > MIN_VERTICAL_DISTANCE) ? 2 : 5;
    let minHeight = Math.ceil(this.scale.minY / degreeStep) * degreeStep;
    ctx.strokeStyle = UI_LINE_COLOR;
    ctx.lineWidth = UI_LINE_WIDTH;
    for (let height = minHeight; height < this.scale.maxY; height += degreeStep) {
      // horizontal line
      ctx.beginPath();
      ctx.moveTo(this.getX(this.scale.minX), this.getY(height));
      ctx.lineTo(this.getX(this.scale.maxX), this.getY(height));
      ctx.stroke();
      // text label
      ctx.fillStyle = UI_TEXT_COLOR;
      ctx.font = UI_FONT;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(height + '°C', this.getX(this.scale.minX) - 2, this.getY(height));
    }
  }

  private drawTimeScale(ctx: CanvasContext) {
    ctx.strokeStyle = UI_LINE_COLOR;
    ctx.lineWidth = UI_LINE_WIDTH;
    ctx.fillStyle = UI_TEXT_COLOR;
    ctx.font = UI_FONT;
    let minDay = new Date(this.scale.minX).setHours(0, 0, 0, 0);
    minDay += (minDay === this.scale.minX) ? 0 : DAY_LENGTH;
    for (let day = minDay; day < this.scale.maxX; day += DAY_LENGTH) {
      this.drawVerticalLine(ctx, day, 12);
      this.drawDayLabel(ctx, day);
    }
    let hourWidth = this.getX(this.scale.minX + HOURS_LENGTH) - this.getX(this.scale.minX);
    let hourStep = (2 * hourWidth > MIN_HORIZONTAL_DISTANCE) ? 2
      : (6 * hourWidth > MIN_HORIZONTAL_DISTANCE) ? 6 : undefined;
    if (hourStep) {
      let minHour = Math.ceil((new Date(this.scale.minX).getHours() + 1) / hourStep) * hourStep;
      let hour = new Date(this.scale.minX).setHours(minHour, 0, 0, 0);
      for (; hour < this.scale.maxX; hour += hourStep * HOURS_LENGTH) {
        this.drawVerticalLine(ctx, hour, 0);
        this.drawHourLabel(ctx, hour);
      }
    }
  }

  private drawVerticalLine(ctx: CanvasContext, time: number, extraLength: number) {
    ctx.beginPath();
    ctx.moveTo(this.getX(time), this.getY(this.scale.minY));
    ctx.lineTo(this.getX(time), this.getY(this.scale.maxY) - extraLength);
    ctx.stroke();
  }

  private drawDayLabel(ctx: CanvasContext, day: number) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    let dayName = DAY_NAMES[new Date(day).getDay()];
    ctx.fillText(dayName, this.getX(day) + 3, this.getY(this.scale.maxY) + 1);
  }

  private drawHourLabel(ctx: CanvasContext, hour: number) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let hourNumber = new Date(hour).getHours();
    let hourString = (hourNumber < 10) ? '0' + hourNumber + ':00' : hourNumber + ':00';
    ctx.fillText(hourString, this.getX(hour), this.getY(this.scale.minY) + 1);
  }

  private drawTemperatureCurve(ctx: CanvasContext) {
    let points: Point[] = this.dataPoints.map(forecast => ({x: forecast.date.getTime(), y: forecast.temperature}));
    for (let i = 1; i < points.length - 1; i++) {
      points[i].dydx = this.estimateDerivative(points[i - 1], points[i], points[i + 1]);
    }
    let n = points.length - 1;
    points[0].dydx = (points[1].y - points[0].y) / (points[1].x - points[0].x);
    points[n].dydx = (points[n].y - points[n - 1].y) / (points[n].x - points[n - 1].x);
    for (let point of points) {
      this.drawPoint(ctx, point);
    }
    this.drawHermiteInterpolation(ctx, points);
  }

  private estimateDerivative(prev: Point, point: Point, next: Point): number {
    if ((prev.y > point.y && next.y > point.y) || (prev.y < point.y && next.y < point.y)) {
      return 0;
    } else {
      return (next.y - prev.y) / (next.x - prev.x);
    }
  }

  private drawHermiteInterpolation(ctx: CanvasContext, points: Point[]) {
    ctx.strokeStyle = GRAPH_LINE_COLOR;
    ctx.lineWidth = GRAPH_LINE_WIDTH;
    for (let i = 0; i < points.length - 1; i++) {
      ctx.beginPath();
      let [b0, b3] = [points[i], points[i + 1]];
      let h = (b3.x - b0.x) / 3;
      let b1 = { x: b0.x + h, y: b0.y + (h * b0.dydx) };
      let b2 = { x: b3.x - h, y: b3.y - (h * b3.dydx) };
      ctx.moveTo(this.getX(b0.x), this.getY(b0.y));
      ctx.bezierCurveTo(
        this.getX(b1.x), this.getY(b1.y),
        this.getX(b2.x), this.getY(b2.y),
        this.getX(b3.x), this.getY(b3.y)
      );
      ctx.stroke();
    }
  }

  private drawPoint(ctx: CanvasContext, point: Point) {
    ctx.fillStyle = GRAPH_LINE_COLOR;
    ctx.fillRect(this.getX(point.x) - 2, this.getY(point.y) - 2, 4, 4);
  }

  private getX(time: number): number {
    let graphWidth = this.bounds.width - margins.left - margins.right;
    let ratio = (time - this.scale.minX) / (this.scale.maxX - this.scale.minX);
    return margins.left + (graphWidth * ratio);
  }

  private getY(temperature: number): number {
    let graphHeight = this.bounds.height - margins.top - margins.bottom;
    let ratio = (temperature - this.scale.minY) / (this.scale.maxY - this.scale.minY);
    return margins.top + graphHeight * (1 - ratio);
  }
}

interface Point { x: number; y: number; dydx?: number; }
