import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale
);

// Default chart options
export const defaultChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom' as const,
      labels: {
        usePointStyle: true,
        padding: 20,
        font: {
          size: 12,
        },
      },
    },
    tooltip: {
      backgroundColor: 'rgba(17, 24, 39, 0.9)',
      titleFont: { size: 13 },
      bodyFont: { size: 12 },
      padding: 12,
      cornerRadius: 8,
    },
  },
};

// Line chart specific options
export const lineChartOptions = {
  ...defaultChartOptions,
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        font: { size: 11 },
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(156, 163, 175, 0.1)',
      },
      ticks: {
        font: { size: 11 },
      },
    },
  },
  elements: {
    line: {
      tension: 0.4,
    },
    point: {
      radius: 3,
      hoverRadius: 6,
    },
  },
};

// Bar chart specific options
export const barChartOptions = {
  ...defaultChartOptions,
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        font: { size: 11 },
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(156, 163, 175, 0.1)',
      },
      ticks: {
        font: { size: 11 },
      },
    },
  },
};

// Doughnut chart specific options
export const doughnutChartOptions = {
  ...defaultChartOptions,
  cutout: '65%',
  plugins: {
    ...defaultChartOptions.plugins,
    legend: {
      ...defaultChartOptions.plugins.legend,
      position: 'right' as const,
    },
  },
};

// Color palettes
export const chartColors = {
  primary: {
    main: 'rgb(59, 130, 246)',
    light: 'rgba(59, 130, 246, 0.1)',
  },
  success: {
    main: 'rgb(34, 197, 94)',
    light: 'rgba(34, 197, 94, 0.1)',
  },
  warning: {
    main: 'rgb(245, 158, 11)',
    light: 'rgba(245, 158, 11, 0.1)',
  },
  danger: {
    main: 'rgb(239, 68, 68)',
    light: 'rgba(239, 68, 68, 0.1)',
  },
  purple: {
    main: 'rgb(139, 92, 246)',
    light: 'rgba(139, 92, 246, 0.1)',
  },
  cyan: {
    main: 'rgb(6, 182, 212)',
    light: 'rgba(6, 182, 212, 0.1)',
  },
  indigo: {
    main: 'rgb(99, 102, 241)',
    light: 'rgba(99, 102, 241, 0.1)',
  },
  pink: {
    main: 'rgb(236, 72, 153)',
    light: 'rgba(236, 72, 153, 0.1)',
  },
};

// Predefined color arrays for charts
export const chartColorPalette = [
  'rgb(59, 130, 246)',   // Blue
  'rgb(34, 197, 94)',    // Green
  'rgb(245, 158, 11)',   // Amber
  'rgb(239, 68, 68)',    // Red
  'rgb(139, 92, 246)',   // Purple
  'rgb(6, 182, 212)',    // Cyan
  'rgb(99, 102, 241)',   // Indigo
  'rgb(236, 72, 153)',   // Pink
];

export const chartColorPaletteLight = [
  'rgba(59, 130, 246, 0.1)',
  'rgba(34, 197, 94, 0.1)',
  'rgba(245, 158, 11, 0.1)',
  'rgba(239, 68, 68, 0.1)',
  'rgba(139, 92, 246, 0.1)',
  'rgba(6, 182, 212, 0.1)',
  'rgba(99, 102, 241, 0.1)',
  'rgba(236, 72, 153, 0.1)',
];
