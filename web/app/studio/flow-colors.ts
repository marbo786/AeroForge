export function cpColor(cp: number) {
  const fraction = Math.max(0, Math.min(1, (cp + 3) / 4));
  const low = [71, 161, 255];
  const high = [255, 151, 75];
  return `#${low
    .map((value, i) =>
      Math.round(value + fraction * (high[i] - value))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
