import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Box,
  Typography,
  IconButton,
  Button,
} from "@mui/material";

import PauseRoundedIcon from "@mui/icons-material/PauseRounded";

import useDeviceType from "../core/useDeviceType";

import fondoSelva3 from "../assets/images/fondoselva3.png";
import monoJuego from "../assets/images/monojuego.png";
import serpiente from "../assets/images/serpiente.png";
import serpiente2 from "../assets/images/serpiente2.png";
import leon from "../assets/images/leon.png";
import tigre from "../assets/images/tigre.png";
import piedra from "../assets/images/piedra.png";
import platano1 from "../assets/images/platano1.png";

const sounds = import.meta.glob("../assets/sounds/**/*.{mp3,wav}", {
  eager: true,
});

const SPEED_VALUES = {
  1: 250,
  2: 390,
  3: 550,
};

// Toda la lógica del nivel se mantiene en esta resolución base.
// La representación se escala después al tamaño real del dispositivo.
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

const BANANA_VALUE = 1;
const BANANA_SPAWN_CHANCE = 0.34;

const clamp = (value, minimum, maximum) => {
  return Math.min(maximum, Math.max(minimum, value));
};

const getEffectiveAlbaArea = (area) => {
  const width = Number(area?.width);
  const height = Number(area?.height);
  const x = Number(area?.x);
  const y = Number(area?.y);

  const hasValidSize = width > 0 && height > 0;

  if (!hasValidSize) {
    return { ...DEFAULT_ALBA_AREA };
  }

  const looksLikeViewportSize =
    width >= GAME_WIDTH * 0.75 || height >= GAME_HEIGHT * 0.75;

  if (looksLikeViewportSize) {
    return { ...DEFAULT_ALBA_AREA };
  }

  return {
    x: Number.isFinite(x) ? x : DEFAULT_ALBA_AREA.x,
    y: Number.isFinite(y) ? y : DEFAULT_ALBA_AREA.y,
    width,
    height,
  };
};

const randomBetween = (minimum, maximum) => {
  return minimum + Math.random() * (maximum - minimum);
};

const randomInteger = (minimum, maximum) => {
  return Math.floor(randomBetween(minimum, maximum + 1));
};

const getRandomItem = (items) => {
  return items[Math.floor(Math.random() * items.length)];
};

const rectanglesIntersect = (rectangleA, rectangleB) => {
  return (
    rectangleA.left < rectangleB.right &&
    rectangleA.right > rectangleB.left &&
    rectangleA.top < rectangleB.bottom &&
    rectangleA.bottom > rectangleB.top
  );
};

const getSoundUrl = (filename) => {
  const normalizedFilename = filename.toLowerCase();

  const soundKey = Object.keys(sounds).find((key) =>
    key.toLowerCase().endsWith(`/${normalizedFilename}`)
  );

  return soundKey ? sounds[soundKey]?.default : "";
};

