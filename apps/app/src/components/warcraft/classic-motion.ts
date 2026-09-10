const durationSeconds = 0.62;
const frequency = 24;
const dampingRatio = 0.86;
const dampedFrequency = frequency * Math.sqrt(1 - dampingRatio ** 2);

export const windowSpring = `linear(${Array.from({ length: 81 }, (_, index) => {
  if (index === 80) return 1;
  const time = (index / 80) * durationSeconds;
  const displacement =
    Math.exp(-dampingRatio * frequency * time) *
    (Math.cos(dampedFrequency * time) +
      ((dampingRatio * frequency) / dampedFrequency) *
        Math.sin(dampedFrequency * time));
  return Number((1 - displacement).toFixed(6));
}).join(", ")})`;
