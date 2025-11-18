import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';
import type { BaseConfigMap } from '@karmaniverous/entity-manager';

import { QueryBuilder } from './QueryBuilder';

/**
 * Eliminates object types from the `NativeScalarAttributeValue` type.
 *
 * @category QueryBuilder
 * @protected
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
 * @protected
 */
export interface QueryCondition {
  operator: string;
}

/**
 * Query condition for the `begins_with` operator.
 *
 * @category QueryBuilder
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
 * @category QueryBuilder
 * @protected
 */
export interface QueryConditionBetween<V extends ActuallyScalarAttributeValue>
  extends QueryCondition {
  property: string;
  operator: 'between';
  value: { from?: V; to?: V };
}

/**
 * Query condition for comparison operators.
 *
 * @category QueryBuilder
 * @protected
 */
export interface QueryConditionComparison<
  V extends ActuallyScalarAttributeValue,
> extends QueryCondition {
  property: string;
  operator: '<' | '<=' | '<>' | '=' | '>' | '>=';
  value?: V;
}

/**
 * Query condition for contains operator.
 *
 * @category QueryBuilder
 * @protected
 */
export interface QueryConditionContains<
  V extends Exclude<NativeScalarAttributeValue, object>,
> extends QueryCondition {
  property: string;
  operator: 'contains';
  value?: V;
}

/**
 * Query condition for attribute existence checks.
 *
 * @category QueryBuilder
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
 * @category QueryBuilder
 * @protected
 */
export interface QueryConditionIn<V extends NativeScalarAttributeValue>
  extends QueryCondition {
  property: string;
  operator: 'in';
  value?: V[] | Set<V>;
}

/**
 * Grouping of multiple query conditions using logical operators.
 * Allows for nesting of conditions.
 *
 * @category QueryBuilder
 * @protected
 */
export interface QueryConditionGroup<C extends QueryCondition> {
  operator: 'and' | 'or';
  conditions: C[];
}

/**
 * Negation of a single filter condition.
 *
 * @category QueryBuilder
 * @protected
 */
export interface QueryConditionNot<C extends QueryCondition> {
  operator: 'not';
  condition: C;
}

export type ComposeCondition<
  C extends BaseConfigMap,
  Q extends QueryCondition,
> = (
  builder: QueryBuilder<C>,
  indexToken: string,
  condition: Q,
) => string | undefined;
