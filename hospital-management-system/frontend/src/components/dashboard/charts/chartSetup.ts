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

// Default chart options - Modern light theme
export const defaultChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom' as const,
      labels: {
        usePointStyle: true,
        padding: 16,
        font: {
          size: 13,
          family: "'Inter', 'Segoe UI', sans-serif",
        },
        color: '#374151',
      },
    },
    tooltip: {
      backgroundColor: '#ffffff',
      titleColor: '#111827',
      bodyColor: '#374151',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      titleFont: { size: 13, weight: 'bold' as const },
      bodyFont: { size: 12 },
      padding: 12,
      cornerRadius: 8,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
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

// Bar chart specific options - Modern light theme with dotted grid
export const barChartOptions = {
  ...defaultChartOptions,
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        font: { size: 12, family: "'Inter', 'Segoe UI', sans-serif" },
        color: '#6b7280',
      },
      border: {
        display: false,
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: '#e5e7eb',
        lineWidth: 1,
        drawBorder: false,
      },
      ticks: {
        font: { size: 11, family: "'Inter', 'Segoe UI', sans-serif" },
        color: '#9ca3af',
        padding: 8,
      },
      border: {
        display: false,
        dash: [4, 4],
      },
    },
  },
  plugins: {
    ...defaultChartOptions.plugins,
    legend: {
      display: false,
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

// Pie chart options - Modern design with labels outside
export const pieChartOptions = {
  ...defaultChartOptions,
  plugins: {
    ...defaultChartOptions.plugins,
    legend: {
      display: false,
    },
  },
};

// Modern department colors matching screenshot
export const departmentColors = {
  neurology: '#22c55e',    // Green
  cardiology: '#3b82f6',   // Blue
  orthopedics: '#f59e0b',  // Orange
  pediatrics: '#a855f7',   // Purple
  general: '#ec4899',      // Pink
};

// Weekly activity colors
export const weeklyActivityColors = {
  appointments: '#3b82f6', // Blue
  completed: '#22c55e',    // Green
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
