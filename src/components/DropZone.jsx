import React, { useRef, useState } from 'react';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export default function DropZone({ onFiles }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function pick(fileList) {
    const files = [...fileList].filter(
      (f) => ACCEPTED_TYPES.includes(f.type) || f.name.toLowerCase().endsWith('.pdf')
    );
    if (files.length) onFiles(files);
  }

  return (
    <div
      className={'dropzone' + (dragging ? ' dragging' : '')}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files);
      }}
    >
      <div className="dropzone-icon" aria-hidden="true">
        📥
      </div>
      <div className="dropzone-title">Trascina qui i tuoi PDF</div>
      <div className="dropzone-hint">
        oppure tocca per sceglierli · vanno bene anche le foto delle ricevute
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
