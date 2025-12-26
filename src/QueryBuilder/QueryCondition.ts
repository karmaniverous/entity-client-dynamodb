import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';

import type { IndexParams } from './IndexParams';

/**
 * Eliminates object types from the `NativeScalarAttributeValue` type.
 *
 * @category QueryBuilder
 */
export type ActuallyScalarAttributeValue = Exclude<
  NativeScalarAttributeValue,
  object
>;

/**
 * Base interface for all query conditions.
 * Each specific condition extends this with its own type constraints.
 *
 * @category QueryBuilder
 */
export interface QueryCondition {
  /** Operator discriminator used to select the condition type. */
  operator: string;
}

/**
 * Query condition for the `begins_with` operator.
 *
 * @category QueryBuilder
 */
export interface QueryConditionBeginsWith extends QueryCondition {
  /** Attribute/property name in the DynamoDB item. */
  property: string;
  /** Operator discriminator. */
  operator: 'begins_with';
  /** Value passed to `begins_with(...)`. Omitted/empty values result in no condition being added. */
  value?: string | undefined;
}

/**
 * Query condition for the `between` operator.
 * Ensures that both `from` and `to` are of the same type.
 *
 * @category QueryBuilder
 */
export interface QueryConditionBetween<
  V extends ActuallyScalarAttributeValue,
> extends QueryCondition {
  /** Attribute/property name in the DynamoDB item. */
  property: string;
  /** Operator discriminator. */
  operator: 'between';
  /** Inclusive bounds. If both are missing, no condition is added. */
  value: { from?: V | undefined; to?: V | undefined };
}

/**
 * Query condition for comparison operators.
 *
 * @category QueryBuilder
 */
export interface QueryConditionComparison<
  V extends ActuallyScalarAttributeValue,
> extends QueryCondition {
  /** Attribute/property name in the DynamoDB item. */
  property: string;
  /** Operator discriminator. */
  operator: '<' | '<=' | '<>' | '=' | '>' | '>=';
  /** Value to compare against. Missing values result in no condition being added. */
  value?: V | undefined;
}

/**
 * Query condition for contains operator.
 *
 * @category QueryBuilder
 */
export interface QueryConditionContains<
  V extends Exclude<NativeScalarAttributeValue, object>,
> extends QueryCondition {
  /** Attribute/property name in the DynamoDB item. */
  property: string;
  /** Operator discriminator. */
  operator: 'contains';
  /** Value passed to `contains(...)`. Missing values result in no condition being added. */
  value?: V | undefined;
}

/**
 * Query condition for attribute existence checks.
 *
 * @category QueryBuilder
 */
export interface QueryConditionExists extends QueryCondition {
  /** Attribute/property name in the DynamoDB item. */
  property: string;
  /** Operator discriminator. */
  operator: 'attribute_exists' | 'attribute_not_exists';
}

/**
 * Query condition for the `in` operator.
 * Ensures that all elements in the array or set are of the same type.
 *
 * @category QueryBuilder
 */
export interface QueryConditionIn<
  V extends NativeScalarAttributeValue,
> extends QueryCondition {
  /** Attribute/property name in the DynamoDB item. */
  property: string;
  /** Operator discriminator. */
  operator: 'in';
  /** Values for the IN list. Missing/empty values result in no condition being added. */
  value?: V[] | Set<V> | undefined;
}

/**
 * Grouping of multiple query conditions using logical operators.
 * Allows for nesting of conditions.
 *
 * @category QueryBuilder
 */
export interface QueryConditionGroup<C extends QueryCondition> {
  /** Operator discriminator. */
  operator: 'and' | 'or';
  /** Child conditions to join. */
  conditions: C[];
}

/**
 * Negation of a single filter condition.
 *
 * @category QueryBuilder
 */
export interface QueryConditionNot<C extends QueryCondition> {
  /** Operator discriminator. */
  operator: 'not';
  /** Condition to negate. */
  condition: C;
}

/**
 * Minimal builder shape required by condition helpers.
 * - indexParamsMap: per-index mutable params
 * - entityClient.logger: debug/error logging
 */
export interface MinimalBuilder {
  /** Per-index mutable query parameters used to build expressions. */
  indexParamsMap: Record<string, IndexParams>;
  /** Logger used by helper functions (debug/error). */
  entityClient: { logger: Pick<Console, 'debug' | 'error'> };
}

/**
 * Function signature for composing a condition string and mutating the builder’s expression maps.
 *
 * @typeParam B - Builder type.
 * @typeParam Q - Condition type.
 *
 * @category QueryBuilder
 */
export type ComposeCondition<B, Q extends QueryCondition> = (
  builder: B,
  indexToken: string,
  condition: Q,
) => string | undefined;
