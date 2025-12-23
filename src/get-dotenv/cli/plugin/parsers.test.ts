import { InvalidArgumentError } from '@commander-js/extra-typings';
import { describe, expect, it } from 'vitest';

import {
  parseFiniteNumber,
  parseNonNegativeInt,
  parsePositiveInt,
} from './parsers';

describe('dynamodb CLI parsers', () => {
  describe('parseFiniteNumber', () => {
    it('parses finite numbers', () => {
      const p = parseFiniteNumber('n');
      expect(p('1')).to.equal(1);
      expect(p('1.5')).to.equal(1.5);
      expect(p(' 2 ')).to.equal(2);
    });

    it('rejects non-finite numbers', () => {
      const p = parseFiniteNumber('n');
      expect(() => p('NaN')).to.throw(
        InvalidArgumentError,
        /n must be a number/,
      );
      expect(() => p('Infinity')).to.throw(
        InvalidArgumentError,
        /n must be a number/,
      );
      expect(() => p('-Infinity')).to.throw(
        InvalidArgumentError,
        /n must be a number/,
      );
    });
  });

  describe('parsePositiveInt', () => {
    it('parses positive integers', () => {
      const p = parsePositiveInt('x');
      expect(p('1')).to.equal(1);
      expect(p('10')).to.equal(10);
    });

    it('rejects zero, negatives, and non-integers', () => {
      const p = parsePositiveInt('x');
      expect(() => p('0')).to.throw(
        InvalidArgumentError,
        /x must be a positive integer/,
      );
      expect(() => p('-1')).to.throw(
        InvalidArgumentError,
        /x must be a positive integer/,
      );
      expect(() => p('1.1')).to.throw(
        InvalidArgumentError,
        /x must be a positive integer/,
      );
    });
  });

  describe('parseNonNegativeInt', () => {
    it('parses non-negative integers (including 0)', () => {
      const p = parseNonNegativeInt('k');
      expect(p('0')).to.equal(0);
      expect(p('2')).to.equal(2);
    });

    it('rejects negatives and non-integers', () => {
      const p = parseNonNegativeInt('k');
      expect(() => p('-1')).to.throw(
        InvalidArgumentError,
        /k must be a non-negative integer/,
      );
      expect(() => p('2.2')).to.throw(
        InvalidArgumentError,
        /k must be a non-negative integer/,
      );
    });
  });
});
