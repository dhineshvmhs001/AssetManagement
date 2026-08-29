import './Skeleton.css';

export default function Skeleton({ width = '100%', height = 12, radius, style }) {
  return (
    <span
      className="ds-skel"
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}
