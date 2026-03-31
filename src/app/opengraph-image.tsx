import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} - ${SITE_TAGLINE}`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

function NetworkGlyph() {
  return (
    <svg width="144" height="144" viewBox="0 0 24 24" fill="none">
      <rect
        x="16"
        y="16"
        width="6"
        height="6"
        rx="1.2"
        stroke="white"
        strokeWidth="2"
      />
      <rect
        x="2"
        y="16"
        width="6"
        height="6"
        rx="1.2"
        stroke="white"
        strokeWidth="2"
      />
      <rect
        x="9"
        y="2"
        width="6"
        height="6"
        rx="1.2"
        stroke="white"
        strokeWidth="2"
      />
      <path
        d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 12V8"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background:
          "linear-gradient(135deg, #0d1117 0%, #11161d 54%, #0f1b16 100%)",
        color: "#f0f6fc",
        padding: "52px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          border: "1px solid rgba(240,246,252,0.12)",
          borderRadius: "36px",
          padding: "44px",
          background: "rgba(13, 17, 23, 0.62)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "96px",
              height: "96px",
              borderRadius: "28px",
              background: "#238636",
              border: "1px solid #2f6f3e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <NetworkGlyph />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: "28px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#7d8590",
              }}
            >
              Flow Merge
            </div>
            <div
              style={{
                fontSize: "76px",
                fontWeight: 700,
                lineHeight: 1.02,
                maxWidth: "820px",
              }}
            >
              {SITE_TAGLINE}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "40px",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              maxWidth: "760px",
            }}
          >
            <div
              style={{ fontSize: "30px", color: "#c9d1d9", lineHeight: 1.35 }}
            >
              Capture qualquer dado, transforme em workflow e entenda impacto
              real no negocio sem trocar de ferramenta.
            </div>
            <div
              style={{
                display: "flex",
                gap: "12px",
                color: "#9fb3c8",
                fontSize: "22px",
              }}
            >
              <span>automation + analytics</span>
              <span>•</span>
              <span>local-first</span>
              <span>•</span>
              <span>desktop + web</span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              alignItems: "flex-end",
            }}
          >
            <div style={{ fontSize: "22px", color: "#7ee787" }}>
              Brasil-first
            </div>
            <div style={{ fontSize: "22px", color: "#9fb3c8" }}>
              indie hackers • micro-SaaS
            </div>
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
