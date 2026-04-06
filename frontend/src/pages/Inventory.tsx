import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCars, createCar, type Car, type CarFilters } from '../api/client';
import CarCard from '../components/CarCard';

const MAKES = ['', 'Chevrolet', 'Ford', 'Dodge', 'Pontiac', 'Plymouth', 'Cadillac', 'Buick', 'Lincoln', 'Oldsmobile', 'AMC', 'Shelby', 'Ferrari', 'Porsche', 'Jaguar', 'Mercedes-Benz', 'BMW'];
const STATUSES = ['', 'available', 'pending', 'sold'];
const CONDITIONS = ['', 'excellent', 'good', 'fair', 'project'];

export default function Inventory() {
  const navigate = useNavigate();
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Filters
  const [filterMake, setFilterMake] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterYearMin, setFilterYearMin] = useState('');
  const [filterYearMax, setFilterYearMax] = useState('');
  const [filterPriceMin, setFilterPriceMin] = useState('');
  const [filterPriceMax, setFilterPriceMax] = useState('');

  // New car form
  const [newCar, setNewCar] = useState({
    year: '', make: '', model: '', trim: '', price: '', mileage: '',
    status: 'available' as Car['status'], condition: 'good' as Car['condition'],
    description: '',
  });

  const fetchCars = () => {
    setLoading(true);
    const filters: CarFilters = {};
    if (filterMake) filters.make = filterMake;
    if (filterStatus) filters.status = filterStatus;
    if (filterCondition) filters.condition = filterCondition;
    if (filterYearMin) filters.year_min = Number(filterYearMin);
    if (filterYearMax) filters.year_max = Number(filterYearMax);
    if (filterPriceMin) filters.price_min = Number(filterPriceMin);
    if (filterPriceMax) filters.price_max = Number(filterPriceMax);

    getCars(filters)
      .then(setCars)
      .catch(() => setError('Failed to load inventory'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMake, filterStatus, filterCondition]);

  const handleSearch = () => {
    fetchCars();
  };

  const handleAddCar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCar({
        year: Number(newCar.year),
        make: newCar.make,
        model: newCar.model,
        trim: newCar.trim || undefined,
        price: Number(newCar.price),
        mileage: newCar.mileage ? Number(newCar.mileage) : undefined,
        status: newCar.status,
        condition: newCar.condition,
        description: newCar.description || undefined,
      });
      setShowAddForm(false);
      setNewCar({ year: '', make: '', model: '', trim: '', price: '', mileage: '', status: 'available', condition: 'good', description: '' });
      fetchCars();
    } catch {
      setError('Failed to add car');
    }
  };

  const inputClass = 'bg-charcoal-700 border border-charcoal-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rpm-red';
  const selectClass = inputClass;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Inventory</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-rpm-red hover:bg-rpm-red-dark text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add Car'}
        </button>
      </div>

      {/* Add Car Form */}
      {showAddForm && (
        <form onSubmit={handleAddCar} className="bg-charcoal-700 border border-charcoal-500 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Add New Vehicle</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <input type="number" placeholder="Year" required value={newCar.year} onChange={(e) => setNewCar({ ...newCar, year: e.target.value })} className={inputClass} />
            <input type="text" placeholder="Make" required value={newCar.make} onChange={(e) => setNewCar({ ...newCar, make: e.target.value })} className={inputClass} />
            <input type="text" placeholder="Model" required value={newCar.model} onChange={(e) => setNewCar({ ...newCar, model: e.target.value })} className={inputClass} />
            <input type="text" placeholder="Trim" value={newCar.trim} onChange={(e) => setNewCar({ ...newCar, trim: e.target.value })} className={inputClass} />
            <input type="number" placeholder="Price" required value={newCar.price} onChange={(e) => setNewCar({ ...newCar, price: e.target.value })} className={inputClass} />
            <input type="number" placeholder="Mileage" value={newCar.mileage} onChange={(e) => setNewCar({ ...newCar, mileage: e.target.value })} className={inputClass} />
            <select value={newCar.status} onChange={(e) => setNewCar({ ...newCar, status: e.target.value as Car['status'] })} className={selectClass}>
              <option value="available">Available</option>
              <option value="pending">Pending</option>
              <option value="sold">Sold</option>
            </select>
            <select value={newCar.condition} onChange={(e) => setNewCar({ ...newCar, condition: e.target.value as Car['condition'] })} className={selectClass}>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="project">Project</option>
            </select>
          </div>
          <textarea placeholder="Description" value={newCar.description} onChange={(e) => setNewCar({ ...newCar, description: e.target.value })} className={`${inputClass} w-full mb-4 resize-none`} rows={2} />
          <button type="submit" className="px-5 py-2 bg-rpm-red hover:bg-rpm-red-dark text-white text-sm font-semibold rounded-lg transition-colors">
            Save Vehicle
          </button>
        </form>
      )}

      {/* Filter Bar */}
      <div className="bg-charcoal-700 border border-charcoal-500 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-charcoal-300 mb-1">Make</label>
            <select value={filterMake} onChange={(e) => setFilterMake(e.target.value)} className={selectClass}>
              {MAKES.map((m) => <option key={m} value={m}>{m || 'All Makes'}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-charcoal-300 mb-1">Year Min</label>
            <input type="number" placeholder="1950" value={filterYearMin} onChange={(e) => setFilterYearMin(e.target.value)} className={`${inputClass} w-24`} />
          </div>
          <div>
            <label className="block text-xs text-charcoal-300 mb-1">Year Max</label>
            <input type="number" placeholder="2024" value={filterYearMax} onChange={(e) => setFilterYearMax(e.target.value)} className={`${inputClass} w-24`} />
          </div>
          <div>
            <label className="block text-xs text-charcoal-300 mb-1">Price Min</label>
            <input type="number" placeholder="$0" value={filterPriceMin} onChange={(e) => setFilterPriceMin(e.target.value)} className={`${inputClass} w-28`} />
          </div>
          <div>
            <label className="block text-xs text-charcoal-300 mb-1">Price Max</label>
            <input type="number" placeholder="$999,999" value={filterPriceMax} onChange={(e) => setFilterPriceMax(e.target.value)} className={`${inputClass} w-28`} />
          </div>
          <div>
            <label className="block text-xs text-charcoal-300 mb-1">Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass}>
              {STATUSES.map((s) => <option key={s} value={s}>{s || 'All'}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-charcoal-300 mb-1">Condition</label>
            <select value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)} className={selectClass}>
              {CONDITIONS.map((c) => <option key={c} value={c}>{c || 'All'}</option>)}
            </select>
          </div>
          <button onClick={handleSearch} className="px-4 py-2 bg-charcoal-500 hover:bg-charcoal-400 text-white text-sm rounded-lg transition-colors">
            Search
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {/* Cars Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-charcoal-400">Loading inventory...</p>
        </div>
      ) : cars.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-charcoal-400">No vehicles found. Try adjusting your filters or add a new car.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cars.map((car) => (
            <CarCard key={car.id} car={car} onClick={() => navigate(`/inventory/${car.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
