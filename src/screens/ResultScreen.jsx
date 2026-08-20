import React, { useCallback, useMemo, useRef, useEffect } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ReplayIcon from "@mui/icons-material/Replay";
import useSound from "use-sound";
import useDeviceType from "../core/useDeviceType";
import manchas1 from "../assets/images/manchas1.png";

const sounds = import.meta.glob("../assets/sounds/**/*.mp3", {
  eager: true,
});

function usePressProps(onPress) {
  const handler = useCallback(
    (e) => {
      try {
        e.preventDefault();
      } catch {}

      try {
        e.stopPropagation();
      } catch {}

      onPress?.();
    },
    [onPress]
  );

  const supportsPointer =
    typeof window !== "undefined" && "PointerEvent" in window;

  return useMemo(() => {
    if (supportsPointer) {
      return {
        onPointerUp: handler,
        onClick: handler,
      };
    }

    return {
      onTouchEnd: handler,
      onClick: handler,
    };
  }, [supportsPointer, handler]);
}

function ResultCard({ label, value, px }) {
  return (
    <Box
      sx={{
        width: px(310),
        height: px(160),
        backgroundColor: "#FFF8F6",
        borderRadius: px(28),
        border: `${px(3)} solid #4955A8`,
        boxShadow: `${px(-10)} ${px(10)} ${px(4)} ${px(4)} #4955A8`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        px: px(18),
      }}
    >
      <Typography
        sx={{
          color: "#4955A8",
          fontSize: px(26),
          fontWeight: "bold",
          textAlign: "center",
          lineHeight: 1.05,
          mb: px(10),
        }}
      >
        {label}
      </Typography>

      <Typography
        sx={{
          color: "#4955A8",
          fontSize: px(54),
          fontWeight: "bold",
          lineHeight: 1,
          textAlign: "center",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default function ResultScreen({
  result,
  onBack,
  onReplay,
  title = "¡Muy bien!",
}) {
  const { isLarge } = useDeviceType();

  const px = useCallback(
    (n) => `${isLarge ? Math.round(n * 1.5) : n}px`,
    [isLarge]
  );

  const [playBack] = useSound(
    sounds["../assets/sounds/back.mp3"]?.default || ""
  );

  const [playNext] = useSound(
    sounds["../assets/sounds/next.mp3"]?.default || ""
  );

  const handleBack = useCallback(() => {
    playBack();
    onBack?.();
  }, [onBack, playBack]);

  const handleReplay = useCallback(() => {
    playNext();
    onReplay?.();
  }, [onReplay, playNext]);

  const backPressProps = usePressProps(handleBack);
  const replayPressProps = usePressProps(handleReplay);

  const backRef = useRef(null);
  const replayRef = useRef(null);

  const areaRef = useRef({ x: 0, y: 0, w: 1280, h: 800 });
  const lastHostRef = useRef({ x: 0, y: 0 });
  const lastPressTsRef = useRef(0);

  const getRootRect = () => {
    const el =
      document.getElementById("game-viewport") ||
      document.getElementById("root") ||
      document.body;

    return el.getBoundingClientRect();
  };

  const toViewportXY = (hostX, hostY) => {
    const r = getRootRect();
    const a = areaRef.current;

    const nx = Math.min(1, Math.max(0, (hostX - a.x) / (a.w || 1)));
    const ny = Math.min(1, Math.max(0, (hostY - a.y) / (a.h || 1)));

    return {
      x: r.left + nx * r.width,
      y: r.top + ny * r.height,
    };
  };

  const contains = (p, rect) =>
    p.x >= rect.left &&
    p.x <= rect.right &&
    p.y >= rect.top &&
    p.y <= rect.bottom;

  useEffect(() => {
    const onMsg = (ev) => {
      const d = ev?.data;

      if (!d || typeof d !== "object") return;

      if (d.type === "setup") {
        areaRef.current = {
          x: d.offsetX ?? (d.offset && d.offset.left) ?? 0,
          y: d.offsetY ?? (d.offset && d.offset.top) ?? 0,
          w: d.width ?? 1280,
          h: d.height ?? 800,
        };

        return;
      }

      if (
        d.type === "cursor" &&
        typeof d.x === "number" &&
        typeof d.y === "number"
      ) {
        lastHostRef.current = { x: d.x, y: d.y };
        return;
      }

      if (d.type === "press") {
        const now = Date.now();

        if (now - lastPressTsRef.current < 60) return;

        lastPressTsRef.current = now;

        const srcX = typeof d.x === "number" ? d.x : lastHostRef.current.x;
        const srcY = typeof d.y === "number" ? d.y : lastHostRef.current.y;
        const p = toViewportXY(srcX, srcY);

        const backRect = backRef.current?.getBoundingClientRect();
        const replayRect = replayRef.current?.getBoundingClientRect();

        if (backRect && contains(p, backRect)) return handleBack();
        if (replayRect && contains(p, replayRect)) return handleReplay();
      }
    };

    window.addEventListener("message", onMsg, false);

    return () => window.removeEventListener("message", onMsg, false);
  }, [handleBack, handleReplay]);

  const collected = result?.collectedBananas ?? 0;
  const possible = result?.possibleBananas ?? 0;
  const efficiency = result?.efficiency ?? 0;

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        backgroundColor: "#A7ADDF",
        overflow: "hidden",
        padding: px(20),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "none",
        boxSizing: "border-box",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${manchas1})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      <Box
        sx={{
          zIndex: 1,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: px(34),
        }}
      >
        <Typography
          sx={{
            color: "white",
            fontWeight: "bold",
            fontSize: px(68),
            textAlign: "center",
            userSelect: "none",
            lineHeight: 1.05,
          }}
        >
          {title}
        </Typography>

        <Typography
          sx={{
            color: "white",
            fontWeight: "bold",
            fontSize: px(34),
            textAlign: "center",
            userSelect: "none",
            mb: px(10),
          }}
        >
          Estos son tus resultados
        </Typography>

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: px(34),
          }}
        >
          <ResultCard
            px={px}
            label="Plátanos atrapados"
            value={collected}
          />

          <ResultCard
            px={px}
            label="Máximo posible"
            value={possible}
          />

          <ResultCard
            px={px}
            label="Eficiencia"
            value={`${efficiency}%`}
          />
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            gap: px(78),
            marginTop: px(38),
          }}
        >
          <IconButton
            ref={backRef}
            {...backPressProps}
            sx={{
              width: px(108),
              height: px(104),
              backgroundColor: "#FF6B55",
              boxShadow: `${px(-8)} ${px(8)} ${px(8)} #2A3D6B`,
              borderRadius: "50%",
              touchAction: "manipulation",
              "&:hover": { backgroundColor: "#FF5733" },
            }}
          >
            <ArrowBackIcon sx={{ color: "white", fontSize: px(48) }} />
          </IconButton>

          <IconButton
            ref={replayRef}
            {...replayPressProps}
            sx={{
              width: px(108),
              height: px(104),
              backgroundColor: "#FF6B55",
              boxShadow: `${px(8)} ${px(8)} ${px(8)} #2A3D6B`,
              borderRadius: "50%",
              touchAction: "manipulation",
              "&:hover": { backgroundColor: "#FF5733" },
            }}
          >
            <ReplayIcon sx={{ color: "white", fontSize: px(48) }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}