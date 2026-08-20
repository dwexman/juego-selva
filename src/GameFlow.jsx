import { useState } from "react";
import LevelSelection from "./screens/LevelSelection";
import MinutesSelection from "./screens/MinutesSelection";
import LivesSelection from "./screens/LivesSelection";
import SpeedSelection from "./screens/SpeedSelection";
import LevelOneGame from "./screens/LevelOneGame";
import LevelTwoGame from "./screens/LevelTwoGame";
import LevelThreeGame from "./screens/LevelThreeGame";
import ResultScreen from "./screens/ResultScreen";

export default function GameFlow() {
  const [screen, setScreen] = useState("level");

  const [selectedLevel, setSelectedLevel] = useState(null);

  const [minutes, setMinutes] = useState(1);
  const [lives, setLives] = useState(3);
  const [speed, setSpeed] = useState(1);

  const [result, setResult] = useState(null);
  const [gameKey, setGameKey] = useState(0);

  const handleExit = () => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "quit",
        },
        "*"
      );

      return;
    }

    console.log("Salir del juego");
  };

  const handleLevelNext = () => {
    setScreen("minutes");
  };

  const handleMinutesBack = () => {
    setScreen("level");
  };

  const handleMinutesNext = () => {
    if (selectedLevel === 2 || selectedLevel === 3) {
      setScreen("lives");
      return;
    }

    if (selectedLevel === 1) {
      setScreen("speed");
      return;
    }

    setGameKey((previous) => previous + 1);
    setScreen("game");
  };

  const handleLivesBack = () => {
    setScreen("minutes");
  };

  const handleLivesNext = () => {
    if (selectedLevel === 2 || selectedLevel === 3) {
      setScreen("speed");
      return;
    }

    setGameKey((previous) => previous + 1);
    setScreen("game");
  };

  const handleSpeedBack = () => {
    if (selectedLevel === 1) {
      setScreen("minutes");
      return;
    }

    if (selectedLevel === 2 || selectedLevel === 3) {
      setScreen("lives");
      return;
    }

    setScreen("minutes");
  };

  const handleSpeedNext = () => {
    setGameKey((previous) => previous + 1);
    setScreen("game");
  };

  const handleGameBack = () => {
    if (selectedLevel === 1 || selectedLevel === 2 || selectedLevel === 3) {
      setScreen("speed");
      return;
    }

    setScreen("minutes");
  };

  const handleGameFinish = (gameResult) => {
    setResult(gameResult);
    setScreen("result");
  };

  const handleResultBack = () => {
    setScreen("level");
    setSelectedLevel(null);
    setMinutes(1);
    setLives(3);
    setSpeed(1);
    setResult(null);
  };

  const handleReplay = () => {
    setResult(null);
    setGameKey((previous) => previous + 1);
    setScreen("game");
  };

  if (screen === "minutes") {
    return (
      <MinutesSelection
        minutes={minutes}
        setMinutes={setMinutes}
        onBack={handleMinutesBack}
        onNext={handleMinutesNext}
        min={1}
        max={10}
      />
    );
  }

  if (screen === "lives") {
    return (
      <LivesSelection
        lives={lives}
        setLives={setLives}
        onBack={handleLivesBack}
        onNext={handleLivesNext}
        min={1}
        max={5}
      />
    );
  }

  if (screen === "speed") {
    return (
      <SpeedSelection
        speed={speed}
        setSpeed={setSpeed}
        onBack={handleSpeedBack}
        onNext={handleSpeedNext}
      />
    );
  }

  if (screen === "game") {
    if (selectedLevel === 3) {
      return (
        <LevelThreeGame
          key={gameKey}
          minutes={minutes}
          lives={lives}
          speed={speed}
          onBack={handleGameBack}
          onFinish={handleGameFinish}
        />
      );
    }

    if (selectedLevel === 2) {
      return (
        <LevelTwoGame
          key={gameKey}
          minutes={minutes}
          lives={lives}
          speed={speed}
          onBack={handleGameBack}
          onFinish={handleGameFinish}
        />
      );
    }

    return (
      <LevelOneGame
        key={gameKey}
        minutes={minutes}
        speed={speed}
        onBack={handleGameBack}
        onFinish={handleGameFinish}
      />
    );
  }

  if (screen === "result") {
    return (
      <ResultScreen
        result={result}
        onBack={handleResultBack}
        onReplay={handleReplay}
      />
    );
  }

  return (
    <LevelSelection
      selectedLevel={selectedLevel}
      setSelectedLevel={setSelectedLevel}
      onBack={handleExit}
      onNext={handleLevelNext}
    />
  );
}
