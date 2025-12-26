/**
 * Managed table properties (NOT dotenv overlays).
 *
 * Requirements addressed:
 * - `generate.tableProperties` declares a small set of non-generated DynamoDB table Properties keys as tooling-managed:
 *   - BillingMode
 *   - ProvisionedThroughput (RCU/WCU)
 *   - TableName
 * - No implicit surprises:
 *   - If ProvisionedThroughput is managed, BillingMode MUST also be managed and MUST be PROVISIONED.
 *   - If BillingMode is managed as PROVISIONED, ProvisionedThroughput must be present and complete in the effective YAML.
 */
import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

/**
 * Config shape for managed table properties (non-generated keys).
 *
 * @category get-dotenv
 */
export interface TablePropertiesConfig {
  /** Billing mode (e.g., `PAY_PER_REQUEST` or `PROVISIONED`). */
  billingMode?: string | undefined;
  /** Provisioned throughput RCU (requires billingMode=PROVISIONED). */
  readCapacityUnits?: number | string | undefined;
  /** Provisioned throughput WCU (requires billingMode=PROVISIONED). */
  writeCapacityUnits?: number | string | undefined;
  /** TableName to set in YAML (often env-expanded by get-dotenv). */
  tableName?: string | undefined;
}

/**
 * DynamoDB table Properties keys managed deterministically by tooling.
 *
 * @category get-dotenv
 */
export interface ManagedTableProperties {
  /** Managed BillingMode. */
  BillingMode?: CreateTableCommandInput['BillingMode'];
  /** Managed ProvisionedThroughput. */
  ProvisionedThroughput?: CreateTableCommandInput['ProvisionedThroughput'];
  /** Managed TableName. */
  TableName?: string;
}

/**
 * Managed properties value plus booleans indicating which keys are managed.
 *
 * @category get-dotenv
 */
export interface ManagedTablePropertiesInfo {
  /** Values to apply/validate when managed. */
  managed: ManagedTableProperties;
  /** Flags describing which keys are managed. */
  manages: {
    /** True when BillingMode is managed. */
    billingMode: boolean;
    /** True when ProvisionedThroughput is managed. */
    provisionedThroughput: boolean;
    /** True when TableName is managed. */
    tableName: boolean;
  };
}

function toPositiveInt(value: unknown, label: string): number {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return n;
}

function parseBillingMode(raw: string): CreateTableCommandInput['BillingMode'] {
  const v = raw.trim();
  if (v === 'PROVISIONED' || v === 'PAY_PER_REQUEST') return v;
  throw new Error(
    `billingMode must be one of PROVISIONED or PAY_PER_REQUEST (got ${JSON.stringify(raw)})`,
  );
}

/**
 * Resolve `generate.tableProperties` (plus any merged CLI overrides) into managed table properties.
 *
 * Returns `undefined` when no properties are managed.
 */
export function resolveManagedTableProperties(
  cfg?: TablePropertiesConfig,
): ManagedTablePropertiesInfo | undefined {
  const billingModeRaw = cfg?.billingMode;
  const rcuRaw = cfg?.readCapacityUnits;
  const wcuRaw = cfg?.writeCapacityUnits;
  const tableNameRaw = cfg?.tableName;

  const managesBillingMode = billingModeRaw !== undefined;
  const managesTableName = tableNameRaw !== undefined;
  const managesThroughput = rcuRaw !== undefined || wcuRaw !== undefined;

  // Reject partial throughput specification.
  if ((rcuRaw !== undefined) !== (wcuRaw !== undefined)) {
    throw new Error(
      'tableProperties.readCapacityUnits and tableProperties.writeCapacityUnits must be provided together',
    );
  }

  const managed: ManagedTableProperties = {};

  if (billingModeRaw !== undefined) {
    managed.BillingMode = parseBillingMode(billingModeRaw);
  }

  if (tableNameRaw !== undefined) {
    const tn = tableNameRaw.trim();
    if (!tn) throw new Error('tableProperties.tableName must be non-empty');
    managed.TableName = tn;
  }

  if (rcuRaw !== undefined && wcuRaw !== undefined) {
    // No implicit surprises: throughput management requires explicit BillingMode=PROVISIONED.
    if (!managesBillingMode || managed.BillingMode !== 'PROVISIONED') {
      throw new Error(
        'ProvisionedThroughput management requires tableProperties.billingMode=PROVISIONED',
      );
    }
    managed.ProvisionedThroughput = {
      ReadCapacityUnits: toPositiveInt(
        rcuRaw,
        'tableProperties.readCapacityUnits',
      ),
      WriteCapacityUnits: toPositiveInt(
        wcuRaw,
        'tableProperties.writeCapacityUnits',
      ),
    };
  }

  const anyManaged =
    managesBillingMode || managesTableName || managesThroughput;
  if (!anyManaged) return undefined;

  return {
    managed,
    manages: {
      billingMode: managesBillingMode,
      provisionedThroughput: rcuRaw !== undefined && wcuRaw !== undefined,
      tableName: managesTableName,
    },
  };
}

/**
 * Pick the subset of managed table properties from a parsed `Properties` object.
 *
 * This is used for drift validation (compare expected managed values vs YAML).
 *
 * @param props - Parsed table `Properties` object.
 * @returns Extracted managed table properties present in the YAML.
 *
 * @category get-dotenv
 */
export function pickManagedActualFromProperties(
  props: Record<string, unknown>,
): ManagedTableProperties {
  const out: ManagedTableProperties = {};

  const bm = props.BillingMode;
  if (typeof bm === 'string') out.BillingMode = bm as never;

  const tn = props.TableName;
  if (typeof tn === 'string') out.TableName = tn;

  const pt = props.ProvisionedThroughput;
  if (pt && typeof pt === 'object') {
    const r = (pt as Record<string, unknown>).ReadCapacityUnits;
    const w = (pt as Record<string, unknown>).WriteCapacityUnits;
    if (typeof r === 'number' && typeof w === 'number') {
      out.ProvisionedThroughput = {
        ReadCapacityUnits: r,
        WriteCapacityUnits: w,
      };
    }
  }

  return out;
}

/**
 * Validate invariants implied by managed table properties against the effective YAML Properties object.
 *
 * This is intentionally NOT full CloudFormation validation. It only enforces invariants introduced
 * by our tooling-managed knobs.
 */
export function assertManagedTablePropertiesInvariants(args: {
  info?: ManagedTablePropertiesInfo;
  effectiveProperties: Record<string, unknown>;
}): void {
  const { info, effectiveProperties } = args;
  if (!info) return;

  const bmManaged = info.managed.BillingMode;
  const ptAny = effectiveProperties.ProvisionedThroughput;

  if (bmManaged === 'PROVISIONED') {
    const pt = effectiveProperties.ProvisionedThroughput;
    const ok =
      !!pt &&
      typeof pt === 'object' &&
      typeof (pt as Record<string, unknown>).ReadCapacityUnits === 'number' &&
      typeof (pt as Record<string, unknown>).WriteCapacityUnits === 'number';
    if (!ok) {
      throw new Error(
        'BillingMode=PROVISIONED requires ProvisionedThroughput (ReadCapacityUnits and WriteCapacityUnits) to be present in table.yml',
      );
    }
  }

  if (bmManaged === 'PAY_PER_REQUEST' && ptAny !== undefined) {
    throw new Error(
      'BillingMode=PAY_PER_REQUEST is incompatible with ProvisionedThroughput in table.yml (remove ProvisionedThroughput or stop managing BillingMode)',
    );
  }
}
