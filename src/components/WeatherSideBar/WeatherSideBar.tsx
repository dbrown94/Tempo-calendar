import React, { useEffect, useRef, useState } from 'react';
import './WeatherSidebar.css';

const weatherStates = {
  sun: {
    label: 'Sunny',
    color: 'transparent',
    icon: 'wi-day-sunny',
    bgColor: 'linear-gradient(135deg, #FFE57F, #FFEB3B, #FFF8E1)',
  },
  rain: {
    label: 'Rainy',
    color: 'transparent',
    icon: 'wi-rain',
    bgColor: '#D0F0FF',
  },
  snow: {
    label: 'Snowy',
    color: 'transparent',
    icon: 'wi-snow',
    bgColor: '#E0F7FA',
  },
  cloudy: {
    label: 'Cloudy',
    color: 'transparent',
    icon: 'wi-cloudy',
    bgColor: '#ECEFF1',
  },
  thunder: {
    label: 'Stormy',
    color: 'transparent',
    icon: 'wi-lightning',
    bgColor: '#B0BEC5',
  },
};

type WeatherType = keyof typeof weatherStates;

const WeatherSidebar: React.FC = () => {
  const [weatherType, setWeatherType] = useState<WeatherType>('sun');
  const [temp, setTemp] = useState(20);
  const [dateString, setDateString] = useState('');
  const [timeString, setTimeString] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualsRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const tempRef = useRef<HTMLDivElement | null>(null);
  const dateRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const now = new Date();
    const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
    const month = now.toLocaleDateString(undefined, { month: 'long' });
    const day = now.getDate();
    setDateString(`${weekday} ${day} ${month}`);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeString(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;

    let particles: any[] = [];

    if (weatherType === 'rain') {
      for (let i = 0; i < 30; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          length: 10 + Math.random() * 10,
          speed: 2 + Math.random() * 4,
        });
      }
    } else if (weatherType === 'snow') {
      for (let i = 0; i < 20; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 2 + Math.random() * 3,
          speed: 0.5 + Math.random(),
        });
      }
    } else {
      ctx.clearRect(0, 0, width, height);
      return;
    }

    function draw(ctx: CanvasRenderingContext2D) {
      ctx.clearRect(0, 0, width, height);

      if (weatherType === 'rain') {
        ctx.strokeStyle = '#00BFFF';
        ctx.lineWidth = 1.5;
        particles.forEach(p => {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x, p.y + p.length);
          ctx.stroke();
          p.y += p.speed;
          if (p.y > height) p.y = 0;
        });
      }

      if (weatherType === 'snow') {
        ctx.fillStyle = '#FFF';
        particles.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
          ctx.fill();
          p.y += p.speed;
          if (p.y > height) p.y = 0;
        });
      }

      requestAnimationFrame(() => draw(ctx));
    }

    draw(ctx);
  }, [weatherType]);

  const handleWeatherChange = (type: WeatherType) => {
    setWeatherType(type);
    setTemp(Math.floor(Math.random() * 15) + 15); // simulate temp
  };

  const currentState = weatherStates[weatherType];

  return (
    <div className="weather-sidebar" style={{ background: currentState.bgColor, position: 'relative' }}>
      <canvas
        id="weather-effect"
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 0, pointerEvents: 'none' }}
      ></canvas>

      <div
        className="weather-visuals"
        ref={visualsRef}
        style={{ zIndex: 1, fontSize: '3rem', textAlign: 'center', color: currentState.color }}
      >
        <i className={`wi ${currentState.icon}`}></i>
      </div>

      <div
        className="weather-summary"
        ref={summaryRef}
        style={{ zIndex: 1, fontSize: '1.2rem', marginTop: '10px', color: currentState.color }}
      >
        {currentState.label}
      </div>

      <div className="weather-switcher" style={{ marginTop: '1rem', zIndex: 1 }}>
  <div className="weather-meta">
    <div className="weather-temp" ref={tempRef}>
      {temp}°C
    </div>
    <div className="weather-time" ref={timeRef}>
      {timeString}
    </div>
    <div className="weather-date" ref={dateRef}>
      {dateString}
    </div>
  </div>

  <div style={{ marginTop: '1rem' }}>
    {Object.entries(weatherStates).map(([type, state]) => {
      const faIcons: Record<string, string> = {
        sun: 'sun',
        rain: 'cloud-showers-heavy',
        snow: 'snowflake',
        cloudy: 'cloud',
        thunder: 'bolt',
      };

      return (
        <button
          key={type}
          className="weather-btn"
          data-weather={type}
          onClick={() => handleWeatherChange(type as WeatherType)}
          style={{
            marginRight: '0.5rem',
            color: state.color,
          }}
        >
          <i className={`fas fa-${faIcons[type] || 'cloud'}`} style={{ fontSize: '18px' }}></i>
        </button>
      );
    })}
  </div>
</div>
    </div>
  );
}

export default WeatherSidebar;
