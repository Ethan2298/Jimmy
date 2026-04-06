import { useState, useEffect } from 'react';
import { createAppointment, getCars, type Car } from '../api/client';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export default function AppointmentModal({ isOpen, onClose, onCreated }: AppointmentModalProps) {
  const [cars, setCars] = useState<Car[]>([]);
  const [carId, setCarId] = useState<string>('');
  const [type, setType] = useState<'call' | 'visit' | 'video'>('visit');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      getCars().then(setCars).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createAppointment({
        car_id: carId ? Number(carId) : undefined,
        type,
        date,
        time,
        notes: notes || undefined,
      });
      onCreated?.();
      onClose();
    } catch {
      setError('Failed to create appointment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-charcoal-800 border border-charcoal-500 rounded-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-white mb-5">Book Appointment</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-charcoal-300 mb-1">Car (optional)</label>
            <select
              value={carId}
              onChange={(e) => setCarId(e.target.value)}
              className="w-full bg-charcoal-700 border border-charcoal-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rpm-red"
            >
              <option value="">Select a car...</option>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.year} {c.make} {c.model}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-charcoal-300 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'call' | 'visit' | 'video')}
              className="w-full bg-charcoal-700 border border-charcoal-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rpm-red"
            >
              <option value="visit">In-Person Visit</option>
              <option value="call">Phone Call</option>
              <option value="video">Video Call</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-charcoal-300 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-charcoal-700 border border-charcoal-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rpm-red"
              />
            </div>
            <div>
              <label className="block text-sm text-charcoal-300 mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full bg-charcoal-700 border border-charcoal-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rpm-red"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-charcoal-300 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-charcoal-700 border border-charcoal-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rpm-red resize-none"
              placeholder="Any special requests..."
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-charcoal-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-rpm-red hover:bg-rpm-red-dark text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? 'Booking...' : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
