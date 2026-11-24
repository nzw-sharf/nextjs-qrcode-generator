import { useState } from 'react';

const TABS = [
  { type: 'barcode', label: 'Barcode' },
  { type: 'qrcode', label: 'QR Code' },
  { type: 'smallQrcode', label: 'Small QR Code' },
  { type: 'bigQrcode', label: 'Big QR Code' },
];

export default function CodeGenerator() {
  const [sequence, setSequence] = useState('');
  const [codeType, setCodeType] = useState('barcode');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number_sequence: sequence, codeType }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        const data = await res.text();
        alert(data || 'Error generating PDF');
      }
    } catch (err) {
      alert('Network error while generating PDF');
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
      <h1>Code Generator</h1>

      {/* Button Tabs */}
      <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            onClick={() => setCodeType(tab.type)}
            style={{
              padding: '10px 20px',
              cursor: 'pointer',
              backgroundColor: codeType === tab.type ? '#4f46e5' : '#e5e7eb',
              color: codeType === tab.type ? '#fff' : '#000',
              border: 'none',
              borderRadius: '5px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          rows={20}
          cols={50}
          value={sequence}
          onChange={(e) => setSequence(e.target.value)}
          placeholder="Enter numbers or text, one per line"
          required
          style={{ width: '100%', padding: 10, fontSize: 16, borderRadius: 5 }}
        ></textarea>
        <br />
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 20,
            padding: '10px 20px',
            backgroundColor: '#4f46e5',
            color: '#fff',
            border: 'none',
            borderRadius: 5,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Generating...' : 'Generate PDF'}
        </button>
      </form>
    </div>
  );
}