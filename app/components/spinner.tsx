export function Spinner({
  size,
}: {
  size: NonNullable<React.CSSProperties["width"]>;
}) {
  return (
    <div className="spinner" style={{ width: size, height: size }}>
      <style>{`
        .spinner {
          border: 2px solid #ddd;
          border-radius: 50%;
          border-top-color: #666;
          border-left-color: #666;
          animation: keyframes-spinner 1s linear infinite;
        }
        @keyframes keyframes-spinner {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
