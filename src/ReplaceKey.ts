export type ReplaceKey<T, K extends keyof T, V> = Omit<T, K> & Record<K, V>;
