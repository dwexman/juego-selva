import React, {
  useRef,
  useCallback,
  useMemo,
  useEffect,
  forwardRef,
} from "react";
import { Box, Typography, IconButton } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
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

const LevelCard = forwardRef(function LevelCard(
  { bg, title, description, active, onPress, px },
  ref
) {
  const pressProps = usePressProps(onPress);

  return (
    <Box
      ref={ref}
      role="button"
      aria-pressed={!!active}
      tabIndex={0}
      {...pressProps}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onPress?.();
      }}
      sx={{
        width: px(314),
        height: px(176),
        backgroundColor: active ? "#110734" : bg,
        borderRadius: px(30),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: `${px(-12)} ${px(12)} ${px(4)} ${px(4)} #4955A8`,
        padding: `0 ${px(22)}`,
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
        flexShrink: 0,
        boxSizing: "border-box",
        gap: px(10),
      }}
    >
      <Typography
        sx={{
          fontSize: px(36),
          fontWeight: "bold",
          color: "white",
          letterSpacing: "0.02em",
          textAlign: "center",
          lineHeight: 1,
        }}
      >
        {title}
      </Typography>

      <Typography
        sx={{
          fontSize: px(23),
          fontWeight: "bold",
          color: "white",
          textAlign: "center",
          lineHeight: 1.12,
        }}
      >
        {description}
      </Typography>
    </Box>
  );
});

export default function LevelSelection({
  onNext,
  onBack,
  selectedLevel,
  setSelectedLevel,
  title = "¿Qué nivel vas a jugar?",
}) {
  const { isLarge } = useDeviceType();

  const px = useCallback(
    (n) => `${isLarge ? Math.round(n * 1.5) : n}px`,
    [isLarge]
  );

  const [playSelect] = useSound(
    sounds["../assets/sounds/seleccionar.mp3"]?.default || ""
  );

  const [playBack] = useSound(
    sounds["../assets/sounds/back.mp3"]?.default || ""
  );

  const [playNext] = useSound(
    sounds["../assets/sounds/next.mp3"]?.default || ""
  );

  const lastPressRef = useRef({ key: null, ts: 0 });

  const levels = useMemo(
    () => [
      {
        key: 1,
        title: "Nivel 1",
        description: "Recolecta plátanos",
        bg: "#688EDE",
      },
      {
        key: 2,
        title: "Nivel 2",
        description: "Plátanos y obstáculos",
        bg: "#E48912",
      },
      {
        key: 3,
        title: "Nivel 3",
        description: "Esquiva animales",
        bg: "#E36875",
      },
    ],
    []
  );

  const handleSelect = useCallback(
    (level) => {
      const now = Date.now();

      if (
        lastPressRef.current.key === level &&
        now - lastPressRef.current.ts < 300
      ) {
        return;
      }

      lastPressRef.current = { key: level, ts: now };

      setSelectedLevel?.(level);
      playSelect();
    },
    [setSelectedLevel, playSelect]
  );

  const handleBack = useCallback(() => {
    playBack();

    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "quit" }, "*");
      return;
    }

    onBack?.();
  }, [onBack, playBack]);

  const handleNext = useCallback(() => {
    if (!selectedLevel) return;

    playNext();
    onNext?.(selectedLevel);
  }, [selectedLevel, onNext, playNext]);

  const backPressProps = usePressProps(handleBack);
  const nextPressProps = usePressProps(handleNext);

  const cardRefs = useRef([]);
  const backRef = useRef(null);
  const nextRef = useRef(null);

  const areaRef = useRef({ x: 0, y: 0, w: 1280, h: 800 });
  const lastHostRef = useRef({ x: 0, y: 0 });
  const lastPressTsRef = useRef(0);

  const getRootRect = () => {
    const el = document.getElementById("root") || document.body;
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

        for (let i = 0; i < levels.length; i += 1) {
          const rect = cardRefs.current[i]?.getBoundingClientRect();

          if (rect && contains(p, rect)) {
            return handleSelect(levels[i].key);
          }
        }

        const rb = backRef.current?.getBoundingClientRect();
        const rn = nextRef.current?.getBoundingClientRect();

        if (rb && contains(p, rb)) return handleBack();
        if (rn && contains(p, rn)) return handleNext();
      }
    };

    window.addEventListener("message", onMsg, false);

    return () => window.removeEventListener("message", onMsg, false);
  }, [levels, handleSelect, handleBack, handleNext]);

  const isComplete = !!selectedLevel;

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
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: px(30),
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        <Typography
          sx={{
            color: "white",
            fontWeight: "bold",
            fontSize: px(64),
            textAlign: "center",
            userSelect: "none",
            maxWidth: px(1100),
            lineHeight: 1.05,
          }}
        >
          {title}
        </Typography>

        <Typography
          sx={{
            color: "white",
            fontWeight: "bold",
            fontSize: px(28),
            textAlign: "center",
            userSelect: "none",
          }}
        >
          Selecciona 1 nivel
        </Typography>

        <Box
          sx={{
            display: "flex",
            overflowX: "scroll",
            overflowY: "hidden",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
            gap: px(28),
            width: "100%",
            maxWidth: px(1080),
            paddingLeft: px(10),
            paddingRight: px(10),
            paddingBottom: px(10),
            scrollBehavior: "smooth",
            zIndex: 1,
            boxSizing: "border-box",
            justifyContent: "center",
          }}
        >
          {levels.map((level, index) => (
            <LevelCard
              key={level.key}
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              px={px}
              bg={level.bg}
              title={level.title}
              description={level.description}
              active={selectedLevel === level.key}
              onPress={() => handleSelect(level.key)}
            />
          ))}
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            gap: px(78),
            marginTop: px(40),
          }}
        >
          <IconButton
            ref={backRef}
            {...backPressProps}
            onClick={handleBack}
            sx={{
              width: px(108),
              height: px(104),
              backgroundColor: "#FF6B55",
              boxShadow: `${px(-8)} ${px(8)} ${px(8)} #2A3D6B`,
              borderRadius: "50%",
              "&:hover": { backgroundColor: "#FF5733" },
              touchAction: "manipulation",
            }}
          >
            <ArrowBackIcon sx={{ color: "white", fontSize: px(48) }} />
          </IconButton>

          <IconButton
            ref={nextRef}
            {...nextPressProps}
            onClick={handleNext}
            sx={{
              width: px(108),
              height: px(104),
              backgroundColor: isComplete ? "#FF6B55" : "#DADADA",
              boxShadow: `${px(8)} ${px(8)} ${px(8)} #2A3D6B`,
              borderRadius: "50%",
              "&:hover": {
                backgroundColor: isComplete ? "#FF5733" : "#E1E1E1",
              },
              touchAction: "manipulation",
            }}
            disabled={!isComplete}
          >
            <ArrowForwardIcon sx={{ color: "white", fontSize: px(48) }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}