import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);
ChartJS.defaults.font.family = "'Instrument Sans', system-ui, sans-serif";
ChartJS.defaults.font.size = 11.5;
ChartJS.defaults.color = 'rgba(120,120,120,.9)';
ChartJS.defaults.plugins.legend.labels.boxWidth = 10;
ChartJS.defaults.maintainAspectRatio = false;

export const moneyAxis = {
    ticks: {
        callback: (v: any) => (Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString('id-ID') + ' jt' : Math.abs(v) >= 1e3 ? (v / 1e3).toLocaleString('id-ID') + ' rb' : v),
    },
    grid: { color: 'rgba(128,128,128,.12)' },
};
export const moneyTooltip = {
    callbacks: { label: (c: any) => `${c.dataset.label}: Rp ${Math.round(c.parsed.y ?? c.parsed).toLocaleString('id-ID')}` },
};

export { Bar, Doughnut, Line };
