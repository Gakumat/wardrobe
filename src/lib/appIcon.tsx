import { ImageResponse } from "next/og";

/** The app icon: a cream hanger on deep green. Rendered at any size. */
export function appIcon(size: number, { padded = false }: { padded?: boolean } = {}) {
  const glyph = Math.round(size * (padded ? 0.5 : 0.62));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2f4a3a",
        }}
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 -2.5 24 24"
          fill="none"
          stroke="#f5f2ec"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 7a2 2 0 1 1 2-2M12 7v2L3 16h18l-9-7" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
