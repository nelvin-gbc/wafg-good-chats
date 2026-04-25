// hand-drawn asterisk used as ornament throughout the brand.
// we use a text-based asterisk in Archivo Black for simplicity.
export default function Asterisk({ size = 24, color = '#01ecf3', rotate = 0, className = '', style = {} }) {
  return (
    <span
      className={`inline-block leading-none ${className}`}
      style={{
        fontFamily: 'var(--font-display), "Archivo Black", sans-serif',
        fontSize: size,
        color,
        transform: `rotate(${rotate}deg)`,
        userSelect: 'none',
        ...style,
      }}
      aria-hidden="true"
    >
      *
    </span>
  );
}