export default function LevelThreeGame({
  minutes = 1,
  lives = 3,
  speed = 1,
  onBack,
  onFinish,
}) {
  const { isLarge } = useDeviceType();

  const px = useCallback(
    (number) => `${isLarge ? Math.round(number * 1.5) : number}px`,
    [isLarge]
  );

  const containerRef = useRef(null);
  const musicRef = useRef(null);
  const rockHitAudioRef = useRef(null);
  const collectAudioRef = useRef(null);
  const animationFrameRef = useRef(null);
  const previousFrameTimeRef = useRef(null);

  const initializedRef = useRef(false);
  const finishedRef = useRef(false);
  const pausedRef = useRef(false);
  const startedRef = useRef(false);
  const preparationSecondsRef = useRef(0);
  const startProtectionRef = useRef(0);
  const [started, setStarted] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [centered, setCentered] = useState(false);

  const dimensionsRef = useRef({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  });

  const sensorAreaRef = useRef({
    ...DEFAULT_ALBA_AREA,
  });

  const gameSizeRef = useRef({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  });

  const columnsRef = useRef([]);
  const columnIdRef = useRef(0);
  const rockCooldownRef = useRef(0);
  const bananaCooldownRef = useRef(0);
  const bananaIdRef = useRef(0);

  const monkeyYRef = useRef(300);
  const targetMonkeyYRef = useRef(300);

  const initialLivesRef = useRef(Number(lives) || 3);
  const remainingLivesRef = useRef(Number(lives) || 3);
  const collectedBananasRef = useRef(0);

  const totalSeconds = Math.max(
    1,
    Math.round((Number(minutes) || 1) * 60)
  );

  const timeLeftRef = useRef(totalSeconds);
  const invulnerableUntilRef = useRef(0);
  const damageTimeoutRef = useRef(null);
  const collidedAnimalsRef = useRef(new Set());

  const tunnelPathRef = useRef({
    currentCenter: 400,
    targetCenter: 400,
    currentGap: 350,
    targetGap: 350,
    remainingSteps: 0,
  });

  const normalizedSpeed = clamp(Number(speed) || 1, 1, 3);

  const [remainingLives, setRemainingLives] = useState(
    Number(lives) || 3
  );
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [paused, setPaused] = useState(false);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [damaged, setDamaged] = useState(false);
  const [collectedBananas, setCollectedBananas] = useState(0);

  const [gameFrame, setGameFrame] = useState({
    monkeyY: 300,
    backgroundX: 0,
    columns: [],
  });

  const [gameSize, setGameSize] = useState({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  });

  const musicUrl = useMemo(() => {
    const availableMusic = [
      getSoundUrl("jungleb1.mp3"),
      getSoundUrl("jungleb2.mp3"),
      getSoundUrl("jungleb3.mp3"),
      getSoundUrl("junglebg1.mp3"),
      getSoundUrl("junglebg2.mp3"),
      getSoundUrl("junglebg3.mp3"),
    ].filter(Boolean);

    if (availableMusic.length === 0) {
      return "";
    }

    return getRandomItem(availableMusic);
  }, []);

  const getMonkeyDimensions = useCallback(() => {
    const { height } = dimensionsRef.current;
    const size = clamp(height * 0.145, 105, 145);

    return {
      width: size,
      height: size,
    };
  }, []);

  const getColumnSpacing = useCallback(() => {
    const { width } = dimensionsRef.current;
    return clamp(width * 0.078, 96, 122);
  }, []);

  const getBananaSize = useCallback(() => {
    const { height } = dimensionsRef.current;
    return clamp(height * 0.105, 76, 104);
  }, []);

  const getNextTunnelShape = useCallback(
    (safeColumn = false) => {
      const { height } = dimensionsRef.current;
      const monkeyDimensions = getMonkeyDimensions();
      const path = tunnelPathRef.current;

      // Pasillos más amplios, con transiciones suaves.
      const monkeySafetyMargin = clamp(height * 0.075, 62, 82);
      const minimumPlayableGap =
        monkeyDimensions.height + monkeySafetyMargin;

      const minimumGap = clamp(
        Math.max(height * 0.30, minimumPlayableGap),
        240,
        290
      );

      const maximumGap = clamp(height * 0.46, 350, 410);

      if (safeColumn) {
        const safeGap = Math.max(height * 0.5, minimumGap + 78);

        path.currentCenter = height * 0.5;
        path.targetCenter = height * 0.5;
        path.currentGap = safeGap;
        path.targetGap = safeGap;
        path.remainingSteps = 1;
      } else {
        if (path.remainingSteps <= 0) {
          const centerOptions = [
            height * 0.26,
            height * 0.34,
            height * 0.42,
            height * 0.5,
            height * 0.58,
            height * 0.66,
            height * 0.74,
          ];

          path.targetCenter =
            getRandomItem(centerOptions) +
            randomBetween(-height * 0.035, height * 0.035);

          const createNarrowSection = Math.random() < 0.35;

          if (createNarrowSection) {
            const narrowMaximum = Math.min(
              maximumGap,
              minimumGap + clamp(height * 0.045, 34, 52)
            );

            path.targetGap = randomBetween(minimumGap, narrowMaximum);
            path.remainingSteps = randomInteger(3, 6);
          } else {
            const normalMinimum = Math.min(
              maximumGap,
              minimumGap + clamp(height * 0.055, 44, 62)
            );

            path.targetGap = randomBetween(normalMinimum, maximumGap);
            path.remainingSteps = randomInteger(4, 7);
          }
        }

        const centerDifference =
          path.targetCenter - path.currentCenter;

        const gapDifference =
          path.targetGap - path.currentGap;

        path.currentCenter +=
          centerDifference /
          Math.max(1, path.remainingSteps * 0.68);

        path.currentGap +=
          gapDifference /
          Math.max(1, path.remainingSteps * 0.8);

        path.remainingSteps -= 1;
      }

      const gapHeight = clamp(
        path.currentGap,
        minimumGap,
        safeColumn ? Math.max(maximumGap, height * 0.56) : maximumGap
      );

      const minimumWallDepth = clamp(
        height * 0.08,
        62,
        98
      );

      const minimumCenter =
        minimumWallDepth + gapHeight / 2;

      const maximumCenter =
        height -
        minimumWallDepth -
        gapHeight / 2;

      const center = clamp(
        path.currentCenter,
        minimumCenter,
        maximumCenter
      );

      path.currentCenter = center;
      path.currentGap = gapHeight;

      return {
        gapTop: center - gapHeight / 2,
        gapBottom: center + gapHeight / 2,
        gapHeight,
      };
    },
    [getMonkeyDimensions]
  );

  const createColumn = useCallback(
    (x, safeColumn = false) => {
      const { height } = dimensionsRef.current;
      const baseShape = getNextTunnelShape(safeColumn);
      // Cada animal retrocede hacia su borde: alternan largos y cortos.
      const topRetreat = safeColumn ? 28 : getRandomItem([18, 38, 60]);
      const bottomRetreat = safeColumn ? 28 : getRandomItem([18, 38, 60]);
      const tunnelShape = {
        gapTop: Math.max(35, baseShape.gapTop - topRetreat),
        gapBottom: Math.min(height - 35, baseShape.gapBottom + bottomRetreat),
      };
      tunnelShape.gapHeight = tunnelShape.gapBottom - tunnelShape.gapTop;
      const bottomDepth = height - tunnelShape.gapBottom;

      const snakeTop = randomBetween(-100, -65);
      const snakeIntrusion = randomBetween(4, 10);

      const snakeHeight =
        tunnelShape.gapTop - snakeTop + snakeIntrusion;

      const snakeWidth = clamp(
        snakeHeight * randomBetween(0.43, 0.52),
        145,
        255
      );

      const bottomHeight = clamp(
        bottomDepth + randomBetween(25, 55),
        150,
        height * 0.52
      );

      const bottomWidth = clamp(
        bottomHeight * randomBetween(0.88, 1.06),
        165,
        275
      );

      /*
       * Las piedras aparecen solamente cuando el túnel está
       * suficientemente ancho. Nunca se generan al comienzo.
       */
      if (rockCooldownRef.current > 0) {
        rockCooldownRef.current -= 1;
      }

      const wideTunnelThreshold = clamp(
        height * 0.355,
        282,
        330
      );

      const canCreateRock =
        !safeColumn &&
        rockCooldownRef.current <= 0 &&
        baseShape.gapHeight >= wideTunnelThreshold &&
        Math.random() < 0.38;

      let obstacle = null;

      if (canCreateRock) {
        const rockSize = clamp(
          height * randomBetween(0.125, 0.145),
          102,
          122
        );

        const rockSide = Math.random() < 0.5 ? "top" : "bottom";
        const wallPadding = clamp(height * 0.018, 13, 18);

        const centerY =
          rockSide === "top"
            ? tunnelShape.gapTop + rockSize / 2 + wallPadding
            : tunnelShape.gapBottom - rockSize / 2 - wallPadding;

        obstacle = {
          image: piedra,
          size: rockSize,
          centerY,
          side: rockSide,
          hit: false,
          rotation: randomBetween(-12, 12),
        };

        /*
         * Evita que aparezcan varias piedras pegadas.
         */
        rockCooldownRef.current = randomInteger(4, 7);
      }

      if (bananaCooldownRef.current > 0) {
        bananaCooldownRef.current -= 1;
      }

      let banana = null;
      const bananaSize = getBananaSize();
      const bananaVerticalPadding = clamp(height * 0.055, 42, 58);

      const canCreateBanana =
        !safeColumn &&
        !obstacle &&
        bananaCooldownRef.current <= 0 &&
        tunnelShape.gapHeight >= bananaSize + bananaVerticalPadding * 2 &&
        Math.random() < BANANA_SPAWN_CHANCE;

      if (canCreateBanana) {
        const minimumBananaCenterY =
          tunnelShape.gapTop + bananaSize / 2 + bananaVerticalPadding;

        const maximumBananaCenterY =
          tunnelShape.gapBottom - bananaSize / 2 - bananaVerticalPadding;

        if (minimumBananaCenterY < maximumBananaCenterY) {
          bananaIdRef.current += 1;

          banana = {
            id: `banana-${bananaIdRef.current}`,
            image: platano1,
            value: BANANA_VALUE,
            size: bananaSize,
            centerY: randomBetween(
              minimumBananaCenterY,
              maximumBananaCenterY
            ),
            collected: false,
            rotation: randomBetween(-10, 10),
          };

          /*
           * Evita que salgan plátanos demasiado juntos.
           */
          bananaCooldownRef.current = randomInteger(2, 4);
        }
      }

      columnIdRef.current += 1;

      return {
        id: `animal-column-${columnIdRef.current}`,
        x,
        gapTop: tunnelShape.gapTop,
        gapBottom: tunnelShape.gapBottom,
        gapHeight: tunnelShape.gapHeight,
        obstacle,
        banana,

        topAnimal: {
          image: Math.random() < 0.5 ? serpiente : serpiente2,
          width: snakeWidth,
          height: snakeHeight,
          top: snakeTop,
          intrusion: snakeIntrusion,
          offsetX: randomBetween(-18, 18),
        },

        bottomAnimal: {
          image: Math.random() < 0.5 ? leon : tigre,
          width: bottomWidth,
          height: bottomHeight,
          offsetX: randomBetween(-22, 22),
        },
      };
    },
    [getBananaSize, getNextTunnelShape]
  );

  const initializeGame = useCallback(() => {
    const { width, height } = dimensionsRef.current;
    const monkeyDimensions = getMonkeyDimensions();
    const initialMonkeyY = height / 2 - monkeyDimensions.height / 2;

    monkeyYRef.current = initialMonkeyY;
    targetMonkeyYRef.current = initialMonkeyY;
    rockCooldownRef.current = 0;
    bananaCooldownRef.current = 2;
    bananaIdRef.current = 0;
    collectedBananasRef.current = 0;
    setCollectedBananas(0);

    tunnelPathRef.current = {
      currentCenter: height * 0.5,
      targetCenter: height * 0.5,
      currentGap: height * 0.54,
      targetGap: height * 0.54,
      remainingSteps: 0,
    };

    const spacing = getColumnSpacing();
    const createdColumns = [];
    let currentX = -spacing;
    const finalX = width + spacing * 7;

    while (currentX <= finalX) {
      const safeColumn = currentX <
        width * 0.17 + monkeyDimensions.width + SPEED_VALUES[normalizedSpeed] * 2.5;
      createdColumns.push(createColumn(currentX, safeColumn));
      currentX += spacing;
    }

    columnsRef.current = createdColumns;

    setGameFrame({
      monkeyY: initialMonkeyY,
      backgroundX: 0,
      columns: [...createdColumns],
    });
  }, [createColumn, getColumnSpacing, getMonkeyDimensions, normalizedSpeed]);

  const finishGame = useCallback(
    (reason) => {
      if (finishedRef.current) {
        return;
      }

      finishedRef.current = true;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (musicRef.current) {
        musicRef.current.pause();
      }

      const finalLives = remainingLivesRef.current;
      const livesLost = Math.max(
        0,
        initialLivesRef.current - finalLives
      );
      const finalCollectedBananas = collectedBananasRef.current;

      onFinish?.({
        level: 3,
        reason,
        completed: reason === "time-completed",
        minutes,
        speed: normalizedSpeed,
        initialLives: initialLivesRef.current,
        totalLives: initialLivesRef.current,
        remainingLives: finalLives,
        livesLost,
        collisions: livesLost,
        totalSeconds,
        timeRemaining: timeLeftRef.current,
        timePlayed: totalSeconds - timeLeftRef.current,
        collectedBananas: finalCollectedBananas,
        score: finalCollectedBananas,
      });
    },
    [minutes, normalizedSpeed, onFinish, totalSeconds]
  );

  const registerCollision = useCallback(
    (collisionId, collisionType = "animal") => {
      const now = performance.now();

      if (!startedRef.current || startProtectionRef.current > 0 ||
          now < invulnerableUntilRef.current) {
        return false;
      }

      if (collidedAnimalsRef.current.has(collisionId)) {
        return false;
      }

      collidedAnimalsRef.current.add(collisionId);
      invulnerableUntilRef.current = now + 1350;

      if (collisionType === "rock" && rockHitAudioRef.current) {
        rockHitAudioRef.current.currentTime = 0;
        rockHitAudioRef.current.play().catch(() => {});
      }

      setDamaged(true);
      window.clearTimeout(damageTimeoutRef.current);

      damageTimeoutRef.current = window.setTimeout(() => {
        setDamaged(false);
      }, 1350);

      setRemainingLives((currentLives) => {
        const nextLives = Math.max(0, currentLives - 1);
        remainingLivesRef.current = nextLives;
        return nextLives;
      });

      return true;
    },
    []
  );

  const registerBananaCollection = useCallback((banana) => {
    if (!banana || banana.collected) {
      return;
    }

    banana.collected = true;

    const nextCollectedBananas =
      collectedBananasRef.current + banana.value;

    collectedBananasRef.current = nextCollectedBananas;
    setCollectedBananas(nextCollectedBananas);

    if (collectAudioRef.current) {
      collectAudioRef.current.currentTime = 0;
      collectAudioRef.current.play().catch(() => {});
    }
  }, []);

  const checkCollisions = useCallback(
    (columns, currentMonkeyY) => {
      const { width } = dimensionsRef.current;
      const monkeyDimensions = getMonkeyDimensions();
      const spacing = getColumnSpacing();
      const monkeyX = width * 0.17;
      const currentGameSize = gameSizeRef.current;
      const currentScaleX = currentGameSize.width / GAME_WIDTH || 1;
      const currentScaleY = currentGameSize.height / GAME_HEIGHT || 1;
      const currentObjectScale = Math.min(currentScaleX, currentScaleY);

      // Las imágenes conservan su proporción. Sus tamaños visuales se
      // convierten nuevamente a coordenadas lógicas para que las colisiones
      // coincidan también en la pantalla de 1920 x 1080.
      const visualMonkeyWidth =
        (monkeyDimensions.width * currentObjectScale) / currentScaleX;
      const visualMonkeyHeight =
        (monkeyDimensions.height * currentObjectScale) / currentScaleY;

      /*
       * Hitbox centrada en el cuerpo del mono.
       * Se ignoran la cola, los brazos y los bordes transparentes.
       */
      const monkeyRectangle = {
        left: monkeyX + visualMonkeyWidth * 0.34,
        right: monkeyX + visualMonkeyWidth * 0.68,
        top: currentMonkeyY + visualMonkeyHeight * 0.27,
        bottom: currentMonkeyY + visualMonkeyHeight * 0.75,
      };

      for (const column of columns) {
        if (column.banana && !column.banana.collected) {
          const bananaSize = column.banana.size;
          const bananaInset = clamp(bananaSize * 0.18, 12, 18);
          const visualBananaHalfWidth =
            (bananaSize * currentObjectScale) / currentScaleX / 2;
          const visualBananaHalfHeight =
            (bananaSize * currentObjectScale) / currentScaleY / 2;
          const visualBananaInsetX =
            (bananaInset * currentObjectScale) / currentScaleX;
          const visualBananaInsetY =
            (bananaInset * currentObjectScale) / currentScaleY;

          const bananaRectangle = {
            left:
              column.x - visualBananaHalfWidth + visualBananaInsetX,
            right:
              column.x + visualBananaHalfWidth - visualBananaInsetX,
            top:
              column.banana.centerY -
              visualBananaHalfHeight +
              visualBananaInsetY,
            bottom:
              column.banana.centerY +
              visualBananaHalfHeight -
              visualBananaInsetY,
          };

          if (rectanglesIntersect(monkeyRectangle, bananaRectangle)) {
            registerBananaCollection(column.banana);
          }
        }

        /*
         * Colisión de la piedra con una hitbox reducida,
         * igual que en el nivel 2.
         */
        if (column.obstacle && !column.obstacle.hit) {
          const rockSize = column.obstacle.size;
          const rockInset = clamp(rockSize * 0.18, 16, 22);
          const visualRockHalfWidth =
            (rockSize * currentObjectScale) / currentScaleX / 2;
          const visualRockHalfHeight =
            (rockSize * currentObjectScale) / currentScaleY / 2;
          const visualRockInsetX =
            (rockInset * currentObjectScale) / currentScaleX;
          const visualRockInsetY =
            (rockInset * currentObjectScale) / currentScaleY;

          const rockRectangle = {
            left: column.x - visualRockHalfWidth + visualRockInsetX,
            right: column.x + visualRockHalfWidth - visualRockInsetX,
            top:
              column.obstacle.centerY -
              visualRockHalfHeight +
              visualRockInsetY,
            bottom:
              column.obstacle.centerY +
              visualRockHalfHeight -
              visualRockInsetY,
          };

          if (rectanglesIntersect(monkeyRectangle, rockRectangle)) {
            const registered = registerCollision(
              `${column.id}-rock`,
              "rock"
            );

            if (registered) {
              column.obstacle.hit = true;
            }

            return;
          }
        }

        /*
         * Las paredes usan una franja estrecha por columna,
         * evitando colisiones con el espacio transparente de los PNG.
         */
        const collisionHalfWidth = Math.min(spacing * 0.36, 42);

        const columnRectangle = {
          left: column.x - collisionHalfWidth,
          right: column.x + collisionHalfWidth,
        };

        const hasHorizontalOverlap =
          monkeyRectangle.left < columnRectangle.right &&
          monkeyRectangle.right > columnRectangle.left;

        if (!hasHorizontalOverlap) {
          continue;
        }

        const topCollisionLimit = column.gapTop - 8;
        const bottomCollisionLimit = column.gapBottom + 12;

        const touchesTopWall =
          monkeyRectangle.top < topCollisionLimit;

        const touchesBottomWall =
          monkeyRectangle.bottom > bottomCollisionLimit;

        if (touchesTopWall) {
          registerCollision(`${column.id}-top`);
          return;
        }

        if (touchesBottomWall) {
          registerCollision(`${column.id}-bottom`);
          return;
        }
      }
    },
    [
      getColumnSpacing,
      getMonkeyDimensions,
      registerBananaCollection,
      registerCollision,
    ]
  );

  const updateGame = useCallback(
    (timestamp) => {
      if (finishedRef.current) {
        return;
      }

      if (previousFrameTimeRef.current === null) {
        previousFrameTimeRef.current = timestamp;
      }

      const elapsedMilliseconds =
        timestamp - previousFrameTimeRef.current;

      previousFrameTimeRef.current = timestamp;

      const deltaTime = Math.min(elapsedMilliseconds / 1000, 0.04);

      if (!pausedRef.current) {
        const { width, height } = dimensionsRef.current;
        const monkeyDimensions = getMonkeyDimensions();
        const maximumMonkeyY = height - monkeyDimensions.height;

        targetMonkeyYRef.current = clamp(
          targetMonkeyYRef.current,
          0,
          maximumMonkeyY
        );

        const movementSmoothness = Math.min(1, deltaTime * 12);

        monkeyYRef.current +=
          (targetMonkeyYRef.current - monkeyYRef.current) *
          movementSmoothness;

        monkeyYRef.current = clamp(
          monkeyYRef.current,
          0,
          maximumMonkeyY
        );

        if (!startedRef.current) {
          const centerY = (height - monkeyDimensions.height) / 2;
          const isCentered =
            Math.abs(monkeyYRef.current - centerY) <= 55 &&
            Math.abs(targetMonkeyYRef.current - centerY) <= 55;
          setCentered(isCentered);
          preparationSecondsRef.current = isCentered
            ? preparationSecondsRef.current + deltaTime
            : 0;
          setCountdown(Math.max(1, 3 - Math.floor(preparationSecondsRef.current)));
          setGameFrame((frame) => ({ ...frame, monkeyY: monkeyYRef.current }));

          if (preparationSecondsRef.current >= 3) {
            startedRef.current = true;
            startProtectionRef.current = 2;
            setStarted(true);
          }
          animationFrameRef.current = requestAnimationFrame(updateGame);
          return;
        }

        startProtectionRef.current = Math.max(0, startProtectionRef.current - deltaTime);
        const movementSpeed = SPEED_VALUES[normalizedSpeed];
        const movement = movementSpeed * deltaTime;
        const spacing = getColumnSpacing();

        let movedColumns = columnsRef.current.map((column) => ({
          ...column,
          x: column.x - movement,
        }));

        movedColumns.sort((columnA, columnB) => columnA.x - columnB.x);

        let furthestX = Math.max(
          width,
          ...movedColumns.map((column) => column.x)
        );

        movedColumns = movedColumns.map((column) => {
          const largestWidth = Math.max(
            column.topAnimal.width,
            column.bottomAnimal.width,
            column.obstacle?.size ?? 0,
            column.banana?.size ?? 0
          );

          if (column.x + largestWidth < -140) {
            furthestX += spacing;
            return createColumn(furthestX);
          }

          return column;
        });

        movedColumns.sort((columnA, columnB) => columnA.x - columnB.x);

        checkCollisions(movedColumns, monkeyYRef.current);
        columnsRef.current = movedColumns;

        setGameFrame((currentFrame) => ({
          monkeyY: monkeyYRef.current,
          backgroundX: currentFrame.backgroundX - movement * 0.46,
          columns: movedColumns,
        }));
      }

      animationFrameRef.current = requestAnimationFrame(updateGame);
    },
    [
      checkCollisions,
      createColumn,
      getColumnSpacing,
      getMonkeyDimensions,
      normalizedSpeed,
    ]
  );

  const updateMonkeyTarget = useCallback(
    (clientY) => {
      if (pausedRef.current) {
        return;
      }

      const container = containerRef.current;

      if (!container) {
        return;
      }

      const rectangle = container.getBoundingClientRect();
      const monkeyDimensions = getMonkeyDimensions();
      const normalizedY = clamp(
        (clientY - rectangle.top) / (rectangle.height || 1),
        0,
        1
      );

      targetMonkeyYRef.current = clamp(
        normalizedY * GAME_HEIGHT - monkeyDimensions.height / 2,
        0,
        GAME_HEIGHT - monkeyDimensions.height
      );
    },
    [getMonkeyDimensions]
  );

  const handlePointerMove = useCallback(
    (event) => {
      updateMonkeyTarget(event.clientY);
    },
    [updateMonkeyTarget]
  );

  const handlePause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
    setPauseModalOpen(true);
  }, []);

  const handleResume = useCallback(() => {
    previousFrameTimeRef.current = null;
    pausedRef.current = false;
    setPaused(false);
    setPauseModalOpen(false);
  }, []);

  const handleTerminate = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
    setPauseModalOpen(false);

    if (onFinish) {
      finishGame("terminated");
      return;
    }

    onBack?.();
  }, [finishGame, onBack, onFinish]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const updateDimensions = () => {
      // clientWidth/clientHeight entregan el tamaño lógico real del elemento.
      // getBoundingClientRect puede venir transformado por ALBA y producir
      // un escalado doble en pantallas grandes.
      const width = container.clientWidth || GAME_WIDTH;
      const height = container.clientHeight || GAME_HEIGHT;

      if (width <= 0 || height <= 0) {
        return;
      }

      const nextSize = { width, height };
      gameSizeRef.current = nextSize;

      setGameSize((previousSize) => {
        const sameWidth = Math.abs(previousSize.width - width) < 0.5;
        const sameHeight = Math.abs(previousSize.height - height) < 0.5;

        return sameWidth && sameHeight ? previousSize : nextSize;
      });

      if (!initializedRef.current) {
        initializedRef.current = true;
        initializeGame();
      }
    };

    updateDimensions();

    let resizeObserver;

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(container);
    } else {
      window.addEventListener("resize", updateDimensions);
    }

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, [initializeGame]);

  useEffect(() => {
    const handleMessage = (event) => {
      const data = event?.data;

      if (!data || typeof data !== "object") {
        return;
      }

      if (data.type === "setup") {
        sensorAreaRef.current = getEffectiveAlbaArea({
          x: data.offsetX ?? data.offset?.left,
          y: data.offsetY ?? data.offset?.top,
          width: data.width,
          height: data.height,
        });

        return;
      }

      if (
        data.type === "cursor" &&
        typeof data.y === "number" &&
        !pausedRef.current
      ) {
        const container = containerRef.current;

        if (!container) {
          return;
        }

        const area = sensorAreaRef.current;
        const monkeyDimensions = getMonkeyDimensions();

        const normalizedY = clamp(
          (data.y - area.y) / (area.height || 1),
          0,
          1
        );

        targetMonkeyYRef.current = clamp(
          normalizedY * GAME_HEIGHT - monkeyDimensions.height / 2,
          0,
          GAME_HEIGHT - monkeyDimensions.height
        );
      }
    };

    window.addEventListener("message", handleMessage, false);

    return () => {
      window.removeEventListener("message", handleMessage, false);
    };
  }, [getMonkeyDimensions]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (pausedRef.current) {
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        targetMonkeyYRef.current -= 90;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        targetMonkeyYRef.current += 90;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const collectUrl = getSoundUrl("collect.wav");

    if (!collectUrl) {
      return undefined;
    }

    const audio = new Audio(collectUrl);
    audio.volume = 0.85;
    collectAudioRef.current = audio;

    return () => {
      audio.pause();
      audio.currentTime = 0;

      if (collectAudioRef.current === audio) {
        collectAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const rockHitUrl = getSoundUrl("rockhit.mp3");

    if (!rockHitUrl) {
      return undefined;
    }

    const audio = new Audio(rockHitUrl);
    audio.volume = 0.75;
    rockHitAudioRef.current = audio;

    return () => {
      audio.pause();
      audio.currentTime = 0;

      if (rockHitAudioRef.current === audio) {
        rockHitAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!musicUrl) {
      return undefined;
    }

    const audio = new Audio(musicUrl);
    audio.loop = true;
    audio.volume = 0.35;
    musicRef.current = audio;

    const startMusic = () => {
      audio.play().catch(() => {});
    };

    startMusic();

    window.addEventListener("pointerdown", startMusic, {
      once: true,
    });

    return () => {
      window.removeEventListener("pointerdown", startMusic);
      audio.pause();
      audio.currentTime = 0;

      if (musicRef.current === audio) {
        musicRef.current = null;
      }
    };
  }, [musicUrl]);

  useEffect(() => {
    const audio = musicRef.current;

    if (!audio) {
      return;
    }

    if (paused) {
      audio.pause();
      return;
    }

    audio.play().catch(() => {});
  }, [paused]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(updateGame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateGame]);

  useEffect(() => {
    if (!started || paused || finishedRef.current) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((currentTime) => {
        const nextTime = Math.max(0, currentTime - 1);
        timeLeftRef.current = nextTime;
        return nextTime;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [paused, started]);

  useEffect(() => {
    if (timeLeft <= 0) {
      finishGame("time-completed");
    }
  }, [finishGame, timeLeft]);

  useEffect(() => {
    if (remainingLives <= 0) {
      finishGame("no-lives");
    }
  }, [finishGame, remainingLives]);

  useEffect(() => {
    return () => {
      window.clearTimeout(damageTimeoutRef.current);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (musicRef.current) {
        musicRef.current.pause();
      }

      if (rockHitAudioRef.current) {
        rockHitAudioRef.current.pause();
      }

      if (collectAudioRef.current) {
        collectAudioRef.current.pause();
      }
    };
  }, []);

  const monkeyDimensions = getMonkeyDimensions();

  const formattedMinutes = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");

  const formattedSeconds = Math.floor(timeLeft % 60)
    .toString()
    .padStart(2, "0");

  const scaleX = gameSize.width / GAME_WIDTH;
  const scaleY = gameSize.height / GAME_HEIGHT;
  const objectScale = Math.min(scaleX, scaleY);

  return (
    <Box
      ref={containerRef}
      onPointerMove={handlePointerMove}
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        backgroundColor: "#245B34",
        backgroundImage: `url(${fondoSelva3})`,
        backgroundRepeat: "repeat-x",
        backgroundSize: "auto 100%",
        backgroundPositionX: `${gameFrame.backgroundX * scaleX}px`,
        backgroundPositionY: "center",
        touchAction: "none",
        userSelect: "none",
      }}
    >
      {damaged && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 90,
            pointerEvents: "none",
            backgroundColor: "rgba(255, 45, 45, 0.25)",
          }}
        />
      )}

      <Box
        sx={{
          position: "absolute",
          top: px(20),
          left: px(24),
          zIndex: 100,
          minWidth: px(170),
          padding: `${px(10)} ${px(22)}`,
          borderRadius: px(24),
          backgroundColor: "rgba(17, 7, 52, 0.87)",
          border: `${px(3)} solid white`,
          boxShadow: `0 ${px(8)} ${px(16)} rgba(0,0,0,0.3)`,
          backdropFilter: "blur(5px)",
        }}
      >
        <Typography
          sx={{
            color: "white",
            fontWeight: "bold",
            fontSize: px(18),
            textAlign: "center",
            lineHeight: 1,
          }}
        >
          TIEMPO
        </Typography>

        <Typography
          sx={{
            color: "white",
            fontWeight: "bold",
            fontSize: px(31),
            textAlign: "center",
            lineHeight: 1.1,
            marginTop: px(5),
          }}
        >
          {formattedMinutes}:{formattedSeconds}
        </Typography>
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: px(112),
          left: px(24),
          zIndex: 100,
          minWidth: px(170),
          padding: `${px(9)} ${px(20)}`,
          borderRadius: px(22),
          backgroundColor: "rgba(255, 248, 246, 0.92)",
          border: `${px(3)} solid #4955A8`,
          boxShadow: `0 ${px(8)} ${px(16)} rgba(0,0,0,0.25)`,
          backdropFilter: "blur(5px)",
        }}
      >
        <Typography
          sx={{
            color: "#4955A8",
            fontWeight: "bold",
            fontSize: px(17),
            textAlign: "center",
            lineHeight: 1,
          }}
        >
          PLÁTANOS
        </Typography>

        <Typography
          sx={{
            color: "#4955A8",
            fontWeight: "bold",
            fontSize: px(31),
            textAlign: "center",
            lineHeight: 1.1,
            marginTop: px(5),
          }}
        >
          🍌 {collectedBananas}
        </Typography>
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: px(20),
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: px(8),
          padding: `${px(10)} ${px(24)}`,
          borderRadius: px(24),
          backgroundColor: "rgba(17, 7, 52, 0.87)",
          border: `${px(3)} solid white`,
          boxShadow: `0 ${px(8)} ${px(16)} rgba(0,0,0,0.3)`,
          backdropFilter: "blur(5px)",
        }}
      >
        {Array.from({ length: initialLivesRef.current }).map((_, index) => {
          const active = index < remainingLives;

          return (
            <Typography
              key={`life-${index}`}
              component="span"
              sx={{
                color: active ? "#FF5B67" : "#8A879A",
                opacity: active ? 1 : 0.55,
                fontSize: px(37),
                fontWeight: "bold",
                lineHeight: 1,
              }}
            >
              ♥
            </Typography>
          );
        })}
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: px(20),
          right: px(145),
          zIndex: 100,
          padding: `${px(11)} ${px(23)}`,
          borderRadius: px(23),
          backgroundColor: "rgba(17, 7, 52, 0.87)",
          border: `${px(3)} solid white`,
          boxShadow: `0 ${px(8)} ${px(16)} rgba(0,0,0,0.3)`,
        }}
      >
        <Typography
          sx={{
            color: "white",
            fontSize: px(25),
            fontWeight: "bold",
          }}
        >
          x{normalizedSpeed}
        </Typography>
      </Box>

      <IconButton
        onClick={handlePause}
        sx={{
          position: "absolute",
          top: px(20),
          right: px(24),
          zIndex: 110,
          width: px(92),
          height: px(88),
          borderRadius: "50%",
          backgroundColor: "#FF6B55",
          border: `${px(3)} solid white`,
          boxShadow: `${px(6)} ${px(7)} ${px(8)} rgba(25,34,69,0.6)`,
          "&:hover": {
            backgroundColor: "#FF5733",
          },
        }}
      >
        <PauseRoundedIcon
          sx={{
            color: "white",
            fontSize: px(48),
          }}
        />
      </IconButton>

      {gameFrame.columns.map((column) => {
        const topImageLeft =
          (column.x + column.topAnimal.offsetX) * scaleX -
          (column.topAnimal.width * objectScale) / 2;

        const topImageTop =
          (column.gapTop + column.topAnimal.intrusion) * scaleY -
          column.topAnimal.height * objectScale;

        const bottomImageLeft =
          (column.x + column.bottomAnimal.offsetX) * scaleX -
          (column.bottomAnimal.width * objectScale) / 2;

        const bottomImageTop = column.gapBottom;

        return (
          <Box
            key={column.id}
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              pointerEvents: "none",
            }}
          >
            <Box
              component="img"
              src={column.topAnimal.image}
              alt=""
              draggable={false}
              sx={{
                position: "absolute",
                left: `${topImageLeft}px`,
                top: `${topImageTop}px`,
                width: `${column.topAnimal.width * objectScale}px`,
                height: `${column.topAnimal.height * objectScale}px`,
                objectFit: "fill",
                objectPosition: "center top",
                userSelect: "none",
                filter: "drop-shadow(0 10px 6px rgba(0,0,0,0.42))",
              }}
            />

            <Box
              component="img"
              src={column.bottomAnimal.image}
              alt=""
              draggable={false}
              sx={{
                position: "absolute",
                left: `${bottomImageLeft}px`,
                top: `${bottomImageTop * scaleY}px`,
                width: `${column.bottomAnimal.width * objectScale}px`,
                height: `${column.bottomAnimal.height * objectScale}px`,
                objectFit: "contain",
                objectPosition: "center top",
                userSelect: "none",
                filter: "drop-shadow(0 10px 6px rgba(0,0,0,0.42))",
              }}
            />


            {column.banana && !column.banana.collected && (
              <Box
                component="img"
                src={column.banana.image}
                alt="Plátano"
                draggable={false}
                sx={{
                  position: "absolute",
                  left: `${
                    column.x * scaleX -
                    (column.banana.size * objectScale) / 2
                  }px`,
                  top: `${
                    column.banana.centerY * scaleY -
                    (column.banana.size * objectScale) / 2
                  }px`,
                  width: `${column.banana.size * objectScale}px`,
                  height: `${column.banana.size * objectScale}px`,
                  objectFit: "contain",
                  transform: `rotate(${column.banana.rotation}deg)`,
                  userSelect: "none",
                  filter:
                    "drop-shadow(-5px 8px 3px rgba(33,44,81,0.35))",
                }}
              />
            )}

            {column.obstacle && !column.obstacle.hit && (
              <Box
                component="img"
                src={column.obstacle.image}
                alt="Piedra"
                draggable={false}
                sx={{
                  position: "absolute",
                  left: `${
                    column.x * scaleX -
                    (column.obstacle.size * objectScale) / 2
                  }px`,
                  top: `${
                    column.obstacle.centerY * scaleY -
                    (column.obstacle.size * objectScale) / 2
                  }px`,
                  width: `${column.obstacle.size * objectScale}px`,
                  height: `${column.obstacle.size * objectScale}px`,
                  objectFit: "contain",
                  transform: `rotate(${column.obstacle.rotation}deg)`,
                  userSelect: "none",
                  filter:
                    "drop-shadow(-6px 9px 3px rgba(33,44,81,0.45))",
                }}
              />
            )}
          </Box>
        );
      })}

      <Box
        component="img"
        src={monoJuego}
        alt="Mono"
        draggable={false}
        sx={{
          position: "absolute",
          left: "17%",
          top: `${gameFrame.monkeyY * scaleY}px`,
          width: `${monkeyDimensions.width * objectScale}px`,
          height: `${monkeyDimensions.height * objectScale}px`,
          objectFit: "contain",
          zIndex: 60,
          pointerEvents: "none",
          userSelect: "none",
          filter: damaged
            ? "drop-shadow(0 0 18px white)"
            : "drop-shadow(0 10px 6px rgba(0,0,0,0.4))",
          animation: damaged
            ? "monkeyDamage 0.17s infinite alternate"
            : "none",
          "@keyframes monkeyDamage": {
            from: {
              opacity: 0.25,
            },
            to: {
              opacity: 1,
            },
          },
        }}
      />

      {!started && (
        <Box sx={{ position: "absolute", inset: 0, zIndex: 105, pointerEvents: "none" }}>
          <Box sx={{
            position: "absolute", left: "15%", top: "50%",
            transform: "translateY(-50%)", width: `${monkeyDimensions.width * objectScale + 32 * objectScale}px`,
            height: `${(monkeyDimensions.height + 110) * scaleY}px`,
            border: `${px(4)} dashed ${centered ? "#BBF7A5" : "#FFE18A"}`,
            borderRadius: px(30), backgroundColor: "rgba(255,255,255,0.10)",
          }} />
          <Box sx={{
            position: "absolute", left: "40%", right: "8%", top: "50%",
            transform: "translateY(-50%)", padding: px(26),
            borderRadius: px(28), backgroundColor: "rgba(17, 7, 52, 0.93)",
            border: `${px(3)} solid white`, color: "white", textAlign: "center",
            boxShadow: `0 ${px(10)} ${px(30)} rgba(0,0,0,0.3)`,
          }}>
            <Typography sx={{ fontSize: px(32), fontWeight: 800, lineHeight: 1.2 }}>
              Posiciónate al centro de la pantalla
            </Typography>
            <Typography sx={{ fontSize: px(21), marginTop: px(14) }}>
              {centered ? "¡Muy bien! Mantén el mono dentro de la zona marcada." : "Mueve el mono hacia la zona marcada para comenzar."}
            </Typography>
            <Typography role="status" aria-live="polite" sx={{
              fontSize: px(88), fontWeight: 900, lineHeight: 1.1,
              marginTop: px(12), color: centered ? "#BBF7A5" : "#FFE18A",
            }}>
              {countdown}
            </Typography>
          </Box>
        </Box>
      )}

      {pauseModalOpen && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 200,
            backgroundColor: "rgba(17, 7, 52, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "none",
          }}
        >
          <Box
            sx={{
              width: px(520),
              maxWidth: "82%",
              backgroundColor: "#FFF8F6",
              borderRadius: px(30),
              border: `${px(4)} solid #4955A8`,
              boxShadow: `${px(-12)} ${px(12)} 0 #323B79`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              paddingX: px(40),
              paddingY: px(40),
              gap: px(24),
            }}
          >
            <Typography
              sx={{
                color: "#4955A8",
                fontSize: px(58),
                fontWeight: "bold",
                lineHeight: 1,
                textAlign: "center",
              }}
            >
              Pausa
            </Typography>

            <Typography
              sx={{
                color: "#4955A8",
                fontSize: px(28),
                fontWeight: "bold",
                textAlign: "center",
                lineHeight: 1.15,
                maxWidth: px(420),
              }}
            >
              ¿Qué quieres hacer?
            </Typography>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: px(24),
                marginTop: px(8),
              }}
            >
              <Button
                onClick={handleResume}
                sx={{
                  width: px(190),
                  height: px(66),
                  backgroundColor: "#4955A8",
                  color: "white",
                  borderRadius: px(18),
                  fontSize: px(24),
                  fontWeight: "bold",
                  textTransform: "none",
                  boxShadow: `${px(-6)} ${px(6)} 0 #323B79`,
                  border: `${px(3)} solid #323B79`,
                  touchAction: "manipulation",
                  "&:hover": {
                    backgroundColor: "#3F4A99",
                  },
                }}
              >
                Reanudar
              </Button>

              <Button
                onClick={handleTerminate}
                sx={{
                  width: px(190),
                  height: px(66),
                  backgroundColor: "#FF6B55",
                  color: "white",
                  borderRadius: px(18),
                  fontSize: px(24),
                  fontWeight: "bold",
                  textTransform: "none",
                  boxShadow: `${px(6)} ${px(6)} 0 #2A3D6B`,
                  border: `${px(3)} solid #2A3D6B`,
                  touchAction: "manipulation",
                  "&:hover": {
                    backgroundColor: "#FF5733",
                  },
                }}
              >
                Terminar
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}