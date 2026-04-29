import { selectRandomAvailableNumbers } from './random-ticket-selection.util';

describe('selectRandomAvailableNumbers', () => {
  it('uses random indexes instead of returning the first available numbers', () => {
    const deterministicIndexes = [9, 8, 7];
    const randomInteger = jest.fn(
      (minInclusive: number, _maxExclusive: number) =>
        deterministicIndexes.shift() ?? minInclusive,
    );

    const selectedNumbers = selectRandomAvailableNumbers(
      new Set<number>(),
      100,
      3,
      randomInteger,
    );

    expect(selectedNumbers).toEqual([10, 9, 8]);
    expect(randomInteger).toHaveBeenNthCalledWith(1, 0, 100);
    expect(randomInteger).toHaveBeenNthCalledWith(2, 1, 100);
    expect(randomInteger).toHaveBeenNthCalledWith(3, 2, 100);
  });

  it('only selects available numbers', () => {
    const selectedNumbers = selectRandomAvailableNumbers(
      new Set<number>([1, 2, 3]),
      5,
      3,
      (minInclusive) => minInclusive,
    );

    expect(selectedNumbers).toEqual([4, 5]);
  });
});
