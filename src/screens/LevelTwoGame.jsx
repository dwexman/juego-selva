import { Box, Typography, IconButton, Button } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PauseIcon from "@mui/icons-material/Pause";
import fondoselva from "../assets/images/fondoselva.png";
import monojuego from "../assets/images/monojuego.png";
import platano1 from "../assets/images/platano1.png";
import platano3 from "../assets/images/platano3.png";
import platano5 from "../assets/images/platano5.png";
import piedra from "../assets/images/piedra.png";
import jungleB1 from "../assets/sounds/junglebg1.mp3";
import jungleB2 from "../assets/sounds/junglebg2.mp3";
import jungleB3 from "../assets/sounds/junglebg3.mp3";
import collectSound from "../assets/sounds/collect.wav";
import rockHitSound from "../assets/sounds/rockhit.mp3";
import lostSound from "../assets/sounds/lost.mp3";
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 800;

// Área física desde la que ALBA envía las coordenadas del cursor.
// En algunos dispositivos el mensaje "setup" informa el tamaño completo
// del iframe (1280 x 800 o 1920 x 1080), aunque cursor.x/cursor.y continúan
// usando esta área. Si usamos el tamaño del iframe para normalizar el cursor,
// el mono solo alcanza aproximadamente la mitad superior del juego.
const DEFAULT_ALBA_AREA = {
  x: 43,
  y: 47,
  width: 460,
  height: 320,
};

