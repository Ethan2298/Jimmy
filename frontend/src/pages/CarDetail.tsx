import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCar, updateCar, type Car } from '../api/client';

export default function CarDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [car, setCar] = useState<Car | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Car>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getCar(Number(id))
      .then((c) => {
        setCar(c);
        setForm(c);
      })
      .catch(() => setError('Failed to load car'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateCar(Number(id), form);
      setCar(updated);
      setEditing(false);
    } catch {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'bg-charcoal-700 border border-charcoal-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rpm-red w-full';

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-charcoal-400">Loading...</p></div>;
  }

  if (!car) {
    return <div className="flex items-center justify-center h-64"><p className="text-red-400">{error || 'Car not found'}</p></div>;
  }

  const Field = ({ label, field, type = 'text' }: { label: string; field: keyof Car; type?: string }) => (
    <div>
      <label className="block text-xs text-charcoal-300 mb-1">{label}</label>
      {editing ? (
        <input
          type={type}
          value={form[field] as string | number ?? ''}
          onChange={(e) => setForm({ ...form, [field]: type === 'number' ? Number(e.target.value) : e.target.value })}
          className={inputClass}
        />
      ) : (
        <p className="text-white text-sm py-2">
          {field === 'price' ? `$${(car[field] as number)?.toLocaleString()}` :
           field === 'mileage' ? `${(car[field] as number)?.toLocaleString()} miles` :
           String(car[field] ?? 'N/A')}
        </p>
      )}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/inventory')} className="text-charcoal-300 hover:text-white transition-colors text-sm">
            &larr; Back to Inventory
          </button>
          <h1 className="text-3xl font-bold text-white">
            {car.year} {car.make} {car.model}
            {car.trim && <span className="text-charcoal-300 font-normal ml-2">{car.trim}</span>}
          </h1>
        </div>
        <div className="flex gap-3">
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setForm(car); }} className="px-4 py-2 text-sm text-charcoal-300 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-rpm-red hover:bg-rpm-red-dark text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="px-4 py-2 bg-charcoal-600 hover:bg-charcoal-500 text-white text-sm rounded-lg transition-colors border border-charcoal-400">
              Edit
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image placeholder */}
          <div className="bg-charcoal-700 border border-charcoal-500 rounded-xl h-64 flex items-center justify-center">
            <div className="text-center text-charcoal-400">
              <svg className="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
              </svg>
              <p className="text-sm">Photo placeholder</p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="bg-charcoal-700 border border-charcoal-500 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Vehicle Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Year" field="year" type="number" />
              <Field label="Make" field="make" />
              <Field label="Model" field="model" />
              <Field label="Trim" field="trim" />
              <Field label="Price" field="price" type="number" />
              <Field label="Mileage" field="mileage" type="number" />
              <Field label="Exterior Color" field="exterior_color" />
              <Field label="Interior Color" field="interior_color" />
              <Field label="Engine" field="engine" />
              <Field label="Transmission" field="transmission" />
              <Field label="VIN" field="vin" />
              <div>
                <label className="block text-xs text-charcoal-300 mb-1">Status</label>
                {editing ? (
                  <select
                    value={form.status || ''}
                    onChange={(e) => setForm({ ...form, status: e.target.value as Car['status'] })}
                    className={inputClass}
                  >
                    <option value="available">Available</option>
                    <option value="pending">Pending</option>
                    <option value="sold">Sold</option>
                  </select>
                ) : (
                  <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${
                    car.status === 'available' ? 'bg-green-600 text-green-100' :
                    car.status === 'pending' ? 'bg-yellow-600 text-yellow-100' :
                    'bg-red-700 text-red-100'
                  }`}>{car.status}</span>
                )}
              </div>
              <div>
                <label className="block text-xs text-charcoal-300 mb-1">Condition</label>
                {editing ? (
                  <select
                    value={form.condition || ''}
                    onChange={(e) => setForm({ ...form, condition: e.target.value as Car['condition'] })}
                    className={inputClass}
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="project">Project</option>
                  </select>
                ) : (
                  <p className="text-white text-sm py-2 capitalize">{car.condition}</p>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-charcoal-700 border border-charcoal-500 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-3">Description</h2>
            {editing ? (
              <textarea
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={`${inputClass} resize-none`}
                rows={4}
              />
            ) : (
              <p className="text-charcoal-300 text-sm leading-relaxed">{car.description || 'No description available.'}</p>
            )}
          </div>

          {/* Highlights */}
          {car.highlights && car.highlights.length > 0 && (
            <div className="bg-charcoal-700 border border-charcoal-500 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-white mb-3">Highlights</h2>
              <ul className="space-y-2">
                {car.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-rpm-gold mt-0.5">&#9733;</span>
                    <span className="text-charcoal-300">{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Price Card */}
          <div className="bg-charcoal-700 border border-charcoal-500 rounded-xl p-5 text-center">
            <p className="text-charcoal-300 text-sm mb-1">Asking Price</p>
            <p className="text-3xl font-bold text-rpm-gold-light">${car.price.toLocaleString()}</p>
            <div className="mt-3 flex justify-center gap-2">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                car.status === 'available' ? 'bg-green-600 text-green-100' :
                car.status === 'pending' ? 'bg-yellow-600 text-yellow-100' :
                'bg-red-700 text-red-100'
              }`}>{car.status}</span>
            </div>
          </div>

          {/* Quick Info */}
          <div className="bg-charcoal-700 border border-charcoal-500 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Quick Info</h3>
            <div className="space-y-2 text-sm">
              {car.mileage !== undefined && (
                <div className="flex justify-between">
                  <span className="text-charcoal-300">Mileage</span>
                  <span className="text-white">{car.mileage.toLocaleString()} mi</span>
                </div>
              )}
              {car.engine && (
                <div className="flex justify-between">
                  <span className="text-charcoal-300">Engine</span>
                  <span className="text-white">{car.engine}</span>
                </div>
              )}
              {car.transmission && (
                <div className="flex justify-between">
                  <span className="text-charcoal-300">Trans</span>
                  <span className="text-white">{car.transmission}</span>
                </div>
              )}
              {car.exterior_color && (
                <div className="flex justify-between">
                  <span className="text-charcoal-300">Ext. Color</span>
                  <span className="text-white">{car.exterior_color}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
