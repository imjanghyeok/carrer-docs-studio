export function colorHex(color, fallback = '#202832') {
  if (!color || color === 'rgba(0, 0, 0, 0)') return fallback;
  const rgb = color.match(/\d+/g);
  return rgb?.length >= 3
    ? '#' +
        rgb
          .slice(0, 3)
          .map((x) => Number(x).toString(16).padStart(2, '0'))
          .join('')
    : fallback;
}
