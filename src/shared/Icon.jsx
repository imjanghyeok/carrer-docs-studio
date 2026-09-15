import React from 'react';

export default function Icon({ name, size = 18 }) {
  const paths = {
    file: 'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    arrow: 'M5 12h14 M14 7l5 5-5 5',
    download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
    plus: 'M12 5v14 M5 12h14',
    undo: 'M9 5L4 10l5 5 M4 10h9a7 7 0 0 1 7 7',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    draw: 'M4 17l12-12 3 3-12 12-4 1z M14 7l3 3',
    check: 'M4 12l5 5L20 6',
    box: 'M4 4h16v16H4z',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.file} />
    </svg>
  );
}
