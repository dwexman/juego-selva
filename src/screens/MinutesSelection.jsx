import React, { useRef, useCallback, useMemo, useEffect } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import useSound from "use-sound";
import useDeviceType from "../core/useDeviceType";
import restar from "../assets/images/restar.svg";
import sumar from "../assets/images/sumar.svg";
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

export default function MinutesSelection({
  minutes,
  setMinutes,
  onBack,
  onNext,
  title = "¿Cuántos minutos vas a jugar?",
  unit = "min",
  min = 1,
  max = 10,
}) {
  const { isLarge } = useDeviceType();

  const px = useCallback(
    (n) => `${isLarge ? Math.round(n * 1.5) : n}px`,
    [isLarge]
  );

  const [playSumar] = useSound(
    sounds["../assets/sounds/sumar.mp3"]?.default || ""
  );

  const [playRestar] = useSound(
    sounds["../assets/sounds/restar.mp3"]?.default || ""
  );

  const [playBack] = useSound(
    sounds["../assets/sounds/back.mp3"]?.default || ""
  );

  const [playNext] = useSound(
    sounds["../assets/sounds/next.mp3"]?.default || ""
  );

  const lastPressRef = useRef({
    key: null,
    ts: 0,
  });

  const runOnce = useCallback((key, callback) => {
    const now = Date.now();

    if (
      lastPressRef.current.key === key &&
      now - lastPressRef.current.ts < 180
    ) {
      return;
    }

    lastPressRef.current = {
      key,
      ts: now,
    };

    callback?.();
  }, []);

  const handleDecrease = useCallback(() => {
    runOnce("decrease", () => {
      setMinutes?.((previous) => {
        const safePrevious = Number.isFinite(previous)
          ? previous
          : min;

        const nextValue = Math.max(
          safePrevious - 1,
          min
        );

        if (nextValue !== safePrevious) {
          playRestar();
        }

        return nextValue;
      });
    });
  }, [runOnce, setMinutes, min, playRestar]);

  const handleIncrease = useCallback(() => {
    runOnce("increase", () => {
      setMinutes?.((previous) => {
        const safePrevious = Number.isFinite(previous)
          ? previous
          : min;

        const nextValue = Math.min(
          safePrevious + 1,
          max
        );

        if (nextValue !== safePrevious) {
          playSumar();
        }

        return nextValue;
      });
    });
  }, [runOnce, setMinutes, min, max, playSumar]);

  const handleBack = useCallback(() => {
    runOnce("back", () => {
      playBack();
      onBack?.();
    });
  }, [runOnce, onBack, playBack]);

  const handleNext = useCallback(() => {
    runOnce("next", () => {
      playNext();
      onNext?.(minutes);
    });
  }, [runOnce, onNext, minutes, playNext]);

  const decreasePressProps = usePressProps(handleDecrease);
  const increasePressProps = usePressProps(handleIncrease);
  const backPressProps = usePressProps(handleBack);
  const nextPressProps = usePressProps(handleNext);

  const decreaseRef = useRef(null);
  const increaseRef = useRef(null);
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

  const lastSensorPressTsRef = useRef(0);

  const getRootRect = () => {
    const element =
      document.getElementById("game-viewport") ||
      document.getElementById("root") ||
      document.body;

    return element.getBoundingClientRect();
  };

  const toViewportXY = (hostX, hostY) => {
    const rootRect = getRootRect();
    const area = areaRef.current;

    const normalizedX = Math.min(
      1,
      Math.max(
        0,
        (hostX - area.x) / (area.w || 1)
      )
    );

    const normalizedY = Math.min(
      1,
      Math.max(
        0,
        (hostY - area.y) / (area.h || 1)
      )
    );

    return {
      x: rootRect.left + normalizedX * rootRect.width,
      y: rootRect.top + normalizedY * rootRect.height,
    };
  };

  const contains = (point, rect) =>
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom;

  useEffect(() => {
    const onMessage = (event) => {
      const data = event?.data;

      if (!data || typeof data !== "object") {
        return;
      }

      if (data.type === "setup") {
        areaRef.current = {
          x:
            data.offsetX ??
            (data.offset && data.offset.left) ??
            0,
          y:
            data.offsetY ??
            (data.offset && data.offset.top) ??
            0,
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

      if (data.type === "press") {
        const now = Date.now();

        if (
          now - lastSensorPressTsRef.current <
          60
        ) {
          return;
        }

        lastSensorPressTsRef.current = now;

        const sourceX =
          typeof data.x === "number"
            ? data.x
            : lastHostRef.current.x;

        const sourceY =
          typeof data.y === "number"
            ? data.y
            : lastHostRef.current.y;

        const point = toViewportXY(
          sourceX,
          sourceY
        );

        const decreaseRect =
          decreaseRef.current?.getBoundingClientRect();

        const increaseRect =
          increaseRef.current?.getBoundingClientRect();

        const backRect =
          backRef.current?.getBoundingClientRect();

        const nextRect =
          nextRef.current?.getBoundingClientRect();

        if (
          decreaseRect &&
          contains(point, decreaseRect)
        ) {
          return handleDecrease();
        }

        if (
          increaseRect &&
          contains(point, increaseRect)
        ) {
          return handleIncrease();
        }

        if (
          backRect &&
          contains(point, backRect)
        ) {
          return handleBack();
        }

        if (
          nextRect &&
          contains(point, nextRect)
        ) {
          return handleNext();
        }
      }
    };

    window.addEventListener(
      "message",
      onMessage,
      false
    );

    return () => {
      window.removeEventListener(
        "message",
        onMessage,
        false
      );
    };
  }, [
    handleDecrease,
    handleIncrease,
    handleBack,
    handleNext,
  ]);

  const canDecrease = minutes > min;
  const canIncrease = minutes < max;

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        backgroundColor: "#E1E1E1",
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
          gap: px(40),
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        <Typography
          sx={{
            color: "#4955A8",
            fontWeight: "bold",
            fontSize: px(64),
            textAlign: "center",
            marginBottom: px(35),
            userSelect: "none",
            maxWidth: px(1100),
            lineHeight: 1.05,
          }}
        >
          {title}
        </Typography>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: px(20),
          }}
        >
          <IconButton
            ref={decreaseRef}
            {...decreasePressProps}
            disabled={!canDecrease}
            sx={{
              width: px(159),
              height: px(111),
              backgroundColor: canDecrease
                ? "#4955A8"
                : "#8C91C6",
              borderRadius: px(30),
              border: `${px(3)} solid #585454`,
              boxShadow: `${px(-6)} ${px(6)} ${px(
                4
              )} ${px(4)} #323B79`,
              opacity: canDecrease ? 1 : 0.65,
              touchAction: "manipulation",
              "&:hover": {
                backgroundColor: canDecrease
                  ? "#4955A8"
                  : "#8C91C6",
              },
              "&.Mui-disabled": {
                backgroundColor: "#8C91C6",
              },
            }}
          >
            <img
              src={restar}
              alt="Restar"
              style={{
                width: px(72),
                height: px(72),
                pointerEvents: "none",
              }}
            />
          </IconButton>

          <Box
            sx={{
              width: px(402),
              height: px(111),
              backgroundColor: "#FFF8F6",
              borderRadius: px(20),
              border: `${px(3)} solid #4955A8`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `${px(-12)} ${px(
                12
              )} ${px(4)} ${px(4)} #4955A8`,
              userSelect: "none",
            }}
          >
            <Typography
              sx={{
                fontSize: px(92),
                color: "#4955A8",
                lineHeight: 1,
                fontWeight: "bold",
              }}
            >
              {minutes}
            </Typography>

            <Typography
              sx={{
                fontSize: px(36),
                color: "#4955A8",
                lineHeight: 1,
                fontWeight: "bold",
                marginLeft: px(18),
                marginTop: px(22),
              }}
            >
              {unit}
            </Typography>
          </Box>

          <IconButton
            ref={increaseRef}
            {...increasePressProps}
            disabled={!canIncrease}
            sx={{
              width: px(159),
              height: px(111),
              backgroundColor: canIncrease
                ? "#4955A8"
                : "#8C91C6",
              borderRadius: px(30),
              border: `${px(3)} solid #585454`,
              boxShadow: `${px(-6)} ${px(6)} ${px(
                4
              )} ${px(4)} #323B79`,
              opacity: canIncrease ? 1 : 0.65,
              touchAction: "manipulation",
              "&:hover": {
                backgroundColor: canIncrease
                  ? "#4955A8"
                  : "#8C91C6",
              },
              "&.Mui-disabled": {
                backgroundColor: "#8C91C6",
              },
            }}
          >
            <img
              src={sumar}
              alt="Sumar"
              style={{
                width: px(72),
                height: px(72),
                pointerEvents: "none",
              }}
            />
          </IconButton>
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
            sx={{
              width: px(108),
              height: px(104),
              backgroundColor: "#FF6B55",
              boxShadow: `${px(-8)} ${px(
                8
              )} ${px(8)} #2A3D6B`,
              borderRadius: "50%",
              touchAction: "manipulation",
              "&:hover": {
                backgroundColor: "#FF5733",
              },
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
            sx={{
              width: px(108),
              height: px(104),
              backgroundColor: "#FF6B55",
              boxShadow: `${px(8)} ${px(
                8
              )} ${px(8)} #2A3D6B`,
              borderRadius: "50%",
              touchAction: "manipulation",
              "&:hover": {
                backgroundColor: "#FF5733",
              },
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