import MinutesSelection from "./MinutesSelection";

export default function LivesSelection({
  lives,
  setLives,
  onBack,
  onNext,
  min = 1,
  max = 5,
}) {
  return (
    <MinutesSelection
      minutes={lives}
      setMinutes={setLives}
      onBack={onBack}
      onNext={onNext}
      title="¿Cuántas vidas vas a tener?"
      unit="vidas"
      min={min}
      max={max}
    />
  );
}