const MONKEY_X = 185;
const MONKEY_WIDTH = 150;
const MONKEY_HEIGHT = 150;
const BANANA_SIZE = 118;
const ROCK_SIZE = 125;
const SPAWN_INTERVAL_MS = 1600;
const START_DELAY_MS = 900;
const SPEED_VALUES = {
  1: 250,
  2: 390,
  3: 550,
};
const TOP_BANANA_MIN_Y = 150;
const TOP_BANANA_MAX_Y = 330;
const BOTTOM_BANANA_MIN_Y = 500;
const BOTTOM_BANANA_MAX_Y = 690;
const ROCK_MIN_Y = 180;
const ROCK_MAX_Y = 690;
const MAX_SAME_SIDE_HIGH_VALUE = 2;
const HIT_INVULNERABILITY_MS = 1200;
const GAME_OVER_MESSAGE_MS = 2500;
const BACKGROUND_MUSICS = [jungleB1, jungleB2, jungleB3];
const BANANA_TYPES = [
  { key: "platano1", value: 1, image: platano1 },
  { key: "platano3", value: 3, image: platano3 },
  { key: "platano5", value: 5, image: platano5 },
];
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getEffectiveAlbaArea(area) {
  const width = Number(area?.width);
  const height = Number(area?.height);
  const x = Number(area?.x);
  const y = Number(area?.y);

  const hasValidSize = width > 0 && height > 0;

  if (!hasValidSize) {
    return {
      x: DEFAULT_ALBA_AREA.x,
      y: DEFAULT_ALBA_AREA.y,
      w: DEFAULT_ALBA_AREA.width,
      h: DEFAULT_ALBA_AREA.height,
    };
  }

  const looksLikeViewportSize =
    width >= GAME_WIDTH * 0.75 || height >= GAME_HEIGHT * 0.75;

  if (looksLikeViewportSize) {
    return {
      x: DEFAULT_ALBA_AREA.x,
      y: DEFAULT_ALBA_AREA.y,
      w: DEFAULT_ALBA_AREA.width,
      h: DEFAULT_ALBA_AREA.height,
    };
  }

  return {
    x: Number.isFinite(x) ? x : DEFAULT_ALBA_AREA.x,
    y: Number.isFinite(y) ? y : DEFAULT_ALBA_AREA.y,
    w: width,
    h: height,
  };
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function getRandomBackgroundMusic() {
  return randomItem(BACKGROUND_MUSICS);
}
function rectsCollide(a, b) {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}
function formatTime(ms) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
function getRandomTopY(previousY) {
  let y = randomBetween(TOP_BANANA_MIN_Y, TOP_BANANA_MAX_Y);
  let tries = 0;
  while (previousY && Math.abs(y - previousY) < 55 && tries < 20) {
    y = randomBetween(TOP_BANANA_MIN_Y, TOP_BANANA_MAX_Y);
    tries += 1;
  }
  return y;
}
function getRandomBottomY(previousY) {
  let y = randomBetween(BOTTOM_BANANA_MIN_Y, BOTTOM_BANANA_MAX_Y);
  let tries = 0;
  while (previousY && Math.abs(y - previousY) < 55 && tries < 20) {
    y = randomBetween(BOTTOM_BANANA_MIN_Y, BOTTOM_BANANA_MAX_Y);
    tries += 1;
  }
  return y;
}
function getRandomRockY(previousY) {
  let y = randomBetween(ROCK_MIN_Y, ROCK_MAX_Y);
  let tries = 0;
  while (previousY && Math.abs(y - previousY) < 120 && tries < 20) {
    y = randomBetween(ROCK_MIN_Y, ROCK_MAX_Y);
    tries += 1;
  }
  return y;
}
function getNextHighValueSide(lastHighValueSide, highValueSideCount) {
  if (lastHighValueSide && highValueSideCount >= MAX_SAME_SIDE_HIGH_VALUE) {
    return lastHighValueSide === "top" ? "bottom" : "top";
  }
  return Math.random() > 0.5 ? "top" : "bottom";
}
function createRows(durationMs) {
  const rowsCount = Math.max(
    1,
    Math.floor((durationMs - START_DELAY_MS) / SPAWN_INTERVAL_MS),
  );
  let currentSpawnAt = START_DELAY_MS;
  let lastHighValueSide = null;
  let highValueSideCount = 0;
  let previousTopY = null;
  let previousBottomY = null;
  return Array.from({ length: rowsCount }, (_, index) => {
    if (index > 0) {
      currentSpawnAt += SPAWN_INTERVAL_MS + randomBetween(-280, 300);
    }
    const highValueSide = getNextHighValueSide(
      lastHighValueSide,
      highValueSideCount,
    );
    if (highValueSide === lastHighValueSide) {
      highValueSideCount += 1;
    } else {
      highValueSideCount = 1;
      lastHighValueSide = highValueSide;
    }
    const topY = getRandomTopY(previousTopY);
    const bottomY = getRandomBottomY(previousBottomY);
    previousTopY = topY;
    previousBottomY = bottomY;
    const bananaA = randomItem(BANANA_TYPES);
    let bananaB = randomItem(BANANA_TYPES);
    while (bananaB.key === bananaA.key) {
      bananaB = randomItem(BANANA_TYPES);
    }
    const highBanana = bananaA.value > bananaB.value ? bananaA : bananaB;
    const lowBanana = bananaA.value > bananaB.value ? bananaB : bananaA;
    const highBananaY = highValueSide === "top" ? topY : bottomY;
    const lowBananaY = highValueSide === "top" ? bottomY : topY;
    const options = [
      {
        id: `${index}-high`,
        ...highBanana,
        y: highBananaY,
        side: highValueSide,
      },
      {
        id: `${index}-low`,
        ...lowBanana,
        y: lowBananaY,
        side: highValueSide === "top" ? "bottom" : "top",
      },
    ];
    if (Math.random() > 0.5) {
      options.reverse();
    }
    return {
      id: `row-${index}`,
      spawnAt: currentSpawnAt,
      x: GAME_WIDTH + 180,
      options,
      collectedOptionId: null,
      hasScored: false,
      maxValue: highBanana.value,
      highValueSide,
    };
  });
}
function createRocks(rows, durationMs) {
  let previousRockY = null;
  return rows
    .map((row, index) => {
      const nextRow = rows[index + 1];
      const nextSpawnAt = nextRow
        ? nextRow.spawnAt
        : row.spawnAt + SPAWN_INTERVAL_MS;
      const timeBetweenRows = nextSpawnAt - row.spawnAt;
      const spawnAt =
        row.spawnAt +
        clamp(
          Math.round(timeBetweenRows * 0.52),
          580,
          Math.max(580, timeBetweenRows - 350),
        );
      const y = getRandomRockY(previousRockY);
      previousRockY = y;
      return { id: `rock-${index}`, spawnAt, x: GAME_WIDTH + 160, y };
    })
    .filter((rock) => rock.spawnAt < durationMs - 400);
}
export default function LevelTwoGame({
  minutes = 1,
  lives = 3,
  speed = 1,
  onFinish,
  onBack,
}) {
  const durationMs = useMemo(() => minutes * 60 * 1000, [minutes]);

  const normalizedSpeed = useMemo(() => {
    return clamp(Math.round(Number(speed) || 1), 1, 3);
  }, [speed]);

  const objectSpeed = SPEED_VALUES[normalizedSpeed] || SPEED_VALUES[1];
  const plannedRowsRef = useRef([]);
  const activeRowsRef = useRef([]);
  const spawnedRowsRef = useRef(new Set());
  const plannedRocksRef = useRef([]);
  const activeRocksRef = useRef([]);
  const spawnedRocksRef = useRef(new Set());
  const monkeyYRef = useRef(GAME_HEIGHT / 2);
  const targetMonkeyYRef = useRef(GAME_HEIGHT / 2);
  const animationRef = useRef(null);
  const lastFrameTimeRef = useRef(null);
  const playElapsedMsRef = useRef(0);
  const finishedRef = useRef(false);

  // El nivel mantiene su lógica en una base de 1280 x 800, pero se dibuja
  // usando el tamaño real del contenedor. Así funciona tanto en 1280 x 800
  // como en 1920 x 1080 sin dejar una franja de la pantalla sin utilizar.
  const gameAreaRef = useRef(null);
  const gameSizeRef = useRef({ width: GAME_WIDTH, height: GAME_HEIGHT });

  const areaRef = useRef({
    x: DEFAULT_ALBA_AREA.x,
    y: DEFAULT_ALBA_AREA.y,
    w: DEFAULT_ALBA_AREA.width,
    h: DEFAULT_ALBA_AREA.height,
  });
  const lastHostRef = useRef({ x: 0, y: GAME_HEIGHT / 2 });
  const lastSensorPressTsRef = useRef(0);
  const collectedRef = useRef(0);
  const remainingLivesRef = useRef(lives);
  const lastHitElapsedRef = useRef(-HIT_INVULNERABILITY_MS);
  const pausedRef = useRef(false);
  const musicRef = useRef(null);
  const collectAudioRef = useRef(null);
  const rockHitAudioRef = useRef(null);
  const lostAudioRef = useRef(null);
  const hitTimeoutRef = useRef(null);
  const gameOverTimeoutRef = useRef(null);
  const pauseButtonRef = useRef(null);
  const resumeButtonRef = useRef(null);
  const finishButtonRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);
  const [monkeyY, setMonkeyY] = useState(GAME_HEIGHT / 2);
  const [activeRows, setActiveRows] = useState([]);
  const [activeRocks, setActiveRocks] = useState([]);
  const [collectedBananas, setCollectedBananas] = useState(0);
  const [remainingLives, setRemainingLives] = useState(lives);
  const [timeLeftMs, setTimeLeftMs] = useState(durationMs);
  const [bgOffset, setBgOffset] = useState(0);
  const [isHit, setIsHit] = useState(false);
  const [showGameOverMessage, setShowGameOverMessage] = useState(false);
  const [gameSize, setGameSize] = useState({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  });

  useEffect(() => {
    const gameArea = gameAreaRef.current;

    if (!gameArea) return undefined;

    const updateGameSize = () => {
      // clientWidth/clientHeight entregan el tamaño lógico del elemento.
      // getBoundingClientRect puede venir escalado por el contenedor de ALBA
      // y provocaría que las coordenadas se escalaran dos veces.
      const width = gameArea.clientWidth || GAME_WIDTH;
      const height = gameArea.clientHeight || GAME_HEIGHT;

      if (width <= 0 || height <= 0) return;

      const nextSize = { width, height };
      gameSizeRef.current = nextSize;

      setGameSize((previousSize) => {
        const sameWidth = Math.abs(previousSize.width - nextSize.width) < 0.5;
        const sameHeight =
          Math.abs(previousSize.height - nextSize.height) < 0.5;

        return sameWidth && sameHeight ? previousSize : nextSize;
      });
    };

    updateGameSize();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateGameSize)
        : null;

    resizeObserver?.observe(gameArea);
    window.addEventListener("resize", updateGameSize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateGameSize);
    };
  }, []);

  const playMusic = useCallback(() => {
    const music = musicRef.current;
    if (!music) return;
    music.play().catch(() => {});
  }, []);
  const pauseMusic = useCallback(() => {
    const music = musicRef.current;
    if (!music) return;
    music.pause();
  }, []);
  const stopMusic = useCallback(() => {
    const music = musicRef.current;
    if (!music) return;
    music.pause();
    music.currentTime = 0;
  }, []);
  const playCollectSound = useCallback(() => {
    const audio = collectAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);
  const playRockHitSound = useCallback(() => {
    const audio = rockHitAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);
  const playLostSound = useCallback(() => {
    const audio = lostAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);
  const showHitEffect = useCallback(() => {
    if (hitTimeoutRef.current) {
      window.clearTimeout(hitTimeoutRef.current);
    }
    setIsHit(true);
    hitTimeoutRef.current = window.setTimeout(() => {
      setIsHit(false);
      hitTimeoutRef.current = null;
    }, 500);
  }, []);
  useEffect(() => {
    const selectedMusic = getRandomBackgroundMusic();
    const music = new Audio(selectedMusic);
    music.loop = true;
    music.volume = 0.28;
    musicRef.current = music;
    playMusic();
    return () => {
      music.pause();
      music.currentTime = 0;
      musicRef.current = null;
    };
  }, [playMusic]);
  useEffect(() => {
    const audio = new Audio(collectSound);
    audio.volume = 0.55;
    collectAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.currentTime = 0;
      collectAudioRef.current = null;
    };
  }, []);
  useEffect(() => {
    const audio = new Audio(rockHitSound);
    audio.volume = 0.75;
    rockHitAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.currentTime = 0;
      rockHitAudioRef.current = null;
    };
  }, []);
  useEffect(() => {
    const audio = new Audio(lostSound);
    audio.volume = 0.8;
    lostAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.currentTime = 0;
      lostAudioRef.current = null;
    };
  }, []);
  useEffect(() => {
    const rows = createRows(durationMs);
    const rocks = createRocks(rows, durationMs);
    plannedRowsRef.current = rows;
    activeRowsRef.current = [];
    spawnedRowsRef.current = new Set();
    plannedRocksRef.current = rocks;
    activeRocksRef.current = [];
    spawnedRocksRef.current = new Set();
    collectedRef.current = 0;
    remainingLivesRef.current = lives;
    lastHitElapsedRef.current = -HIT_INVULNERABILITY_MS;
    finishedRef.current = false;
    lastFrameTimeRef.current = null;
    playElapsedMsRef.current = 0;
    pausedRef.current = false;
    if (hitTimeoutRef.current) {
      window.clearTimeout(hitTimeoutRef.current);
      hitTimeoutRef.current = null;
    }
    if (gameOverTimeoutRef.current) {
      window.clearTimeout(gameOverTimeoutRef.current);
      gameOverTimeoutRef.current = null;
    }
    setIsPaused(false);
    setActiveRows([]);
    setActiveRocks([]);
    setCollectedBananas(0);
    setRemainingLives(lives);
    setTimeLeftMs(durationMs);
    setBgOffset(0);
    setMonkeyY(GAME_HEIGHT / 2);
    setIsHit(false);
    setShowGameOverMessage(false);
    monkeyYRef.current = GAME_HEIGHT / 2;
    targetMonkeyYRef.current = GAME_HEIGHT / 2;
    playMusic();
  }, [durationMs, lives, playMusic]);
  useEffect(() => {
    return () => {
      if (hitTimeoutRef.current) {
        window.clearTimeout(hitTimeoutRef.current);
      }
      if (gameOverTimeoutRef.current) {
        window.clearTimeout(gameOverTimeoutRef.current);
      }
    };
  }, []);
  const getRootRect = () => {
    const element =
      gameAreaRef.current ||
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
      Math.max(0, (hostX - area.x) / (area.w || 1)),
    );
    const normalizedY = Math.min(
      1,
      Math.max(0, (hostY - area.y) / (area.h || 1)),
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
  const getInternalYFromHostY = useCallback((hostY) => {
    const area = areaRef.current;
    const normalizedY = clamp((hostY - area.y) / (area.h || 1), 0, 1);
    return normalizedY * GAME_HEIGHT;
  }, []);
  const finishGame = useCallback(
    (finishReason = "time") => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      pausedRef.current = false;
      setIsPaused(false);
      stopMusic();
      const collected = collectedRef.current;
      const playedMs = Math.min(playElapsedMsRef.current, durationMs);
      const possibleRows = plannedRowsRef.current.filter(
        (row) => row.spawnAt <= playedMs,
      );
      const possible = possibleRows.reduce((sum, row) => sum + row.maxValue, 0);
      const efficiency =
        possible > 0 ? Math.round((collected / possible) * 100) : 0;
      const gameResult = {
        level: 2,
        minutes,
        speed: normalizedSpeed,
        initialLives: lives,
        remainingLives: remainingLivesRef.current,
        lostLives: Math.max(0, lives - remainingLivesRef.current),
        gameOver: finishReason === "no-lives",
        finishReason,
        collectedBananas: collected,
        possibleBananas: possible,
        efficiency,
        totalRows: possibleRows.length,
      };
      if (finishReason === "no-lives") {
        setShowGameOverMessage(true);
        playLostSound();
        gameOverTimeoutRef.current = window.setTimeout(() => {
          gameOverTimeoutRef.current = null;
          onFinish?.(gameResult);
        }, GAME_OVER_MESSAGE_MS);
        return;
      }
      onFinish?.(gameResult);
    },
    [
      durationMs,
      lives,
      minutes,
      normalizedSpeed,
      onFinish,
      playLostSound,
      stopMusic,
    ],
  );
  const handlePause = useCallback(() => {
    if (finishedRef.current) return;
    pausedRef.current = true;
    setIsPaused(true);
    pauseMusic();
  }, [pauseMusic]);
  const handleResume = useCallback(() => {
    if (finishedRef.current) return;
    pausedRef.current = false;
    lastFrameTimeRef.current = null;
    setIsPaused(false);
    playMusic();
  }, [playMusic]);
  const handleFinishEarly = useCallback(() => {
    finishGame("manual");
  }, [finishGame]);
  useEffect(() => {
    const onMessage = (event) => {
      const data = event?.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "setup") {
        areaRef.current = getEffectiveAlbaArea({
          x: data.offsetX ?? (data.offset && data.offset.left),
          y: data.offsetY ?? (data.offset && data.offset.top),
          width: data.width,
          height: data.height,
        });
        return;
      }
      if (
        data.type === "cursor" &&
        typeof data.x === "number" &&
        typeof data.y === "number"
      ) {
        lastHostRef.current = { x: data.x, y: data.y };
        if (!pausedRef.current && !finishedRef.current) {
          targetMonkeyYRef.current = getInternalYFromHostY(data.y);
        }
        return;
      }
      if (data.type === "press") {
        if (finishedRef.current) return;
        const now = Date.now();
        if (now - lastSensorPressTsRef.current < 80) {
          return;
        }
        lastSensorPressTsRef.current = now;
        const sourceX =
          typeof data.x === "number" ? data.x : lastHostRef.current.x;
        const sourceY =
          typeof data.y === "number" ? data.y : lastHostRef.current.y;
        const point = toViewportXY(sourceX, sourceY);
        if (pausedRef.current) {
          const resumeRect = resumeButtonRef.current?.getBoundingClientRect();
          const finishRect = finishButtonRef.current?.getBoundingClientRect();
          if (resumeRect && contains(point, resumeRect)) {
            return handleResume();
          }
          if (finishRect && contains(point, finishRect)) {
            return handleFinishEarly();
          }
          return;
        }
        const pauseRect = pauseButtonRef.current?.getBoundingClientRect();
        if (pauseRect && contains(point, pauseRect)) {
          return handlePause();
        }
      }
      if (data.type === "quit") {
        stopMusic();
        onBack?.();
      }
    };
    window.addEventListener("message", onMessage, false);
    return () => {
      window.removeEventListener("message", onMessage, false);
    };
  }, [
    getInternalYFromHostY,
    handleFinishEarly,
    handlePause,
    handleResume,
    onBack,
    stopMusic,
  ]);
  const handleLocalPointerMove = useCallback((event) => {
    if (pausedRef.current || finishedRef.current) {
      return;
    }
    const viewport =
      gameAreaRef.current ||
      document.getElementById("game-viewport") ||
      document.getElementById("root") ||
      document.body;
    const rect = viewport.getBoundingClientRect();
    const normalizedY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    targetMonkeyYRef.current = normalizedY * GAME_HEIGHT;
  }, []);
  useEffect(() => {
    const loop = (timestamp) => {
      if (finishedRef.current) return;
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = timestamp;
      }
      const deltaMs = Math.min(50, timestamp - lastFrameTimeRef.current);
      lastFrameTimeRef.current = timestamp;
      if (pausedRef.current) {
        animationRef.current = requestAnimationFrame(loop);
        return;
      }
      const deltaSeconds = deltaMs / 1000;
      playElapsedMsRef.current = Math.min(
        durationMs,
        playElapsedMsRef.current + deltaMs,
      );
      const elapsedMs = playElapsedMsRef.current;
      const remaining = Math.max(0, durationMs - elapsedMs);
      if (remaining <= 0) {
        setTimeLeftMs(0);
        finishGame("time");
        return;
      }
      const targetY = clamp(
        targetMonkeyYRef.current,
        MONKEY_HEIGHT / 2 + 20,
        GAME_HEIGHT - MONKEY_HEIGHT / 2 - 20,
      );
      const currentY = monkeyYRef.current;
      const nextMonkeyY = currentY + (targetY - currentY) * 0.18;
      monkeyYRef.current = nextMonkeyY;
      plannedRowsRef.current.forEach((row) => {
        if (elapsedMs >= row.spawnAt && !spawnedRowsRef.current.has(row.id)) {
          spawnedRowsRef.current.add(row.id);
          activeRowsRef.current.push({
            ...row,
            x: GAME_WIDTH + 160,
            collectedOptionId: null,
            hasScored: false,
          });
        }
      });
      plannedRocksRef.current.forEach((rock) => {
        if (
          elapsedMs >= rock.spawnAt &&
          !spawnedRocksRef.current.has(rock.id)
        ) {
          spawnedRocksRef.current.add(rock.id);
          activeRocksRef.current.push({ ...rock, x: GAME_WIDTH + 160 });
        }
      });

      const currentGameSize = gameSizeRef.current;
      const currentScaleX = currentGameSize.width / GAME_WIDTH || 1;
      const currentScaleY = currentGameSize.height / GAME_HEIGHT || 1;
      const currentObjectScale = Math.min(currentScaleX, currentScaleY);

      // Las imágenes conservan su proporción, por eso sus hitboxes se
      // convierten nuevamente a coordenadas lógicas antes de las colisiones.
      const monkeyHalfWidth =
        (MONKEY_WIDTH * currentObjectScale) / currentScaleX / 2;
      const monkeyHalfHeight =
        (MONKEY_HEIGHT * currentObjectScale) / currentScaleY / 2;
      const monkeyInsetX = (24 * currentObjectScale) / currentScaleX;
      const monkeyInsetY = (24 * currentObjectScale) / currentScaleY;

      const monkeyRect = {
        left: MONKEY_X - monkeyHalfWidth + monkeyInsetX,
        right: MONKEY_X + monkeyHalfWidth - monkeyInsetX,
        top: nextMonkeyY - monkeyHalfHeight + monkeyInsetY,
        bottom: nextMonkeyY + monkeyHalfHeight - monkeyInsetY,
      };
      const nextActiveRows = [];
      activeRowsRef.current.forEach((row) => {
        const nextX = row.x - objectSpeed * deltaSeconds;
        let caughtOption = null;
        row.options.forEach((option) => {
          if (row.collectedOptionId === option.id) {
            return;
          }
          if (row.hasScored) return;

          const bananaHalfWidth =
            (BANANA_SIZE * currentObjectScale) / currentScaleX / 2;
          const bananaHalfHeight =
            (BANANA_SIZE * currentObjectScale) / currentScaleY / 2;
          const bananaInsetX = (14 * currentObjectScale) / currentScaleX;
          const bananaInsetY = (14 * currentObjectScale) / currentScaleY;

          const bananaRect = {
            left: nextX - bananaHalfWidth + bananaInsetX,
            right: nextX + bananaHalfWidth - bananaInsetX,
            top: option.y - bananaHalfHeight + bananaInsetY,
            bottom: option.y + bananaHalfHeight - bananaInsetY,
          };
          if (!caughtOption && rectsCollide(monkeyRect, bananaRect)) {
            caughtOption = option;
          }
        });
        let updatedRow = { ...row, x: nextX };
        if (caughtOption) {
          const newCollected = collectedRef.current + caughtOption.value;
          collectedRef.current = newCollected;
          setCollectedBananas(newCollected);
          playCollectSound();
          updatedRow = {
            ...updatedRow,
            collectedOptionId: caughtOption.id,
            hasScored: true,
          };
        }
        if (nextX >= -BANANA_SIZE) {
          nextActiveRows.push(updatedRow);
        }
      });
      const nextActiveRocks = [];
      let lostAllLives = false;
      activeRocksRef.current.forEach((rock) => {
        const nextX = rock.x - objectSpeed * deltaSeconds;

        const rockHalfWidth =
          (ROCK_SIZE * currentObjectScale) / currentScaleX / 2;
        const rockHalfHeight =
          (ROCK_SIZE * currentObjectScale) / currentScaleY / 2;
        const rockInsetX = (18 * currentObjectScale) / currentScaleX;
        const rockInsetY = (18 * currentObjectScale) / currentScaleY;

        const rockRect = {
          left: nextX - rockHalfWidth + rockInsetX,
          right: nextX + rockHalfWidth - rockInsetX,
          top: rock.y - rockHalfHeight + rockInsetY,
          bottom: rock.y + rockHalfHeight - rockInsetY,
        };
        const canReceiveDamage =
          elapsedMs - lastHitElapsedRef.current >= HIT_INVULNERABILITY_MS;
        const collided = canReceiveDamage && rectsCollide(monkeyRect, rockRect);
        if (collided) {
          lastHitElapsedRef.current = elapsedMs;
          const nextLives = Math.max(0, remainingLivesRef.current - 1);
          remainingLivesRef.current = nextLives;
          setRemainingLives(nextLives);
          showHitEffect();
          playRockHitSound();
          if (nextLives <= 0) {
            lostAllLives = true;
          }
          return;
        }
        if (nextX >= -ROCK_SIZE) {
          nextActiveRocks.push({ ...rock, x: nextX });
        }
      });
      activeRowsRef.current = nextActiveRows;
      activeRocksRef.current = nextActiveRocks;
      setMonkeyY(nextMonkeyY);
      setActiveRows(nextActiveRows);
      setActiveRocks(nextActiveRocks);
      setTimeLeftMs(remaining);
      setBgOffset((previous) => previous + objectSpeed * 0.35 * deltaSeconds);
      if (lostAllLives) {
        finishGame("no-lives");
        return;
      }
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    durationMs,
    finishGame,
    objectSpeed,
    playCollectSound,
    playRockHitSound,
    showHitEffect,
  ]);

  const scaleX = gameSize.width / GAME_WIDTH;
  const scaleY = gameSize.height / GAME_HEIGHT;
  const objectScale = Math.min(scaleX, scaleY);

  return (
    <Box
      ref={gameAreaRef}
      onPointerMove={handleLocalPointerMove}
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#7FCB65",
        touchAction: "none",
        userSelect: "none",
      }}
    >
      {" "}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${fondoselva})`,
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 100%",
          backgroundPosition: `${-bgOffset * scaleX}px center`,
          zIndex: 0,
        }}
      />{" "}
      {isHit && !showGameOverMessage && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            pointerEvents: "none",
            border: "14px solid rgba(255, 70, 70, 0.8)",
            boxSizing: "border-box",
            backgroundColor: "rgba(255, 70, 70, 0.12)",
          }}
        />
      )}{" "}
      <Box
        sx={{
          position: "absolute",
          top: 24,
          left: 30,
          zIndex: 12,
          minWidth: 250,
          px: 3,
          py: 1.5,
          borderRadius: "22px",
          backgroundColor: "rgba(255, 248, 246, 0.9)",
          border: "3px solid #4955A8",
          boxShadow: "-6px 6px 0 #323B79",
        }}
      >
        {" "}
        <Typography
          sx={{
            color: "#4955A8",
            fontSize: 30,
            fontWeight: "bold",
            lineHeight: 1,
          }}
        >
          {" "}
          Plátanos: {collectedBananas}{" "}
        </Typography>{" "}
      </Box>{" "}
      <Box
        sx={{
          position: "absolute",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 12,
          minWidth: 210,
          px: 3,
          py: 1.5,
          borderRadius: "22px",
          backgroundColor: "rgba(255, 248, 246, 0.9)",
          border: "3px solid #4955A8",
          boxShadow: "-6px 6px 0 #323B79",
        }}
      >
        {" "}
        <Typography
          sx={{
            color: "#4955A8",
            fontSize: 30,
            fontWeight: "bold",
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          {" "}
          {formatTime(timeLeftMs)}{" "}
        </Typography>{" "}
      </Box>{" "}
      <Box
        sx={{
          position: "absolute",
          top: 24,
          right: 335,
          zIndex: 12,
          minWidth: 180,
          px: 3,
          py: 1.5,
          borderRadius: "22px",
          backgroundColor: "rgba(255, 248, 246, 0.9)",
          border: "3px solid #E36875",
          boxShadow: "-6px 6px 0 #9E3D55",
        }}
      >
        {" "}
        <Typography
          sx={{
            color: "#E36875",
            fontSize: 30,
            fontWeight: "bold",
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          {" "}
          Vidas: {remainingLives}{" "}
        </Typography>{" "}
      </Box>{" "}
      <Box
        sx={{
          position: "absolute",
          top: 24,
          right: 130,
          zIndex: 12,
          minWidth: 160,
          px: 3,
          py: 1.5,
          borderRadius: "22px",
          backgroundColor: "rgba(255, 248, 246, 0.9)",
          border: "3px solid #4955A8",
          boxShadow: "-6px 6px 0 #323B79",
        }}
      >
        {" "}
        <Typography
          sx={{
            color: "#4955A8",
            fontSize: 30,
            fontWeight: "bold",
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          {" "}
          x{normalizedSpeed}{" "}
        </Typography>{" "}
      </Box>{" "}
      <IconButton
        ref={pauseButtonRef}
        onClick={handlePause}
        disabled={showGameOverMessage}
        sx={{
          position: "absolute",
          top: 20,
          right: 30,
          zIndex: 13,
          width: 82,
          height: 82,
          backgroundColor: "#FF6B55",
          borderRadius: "50%",
          border: "3px solid #FFFFFF",
          boxShadow: "-6px 6px 0 #2A3D6B",
          touchAction: "manipulation",
          "&:hover": { backgroundColor: "#FF5733" },
          "&.Mui-disabled": { backgroundColor: "#FF6B55", opacity: 0.65 },
        }}
      >
        {" "}
        <PauseIcon sx={{ color: "white", fontSize: 46 }} />{" "}
      </IconButton>{" "}
      {activeRows.map((row) =>
        row.options.map((option) => {
          if (row.collectedOptionId === option.id) {
            return null;
          }
          return (
            <Box
              key={option.id}
              component="img"
              src={option.image}
              alt={option.key}
              sx={{
                position: "absolute",
                zIndex: 2,
                width: BANANA_SIZE * objectScale,
                height: BANANA_SIZE * objectScale,
                objectFit: "contain",
                left: row.x * scaleX,
                top: option.y * scaleY,
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                filter: "drop-shadow(-5px 8px 2px rgba(50, 59, 121, 0.35))",
              }}
            />
          );
        }),
      )}{" "}
      {activeRocks.map((rock) => (
        <Box
          key={rock.id}
          component="img"
          src={piedra}
          alt="Piedra"
          sx={{
            position: "absolute",
            zIndex: 3,
            width: ROCK_SIZE * objectScale,
            height: ROCK_SIZE * objectScale,
            objectFit: "contain",
            left: rock.x * scaleX,
            top: rock.y * scaleY,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            filter: "drop-shadow(-6px 9px 3px rgba(33, 44, 81, 0.45))",
          }}
        />
      ))}{" "}
      <Box
        component="img"
        src={monojuego}
        alt="Mono"
        sx={{
          position: "absolute",
          zIndex: 4,
          width: MONKEY_WIDTH * objectScale,
          height: MONKEY_HEIGHT * objectScale,
          objectFit: "contain",
          left: MONKEY_X * scaleX,
          top: monkeyY * scaleY,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          opacity: isHit ? 0.45 : 1,
          filter: "drop-shadow(-8px 10px 3px rgba(33, 44, 81, 0.35))",
        }}
      />{" "}
      {isPaused && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            backgroundColor: "rgba(17, 7, 52, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "none",
          }}
        >
          {" "}
          <Box
            sx={{
              width: 520,
              backgroundColor: "#FFF8F6",
              borderRadius: "30px",
              border: "4px solid #4955A8",
              boxShadow: "-12px 12px 0 #323B79",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              px: 5,
              py: 5,
              gap: 3,
            }}
          >
            {" "}
            <Typography
              sx={{
                color: "#4955A8",
                fontSize: 58,
                fontWeight: "bold",
                lineHeight: 1,
                textAlign: "center",
              }}
            >
              {" "}
              Pausa{" "}
            </Typography>{" "}
            <Typography
              sx={{
                color: "#4955A8",
                fontSize: 28,
                fontWeight: "bold",
                textAlign: "center",
                lineHeight: 1.15,
                maxWidth: 420,
              }}
            >
              {" "}
              ¿Qué quieres hacer?{" "}
            </Typography>{" "}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                mt: 1,
              }}
            >
              {" "}
              <Button
                ref={resumeButtonRef}
                onClick={handleResume}
                sx={{
                  width: 190,
                  height: 66,
                  backgroundColor: "#4955A8",
                  color: "white",
                  borderRadius: "18px",
                  fontSize: 24,
                  fontWeight: "bold",
                  textTransform: "none",
                  boxShadow: "-6px 6px 0 #323B79",
                  border: "3px solid #323B79",
                  touchAction: "manipulation",
                  "&:hover": { backgroundColor: "#3F4A99" },
                }}
              >
                {" "}
                Reanudar{" "}
              </Button>{" "}
              <Button
                ref={finishButtonRef}
                onClick={handleFinishEarly}
                sx={{
                  width: 190,
                  height: 66,
                  backgroundColor: "#FF6B55",
                  color: "white",
                  borderRadius: "18px",
                  fontSize: 24,
                  fontWeight: "bold",
                  textTransform: "none",
                  boxShadow: "6px 6px 0 #2A3D6B",
                  border: "3px solid #2A3D6B",
                  touchAction: "manipulation",
                  "&:hover": { backgroundColor: "#FF5733" },
                }}
              >
                {" "}
                Terminar{" "}
              </Button>{" "}
            </Box>{" "}
          </Box>{" "}
        </Box>
      )}{" "}
      {showGameOverMessage && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 30,
            backgroundColor: "rgba(17, 7, 52, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "none",
            animation: "gameOverBackdrop 250ms ease-out",
            "@keyframes gameOverBackdrop": {
              from: { opacity: 0 },
              to: { opacity: 1 },
            },
          }}
        >
          {" "}
          <Box
            sx={{
              width: 650,
              maxWidth: "80%",
              minHeight: 330,
              px: 6,
              py: 5,
              boxSizing: "border-box",
              backgroundColor: "#FFF8F6",
              borderRadius: "36px",
              border: "5px solid #E36875",
              boxShadow: "-14px 14px 0 #9E3D55",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              animation: "gameOverCard 450ms ease-out",
              "@keyframes gameOverCard": {
                from: { opacity: 0, transform: "scale(0.75) translateY(30px)" },
                to: { opacity: 1, transform: "scale(1) translateY(0)" },
              },
            }}
          >
            {" "}
            <Typography
              sx={{
                color: "#E36875",
                fontSize: 76,
                fontWeight: "bold",
                lineHeight: 1,
                textAlign: "center",
              }}
            >
              {" "}
              ¡Oh no!{" "}
            </Typography>{" "}
            <Typography
              sx={{
                color: "#4955A8",
                fontSize: 42,
                fontWeight: "bold",
                lineHeight: 1.1,
                textAlign: "center",
              }}
            >
              {" "}
              Perdiste todas tus vidas{" "}
            </Typography>{" "}
            <Typography
              sx={{
                color: "#4955A8",
                fontSize: 27,
                fontWeight: "bold",
                lineHeight: 1.2,
                textAlign: "center",
                opacity: 0.85,
                mt: 1,
              }}
            >
              {" "}
              Veamos cómo te fue...{" "}
            </Typography>{" "}
          </Box>{" "}
        </Box>
      )}{" "}
    </Box>
  );
}