import React from 'react';

export default function NumberField({ label, value, unit, onChange, ...props }) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          aria-label={label}
          key={label + '-' + value}
          defaultValue={value}
          {...props}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (
              Number.isFinite(n) &&
              n !== value &&
              n >= Number(props.min ?? 0) &&
              n <= Number(props.max ?? 999)
            )
              onChange(n);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur();
          }}
        />
        {unit && <small>{unit}</small>}
      </div>
    </label>
  );
}
