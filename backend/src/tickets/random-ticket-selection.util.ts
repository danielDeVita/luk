import { randomInt } from 'crypto';

type RandomInteger = (minInclusive: number, maxExclusive: number) => number;

export function selectRandomAvailableNumbers(
  usedNumbers: Set<number>,
  totalTickets: number,
  quantity: number,
  randomInteger: RandomInteger = randomInt,
): number[] {
  const availableNumbers: number[] = [];

  for (let number = 1; number <= totalTickets; number += 1) {
    if (!usedNumbers.has(number)) {
      availableNumbers.push(number);
    }
  }

  const selectedNumbers: number[] = [];
  const drawCount = Math.min(quantity, availableNumbers.length);

  for (let index = 0; index < drawCount; index += 1) {
    const randomIndex = randomInteger(index, availableNumbers.length);
    [availableNumbers[index], availableNumbers[randomIndex]] = [
      availableNumbers[randomIndex],
      availableNumbers[index],
    ];
    selectedNumbers.push(availableNumbers[index]);
  }

  return selectedNumbers;
}
