import { useState } from 'react';

export default function Home() {
  const [sequence, setSequence] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/generate-qrcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number_sequence: sequence })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Server returned an error');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qr_codes.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h1>Number Sequence QR Generator</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="number_sequence">Enter numbers (one per line)</label>
        <br />
        <textarea
          id="number_sequence"
          name="number_sequence"
          rows={20}
          cols={80}
          value={sequence}
          onChange={(e) => setSequence(e.target.value)}
          required
          style={{ fontFamily: 'monospace', marginTop: 8 }}
        />
        <br />
        <button type="submit" disabled={loading} style={{ marginTop: 12 }}>
          {loading ? 'Generating...' : 'Generate QR Code PDF'}
        </button>
      </form>

      {error && (
        <p style={{ color: 'red', marginTop: 12 }}>{error}</p>
      )}

      <p style={{ marginTop: 12, color: '#666' }}>
        Tip: paste numbers separated by newlines. Blank lines are ignored.
      </p>
    </main>
  );
}
