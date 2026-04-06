import type { Car } from '../api/client';

interface CarCardProps {
  car: Car;
  onClick: () => void;
}

const statusColors: Record<string, string> = {
  available: 'bg-green-600 text-green-100',
  pending: 'bg-yellow-600 text-yellow-100',
  sold: 'bg-red-700 text-red-100',
};

const conditionColors: Record<string, string> = {
  excellent: 'bg-emerald-800 text-emerald-200',
  good: 'bg-blue-800 text-blue-200',
  fair: 'bg-amber-800 text-amber-200',
  project: 'bg-purple-800 text-purple-200',
};

function formatPrice(price: number): string {
  return '$' + price.toLocaleString();
}

export default function CarCard({ car, onClick }: CarCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-charcoal-700 border border-charcoal-500 rounded-lg overflow-hidden cursor-pointer
                 hover:border-rpm-red/50 hover:shadow-lg hover:shadow-rpm-red/5 transition-all duration-200 group"
    >
      {/* Placeholder image area */}
      <div className="h-44 bg-gradient-to-br from-charcoal-600 to-charcoal-800 flex items-center justify-center relative overflow-hidden">
        <svg className="w-16 h-16 text-charcoal-400 group-hover:text-charcoal-300 transition-colors" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
        <div className="absolute top-2 right-2 flex gap-1.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[car.status] || 'bg-gray-600'}`}>
            {car.status}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        <h3 className="text-white font-semibold text-lg leading-tight mb-1 group-hover:text-rpm-gold-light transition-colors">
          {car.year} {car.make} {car.model}
        </h3>
        {car.trim && <p className="text-charcoal-300 text-sm mb-2">{car.trim}</p>}

        <div className="flex items-center justify-between mt-3">
          <span className="text-rpm-gold-light font-bold text-xl">{formatPrice(car.price)}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${conditionColors[car.condition] || 'bg-gray-700'}`}>
            {car.condition}
          </span>
        </div>

        {car.mileage !== undefined && (
          <p className="text-charcoal-300 text-sm mt-2">
            {car.mileage.toLocaleString()} miles
          </p>
        )}
      </div>
    </div>
  );
}
