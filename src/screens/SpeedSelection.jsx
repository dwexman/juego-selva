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
  const lastPressRef = useRef(0);

  const handler = useCallback(
    (event) => {
      const now = Date.now();

      // Evita que PointerUp y Click ejecuten dos veces la acción.
      if (now - lastPressRef.current < 150) {
        return;
      }

      lastPressRef.current = now;

      try {
        event.preventDefault();
      } catch {}

      try {
        event.stopPropagation();
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

const SpeedCard = forwardRef(function SpeedCard(
  { bg, title, description, active, onPress, px },
  ref
) {
  const pressProps = usePressProps(onPress);

  return (
    <Box
      ref={ref}
      role="button"
      aria-pressed={Boolean(active)}
      tabIndex={0}
      {...pressProps}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPress?.();
        }
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
        transition:
          "background-color 180ms ease, transform 180ms ease, box-shadow 180ms ease",
        transform: active ? `translateY(${px(-6)})` : "translateY(0)",
      }}
    >
      <Typography
        sx={{
          fontSize: px(48),
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

export default function SpeedSelection({
  speed,
  setSpeed,
  onBack,
  onNext,
  title = "¿A qué velocidad avanzará la pantalla?",
}) {
  const { isLarge } = useDeviceType();

  const px = useCallback(
    (number) => `${isLarge ? Math.round(number * 1.5) : number}px`,
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

  const options = useMemo(
    () => [
      {
        key: 1,
        title: "x1",
        description: "Velocidad suave",
        bg: "#688EDE",
      },
      {
        key: 2,
        title: "x2",
        description: "Velocidad media",
        bg: "#E48912",
      },
      {
        key: 3,
        title: "x3",
        description: "Velocidad rápida",
        bg: "#E36875",
      },
    ],
    []
  );

  const lastSelectionRef = useRef({
    key: null,
    timestamp: 0,
  });

  const handleSelect = useCallback(
    (selectedSpeed) => {
      const now = Date.now();

      if (
        lastSelectionRef.current.key === selectedSpeed &&
        now - lastSelectionRef.current.timestamp < 300
      ) {
        return;
      }

      lastSelectionRef.current = {
        key: selectedSpeed,
        timestamp: now,
      };

      setSpeed?.(selectedSpeed);
      playSelect();
    },
    [setSpeed, playSelect]
  );

  const handleBack = useCallback(() => {
    playBack();
    onBack?.();
  }, [onBack, playBack]);

  const handleNext = useCallback(() => {
    if (!speed) {
      return;
    }

    playNext();
    onNext?.(speed);
  }, [speed, onNext, playNext]);

  const backPressProps = usePressProps(handleBack);
  const nextPressProps = usePressProps(handleNext);

  const cardRefs = useRef([]);
  const backRef = useRef(null);
  const nextRef = useRef(null);

  const areaRef = useRef({
    x: 0,
    y: 0,
    w: 1280,
    h: 800,
  });

  const lastHostRef = useRef({
    x: 0,
    y: 0,
  });

  const lastSensorPressRef = useRef(0);

  const getRootRect = useCallback(() => {
    const element = document.getElementById("root") || document.body;
    return element.getBoundingClientRect();
  }, []);

  const toViewportXY = useCallback(
    (hostX, hostY) => {
      const rootRect = getRootRect();
      const area = areaRef.current;

      const normalizedX = Math.min(
        1,
        Math.max(0, (hostX - area.x) / (area.w || 1))
      );

      const normalizedY = Math.min(
        1,
        Math.max(0, (hostY - area.y) / (area.h || 1))
      );

      return {
        x: rootRect.left + normalizedX * rootRect.width,
        y: rootRect.top + normalizedY * rootRect.height,
      };
    },
    [getRootRect]
  );

  const contains = useCallback(
    (point, rectangle) =>
      point.x >= rectangle.left &&
      point.x <= rectangle.right &&
      point.y >= rectangle.top &&
      point.y <= rectangle.bottom,
    []
  );

  useEffect(() => {
    const handleMessage = (event) => {
      const data = event?.data;

      if (!data || typeof data !== "object") {
        return;
      }

      if (data.type === "setup") {
        areaRef.current = {
          x: data.offsetX ?? data.offset?.left ?? 0,
          y: data.offsetY ?? data.offset?.top ?? 0,
          w: data.width ?? 1280,
          h: data.height ?? 800,
        };

        return;
      }

      if (
        data.type === "cursor" &&
        typeof data.x === "number" &&
        typeof data.y === "number"
      ) {
        lastHostRef.current = {
          x: data.x,
          y: data.y,
        };

        return;
      }

      if (data.type !== "press") {
        return;
      }

      const now = Date.now();

      if (now - lastSensorPressRef.current < 100) {
        return;
      }

      lastSensorPressRef.current = now;

      const sourceX =
        typeof data.x === "number" ? data.x : lastHostRef.current.x;

      const sourceY =
        typeof data.y === "number" ? data.y : lastHostRef.current.y;

      const point = toViewportXY(sourceX, sourceY);

      for (let index = 0; index < options.length; index += 1) {
        const rectangle =
          cardRefs.current[index]?.getBoundingClientRect();

        if (rectangle && contains(point, rectangle)) {
          handleSelect(options[index].key);
          return;
        }
      }

      const backRectangle =
        backRef.current?.getBoundingClientRect();

      const nextRectangle =
        nextRef.current?.getBoundingClientRect();

      if (backRectangle && contains(point, backRectangle)) {
        handleBack();
        return;
      }

      if (nextRectangle && contains(point, nextRectangle)) {
        handleNext();
      }
    };

    window.addEventListener("message", handleMessage, false);

    return () => {
      window.removeEventListener("message", handleMessage, false);
    };
  }, [
    options,
    contains,
    toViewportXY,
    handleSelect,
    handleBack,
    handleNext,
  ]);

  const isComplete = Boolean(speed);

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
          position: "relative",
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
            fontSize: px(58),
            textAlign: "center",
            userSelect: "none",
            maxWidth: px(1150),
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
          Selecciona 1 velocidad
        </Typography>

        <Box
          sx={{
            display: "flex",
            overflowX: "auto",
            overflowY: "hidden",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": {
              display: "none",
            },
            gap: px(28),
            width: "100%",
            maxWidth: px(1080),
            paddingLeft: px(10),
            paddingRight: px(10),
            paddingBottom: px(18),
            paddingTop: px(8),
            scrollBehavior: "smooth",
            zIndex: 1,
            boxSizing: "border-box",
            justifyContent: "center",
          }}
        >
          {options.map((option, index) => (
            <SpeedCard
              key={option.key}
              ref={(element) => {
                cardRefs.current[index] = element;
              }}
              px={px}
              bg={option.bg}
              title={option.title}
              description={option.description}
              active={speed === option.key}
              onPress={() => handleSelect(option.key)}
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
            aria-label="Volver"
            sx={{
              width: px(108),
              height: px(104),
              backgroundColor: "#FF6B55",
              boxShadow: `${px(-8)} ${px(8)} ${px(8)} #2A3D6B`,
              borderRadius: "50%",
              "&:hover": {
                backgroundColor: "#FF5733",
              },
              touchAction: "manipulation",
            }}
          >
            <ArrowBackIcon
              sx={{
                color: "white",
                fontSize: px(48),
              }}
            />
          </IconButton>

          <IconButton
            ref={nextRef}
            {...nextPressProps}
            aria-label="Continuar"
            disabled={!isComplete}
            sx={{
              width: px(108),
              height: px(104),
              backgroundColor: isComplete ? "#FF6B55" : "#DADADA",
              boxShadow: `${px(8)} ${px(8)} ${px(8)} #2A3D6B`,
              borderRadius: "50%",
              "&:hover": {
                backgroundColor: isComplete ? "#FF5733" : "#DADADA",
              },
              "&.Mui-disabled": {
                backgroundColor: "#DADADA",
              },
              touchAction: "manipulation",
            }}
          >
            <ArrowForwardIcon
              sx={{
                color: "white",
                fontSize: px(48),
              }}
            />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}