interface Props {
  size?: number;
  color?: string;
  className?: string;
}

export function LogoSpinner({ size = 32, color = "#E84B2B", className = "" }: Props) {
  const arm = "63,65 63,55 79,55 95,42 95,50 75,60 95,70 95,78 79,65";
  const rotations = [0, 60, 120, 180, 240, 300];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`animate-spin ${className}`}
      aria-hidden="true"
      style={{ animationDuration: "1.2s" }}
    >
      <g fill={color}>
        {rotations.map((deg) => (
          <polygon key={deg} transform={`rotate(${deg}, 60, 60)`} points={arm} />
        ))}
      </g>
    </svg>
  );
}
