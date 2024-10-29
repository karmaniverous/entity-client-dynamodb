import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';

import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export type ActuallyScalarAttributeValue = Exclude<
  NativeScalarAttributeValue,
  object
>;

/**
 * Base interface for all query conditions.
 * Each specific condition extends this with its own type constraints.
 *
 * @category ShardQueryMap Builder
 * @protected
 */
export interface QueryCondition {
  operator: string;
}

/**
 * Query condition for the `begins_with` operator.
 *
 * @category ShardQueryMap Builder
 * @protected
 */
export interface QueryConditionBeginsWith extends QueryCondition {
  property: string;
  operator: 'begins_with';
  value?: string;
}

/**
 * Query condition for the `between` operator.
 * Ensures that both `from` and `to` are of the same type.
 *
 * @category ShardQueryMap Builder
 * @protected
 */
export interface QueryConditionBetween<T extends ActuallyScalarAttributeValue>
  extends QueryCondition {
  property: string;
  operator: 'between';
  value: { from?: T; to?: T };
}

/**
 * Query condition for comparison operators.
 *
 * @category ShardQueryMap Builder
 * @protected
 */
export interface QueryConditionComparison<
  T extends ActuallyScalarAttributeValue,
> extends QueryCondition {
  property: string;
  operator: '<' | '<=' | '<>' | '=' | '>' | '>=';
  value?: T;
}

/**
 * Query condition for contains operator.
 *
 * @category ShardQueryMap Builder
 * @protected
 */
export interface QueryConditionContains<T extends NativeScalarAttributeValue>
  extends QueryCondition {
  property: string;
  operator: 'contains';
  value?: T;
}

/**
 * Query condition for attribute existence checks.
 *
 * @category ShardQueryMap Builder
 * @protected
 */
export interface QueryConditionExists extends QueryCondition {
  property: string;
  operator: 'attribute_exists' | 'attribute_not_exists';
}

/**
 * Query condition for the `in` operator.
 * Ensures that all elements in the array or set are of the same type.
 *
 * @category ShardQueryMap Builder
 * @protected
 */
export interface QueryConditionIn<T extends NativeScalarAttributeValue>
  extends QueryCondition {
  property: string;
  operator: 'in';
  value?: T[] | Set<T>;
}

/**
 * Grouping of multiple query conditions using logical operators.
 * Allows for nesting of conditions.
 *
 * @category ShardQueryMap Builder
 * @protected
 */
export interface QueryConditionGroup<T extends QueryCondition> {
  operator: 'and' | 'or';
  conditions: T[];
}

/**
 * Negation of a single filter condition.
 *
 * @category ShardQueryMap Builder
 * @protected
 */
export interface QueryConditionNot<T extends QueryCondition> {
  operator: 'not';
  condition: T;
}

export type ComposeCondition<T extends QueryCondition> = (
  builder: ShardQueryMapBuilder,
  indexToken: string,
  condition: T,
) => string | undefined;
