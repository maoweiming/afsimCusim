import { useRef, useState, useCallback } from 'react';
import * as api from '../../api/client';

export function ScenarioUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      await api.uploadScenario(file);
      setSuccess(true);
      window.dispatchEvent(new Event('truesim:scenarios-updated'));
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  return (
    <div className="scenario-upload">
      <h3 className="panel-title">Upload Scenario</h3>

      <div className="upload-area">
        <input
          ref={fileInputRef}
          type="file"
          accept=".scenario,.zip,.xml"
          onChange={handleUpload}
          disabled={uploading}
          className="file-input"
        />
        <button
          className="btn btn-upload"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? 'Uploading...' : 'Choose File'}
        </button>
      </div>

      {error && <div className="panel-msg error">{error}</div>}
      {success && <div className="panel-msg success">Scenario uploaded successfully.</div>}
    </div>
  );
}
