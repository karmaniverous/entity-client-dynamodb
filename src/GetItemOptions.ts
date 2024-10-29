import type { GetCommandInput } from '@aws-sdk/lib-dynamodb';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { EntityClient } from './EntityClient';

/**
 * Options for {@link EntityClient | `EntityClient.getItem`} method.
 *
 * @typeParam T - Item type.
 *
 * @category EntityClient
 * @protected
 */
export interface GetItemOptions {
  /** Item attributes to retrieve (undefined retrieves all attributes). */
  attributes?: string[];

  /** Determines the read consistency model: If set to `true`, then the operation uses strongly consistent reads; otherwise, the operation uses eventually consistent reads. */
  consistentRead?: GetCommandInput['ConsistentRead'];

  /**
   * <p>Determines the level of detail about either provisioned or on-demand throughput
   *             consumption that is returned in the response:</p>
   *          <ul>
   *             <li>
   *                <p>
   *                   <code>INDEXES</code> - The response includes the aggregate
   *                         <code>ConsumedCapacity</code> for the operation, together with
   *                         <code>ConsumedCapacity</code> for each table and secondary index that was
   *                     accessed.</p>
   *                <p>Note that some operations, such as <code>GetItem</code> and
   *                         <code>BatchGetItem</code>, do not access any indexes at all. In these cases,
   *                     specifying <code>INDEXES</code> will only return <code>ConsumedCapacity</code>
   *                     information for table(s).</p>
   *             </li>
   *             <li>
   *                <p>
   *                   <code>TOTAL</code> - The response includes only the aggregate
   *                         <code>ConsumedCapacity</code> for the operation.</p>
   *             </li>
   *             <li>
   *                <p>
   *                   <code>NONE</code> - No <code>ConsumedCapacity</code> details are included in the
   *                     response.</p>
   *             </li>
   *          </ul>
   */
  returnConsumedCapacity?: GetCommandInput['ReturnConsumedCapacity'];
}
