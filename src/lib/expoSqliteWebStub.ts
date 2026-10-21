export async function openDatabaseAsync(
  _name?: string,
  _options?: unknown,
): Promise<never> {
  throw new Error('SQLite is not used on the website.');
}

export function openDatabaseSync(_name?: string, _options?: unknown): never {
  throw new Error('SQLite is not used on the website.');
}

const sqlite = {
  openDatabaseAsync,
  openDatabaseSync,
};

export default sqlite;
