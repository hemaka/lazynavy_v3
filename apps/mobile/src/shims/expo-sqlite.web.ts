export async function openDatabaseAsync(): Promise<never> {
  throw new Error('expo-sqlite is unavailable on web; offline cache only runs on native platforms.')
}
