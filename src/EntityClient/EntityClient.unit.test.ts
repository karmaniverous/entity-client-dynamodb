const { getItemMock, getItemsMock } = vi.hoisted(() => ({
  getItemMock: vi.fn(),
  getItemsMock: vi.fn(),
}));

vi.mock('./methods/getItem', () => ({ getItem: getItemMock }));
vi.mock('./methods/getItems', () => ({ getItems: getItemsMock }));

import { entityManager, type MyConfigMap } from '../../test/entityManager';
import { EntityClient } from './EntityClient';

function makeClient(): EntityClient<MyConfigMap> {
  return new EntityClient({
    credentials: {
      accessKeyId: 'fakeAccessKeyId',
      secretAccessKey: 'fakeSecretAccessKey',
    },
    entityManager,
    region: 'local',
    tableName: 'UnitTest',
  });
}

describe('EntityClient token-aware get wrappers', () => {
  beforeEach(() => {
    getItemMock.mockReset();
    getItemsMock.mockReset();
  });

  it('delegates getItem arguments without using the type-only entity token', async () => {
    const client = makeClient();
    const key = { hashKey2: 'user#1', rangeKey: 'profile' };
    const attributes = ['a0'] as const;
    const options = { ConsistentRead: true };
    const output = { Item: { a0: 'value' } };
    getItemMock.mockResolvedValue(output);

    await expect(
      client.getItem('user', key, attributes, options),
    ).resolves.toBe(output);

    expect(getItemMock).toHaveBeenCalledExactlyOnceWith(
      client,
      key,
      attributes,
      options,
    );
  });

  it.each([
    {
      label: 'projection attributes',
      attributesOrOptions: ['a0'] as const,
      options: undefined,
      expectedTail: [['a0'], {}],
    },
    {
      label: 'batch options',
      attributesOrOptions: { ReturnConsumedCapacity: 'TOTAL' as const },
      options: undefined,
      expectedTail: [{ ReturnConsumedCapacity: 'TOTAL' }],
    },
    {
      label: 'defaults',
      attributesOrOptions: undefined,
      options: undefined,
      expectedTail: [{}],
    },
  ])(
    'delegates getItems with $label',
    async ({ attributesOrOptions, options, expectedTail }) => {
      const client = makeClient();
      const keys = [{ hashKey2: 'user#1', rangeKey: 'profile' }];
      const output = { items: [], outputs: [] };
      getItemsMock.mockResolvedValue(output);

      await expect(
        client.getItems('user', keys, attributesOrOptions, options),
      ).resolves.toBe(output);

      expect(getItemsMock).toHaveBeenCalledExactlyOnceWith(
        client,
        keys,
        ...expectedTail,
      );
    },
  );
});
