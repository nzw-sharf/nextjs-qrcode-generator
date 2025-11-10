import { useState } from 'react';

export default function CodeGenerator() {
  const [sequence, setSequence] = useState('');
  const [codeType, setCodeType] = useState('barcode');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

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

    setLoading(false);
  };

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
      <h1>Code Generator</h1>

      {/* Button Tabs */}
      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setCodeType('barcode')}
          style={{
            padding: '10px 20px',
            marginRight: 10,
            cursor: 'pointer',
            backgroundColor: codeType === 'barcode' ? '#4f46e5' : '#e5e7eb',
            color: codeType === 'barcode' ? '#fff' : '#000',
            border: 'none',
            borderRadius: '5px',
          }}
        >
          Barcode
        </button>
        <button
          type="button"
          onClick={() => setCodeType('qrcode')}
          style={{
            padding: '10px 20px',
            cursor: 'pointer',
            backgroundColor: codeType === 'qrcode' ? '#4f46e5' : '#e5e7eb',
            color: codeType === 'qrcode' ? '#fff' : '#000',
            border: 'none',
            borderRadius: '5px',
          }}
        >
          QR Code
        </button>
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
